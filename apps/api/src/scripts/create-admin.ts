import { parseArgs } from "node:util";
import { pool, query } from "../db/client.js";
import { hashPassword } from "../lib/password.js";

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      password: { type: "string" },
    },
    strict: true,
  });

  const email = values.email?.trim();
  const password = values.password;

  if (!email || !password) {
    // eslint-disable-next-line no-console
    console.error(
      "Benutzung: npm run admin:create -- --email=<mail> --password=<passwort>"
    );
    process.exit(1);
  }

  const existing = await query<{ id: string }>(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );
  if (existing.rowCount && existing.rowCount > 0) {
    // eslint-disable-next-line no-console
    console.error(`Benutzer mit E-Mail ${email} existiert bereits.`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  await query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin')`,
    [email, passwordHash]
  );

  // eslint-disable-next-line no-console
  console.log(`Admin ${email} wurde angelegt.`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
