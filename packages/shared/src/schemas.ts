import { z } from "zod";

export const CompanyStatus = z.enum([
  "draft",
  "pending",
  "approved",
  "suspended",
]);
export type CompanyStatus = z.infer<typeof CompanyStatus>;

export const UserRole = z.enum(["company", "admin"]);
export type UserRole = z.infer<typeof UserRole>;

export const TaxonomySchema = z.object({
  id: z.number().int().positive(),
  slug: z.string(),
  name: z.string(),
});
export type Taxonomy = z.infer<typeof TaxonomySchema>;

export const IndustryGroupSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  sort_order: z.number().int(),
});
export type IndustryGroup = z.infer<typeof IndustryGroupSchema>;

// Branchen sind gruppiert und manuell sortierbar. group ist null,
// solange keine Gruppe zugeordnet wurde ("Ohne Gruppe").
export const IndustrySchema = TaxonomySchema.extend({
  group: IndustryGroupSchema.pick({ id: true, slug: true, name: true })
    .nullable(),
  sort_order: z.number().int(),
});
export type Industry = z.infer<typeof IndustrySchema>;

export const TechnologyGroupSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  sort_order: z.number().int(),
});
export type TechnologyGroup = z.infer<typeof TechnologyGroupSchema>;

// Technologien sind gruppiert und manuell sortierbar. group ist null,
// solange keine Gruppe zugeordnet wurde ("Ohne Gruppe").
export const TechnologySchema = TaxonomySchema.extend({
  group: TechnologyGroupSchema.pick({ id: true, slug: true, name: true })
    .nullable(),
  sort_order: z.number().int(),
});
export type Technology = z.infer<typeof TechnologySchema>;

export const KnowhowSchema = TaxonomySchema;
export type Knowhow = z.infer<typeof KnowhowSchema>;

export const CompanySizeSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string(),
  name: z.string(),
  sort_order: z.number().int(),
});
export type CompanySize = z.infer<typeof CompanySizeSchema>;

export const CompanyKnowhowSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string(),
  name: z.string(),
  score: z.number().int().min(0),
});
export type CompanyKnowhow = z.infer<typeof CompanyKnowhowSchema>;

export const CompanyTechnologySchema = z.object({
  id: z.number().int().positive(),
  slug: z.string(),
  name: z.string(),
  trl: z.number().int().min(1).max(9).nullable(),
  notes: z.string().nullable(),
});
export type CompanyTechnology = z.infer<typeof CompanyTechnologySchema>;

export const CompanyDemoSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  sort_order: z.number().int().default(0),
});
export type CompanyDemo = z.infer<typeof CompanyDemoSchema>;

export const CompanyServiceSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  sort_order: z.number().int().default(0),
});
export type CompanyService = z.infer<typeof CompanyServiceSchema>;

export const CompanyTechnologySuggestionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  notes: z.string().nullable(),
  trl: z.number().int().min(1).max(9).nullable(),
  status: z.enum(["open", "accepted", "rejected"]),
  created_at: z.string(),
});
export type CompanyTechnologySuggestion = z.infer<
  typeof CompanyTechnologySuggestionSchema
>;

export const CompanyPublicSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  display_name: z.string().nullable(),
  logo_url: z.string().nullable(),
  description: z.string().nullable(),
  website_url: z.string().nullable(),
});
export type CompanyPublic = z.infer<typeof CompanyPublicSchema>;

export const CompanyDetailSchema = CompanyPublicSchema.extend({
  street: z.string().nullable(),
  postal_code: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  contact_name: z.string().nullable(),
  contact_position: z.string().nullable(),
  contact_email: z.string().email(),
  contact_phone: z.string().nullable(),
  size: CompanySizeSchema.nullable(),
  industries: z.array(IndustrySchema),
  technologies: z.array(CompanyTechnologySchema),
  machines: z.array(TaxonomySchema),
  knowhows: z.array(CompanyKnowhowSchema),
  demos: z.array(CompanyDemoSchema),
  services: z.array(CompanyServiceSchema),
  offers_services: z.boolean(),
  technology_suggestions: z
    .array(CompanyTechnologySuggestionSchema)
    .optional()
    .default([]),
});
export type CompanyDetail = z.infer<typeof CompanyDetailSchema>;

