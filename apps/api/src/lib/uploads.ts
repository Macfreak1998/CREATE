import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import sharp from "sharp";
import { config } from "./config.js";

export const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.mimetype)) {
      cb(new Error("Nur Bilddateien (PNG, JPEG, WebP, GIF) erlaubt."));
      return;
    }
    cb(null, true);
  },
});

export async function processLogo(buffer: Buffer): Promise<string> {
  const metadata = await sharp(buffer).metadata();
  if (!metadata.format) {
    throw new Error("Unbekanntes Bildformat.");
  }

  // contain (statt cover) verhindert das Beschneiden links/rechts. Vorhandene
  // einfarbige Raender werden zuvor per .trim() entfernt, damit das Logo
  // moeglichst gross im 512x512-Quadrat liegt. Hintergrund transparent.
  const trimmed = await sharp(buffer).rotate().trim().toBuffer().catch(() => null);
  const source = trimmed ?? buffer;

  const processed = await sharp(source)
    .resize({
      width: 512,
      height: 512,
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
      withoutEnlargement: false,
    })
    .webp({ quality: 85 })
    .toBuffer();

  const dir = path.join(config.UPLOADS_DIR, "logos");
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.webp`;
  const fullPath = path.join(dir, filename);
  await writeFile(fullPath, processed);

  return path.posix.join("logos", filename);
}

export function buildPublicLogoUrl(logoPath: string | null): string | null {
  if (!logoPath) return null;
  return `${config.PUBLIC_UPLOADS_BASE_URL.replace(/\/$/, "")}/${logoPath}`;
}

/** Entfernt eine Logo-Datei unter UPLOADS_DIR. Fehler werden stillschweigend ignoriert. */
export async function deleteLogoFile(logoPath: string | null): Promise<void> {
  if (!logoPath) return;
  // Nur relative Pfade unter logos/ erlauben (kein Path-Traversal).
  if (
    logoPath.includes("..") ||
    path.isAbsolute(logoPath) ||
    !logoPath.startsWith("logos/")
  ) {
    return;
  }
  const fullPath = path.join(config.UPLOADS_DIR, logoPath);
  try {
    await unlink(fullPath);
  } catch {
    // Datei fehlt bereits oder ist nicht lesbar — DB-Loeschung geht trotzdem weiter.
  }
}
