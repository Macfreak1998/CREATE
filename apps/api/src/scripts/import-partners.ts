import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { config as loadEnv } from "dotenv";
import {
  CompanyImportSchema,
  type CompanyImportInput,
} from "@b2b/shared";

// Root-.env laden, bevor db/client die Config parst (cwd ist oft apps/api).
loadEnv({ path: resolve(import.meta.dirname, "../../../../.env") });

const { pool } = await import("../db/client.js");
const { importCompanies } = await import("../modules/admin/import-export.js");

// Importiert Firmen aus apps/api/data/partner-import.json (oder --file).
// Nutzt denselben Import-Pfad wie die Admin-API; Status der Firmen: draft.

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      file: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
    strict: true,
  });

  const filePath = resolve(
    values.file ?? new URL("../../data/partner-import.json", import.meta.url).pathname
  );
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  const parsed = CompanyImportSchema.safeParse({
    ...(raw as object),
    dry_run: Boolean(values["dry-run"]),
  });

  if (!parsed.success) {
    console.error("Import-Datei ungültig:");
    console.error(parsed.error.flatten());
    process.exit(1);
  }

  const input: CompanyImportInput = parsed.data;
  console.log(
    `Importiere ${input.companies.length} Firmen aus ${filePath}` +
      (input.dry_run ? " (dry-run)" : "") +
      "…"
  );

  const result = await importCompanies(input);

  console.log(
    `\nFertig. created=${result.created} skipped=${result.skipped} ` +
      `taxonomies_created=${result.taxonomies_created} dry_run=${result.dry_run}`
  );
  if (result.errors.length > 0) {
    console.log("\nHinweise/Fehler:");
    for (const err of result.errors.slice(0, 50)) {
      console.log(`  [${err.index}] ${err.name}: ${err.message}`);
    }
    if (result.errors.length > 50) {
      console.log(`  … und ${result.errors.length - 50} weitere`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
