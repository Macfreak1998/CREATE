import { Router, type Request, type Response } from "express";
import type { PoolClient } from "pg";
import { z } from "zod";
import {
  AdminCreateCompanySchema,
  AdminUpdateCompanySchema,
  AppSettingsInputSchema,
  CompanyImportSchema,
  CompanySizeInputSchema,
  CompanyStatus,
  SECTION_KEYS,
  SectionDescriptionsInputSchema,
  AdminIndustryInputSchema,
  AdminTechnologyInputSchema,
  TaxonomyInputSchema,
  IndustryGroupInputSchema,
  IndustryMoveSchema,
  TechnologyGroupInputSchema,
  TechnologyMoveSchema,
  TechnologySuggestionAcceptSchema,
  MailTemplatesInputSchema,
  TestMailInputSchema,
  CompanyAnonymousUpdateSchema,
  UpdateStatusSchema,
  type AdminCreateCompanyInput,
  type AdminCreateCompanyResponse,
  type AdminUpdateCompanyInput,
  type AppSettings,
  type AppSettingsInput,
  type CompanyImportInput,
  type AdminIndustryInput,
  type AdminTechnologyInput,
  type IndustryGroupInput,
  type IndustryMoveInput,
  type MailTemplates,
  type MailTemplatesInput,
  type SectionDescriptionsInput,
  type TechnologyGroupInput,
  type TechnologyMoveInput,
  type TechnologySuggestionAcceptInput,
  type TestMailInput,
} from "@b2b/shared";
import { query, withTransaction } from "../../db/client.js";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { requireAuth } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/require-role.js";
import { validate } from "../../middlewares/validate.js";
import { uniqueSlug } from "../../lib/slug.js";
import { generatePassword, hashPassword } from "../../lib/password.js";
import { deleteLogoFile, processLogo, uploadMemory } from "../../lib/uploads.js";
import {
  MAIL_TEMPLATE_META,
  loadMailTemplateContent,
  mailTemplateSettingKey,
  testMail,
  type MailTemplateKey,
} from "../../lib/mail-templates.js";
import {
  SETTING_ADMIN_NOTIFICATION_EMAIL,
  SETTING_SECTION_DESCRIPTION_PREFIX,
  getSetting,
  setSetting,
} from "../../lib/settings.js";
import { loadSectionDescriptions } from "../section-descriptions/router.js";
import {
  listTechnologies,
  listTechnologyGroups,
} from "../taxonomies/technologies.js";
import {
  listIndustries,
  listIndustryGroups,
} from "../taxonomies/industries.js";
import { sendMailStrict } from "../../lib/mailer.js";
import { logger } from "../../lib/logger.js";
import { adminFeedbackRouter } from "./feedback-router.js";
import { adminGraphRouter } from "../graph/admin-router.js";
import { handleCompanyStatusTransition } from "./company-approval.js";
import { notifyCompanyCredentials } from "../../lib/notifications.js";
import { exportCompanies, importCompanies } from "./import-export.js";
import {
  applyCompanyAggregateUpdates,
  createCompanyWithUser,
  getCompanyUserEmail,
  loadCompanyAdminAggregates,
  persistCompanyReviewSnapshot,
  rowToAdmin,
  updateCompanyUserEmail,
  type CompanyRow,
} from "../companies/repository.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("admin"));

const AdminCompanyListQuery = z.object({
  q: z.string().trim().max(200).optional().default(""),
  status: CompanyStatus.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// $1 = Status (NULL = alle), $2 = Suchbegriff ('' = keine Suche).
// ILIKE deckt zusaetzlich Firmen ab, deren search_tsv noch leer ist (Entwuerfe).
const ADMIN_COMPANY_LIST_WHERE = `
  ($1::text IS NULL OR c.status = $1)
    AND (
          $2 = ''
       OR c.search_tsv @@ plainto_tsquery('german', $2)
       OR c.name ILIKE '%' || $2 || '%'
       OR c.display_name ILIKE '%' || $2 || '%'
       OR c.contact_email ILIKE '%' || $2 || '%'
       OR EXISTS (
            SELECT 1 FROM users u
             WHERE u.company_id = c.id
               AND u.role = 'company'
               AND u.email ILIKE '%' || $2 || '%'
          )
     )
`;

adminRouter.get(
  "/companies/export",
  validate(
    z.object({ status: CompanyStatus.optional() }),
    "query"
  ),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as { status?: CompanyStatus };
    const data = await exportCompanies(q.status);
    const filename = `create-firmen-export-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    res.json(data);
  })
);

adminRouter.post(
  "/companies/import",
  validate(CompanyImportSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CompanyImportInput;
    const result = await importCompanies(input);
    res.json(result);
  })
);

adminRouter.get(
  "/companies",
  validate(AdminCompanyListQuery, "query"),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as z.infer<typeof AdminCompanyListQuery>;
    const offset = (q.page - 1) * q.limit;
    const status = q.status ?? null;

    const itemsResult = await query<CompanyRow>(
      `SELECT c.* FROM companies c
        WHERE ${ADMIN_COMPANY_LIST_WHERE}
        ORDER BY c.created_at DESC
        LIMIT $3 OFFSET $4`,
      [status, q.q, q.limit, offset]
    );
    const countResult = await query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM companies c
        WHERE ${ADMIN_COMPANY_LIST_WHERE}`,
      [status, q.q]
    );

    const items = await Promise.all(
      itemsResult.rows.map(async (row) => {
        const [aggregates, userEmail] = await Promise.all([
          loadCompanyAdminAggregates(row.id, row.size_id),
          getCompanyUserEmail(row.id),
        ]);
        return rowToAdmin(row, aggregates, userEmail);
      })
    );

    res.json({
      items,
      total: Number.parseInt(countResult.rows[0]?.total ?? "0", 10),
      page: q.page,
      limit: q.limit,
    });
  })
);