export const CompanyAdminSchema = CompanyDetailSchema.extend({
  status: CompanyStatus,
  // Login-E-Mail des verknuepften Firmen-Accounts (users.email), nicht die
  // oeffentliche Kontakt-E-Mail (contact_email).
  user_email: z.string().email().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  last_reviewed_at: z.string().nullable(),
  last_reviewed_snapshot: z.unknown().nullable(),
});
export type CompanyAdmin = z.infer<typeof CompanyAdminSchema>;

// Eigene Firmensicht inkl. Login-E-Mail und Status (fuer /api/me/company).
export const CompanyOwnSchema = CompanyDetailSchema.extend({
  status: CompanyStatus,
  user_email: z.string().email(),
});
export type CompanyOwn = z.infer<typeof CompanyOwnSchema>;

// Erweiterte Suchergebnis-Karten enthalten Felder fuer den 'Erweitert'-Modus.
export const CompanyCardSchema = CompanyPublicSchema.extend({
  contact_name: z.string().nullable(),
  city: z.string().nullable(),
  size_name: z.string().nullable(),
  industries: z.array(z.object({ id: z.number().int(), name: z.string() })),
  knowhows: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      score: z.number().int(),
    })
  ),
  top_technology: z
    .object({
      id: z.number().int(),
      name: z.string(),
      trl: z.number().int().min(1).max(9).nullable(),
    })
    .nullable(),
});
export type CompanyCard = z.infer<typeof CompanyCardSchema>;

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type Pagination = z.infer<typeof PaginationSchema>;

const stringListFromCsv = z
  .string()
  .optional()
  .transform((v) =>
    v
      ? v
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && s.length <= 200)
          .slice(0, 8)
      : []
  );

const intListFromCsv = z
  .string()
  .optional()
  .transform((v) =>
    v
      ? v
          .split(",")
          .map((s) => Number.parseInt(s, 10))
          .filter((n) => Number.isFinite(n) && n > 0)
      : []
  );

export const SearchQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  qs: stringListFromCsv,
  tech: intListFromCsv,
  machine: intListFromCsv,
  industry: intListFromCsv,
  size: intListFromCsv,
  knowhow: intListFromCsv,
  offers_services: z
    .union([z.literal("true"), z.literal("false"), z.literal("")])
    .optional()
    .transform((v) => v === "true"),
  trl_min: z.coerce.number().int().min(1).max(9).optional(),
  trl_max: z.coerce.number().int().min(1).max(9).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const SearchResultSchema = z.object({
  items: z.array(CompanyCardSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

// Eingaben fuer das Speichern eines Firmenprofils.
const TechnologyInputSchema = z.object({
  technology_id: z.number().int().positive(),
  trl: z.number().int().min(1).max(9).nullable().optional().default(null),
  notes: z.string().trim().max(2000).optional().default(""),
});
export type TechnologyInput = z.infer<typeof TechnologyInputSchema>;

const KnowhowInputSchema = z.object({
  knowhow_id: z.number().int().positive(),
  score: z.number().int().min(0).max(4),
});
export type KnowhowInput = z.infer<typeof KnowhowInputSchema>;

const DemoInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().default(""),
});
export type DemoInput = z.infer<typeof DemoInputSchema>;

const ServiceInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().default(""),
});
export type ServiceInput = z.infer<typeof ServiceInputSchema>;

const TechnologySuggestionInputSchema = z.object({
  name: z.string().trim().min(2).max(200),
  notes: z.string().trim().max(2000).optional().default(""),
  trl: z.number().int().min(1).max(9).nullable().optional().default(null),
});
export type TechnologySuggestionInput = z.infer<
  typeof TechnologySuggestionInputSchema
>;

