import { Router, type Request, type Response } from "express";
import { SECTION_KEYS, type SectionDescriptions } from "@b2b/shared";
import { asyncHandler } from "../../middlewares/async-handler.js";
import {
  SETTING_SECTION_DESCRIPTION_PREFIX,
  getSettingsByPrefix,
} from "../../lib/settings.js";

// Liefert die im Admin gepflegten Hilfetexte. Oeffentlich, weil die Suchseite
// ohne Login erreichbar ist. Leere Texte werden ausgelassen.
export async function loadSectionDescriptions(): Promise<SectionDescriptions> {
  const stored = await getSettingsByPrefix(SETTING_SECTION_DESCRIPTION_PREFIX);
  const out: SectionDescriptions = {};
  for (const key of SECTION_KEYS) {
    const value = stored[key];
    if (value) out[key] = value;
  }
  return out;
}

export const sectionDescriptionsRouter = Router();

sectionDescriptionsRouter.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(await loadSectionDescriptions());
  })
);
