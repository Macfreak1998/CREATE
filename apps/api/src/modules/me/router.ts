import { Router, type Request, type Response } from "express";
import { UpdateCompanySchema, type UpdateCompanyInput } from "@b2b/shared";
import { query, withTransaction } from "../../db/client.js";
import { processLogo, uploadMemory } from "../../lib/uploads.js";
import { notifyAdminPendingCompany } from "../../lib/notifications.js";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { requireAuth } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import {
  applyCompanyAggregateUpdates,
  getCompanyUserEmail,
  loadCompanyOwnAggregates,
  rowToOwn,
  updateCompanyUserEmail,
  type CompanyRow,
} from "../companies/repository.js";

export const meRouter = Router();

meRouter.use(requireAuth);

meRouter.get(
  "/company",
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = req.session!.company_id;
    if (!companyId) {
      res.status(404).json({ error: "Kein Unternehmen zugeordnet." });
      return;
    }
    const result = await query<CompanyRow>(
      "SELECT * FROM companies WHERE id = $1",
      [companyId]
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: "Unternehmen nicht gefunden." });
      return;
    }
    const [aggregates, userEmail] = await Promise.all([
      loadCompanyOwnAggregates(row.id, row.size_id),
      getCompanyUserEmail(row.id),
    ]);
    if (!userEmail) {
      res.status(404).json({ error: "Kein Login-Account für dieses Unternehmen." });
      return;
    }
    res.json({
      ...rowToOwn(row, aggregates),
      status: row.status,
      user_email: userEmail,
    });
  })
);

meRouter.put(
  "/company",
  validate(UpdateCompanySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = req.session!.company_id;
    if (!companyId) {
      res.status(404).json({ error: "Kein Unternehmen zugeordnet." });
      return;
    }
    const input = req.body as UpdateCompanyInput;

    const emailConflict = await query<{ id: string }>(
      `SELECT id FROM users
        WHERE email = $1
          AND (company_id IS DISTINCT FROM $2)`,
      [input.user_email, companyId]
    );
    if (emailConflict.rowCount && emailConflict.rowCount > 0) {
      res.status(409).json({ error: "E-Mail ist bereits registriert." });
      return;
    }

    const companyUser = await query<{ id: string }>(
      `SELECT id FROM users WHERE company_id = $1 AND role = 'company'`,
      [companyId]
    );
    if (companyUser.rowCount === 0) {
      res.status(404).json({
        error: "Kein Login-Account für dieses Unternehmen.",
      });
      return;
    }

    await withTransaction(async (client) => {
      // Bei jeder Änderung wird der Status auf 'pending' zurückgesetzt,
      // damit das aktualisierte Profil erst nach Admin-Freigabe oeffentlich ist.
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
                status = 'pending',
                updated_at = now()
          WHERE id = $1`,
        [
          companyId,
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
        ]
      );
      await applyCompanyAggregateUpdates(client, companyId, input);
      await updateCompanyUserEmail(client, companyId, input.user_email);
    });

    const refreshed = await query<CompanyRow>(
      "SELECT * FROM companies WHERE id = $1",
      [companyId]
    );
    const updatedRow = refreshed.rows[0];
    const aggregates = updatedRow
      ? await loadCompanyOwnAggregates(updatedRow.id, updatedRow.size_id)
      : null;
    const userEmail = updatedRow
      ? await getCompanyUserEmail(updatedRow.id)
      : null;

    // PUT /me/company setzt den Status immer zurueck auf 'pending'.
    // Admin per Mail informieren, dass das Profil neu zu pruefen ist.
    void notifyAdminPendingCompany({
      companyId,
      companyName: input.name,
      contactEmail: input.contact_email,
    });

    if (!updatedRow || !aggregates || !userEmail) {
      res.json({ status: "pending" });
      return;
    }
    res.json({
      ...rowToOwn(updatedRow, aggregates),
      status: updatedRow.status,
      user_email: userEmail,
    });
  })
);

meRouter.post(
  "/company/logo",
  uploadMemory.single("logo"),
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = req.session!.company_id;
    if (!companyId) {
      res.status(404).json({ error: "Kein Unternehmen zugeordnet." });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "Keine Datei hochgeladen." });
      return;
    }
    const logoPath = await processLogo(req.file.buffer);
    // Logo-Aenderungen folgen dem gleichen Freigabe-Workflow.
    const updated = await query<{ name: string; contact_email: string }>(
      `UPDATE companies
          SET logo_path = $2,
              status = 'pending',
              updated_at = now()
        WHERE id = $1
        RETURNING name, contact_email`,
      [companyId, logoPath]
    );
    const row = updated.rows[0];
    if (row) {
      void notifyAdminPendingCompany({
        companyId,
        companyName: row.name,
        contactEmail: row.contact_email,
      });
    }
    res.json({ ok: true, logo_path: logoPath });
  })
);