// Reihenfolge der Felder entspricht der Reihenfolge im Profil-Formular und
// in der Umfrage (Logo, Stammdaten, Anschrift, Kontakt, Klassifizierung).
const CompanyInputBase = {
  name: z.string().trim().min(2).max(200),
  display_name: z.string().trim().max(200).optional().default(""),
  description: z.string().trim().max(5000).optional().default(""),
  website_url: z
    .union([z.string().trim().url().max(500), z.literal("")])
    .optional()
    .default(""),
  street: z.string().trim().max(200).optional().default(""),
  postal_code: z.string().trim().max(20).optional().default(""),
  city: z.string().trim().max(200).optional().default(""),
  country: z.string().trim().max(200).optional().default(""),
  contact_name: z.string().trim().min(2).max(200),
  contact_position: z.string().trim().max(200).optional().default(""),
  contact_email: z.string().email().max(200),
  contact_phone: z.string().trim().max(50).optional().default(""),
  size_id: z.number().int().positive().nullable().optional().default(null),
  industry_ids: z.array(z.number().int().positive()).max(50).default([]),
  knowhows: z.array(KnowhowInputSchema).max(100).default([]),
  technologies: z.array(TechnologyInputSchema).max(50).default([]),
  technology_suggestions: z
    .array(TechnologySuggestionInputSchema)
    .max(20)
    .default([]),
  services: z.array(ServiceInputSchema).max(50).default([]),
  demos: z.array(DemoInputSchema).max(50).default([]),
  machine_ids: z.array(z.number().int().positive()).max(100).default([]),
};

export const RegisterSchema = z.object({
  company: z.object(CompanyInputBase),
  user: z.object({
    email: z.string().email().max(200),
    password: z.string().min(10).max(200),
  }),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const AdminCreateCompanySchema = z.object({
  company: z.object({
    ...CompanyInputBase,
    status: CompanyStatus.default("draft"),
  }),
  user: z.object({
    email: z.string().email().max(200),
    password: z
      .union([z.string().min(10).max(200), z.literal("")])
      .optional()
      .transform((v) => (v ? v : undefined)),
  }),
});
export type AdminCreateCompanyInput = z.infer<typeof AdminCreateCompanySchema>;

export const AdminCreateCompanyResponseSchema = CompanyAdminSchema.extend({
  generated_password: z.string().nullable(),
});
export type AdminCreateCompanyResponse = z.infer<
  typeof AdminCreateCompanyResponseSchema
>;

export const LoginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const PasswordResetRequestSchema = z.object({
  email: z.string().email().max(200),
});
export type PasswordResetRequestInput = z.infer<
  typeof PasswordResetRequestSchema
>;

export const PasswordResetConfirmSchema = z.object({
  email: z.string().email().max(200),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/u, "Der Code besteht aus 6 Ziffern."),
  password: z.string().min(10).max(200),
});
export type PasswordResetConfirmInput = z.infer<
  typeof PasswordResetConfirmSchema
>;

export const PasswordChangeSchema = z.object({
  current_password: z.string().min(1).max(200),
  new_password: z.string().min(10).max(200),
});
export type PasswordChangeInput = z.infer<typeof PasswordChangeSchema>;

export const UpdateCompanySchema = z.object({
  ...CompanyInputBase,
  // Login-E-Mail des Firmen-Accounts; Aenderung aktualisiert users.email.
  user_email: z.string().email().max(200),
});
export type UpdateCompanyInput = z.infer<typeof UpdateCompanySchema>;

export const AdminUpdateCompanySchema = UpdateCompanySchema.extend({
  status: CompanyStatus,
});
export type AdminUpdateCompanyInput = z.infer<typeof AdminUpdateCompanySchema>;

export const UpdateStatusSchema = z.object({
  status: CompanyStatus,
});

export const TechnologySuggestionAcceptSchema = z.object({
  name: z.string().trim().min(1).max(120),
  link_to_company: z.boolean().optional().default(true),
  trl: z.number().int().min(1).max(9).nullable().optional(),
  notes: z.string().trim().max(2000).optional().default(""),
  group_id: z.coerce
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .default(null),
});
export type TechnologySuggestionAcceptInput = z.infer<
  typeof TechnologySuggestionAcceptSchema
>;

export const TaxonomyInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const AdminTechnologyInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  group_id: z.coerce
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .default(null),
});
export type AdminTechnologyInput = z.infer<typeof AdminTechnologyInputSchema>;

