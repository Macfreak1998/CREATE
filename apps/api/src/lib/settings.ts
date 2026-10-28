import { query } from "../db/client.js";

const cache = new Map<string, string | null>();

export async function getSetting(key: string): Promise<string | null> {
  if (cache.has(key)) {
    return cache.get(key) ?? null;
  }
  const result = await query<{ value: string | null }>(
    "SELECT value FROM app_settings WHERE key = $1",
    [key]
  );
  const value = result.rows[0]?.value ?? null;
  cache.set(key, value);
  return value;
}

// Liest alle Keys mit gemeinsamem Prefix in einem Rutsch. Nutzt den
// Einzel-Cache nicht, damit hier keine Teilmengen zwischengespeichert werden.
export async function getSettingsByPrefix(
  prefix: string
): Promise<Record<string, string>> {
  const result = await query<{ key: string; value: string | null }>(
    "SELECT key, value FROM app_settings WHERE key LIKE $1 || '%'",
    [prefix]
  );
  const out: Record<string, string> = {};
  for (const row of result.rows) {
    const value = row.value?.trim();
    if (value) out[row.key.slice(prefix.length)] = value;
  }
  return out;
}

export async function setSetting(
  key: string,
  value: string | null
): Promise<void> {
  await query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            updated_at = now()`,
    [key, value]
  );
  cache.set(key, value);
}

export function invalidateSettingCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}

export const SETTING_ADMIN_NOTIFICATION_EMAIL = "admin_notification_email";
export const SETTING_GRAPH_ROOT_LAYOUT = "graph_root_layout";
export const SETTING_SECTION_DESCRIPTION_PREFIX = "section_description.";
export const SETTING_MAIL_TEMPLATE_PREFIX = "mail_template.";