adminRouter.post(
  "/companies",
  validate(AdminCreateCompanySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as AdminCreateCompanyInput;

    const existing = await query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1",
      [input.user.email]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      res.status(409).json({ error: "E-Mail ist bereits registriert." });
      return;
    }

    const providedPassword = input.user.password;
    const generatedPassword = providedPassword ? null : generatePassword(16);
    const plainPassword = providedPassword ?? generatedPassword!;
    const passwordHash = await hashPassword(plainPassword);

    const { companyId } = await withTransaction(async (client) => {
      const created = await createCompanyWithUser(client, {
        company: input.company,
        user: { email: input.user.email, password_hash: passwordHash },
        status: input.company.status,
      });
      if (input.company.status === "approved") {
        await persistCompanyReviewSnapshot(client, created.companyId);
      }
      return created;
    });

    const created = await query<CompanyRow>(
      "SELECT * FROM companies WHERE id = $1",
      [companyId]
    );
    const row = created.rows[0];
    const aggregates = await loadCompanyAdminAggregates(row.id, row.size_id);

    const payload: AdminCreateCompanyResponse = {
      ...rowToAdmin(row, aggregates, input.user.email),
      generated_password:
        input.company.status === "draft" ? null : generatedPassword,
    };

    res.status(201).json(payload);
  })
);

adminRouter.get(
  "/companies/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await query<CompanyRow>(
      "SELECT * FROM companies WHERE id = $1",
      [id]
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: "Firma nicht gefunden." });
      return;
    }
    const [aggregates, userEmail] = await Promise.all([
      loadCompanyAdminAggregates(row.id, row.size_id),
      getCompanyUserEmail(row.id),
    ]);
    res.json(rowToAdmin(row, aggregates, userEmail));
  })
);

adminRouter.put(
  "/companies/:id",
  validate(AdminUpdateCompanySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const input = req.body as AdminUpdateCompanyInput;

    const previous = await query<{
      status: CompanyRow["status"];
      contact_email: string;
      name: string;
    }>(
      "SELECT status, contact_email, name FROM companies WHERE id = $1",
      [id]
    );
    if (previous.rowCount === 0) {
      res.status(404).json({ error: "Firma nicht gefunden." });
      return;
    }
    const prev = previous.rows[0];

    const emailConflict = await query<{ id: string }>(
      `SELECT id FROM users
        WHERE email = $1
          AND (company_id IS DISTINCT FROM $2)`,
      [input.user_email, id]
    );
    if (emailConflict.rowCount && emailConflict.rowCount > 0) {
      res.status(409).json({ error: "E-Mail ist bereits registriert." });
      return;
    }

    const companyUser = await query<{ id: string }>(
      `SELECT id FROM users WHERE company_id = $1 AND role = 'company'`,
      [id]
    );
    if (companyUser.rowCount === 0) {
      res.status(404).json({ error: "Kein Login-Account für diese Firma." });
      return;
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE companies
            SET name = $2,
                display_name = $3,
                description = $4,
                website_url = $5,
                street = $6,
                postal_code = $7,
                city = $8,
                country = $9,
                contact_name = $10,
                contact_position = $11,
                contact_email = $12,
                contact_phone = $13,
                status = $14,
                updated_at = now()
          WHERE id = $1`,
        [
          id,
          input.name,
          input.display_name || null,
          input.description || null,
          input.website_url || null,
          input.street || null,
          input.postal_code || null,
          input.city || null,
          input.country || null,
          input.contact_name,
          input.contact_position || null,
          input.contact_email,
          input.contact_phone || null,
          input.status,
        ]
      );
      await applyCompanyAggregateUpdates(client, id, input);
      await updateCompanyUserEmail(client, id, input.user_email);
      if (prev.status !== input.status) {
        await handleCompanyStatusTransition({
          companyId: id,
          previousStatus: prev.status,
          newStatus: input.status,
          companyName: input.name,
          contactEmail: input.contact_email,
          client,
        });
      }
    });

    const updated = await query<CompanyRow>(
      "SELECT * FROM companies WHERE id = $1",
      [id]
    );
    const row = updated.rows[0];
    const [aggregates, userEmail] = await Promise.all([
      loadCompanyAdminAggregates(row.id, row.size_id),
      getCompanyUserEmail(row.id),
    ]);
    res.json(rowToAdmin(row, aggregates, userEmail));
  })
);

adminRouter.post(
  "/companies/:id/send-credentials",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const company = await query<{
      id: string;
      name: string;
    }>("SELECT id, name FROM companies WHERE id = $1", [id]);
    if (company.rowCount === 0) {
      res.status(404).json({ error: "Firma nicht gefunden." });
      return;
    }

    const userResult = await query<{ email: string }>(
      "SELECT email FROM users WHERE company_id = $1",
      [id]
    );
    const loginEmail = userResult.rows[0]?.email;
    if (!loginEmail) {
      res.status(404).json({ error: "Kein Login-Account für diese Firma." });
      return;
    }

    const plainPassword = generatePassword(16);
    const passwordHash = await hashPassword(plainPassword);
    await query(
      `UPDATE users
          SET password_hash = $2,
              token_version = token_version + 1
        WHERE company_id = $1`,
      [id, passwordHash]
    );

    const row = company.rows[0];
    void notifyCompanyCredentials({
      companyName: row.name,
      loginEmail,
      password: plainPassword,
    });

    res.json({ ok: true });
  })
);

adminRouter.post(
  "/companies/:id/logo",
  uploadMemory.single("logo"),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!req.file) {
      res.status(400).json({ error: "Keine Datei hochgeladen." });
      return;
    }
    const existing = await query<{ id: string }>(
      "SELECT id FROM companies WHERE id = $1",
      [id]
    );
    if (existing.rowCount === 0) {
      res.status(404).json({ error: "Firma nicht gefunden." });
      return;
    }
    const logoPath = await processLogo(req.file.buffer);
    await query(
      "UPDATE companies SET logo_path = $2, updated_at = now() WHERE id = $1",
      [id, logoPath]
    );
    res.json({ ok: true, logo_path: logoPath });
  })
);

adminRouter.patch(
  "/companies/:id/anonymous",
  validate(CompanyAnonymousUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const input = req.body as z.infer<typeof CompanyAnonymousUpdateSchema>;
    const updated = await query<{ anonymous: boolean }>(
      `UPDATE companies
          SET anonymous = $2, updated_at = now()
        WHERE id = $1
        RETURNING anonymous`,
      [id, input.anonymous]
    );
    if (updated.rowCount === 0) {
      res.status(404).json({ error: "Firma nicht gefunden." });
      return;
    }
    res.json({ anonymous: updated.rows[0].anonymous });
  })
);

adminRouter.patch(
  "/companies/:id/status",
  validate(UpdateStatusSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const input = req.body as z.infer<typeof UpdateStatusSchema>;

    const previous = await query<{
      status: CompanyRow["status"];
      contact_email: string;
      name: string;
    }>("SELECT status, contact_email, name FROM companies WHERE id = $1", [id]);
    if (previous.rowCount === 0) {
      res.status(404).json({ error: "Firma nicht gefunden." });
      return;
    }
    const prev = previous.rows[0];

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE companies SET status = $2, updated_at = now() WHERE id = $1`,
        [id, input.status]
      );
      if (prev.status !== input.status) {
        await handleCompanyStatusTransition({
          companyId: id,
          previousStatus: prev.status,
          newStatus: input.status,
          companyName: prev.name,
          contactEmail: prev.contact_email,
          client,
        });
      }
    });

    res.json({ ok: true });
  })
);