export const AdminIndustryInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  group_id: z.coerce
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .default(null),
});
export type AdminIndustryInput = z.infer<typeof AdminIndustryInputSchema>;

export const TechnologyMoveSchema = z.object({
  direction: z.enum(["up", "down"]),
});
export type TechnologyMoveInput = z.infer<typeof TechnologyMoveSchema>;

export const IndustryMoveSchema = z.object({
  direction: z.enum(["up", "down"]),
});
export type IndustryMoveInput = z.infer<typeof IndustryMoveSchema>;

export const TechnologyGroupInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().default(""),
  sort_order: z.coerce.number().int().min(0).max(9999).optional().default(0),
});
export type TechnologyGroupInput = z.infer<typeof TechnologyGroupInputSchema>;

export const IndustryGroupInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().default(""),
  sort_order: z.coerce.number().int().min(0).max(9999).optional().default(0),
});
export type IndustryGroupInput = z.infer<typeof IndustryGroupInputSchema>;

export const CompanySizeInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sort_order: z.coerce.number().int().min(0).max(9999).optional().default(0),
});
export type CompanySizeInput = z.infer<typeof CompanySizeInputSchema>;

export const MeUserSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: UserRole,
  }),
  company: z
    .object({
      id: z.string().uuid(),
      slug: z.string(),
      name: z.string(),
      status: CompanyStatus,
    })
    .nullable(),
});
export type MeUser = z.infer<typeof MeUserSchema>;

export const AppSettingsSchema = z.object({
  admin_notification_email: z.string().email().nullable(),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

export const FeedbackInputSchema = z.object({
  email: z.string().email().max(200),
  message: z.string().trim().min(10).max(5000),
  // Honeypot: muss leer bleiben. Wenn ausgefuellt, wird die Anfrage
  // serverseitig wie ein Erfolg behandelt aber nicht persistiert.
  website: z.string().max(500).optional().default(""),
});
export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;

export const FeedbackEntrySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  message: z.string(),
  handled: z.boolean(),
  created_at: z.string(),
});
export type FeedbackEntry = z.infer<typeof FeedbackEntrySchema>;

export const FeedbackListSchema = z.object({
  items: z.array(FeedbackEntrySchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});
export type FeedbackList = z.infer<typeof FeedbackListSchema>;

export const FeedbackUpdateSchema = z.object({
  handled: z.boolean(),
});
export type FeedbackUpdateInput = z.infer<typeof FeedbackUpdateSchema>;

export const AppSettingsInputSchema = z.object({
  admin_notification_email: z
    .union([z.string().email().max(200), z.literal(""), z.null()])
    .transform((v) => (v === "" || v === null ? null : v)),
});
export type AppSettingsInput = z.infer<typeof AppSettingsInputSchema>;

export const TestMailInputSchema = z.object({
  email: z.string().email().max(200),
});
export type TestMailInput = z.infer<typeof TestMailInputSchema>;

// Hilfetexte pro Formular-/Filter-Abschnitt. Im Admin pflegbar, fuer
// Besucher als Tooltip am Abschnittstitel sichtbar.
export const SECTION_KEYS = [
  "company_size",
  "industries",
  "knowhows",
  "technologies",
  "machines",
  "demos",
  "services",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const MAIL_TEMPLATE_KEYS = [
  "password_reset",
  "admin_pending_company",
  "company_approved",
  "company_suspended",
  "account_credentials",
  "admin_feedback",
  "test_mail",
] as const;
export type MailTemplateKey = (typeof MAIL_TEMPLATE_KEYS)[number];

export const MailTemplateEntrySchema = z.object({
  key: z.enum(MAIL_TEMPLATE_KEYS),
  label: z.string(),
  placeholders: z.array(z.string()),
  subject: z.string(),
  body: z.string(),
  default_subject: z.string(),
  default_body: z.string(),
});
export type MailTemplateEntry = z.infer<typeof MailTemplateEntrySchema>;

export const MailTemplatesSchema = z.object({
  templates: z.array(MailTemplateEntrySchema),
});
export type MailTemplates = z.infer<typeof MailTemplatesSchema>;

export const MailTemplatesInputSchema = z.object({
  templates: z.array(
    z.object({
      key: z.enum(MAIL_TEMPLATE_KEYS),
      subject: z.string().max(500),
      body: z.string().max(20000),
    })
  ),
});
export type MailTemplatesInput = z.infer<typeof MailTemplatesInputSchema>;

export const SECTION_LABELS: Record<SectionKey, string> = {
  company_size: "Unternehmensgröße",
  industries: "Branchen",
  knowhows: "Know-how",
  technologies: "Technologien",
  machines: "Maschinen",
  demos: "Demonstrationsanlagen",
  services: "Dienstleistungen",
};

export const SectionDescriptionsSchema = z.record(z.string(), z.string());
export type SectionDescriptions = Partial<Record<SectionKey, string>>;

export const SectionDescriptionsInputSchema = z.object({
  descriptions: z.record(z.string(), z.string().trim().max(2000)),
});
export type SectionDescriptionsInput = z.infer<
  typeof SectionDescriptionsInputSchema
>;

export const AdminStatsSchema = z.object({
  companies_by_status: z.record(CompanyStatus, z.number().int()),
  total_companies: z.number().int(),
  total_users: z.number().int(),
  top_technologies: z.array(
    z.object({ id: z.number().int(), name: z.string(), count: z.number().int() })
  ),
  top_machines: z.array(
    z.object({ id: z.number().int(), name: z.string(), count: z.number().int() })
  ),
  top_industries: z.array(
    z.object({ id: z.number().int(), name: z.string(), count: z.number().int() })
  ),
  top_knowhows: z.array(
    z.object({ id: z.number().int(), name: z.string(), count: z.number().int() })
  ),
  registrations_per_week: z.array(
    z.object({ week: z.string(), count: z.number().int() })
  ),
});
export type AdminStats = z.infer<typeof AdminStatsSchema>;

export const AnalyticsPageviewSchema = z.object({
  path: z.string().trim().min(1).max(500),
  company_id: z.string().uuid().nullable().optional(),
  company_slug: z.string().trim().max(200).optional(),
});
export type AnalyticsPageviewInput = z.infer<typeof AnalyticsPageviewSchema>;

export const AnalyticsDwellSchema = z.object({
  seconds: z.number().positive().max(3600),
});
export type AnalyticsDwellInput = z.infer<typeof AnalyticsDwellSchema>;

export const AnalyticsStatsSchema = z.object({
  total_pageviews: z.number().int(),
  total_dwell_seconds: z.number().int(),
  avg_dwell_seconds: z.number(),
  top_companies: z.array(
    z.object({
      company_id: z.string().uuid(),
      name: z.string(),
      slug: z.string(),
      views: z.number().int(),
    })
  ),
});
export type AnalyticsStats = z.infer<typeof AnalyticsStatsSchema>;

// Export-/Import-Format fuer Firmen (portabel zwischen Umgebungen).
const ExportTechnologySchema = z.object({
  slug: z.string(),
  name: z.string().optional(),
  trl: z.number().int().min(1).max(9).nullable().optional().default(null),
  notes: z.string().nullable().optional().default(null),
});

const ExportKnowhowSchema = z.object({
  slug: z.string(),
  name: z.string().optional(),
  score: z.number().int().min(0).max(4),
});

const ExportDemoSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional().default(null),
  sort_order: z.number().int().optional().default(0),
});

const ExportServiceSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional().default(null),
  sort_order: z.number().int().optional().default(0),
});

const ExportTechSuggestionSchema = z.object({
  name: z.string(),
  notes: z.string().nullable().optional().default(null),
  trl: z.number().int().min(1).max(9).nullable().optional().default(null),
});