// Endgueltiges Loeschen nur fuer abgelehnte Firmen (suspended).
// CASCADE entfernt User, Relationen und Passwort-Resets.
adminRouter.delete(
  "/companies/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const existing = await query<{
      id: string;
      status: CompanyRow["status"];
      logo_path: string | null;
    }>("SELECT id, status, logo_path FROM companies WHERE id = $1", [id]);
    if (existing.rowCount === 0) {
      res.status(404).json({ error: "Firma nicht gefunden." });
      return;
    }
    const company = existing.rows[0];
    if (company.status !== "suspended") {
      res.status(409).json({
        error:
          "Nur abgelehnte Firmen können endgültig gelöscht werden. Bitte zuerst ablehnen.",
      });
      return;
    }

    const result = await query("DELETE FROM companies WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Firma nicht gefunden." });
      return;
    }

    await deleteLogoFile(company.logo_path);
    res.json({ ok: true });
  })
);

// Markiert das aktuelle Profil als "geprueft", ohne den Status zu aendern.
// Setzt den Diff-Snapshot zurueck, sodass das Highlight wieder leer ist.
adminRouter.post(
  "/companies/:id/mark-reviewed",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const existing = await query<{ id: string }>(
      "SELECT id FROM companies WHERE id = $1",
      [id]
    );
    if (existing.rowCount === 0) {
      res.status(404).json({ error: "Firma nicht gefunden." });
      return;
    }
    await withTransaction((client) => persistCompanyReviewSnapshot(client, id));
    res.json({ ok: true });
  })
);

// Technologie-Vorschlaege uebergreifend listen und verwalten.
adminRouter.get(
  "/technology-suggestions",
  asyncHandler(async (req: Request, res: Response) => {
    const status = (req.query.status as string | undefined) ?? "open";
    const allowed = ["open", "accepted", "rejected", "all"];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: "Ungueltiger Status-Filter." });
      return;
    }
    const result = await query<{
      id: string;
      company_id: string;
      company_name: string;
      name: string;
      notes: string | null;
      trl: number | null;
      status: string;
      created_at: Date;
    }>(
      `SELECT s.id, s.company_id, c.name AS company_name, s.name, s.notes,
              s.trl, s.status, s.created_at
         FROM company_technology_suggestions s
         JOIN companies c ON c.id = s.company_id
        WHERE ($1::text = 'all' OR s.status = $1::text)
        ORDER BY s.created_at DESC`,
      [status]
    );
    res.json({
      items: result.rows.map((r) => ({
        id: r.id,
        company_id: r.company_id,
        company_name: r.company_name,
        name: r.name,
        notes: r.notes,
        trl: r.trl,
        status: r.status,
        created_at: r.created_at.toISOString(),
      })),
    });
  })
);

adminRouter.post(
  "/technology-suggestions/:id/accept",
  validate(TechnologySuggestionAcceptSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const input = req.body as TechnologySuggestionAcceptInput;

    const suggestion = await query<{
      id: string;
      company_id: string;
      name: string;
      notes: string | null;
      trl: number | null;
    }>(
      "SELECT id, company_id, name, notes, trl FROM company_technology_suggestions WHERE id = $1",
      [id]
    );
    if (suggestion.rowCount === 0) {
      res.status(404).json({ error: "Vorschlag nicht gefunden." });
      return;
    }
    const s = suggestion.rows[0];

    const suggestionId = id;
    const techId = await withTransaction(async (client) => {
      // Existierende Technologie mit demselben Namen wiederverwenden,
      // falls vorhanden (case-insensitive Vergleich), sonst neu anlegen.
      const existingTech = await client.query<{ id: number }>(
        "SELECT id FROM technologies WHERE lower(name) = lower($1) LIMIT 1",
        [input.name]
      );
      let technologyId: number;
      if (existingTech.rowCount && existingTech.rowCount > 0) {
        technologyId = existingTech.rows[0].id;
      } else {
        const slugs = await client.query<{ slug: string }>(
          "SELECT slug FROM technologies"
        );
        const slug = uniqueSlug(
          input.name,
          new Set(slugs.rows.map((r) => r.slug))
        );
        const nextSort = await client.query<{ pos: number }>(
          `SELECT COALESCE(MAX(sort_order), 0) + 10 AS pos
             FROM technologies
            WHERE group_id IS NOT DISTINCT FROM $1`,
          [input.group_id]
        );
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO technologies (slug, name, group_id, sort_order)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [slug, input.name, input.group_id, nextSort.rows[0]?.pos ?? 10]
        );
        technologyId = inserted.rows[0].id;
      }

      if (input.link_to_company !== false) {
        await client.query(
          `INSERT INTO company_technologies (company_id, technology_id, trl, notes)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (company_id, technology_id) DO UPDATE
             SET trl = COALESCE(EXCLUDED.trl, company_technologies.trl),
                 notes = COALESCE(EXCLUDED.notes, company_technologies.notes)`,
          [
            s.company_id,
            technologyId,
            input.trl ?? s.trl ?? null,
            input.notes || s.notes || null,
          ]
        );
        await client.query("SELECT companies_refresh_search_tsv($1)", [
          s.company_id,
        ]);
      }

      await client.query(
        "UPDATE company_technology_suggestions SET status = 'accepted' WHERE id = $1",
        [suggestionId]
      );
      return technologyId;
    });

    res.json({ ok: true, technology_id: techId });
  })
);

adminRouter.post(
  "/technology-suggestions/:id/reject",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await query(
      "UPDATE company_technology_suggestions SET status = 'rejected' WHERE id = $1",
      [id]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Vorschlag nicht gefunden." });
      return;
    }
    res.json({ ok: true });
  })
);

adminRouter.delete(
  "/technology-suggestions/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await query(
      "DELETE FROM company_technology_suggestions WHERE id = $1",
      [id]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Vorschlag nicht gefunden." });
      return;
    }
    res.json({ ok: true });
  })
);

type SimpleTax = "machines" | "knowhows";

// Nummeriert eine Gruppe (inkl. der Sammelgruppe group_id IS NULL) neu durch,
// damit sort_order eindeutig ist und die Auf-/Ab-Buttons eindeutige Nachbarn
// finden. Schrittweite 10 laesst Raum fuer manuelle Korrekturen.
async function renumberTechnologyGroup(
  client: PoolClient,
  groupId: number | null
): Promise<void> {
  await client.query(
    `WITH ordered AS (
       SELECT id, row_number() OVER (ORDER BY sort_order, name) * 10 AS pos
         FROM technologies
        WHERE group_id IS NOT DISTINCT FROM $1
     )
     UPDATE technologies t
        SET sort_order = o.pos
       FROM ordered o
      WHERE o.id = t.id AND t.sort_order <> o.pos`,
    [groupId]
  );
}

async function nextTechnologySortOrder(
  groupId: number | null
): Promise<number> {
  const result = await query<{ pos: number }>(
    `SELECT COALESCE(MAX(sort_order), 0) + 10 AS pos
       FROM technologies
      WHERE group_id IS NOT DISTINCT FROM $1`,
    [groupId]
  );
  return result.rows[0]?.pos ?? 10;
}

async function renumberIndustryGroup(
  client: PoolClient,
  groupId: number | null
): Promise<void> {
  await client.query(
    `WITH ordered AS (
       SELECT id, row_number() OVER (ORDER BY sort_order, name) * 10 AS pos
         FROM industries
        WHERE group_id IS NOT DISTINCT FROM $1
     )
     UPDATE industries i
        SET sort_order = o.pos
       FROM ordered o
      WHERE o.id = i.id AND i.sort_order <> o.pos`,
    [groupId]
  );
}

async function nextIndustrySortOrder(groupId: number | null): Promise<number> {
  const result = await query<{ pos: number }>(
    `SELECT COALESCE(MAX(sort_order), 0) + 10 AS pos
       FROM industries
      WHERE group_id IS NOT DISTINCT FROM $1`,
    [groupId]
  );
  return result.rows[0]?.pos ?? 10;
}