export const CompanyExportEntrySchema = z.object({
  name: z.string(),
  display_name: z.string().nullable().optional().default(null),
  description: z.string().nullable().optional().default(null),
  website_url: z.string().nullable().optional().default(null),
  street: z.string().nullable().optional().default(null),
  postal_code: z.string().nullable().optional().default(null),
  city: z.string().nullable().optional().default(null),
  country: z.string().nullable().optional().default(null),
  contact_name: z.string(),
  contact_position: z.string().nullable().optional().default(null),
  contact_email: z.string().email(),
  contact_phone: z.string().nullable().optional().default(null),
  user_email: z.string().email(),
  size_slug: z.string().nullable().optional().default(null),
  industry_slugs: z.array(z.string()).default([]),
  machine_slugs: z.array(z.string()).default([]),
  technologies: z.array(ExportTechnologySchema).default([]),
  knowhows: z.array(ExportKnowhowSchema).default([]),
  demos: z.array(ExportDemoSchema).default([]),
  services: z.array(ExportServiceSchema).default([]),
  technology_suggestions: z.array(ExportTechSuggestionSchema).default([]),
});
export type CompanyExportEntry = z.infer<typeof CompanyExportEntrySchema>;

const ExportTaxonomyItemSchema = z.object({
  slug: z.string(),
  name: z.string(),
});

const ExportSizeItemSchema = ExportTaxonomyItemSchema.extend({
  sort_order: z.number().int().optional().default(0),
});

const ExportTechnologyItemSchema = ExportTaxonomyItemSchema.extend({
  group_slug: z.string().nullable().optional().default(null),
  sort_order: z.number().int().optional().default(0),
});

const ExportTechnologyGroupSchema = ExportTaxonomyItemSchema.extend({
  description: z.string().nullable().optional().default(null),
  sort_order: z.number().int().optional().default(0),
});

const ExportIndustryItemSchema = ExportTaxonomyItemSchema.extend({
  group_slug: z.string().nullable().optional().default(null),
  sort_order: z.number().int().optional().default(0),
});

const ExportIndustryGroupSchema = ExportTaxonomyItemSchema.extend({
  description: z.string().nullable().optional().default(null),
  sort_order: z.number().int().optional().default(0),
});

export const CompanyExportTaxonomiesSchema = z.object({
  industry_groups: z.array(ExportIndustryGroupSchema).default([]),
  industries: z.array(ExportIndustryItemSchema).default([]),
  machines: z.array(ExportTaxonomyItemSchema).default([]),
  technology_groups: z.array(ExportTechnologyGroupSchema).default([]),
  technologies: z.array(ExportTechnologyItemSchema).default([]),
  knowhows: z.array(ExportTaxonomyItemSchema).default([]),
  sizes: z.array(ExportSizeItemSchema).default([]),
});
export type CompanyExportTaxonomies = z.infer<
  typeof CompanyExportTaxonomiesSchema
>;

export const CompanyExportFileSchema = z.object({
  version: z.literal(1),
  exported_at: z.string(),
  taxonomies: CompanyExportTaxonomiesSchema.optional(),
  companies: z.array(CompanyExportEntrySchema),
});
export type CompanyExportFile = z.infer<typeof CompanyExportFileSchema>;

export const CompanyImportSchema = z.object({
  dry_run: z.boolean().optional().default(false),
  taxonomies: CompanyExportTaxonomiesSchema.optional(),
  companies: z.array(CompanyExportEntrySchema).min(1).max(500),
});
export type CompanyImportInput = z.infer<typeof CompanyImportSchema>;

export const CompanyImportResultSchema = z.object({
  dry_run: z.boolean(),
  created: z.number().int(),
  skipped: z.number().int(),
  taxonomies_created: z.number().int(),
  errors: z.array(
    z.object({
      index: z.number().int(),
      name: z.string(),
      message: z.string(),
    })
  ),
});
export type CompanyImportResult = z.infer<typeof CompanyImportResultSchema>;