function technologiesAdminRouter(): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (_req: Request, res: Response) => {
      res.json(await listTechnologies());
    })
  );

  router.post(
    "/",
    validate(AdminTechnologyInputSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { name, group_id } = req.body as AdminTechnologyInput;
      const existing = await query<{ slug: string }>(
        "SELECT slug FROM technologies"
      );
      const slug = uniqueSlug(name, new Set(existing.rows.map((r) => r.slug)));
      const sortOrder = await nextTechnologySortOrder(group_id);
      await query(
        `INSERT INTO technologies (slug, name, group_id, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [slug, name, group_id, sortOrder]
      );
      res.status(201).json(await listTechnologies());
    })
  );

  router.patch(
    "/:id",
    validate(AdminTechnologyInputSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { name, group_id } = req.body as AdminTechnologyInput;
      const current = await query<{ group_id: number | null }>(
        "SELECT group_id FROM technologies WHERE id = $1",
        [req.params.id]
      );
      if (current.rowCount === 0) {
        res.status(404).json({ error: "Eintrag nicht gefunden." });
        return;
      }
      const existing = await query<{ slug: string }>(
        "SELECT slug FROM technologies WHERE id <> $1",
        [req.params.id]
      );
      const newSlug = uniqueSlug(
        name,
        new Set(existing.rows.map((r) => r.slug))
      );
      // Beim Gruppenwechsel ans Ende der Zielgruppe einsortieren.
      const groupChanged = current.rows[0].group_id !== group_id;
      const sortOrder = groupChanged
        ? await nextTechnologySortOrder(group_id)
        : null;
      await query(
        `UPDATE technologies
            SET name = $2,
                slug = $3,
                group_id = $4,
                sort_order = COALESCE($5, sort_order)
          WHERE id = $1`,
        [req.params.id, name, newSlug, group_id, sortOrder]
      );
      res.json(await listTechnologies());
    })
  );

  router.post(
    "/:id/move",
    validate(TechnologyMoveSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { direction } = req.body as TechnologyMoveInput;
      const found = await withTransaction(async (client) => {
        const current = await client.query<{
          group_id: number | null;
          sort_order: number;
        }>("SELECT group_id, sort_order FROM technologies WHERE id = $1", [
          req.params.id,
        ]);
        if (current.rowCount === 0) return false;

        const groupId = current.rows[0].group_id;
        await renumberTechnologyGroup(client, groupId);

        const fresh = await client.query<{ sort_order: number }>(
          "SELECT sort_order FROM technologies WHERE id = $1",
          [req.params.id]
        );
        const sortOrder = fresh.rows[0].sort_order;
        const neighbour = await client.query<{
          id: number;
          sort_order: number;
        }>(
          `SELECT id, sort_order FROM technologies
            WHERE group_id IS NOT DISTINCT FROM $1
              AND sort_order ${direction === "up" ? "<" : ">"} $2
            ORDER BY sort_order ${direction === "up" ? "DESC" : "ASC"}
            LIMIT 1`,
          [groupId, sortOrder]
        );
        // Am Rand der Gruppe passiert nichts.
        if (neighbour.rowCount === 0) return true;

        await client.query(
          "UPDATE technologies SET sort_order = $2 WHERE id = $1",
          [req.params.id, neighbour.rows[0].sort_order]
        );
        await client.query(
          "UPDATE technologies SET sort_order = $2 WHERE id = $1",
          [neighbour.rows[0].id, sortOrder]
        );
        return true;
      });

      if (!found) {
        res.status(404).json({ error: "Eintrag nicht gefunden." });
        return;
      }
      res.json(await listTechnologies());
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req: Request, res: Response) => {
      const result = await query("DELETE FROM technologies WHERE id = $1", [
        req.params.id,
      ]);
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Eintrag nicht gefunden." });
        return;
      }
      const affected = await query<{ company_id: string }>(
        "SELECT DISTINCT company_id FROM company_technologies"
      );
      for (const row of affected.rows) {
        await query("SELECT companies_refresh_search_tsv($1)", [row.company_id]);
      }
      res.json({ ok: true });
    })
  );

  return router;
}

function technologyGroupsAdminRouter(): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (_req: Request, res: Response) => {
      res.json(await listTechnologyGroups());
    })
  );

  router.post(
    "/",
    validate(TechnologyGroupInputSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { name, description, sort_order } =
        req.body as TechnologyGroupInput;
      const existing = await query<{ slug: string }>(
        "SELECT slug FROM technology_groups"
      );
      const slug = uniqueSlug(name, new Set(existing.rows.map((r) => r.slug)));
      await query(
        `INSERT INTO technology_groups (slug, name, description, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [slug, name, description || null, sort_order]
      );
      res.status(201).json(await listTechnologyGroups());
    })
  );

  router.patch(
    "/:id",
    validate(TechnologyGroupInputSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { name, description, sort_order } =
        req.body as TechnologyGroupInput;
      const existing = await query<{ slug: string }>(
        "SELECT slug FROM technology_groups WHERE id <> $1",
        [req.params.id]
      );
      const newSlug = uniqueSlug(
        name,
        new Set(existing.rows.map((r) => r.slug))
      );
      const result = await query(
        `UPDATE technology_groups
            SET name = $2, slug = $3, description = $4, sort_order = $5
          WHERE id = $1`,
        [req.params.id, name, newSlug, description || null, sort_order]
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Gruppe nicht gefunden." });
        return;
      }
      res.json(await listTechnologyGroups());
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req: Request, res: Response) => {
      // technologies.group_id faellt per ON DELETE SET NULL zurueck in die
      // Sammelgruppe "Ohne Gruppe"; die Technologien selbst bleiben erhalten.
      const result = await query("DELETE FROM technology_groups WHERE id = $1", [
        req.params.id,
      ]);
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Gruppe nicht gefunden." });
        return;
      }
      res.json({ ok: true });
    })
  );

  return router;
}

function industriesAdminRouter(): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (_req: Request, res: Response) => {
      res.json(await listIndustries());
    })
  );

  router.post(
    "/",
    validate(AdminIndustryInputSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { name, group_id } = req.body as AdminIndustryInput;
      const existing = await query<{ slug: string }>(
        "SELECT slug FROM industries"
      );
      const slug = uniqueSlug(name, new Set(existing.rows.map((r) => r.slug)));
      const sortOrder = await nextIndustrySortOrder(group_id);
      await query(
        `INSERT INTO industries (slug, name, group_id, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [slug, name, group_id, sortOrder]
      );
      res.status(201).json(await listIndustries());
    })
  );

  router.patch(
    "/:id",
    validate(AdminIndustryInputSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { name, group_id } = req.body as AdminIndustryInput;
      const current = await query<{ group_id: number | null }>(
        "SELECT group_id FROM industries WHERE id = $1",
        [req.params.id]
      );
      if (current.rowCount === 0) {
        res.status(404).json({ error: "Eintrag nicht gefunden." });
        return;
      }
      const existing = await query<{ slug: string }>(
        "SELECT slug FROM industries WHERE id <> $1",
        [req.params.id]
      );
      const newSlug = uniqueSlug(
        name,
        new Set(existing.rows.map((r) => r.slug))
      );
      const groupChanged = current.rows[0].group_id !== group_id;
      const sortOrder = groupChanged
        ? await nextIndustrySortOrder(group_id)
        : null;
      await query(
        `UPDATE industries
            SET name = $2,
                slug = $3,
                group_id = $4,
                sort_order = COALESCE($5, sort_order)
          WHERE id = $1`,
        [req.params.id, name, newSlug, group_id, sortOrder]
      );
      res.json(await listIndustries());
    })
  );

  router.post(
    "/:id/move",
    validate(IndustryMoveSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { direction } = req.body as IndustryMoveInput;
      const found = await withTransaction(async (client) => {
        const current = await client.query<{
          group_id: number | null;
          sort_order: number;
        }>("SELECT group_id, sort_order FROM industries WHERE id = $1", [
          req.params.id,
        ]);
        if (current.rowCount === 0) return false;

        const groupId = current.rows[0].group_id;
        await renumberIndustryGroup(client, groupId);

        const fresh = await client.query<{ sort_order: number }>(
          "SELECT sort_order FROM industries WHERE id = $1",
          [req.params.id]
        );
        const sortOrder = fresh.rows[0].sort_order;
        const neighbour = await client.query<{
          id: number;
          sort_order: number;
        }>(
          `SELECT id, sort_order FROM industries
            WHERE group_id IS NOT DISTINCT FROM $1
              AND sort_order ${direction === "up" ? "<" : ">"} $2
            ORDER BY sort_order ${direction === "up" ? "DESC" : "ASC"}
            LIMIT 1`,
          [groupId, sortOrder]
        );
        if (neighbour.rowCount === 0) return true;

        await client.query(
          "UPDATE industries SET sort_order = $2 WHERE id = $1",
          [req.params.id, neighbour.rows[0].sort_order]
        );
        await client.query(
          "UPDATE industries SET sort_order = $2 WHERE id = $1",
          [neighbour.rows[0].id, sortOrder]
        );
        return true;
      });

      if (!found) {
        res.status(404).json({ error: "Eintrag nicht gefunden." });
        return;
      }
      res.json(await listIndustries());
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req: Request, res: Response) => {
      const result = await query("DELETE FROM industries WHERE id = $1", [
        req.params.id,
      ]);
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Eintrag nicht gefunden." });
        return;
      }
      const affected = await query<{ company_id: string }>(
        "SELECT DISTINCT company_id FROM company_industries"
      );
      for (const row of affected.rows) {
        await query("SELECT companies_refresh_search_tsv($1)", [row.company_id]);
      }
      res.json({ ok: true });
    })
  );

  return router;
}

function industryGroupsAdminRouter(): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (_req: Request, res: Response) => {
      res.json(await listIndustryGroups());
    })
  );

  router.post(
    "/",
    validate(IndustryGroupInputSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { name, description, sort_order } =
        req.body as IndustryGroupInput;
      const existing = await query<{ slug: string }>(
        "SELECT slug FROM industry_groups"
      );
      const slug = uniqueSlug(name, new Set(existing.rows.map((r) => r.slug)));
      await query(
        `INSERT INTO industry_groups (slug, name, description, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [slug, name, description || null, sort_order]
      );
      res.status(201).json(await listIndustryGroups());
    })
  );

  router.patch(
    "/:id",
    validate(IndustryGroupInputSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { name, description, sort_order } =
        req.body as IndustryGroupInput;
      const existing = await query<{ slug: string }>(
        "SELECT slug FROM industry_groups WHERE id <> $1",
        [req.params.id]
      );
      const newSlug = uniqueSlug(
        name,
        new Set(existing.rows.map((r) => r.slug))
      );
      const result = await query(
        `UPDATE industry_groups
            SET name = $2, slug = $3, description = $4, sort_order = $5
          WHERE id = $1`,
        [req.params.id, name, newSlug, description || null, sort_order]
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Gruppe nicht gefunden." });
        return;
      }
      res.json(await listIndustryGroups());
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req: Request, res: Response) => {
      const result = await query("DELETE FROM industry_groups WHERE id = $1", [
        req.params.id,
      ]);
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Gruppe nicht gefunden." });
        return;
      }
      res.json({ ok: true });
    })
  );

  return router;
}

function taxonomyCrudRouter(table: SimpleTax): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (_req: Request, res: Response) => {
      const result = await query(
        `SELECT id, slug, name FROM ${table} ORDER BY name`
      );
      res.json(result.rows);
    })
  );

  router.post(
    "/",
    validate(TaxonomyInputSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { name } = req.body as z.infer<typeof TaxonomyInputSchema>;
      const existing = await query<{ slug: string }>(
        `SELECT slug FROM ${table}`
      );
      const slug = uniqueSlug(name, new Set(existing.rows.map((r) => r.slug)));
      const result = await query<{ id: number; slug: string; name: string }>(
        `INSERT INTO ${table} (slug, name) VALUES ($1, $2) RETURNING id, slug, name`,
        [slug, name]
      );
      res.status(201).json(result.rows[0]);
    })
  );

  router.patch(
    "/:id",
    validate(TaxonomyInputSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { name } = req.body as z.infer<typeof TaxonomyInputSchema>;
      const existing = await query<{ slug: string; id: number }>(
        `SELECT id, slug FROM ${table} WHERE id <> $1`,
        [req.params.id]
      );
      const newSlug = uniqueSlug(name, new Set(existing.rows.map((r) => r.slug)));
      const result = await query<{ id: number; slug: string; name: string }>(
        `UPDATE ${table} SET name = $2, slug = $3 WHERE id = $1 RETURNING id, slug, name`,
        [req.params.id, name, newSlug]
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Eintrag nicht gefunden." });
        return;
      }
      res.json(result.rows[0]);
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req: Request, res: Response) => {
      const result = await query(`DELETE FROM ${table} WHERE id = $1`, [
        req.params.id,
      ]);
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Eintrag nicht gefunden." });
        return;
      }
      const companyTable: Record<SimpleTax, string> = {
        machines: "company_machines",
        knowhows: "company_knowhows",
      };
      const affected = await query<{ company_id: string }>(
        `SELECT DISTINCT company_id FROM ${companyTable[table]}`
      );
      for (const row of affected.rows) {
        await query("SELECT companies_refresh_search_tsv($1)", [row.company_id]);
      }
      res.json({ ok: true });
    })
  );

  return router;
}