// Netzwerkgraph: geschachtelte Ebenen, Firmen-Platzierungen und Verbindungen.
// Ein Knoten ist entweder eine Ebene oder die Platzierung einer Firma. Kanten
// verbinden ausschliesslich Geschwisterknoten derselben Ebene (Scope).

const HexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Farbe muss ein Hex-Wert wie #0d9488 sein.");

export const GraphNodeKind = z.enum(["layer", "company"]);
export type GraphNodeKind = z.infer<typeof GraphNodeKind>;

// Wie die Kinder einer Ebene gezeichnet werden. `graph` ist das bisherige
// Netzwerk, `pie` die Torte, `xy` das Portfolio aus Größe und Reifegrad.
export const GraphLayoutSchema = z.enum(["graph", "pie", "xy"]);
export type GraphLayout = z.infer<typeof GraphLayoutSchema>;

export const GraphSizeSchema = z.object({
  slug: z.string(),
  name: z.string(),
  sort_order: z.number().int(),
});
export type GraphSize = z.infer<typeof GraphSizeSchema>;

export const GraphEdgeKindSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string(),
  name: z.string(),
  color: z.string(),
  directed: z.boolean(),
  sort_order: z.number().int(),
});
export type GraphEdgeKind = z.infer<typeof GraphEdgeKindSchema>;

export const GraphEdgeKindInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  color: HexColor.optional().default("#64748b"),
  directed: z.boolean().optional().default(false),
  sort_order: z.number().int().min(0).max(9999).optional().default(0),
});
export type GraphEdgeKindInput = z.infer<typeof GraphEdgeKindInputSchema>;

export const GraphLayerSchema = z.object({
  id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  layout: GraphLayoutSchema,
  sort_order: z.number().int(),
  child_layer_count: z.number().int(),
  child_company_count: z.number().int(),
});
export type GraphLayer = z.infer<typeof GraphLayerSchema>;

export const GraphCompanyNodeSchema = z.object({
  id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(),
  company_id: z.string().uuid(),
  company_slug: z.string(),
  company_name: z.string(),
  logo_url: z.string().nullable(),
  status: CompanyStatus,
  sort_order: z.number().int(),
  size_slug: z.string().nullable(),
  size_name: z.string().nullable(),
  size_sort_order: z.number().int().nullable(),
  max_trl: z.number().int().min(1).max(9).nullable(),
});
export type GraphCompanyNode = z.infer<typeof GraphCompanyNodeSchema>;

export const GraphEdgeSchema = z.object({
  id: z.string().uuid(),
  scope_id: z.string().uuid().nullable(),
  source_id: z.string().uuid(),
  target_id: z.string().uuid(),
  edge_kind_id: z.number().int().positive(),
  edge_kind_slug: z.string(),
  edge_kind_name: z.string(),
  color: z.string(),
  directed: z.boolean(),
  label: z.string().nullable(),
});
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

export const GraphBreadcrumbItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  path: z.string(),
});
export type GraphBreadcrumbItem = z.infer<typeof GraphBreadcrumbItemSchema>;

// Kante, die die geoeffnete Ebene selbst auf Elternniveau besitzt. Im Inneren
// der Ebene sonst unsichtbar, deshalb als Randhinweis aufbereitet.
export const GraphOutwardEdgeSchema = GraphEdgeSchema.extend({
  other_id: z.string().uuid(),
  other_kind: GraphNodeKind,
  other_name: z.string(),
  other_path: z.string().nullable(),
  other_company_slug: z.string().nullable(),
  direction: z.enum(["in", "out", "undirected"]),
});
export type GraphOutwardEdge = z.infer<typeof GraphOutwardEdgeSchema>;

export const GraphScopeSchema = z.object({
  layer: GraphLayerSchema.nullable(),
  layout: GraphLayoutSchema,
  path: z.string(),
  breadcrumb: z.array(GraphBreadcrumbItemSchema),
  layers: z.array(GraphLayerSchema),
  companies: z.array(GraphCompanyNodeSchema),
  sizes: z.array(GraphSizeSchema),
  edges: z.array(GraphEdgeSchema),
  outward_edges: z.array(GraphOutwardEdgeSchema),
});
export type GraphScope = z.infer<typeof GraphScopeSchema>;