function companySizesAdminRouter(): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (_req: Request, res: Response) => {
      const result = await query(
        `SELECT id, slug, name, sort_order FROM company_sizes ORDER BY sort_order, name`
      );
      res.json(result.rows);
    })
  );

  router.post(
    "/",
    validate(CompanySizeInputSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { name, sort_order } = req.body as z.infer<
        typeof CompanySizeInputSchema
      >;
      const existing = await query<{ slug: string }>(
        `SELECT slug FROM company_sizes`
      );
      const slug = uniqueSlug(name, new Set(existing.rows.map((r) => r.slug)));
      const result = await query<{
        id: number;
        slug: string;
        name: string;
        sort_order: number;
      }>(
        `INSERT INTO company_sizes (slug, name, sort_order) VALUES ($1, $2, $3) RETURNING id, slug, name, sort_order`,
        [slug, name, sort_order ?? 0]
      );
      res.status(201).json(result.rows[0]);
    })
  );

  router.patch(
    "/:id",
    validate(CompanySizeInputSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { name, sort_order } = req.body as z.infer<
        typeof CompanySizeInputSchema
      >;
      const existing = await query<{ slug: string }>(
        `SELECT slug FROM company_sizes WHERE id <> $1`,
        [req.params.id]
      );
      const newSlug = uniqueSlug(name, new Set(existing.rows.map((r) => r.slug)));
      const result = await query<{
        id: number;
        slug: string;
        name: string;
        sort_order: number;
      }>(
        `UPDATE company_sizes SET name = $2, slug = $3, sort_order = $4 WHERE id = $1 RETURNING id, slug, name, sort_order`,
        [req.params.id, name, newSlug, sort_order ?? 0]
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Eintrag nicht gefunden." });
        return;
      }
      res.json(result.rows[0]);
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req: Request, res: Response) => {
      const result = await query(`DELETE FROM company_sizes WHERE id = $1`, [
        req.params.id,
      ]);
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Eintrag nicht gefunden." });
        return;
      }
      res.json({ ok: true });
    })
  );

  return router;
}

adminRouter.use("/technologies", technologiesAdminRouter());
adminRouter.use("/technology-groups", technologyGroupsAdminRouter());
adminRouter.use("/machines", taxonomyCrudRouter("machines"));
adminRouter.use("/industries", industriesAdminRouter());
adminRouter.use("/industry-groups", industryGroupsAdminRouter());
adminRouter.use("/knowhows", taxonomyCrudRouter("knowhows"));
adminRouter.use("/company-sizes", companySizesAdminRouter());
adminRouter.use("/feedback", adminFeedbackRouter);
adminRouter.use("/graph", adminGraphRouter);

adminRouter.get(
  "/settings",
  asyncHandler(async (_req: Request, res: Response) => {
    const adminEmail = await getSetting(SETTING_ADMIN_NOTIFICATION_EMAIL);
    const payload: AppSettings = {
      admin_notification_email: adminEmail,
    };
    res.json(payload);
  })
);

adminRouter.put(
  "/settings",
  validate(AppSettingsInputSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as AppSettingsInput;
    await setSetting(
      SETTING_ADMIN_NOTIFICATION_EMAIL,
      input.admin_notification_email
    );
    const payload: AppSettings = {
      admin_notification_email: input.admin_notification_email,
    };
    res.json(payload);
  })
);

adminRouter.post(
  "/settings/test-mail",
  validate(TestMailInputSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as TestMailInput;
    try {
      await sendMailStrict(await testMail({ to: input.email }));
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err, to: input.email }, "Test-Mail-Versand fehlgeschlagen");
      res.status(502).json({
        error:
          "E-Mail konnte nicht versendet werden. Bitte SMTP-Konfiguration prüfen.",
      });
    }
  })
);

adminRouter.get(
  "/mail-templates",
  asyncHandler(async (_req: Request, res: Response) => {
    const templates = [];
    for (const meta of MAIL_TEMPLATE_META) {
      const content = await loadMailTemplateContent(meta.key);
      templates.push({
        key: meta.key,
        label: meta.label,
        placeholders: meta.placeholders,
        subject: content.subject,
        body: content.body,
        default_subject: meta.defaultSubject,
        default_body: meta.defaultBody,
      });
    }
    const payload: MailTemplates = { templates };
    res.json(payload);
  })
);

adminRouter.put(
  "/mail-templates",
  validate(MailTemplatesInputSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as MailTemplatesInput;
    for (const entry of input.templates) {
      await setSetting(
        mailTemplateSettingKey(entry.key as MailTemplateKey, "subject"),
        entry.subject.trim() || null
      );
      await setSetting(
        mailTemplateSettingKey(entry.key as MailTemplateKey, "body"),
        entry.body.trim() || null
      );
    }
    const templates = [];
    for (const meta of MAIL_TEMPLATE_META) {
      const content = await loadMailTemplateContent(meta.key);
      templates.push({
        key: meta.key,
        label: meta.label,
        placeholders: meta.placeholders,
        subject: content.subject,
        body: content.body,
        default_subject: meta.defaultSubject,
        default_body: meta.defaultBody,
      });
    }
    res.json({ templates } satisfies MailTemplates);
  })
);