export const GraphFindResultSchema = z.object({
  node_id: z.string().uuid(),
  company_id: z.string().uuid(),
  company_name: z.string(),
  company_slug: z.string(),
  parent_id: z.string().uuid().nullable(),
  parent_path: z.string(),
  breadcrumb: z.array(GraphBreadcrumbItemSchema),
});
export type GraphFindResult = z.infer<typeof GraphFindResultSchema>;

export const GraphScopeQuerySchema = z.object({
  path: z.string().max(400).optional().default(""),
});
export type GraphScopeQuery = z.infer<typeof GraphScopeQuerySchema>;

export const GraphAdminScopeQuerySchema = z.object({
  parent_id: z.string().uuid().optional(),
});
export type GraphAdminScopeQuery = z.infer<typeof GraphAdminScopeQuerySchema>;

export const GraphFindQuerySchema = z.object({
  q: z.string().trim().min(2).max(80),
});
export type GraphFindQuery = z.infer<typeof GraphFindQuerySchema>;

// Schlanke Firmenliste fuer das Autocomplete im Admin. Die regulaere
// Admin-Firmenliste laedt pro Zeile saemtliche Aggregate und waere dafuer zu
// teuer.
export const GraphCompanyOptionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  status: CompanyStatus,
  already_placed: z.boolean(),
});
export type GraphCompanyOption = z.infer<typeof GraphCompanyOptionSchema>;

export const GraphCompanySearchQuerySchema = z.object({
  q: z.string().trim().max(80).optional().default(""),
  parent_id: z.string().uuid().optional(),
});
export type GraphCompanySearchQuery = z.infer<
  typeof GraphCompanySearchQuerySchema
>;

export const GraphLayerInputSchema = z.object({
  parent_id: z.string().uuid().nullable().optional().default(null),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).nullable().optional().default(null),
  color: HexColor.nullable().optional().default(null),
  layout: GraphLayoutSchema.optional().default("graph"),
});
export type GraphLayerInput = z.infer<typeof GraphLayerInputSchema>;

export const GraphLayerUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).nullable().optional().default(null),
  color: HexColor.nullable().optional().default(null),
  layout: GraphLayoutSchema.optional().default("graph"),
  sort_order: z.number().int().min(0).max(9999).optional(),
});
export type GraphLayerUpdate = z.infer<typeof GraphLayerUpdateSchema>;

export const GraphRootLayoutUpdateSchema = z.object({
  layout: GraphLayoutSchema,
});
export type GraphRootLayoutUpdate = z.infer<typeof GraphRootLayoutUpdateSchema>;

export const GraphCompanyNodeInputSchema = z.object({
  parent_id: z.string().uuid().nullable().optional().default(null),
  company_id: z.string().uuid(),
});
export type GraphCompanyNodeInput = z.infer<typeof GraphCompanyNodeInputSchema>;

export const GraphNodeMoveSchema = z.object({
  parent_id: z.string().uuid().nullable(),
  sort_order: z.number().int().min(0).max(9999).optional(),
});
export type GraphNodeMove = z.infer<typeof GraphNodeMoveSchema>;

export const GraphNodeReorderSchema = z.object({
  node_ids: z.array(z.string().uuid()).min(1).max(500),
});
export type GraphNodeReorder = z.infer<typeof GraphNodeReorderSchema>;

export const GraphEdgeInputSchema = z.object({
  source_id: z.string().uuid(),
  target_id: z.string().uuid(),
  edge_kind_id: z.number().int().positive(),
  label: z.string().trim().max(160).nullable().optional().default(null),
});
export type GraphEdgeInput = z.infer<typeof GraphEdgeInputSchema>;

export const GraphEdgeUpdateSchema = z.object({
  edge_kind_id: z.number().int().positive(),
  label: z.string().trim().max(160).nullable().optional().default(null),
});
export type GraphEdgeUpdate = z.infer<typeof GraphEdgeUpdateSchema>;