adminRouter.get(
  "/section-descriptions",
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(await loadSectionDescriptions());
  })
);

adminRouter.put(
  "/section-descriptions",
  validate(SectionDescriptionsInputSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as SectionDescriptionsInput;
    // Nur bekannte Abschnitte schreiben; leere Texte werden als NULL entfernt.
    for (const key of SECTION_KEYS) {
      const text = input.descriptions[key];
      if (text === undefined) continue;
      await setSetting(
        `${SETTING_SECTION_DESCRIPTION_PREFIX}${key}`,
        text || null
      );
    }
    res.json(await loadSectionDescriptions());
  })
);

adminRouter.get(
  "/stats",
  asyncHandler(async (_req: Request, res: Response) => {
  const [byStatus, totals, topTech, topMachines, topIndustries, topKnowhows, perWeek] =
    await Promise.all([
      query<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::text AS count FROM companies GROUP BY status`
      ),
      query<{ total_companies: string; total_users: string }>(
        `SELECT (SELECT COUNT(*)::text FROM companies) AS total_companies,
                (SELECT COUNT(*)::text FROM users) AS total_users`
      ),
      query<{ id: number; name: string; count: string }>(
        `SELECT t.id, t.name, COUNT(ct.company_id)::text AS count
           FROM technologies t
           LEFT JOIN company_technologies ct ON ct.technology_id = t.id
           GROUP BY t.id, t.name
           ORDER BY COUNT(ct.company_id) DESC, t.name
           LIMIT 10`
      ),
      query<{ id: number; name: string; count: string }>(
        `SELECT m.id, m.name, COUNT(cm.company_id)::text AS count
           FROM machines m
           LEFT JOIN company_machines cm ON cm.machine_id = m.id
           GROUP BY m.id, m.name
           ORDER BY COUNT(cm.company_id) DESC, m.name
           LIMIT 10`
      ),
      query<{ id: number; name: string; count: string }>(
        `SELECT i.id, i.name, COUNT(ci.company_id)::text AS count
           FROM industries i
           LEFT JOIN company_industries ci ON ci.industry_id = i.id
           GROUP BY i.id, i.name
           ORDER BY COUNT(ci.company_id) DESC, i.name
           LIMIT 10`
      ),
      query<{ id: number; name: string; count: string }>(
        `SELECT k.id, k.name, COUNT(ck.company_id)::text AS count
           FROM knowhows k
           LEFT JOIN company_knowhows ck ON ck.knowhow_id = k.id AND ck.score > 0
           GROUP BY k.id, k.name
           ORDER BY COUNT(ck.company_id) DESC, k.name
           LIMIT 10`
      ),
      query<{ week: string; count: string }>(
        `SELECT to_char(date_trunc('week', created_at), 'IYYY-IW') AS week,
                COUNT(*)::text AS count
           FROM companies
          WHERE created_at >= now() - interval '12 weeks'
          GROUP BY 1
          ORDER BY 1`
      ),
    ]);

  const companies_by_status: Record<string, number> = {
    draft: 0,
    pending: 0,
    approved: 0,
    suspended: 0,
  };
  for (const row of byStatus.rows) {
    companies_by_status[row.status] = Number.parseInt(row.count, 10);
  }

  res.json({
    companies_by_status,
    total_companies: Number.parseInt(totals.rows[0]?.total_companies ?? "0", 10),
    total_users: Number.parseInt(totals.rows[0]?.total_users ?? "0", 10),
    top_technologies: topTech.rows.map((r) => ({
      id: r.id,
      name: r.name,
      count: Number.parseInt(r.count, 10),
    })),
    top_machines: topMachines.rows.map((r) => ({
      id: r.id,
      name: r.name,
      count: Number.parseInt(r.count, 10),
    })),
    top_industries: topIndustries.rows.map((r) => ({
      id: r.id,
      name: r.name,
      count: Number.parseInt(r.count, 10),
    })),
    top_knowhows: topKnowhows.rows.map((r) => ({
      id: r.id,
      name: r.name,
      count: Number.parseInt(r.count, 10),
    })),
    registrations_per_week: perWeek.rows.map((r) => ({
      week: r.week,
      count: Number.parseInt(r.count, 10),
    })),
  });
  })
);

adminRouter.get(
  "/analytics",
  asyncHandler(async (_req: Request, res: Response) => {
    const [pageviews, dwell, topCompanies] = await Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM analytics_pageviews`
      ),
      query<{ total: string; avg: string }>(
        `SELECT COALESCE(SUM(seconds), 0)::text AS total,
                COALESCE(AVG(seconds), 0)::text AS avg
           FROM analytics_dwell`
      ),
      query<{
        company_id: string;
        name: string;
        slug: string;
        views: string;
      }>(
        `SELECT ap.company_id, c.name, c.slug, COUNT(*)::text AS views
           FROM analytics_pageviews ap
           JOIN companies c ON c.id = ap.company_id
          WHERE ap.company_id IS NOT NULL
          GROUP BY ap.company_id, c.name, c.slug
          ORDER BY COUNT(*) DESC, c.name
          LIMIT 20`
      ),
    ]);

    res.json({
      total_pageviews: Number.parseInt(pageviews.rows[0]?.count ?? "0", 10),
      total_dwell_seconds: Number.parseInt(dwell.rows[0]?.total ?? "0", 10),
      avg_dwell_seconds: Number.parseFloat(dwell.rows[0]?.avg ?? "0"),
      top_companies: topCompanies.rows.map((r) => ({
        company_id: r.company_id,
        name: r.name,
        slug: r.slug,
        views: Number.parseInt(r.views, 10),
      })),
    });
  })
);
