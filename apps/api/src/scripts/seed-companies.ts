import { parseArgs } from "node:util";
import type { PoolClient } from "pg";
import { pool, query, withTransaction } from "../db/client.js";
import { hashPassword } from "../lib/password.js";
import { slugify } from "../lib/slug.js";
import {
  createCompanyWithUser,
  type CompanyInputAggregate,
} from "../modules/companies/repository.js";

// Skript zum Anlegen von Demo-Firmen für Test- und Präsentationszwecke.
// Idempotent: bereits angelegte Firmen (anhand der E-Mail) werden übersprungen.
// Login-Daten:
//   E-Mail:   test@<slug-der-firma>.com
//   Passwort: vollständiger Firmenname (z. B. "BioPolymer Werke GmbH")

interface SeedDemo {
  title: string;
  description: string;
}

interface SeedService {
  title: string;
  description: string;
}

interface SeedTech {
  slug: string;
  trl: number;
  notes?: string;
}

interface SeedKnowhow {
  slug: string;
  score: number;
}

interface SeedCompany {
  name: string;
  description: string;
  contact_name: string;
  contact_phone: string;
  size_slug: string;
  industry_slugs: string[];
  technology: SeedTech[];
  machine_slugs: string[];
  knowhows: SeedKnowhow[];
  demos: SeedDemo[];
  services: SeedService[];
}

// Branchen (Taxonomie wird beim Seed automatisch ergänzt)
const INDUSTRIES: ReadonlyArray<readonly [string, string]> = [
  ["verpackung", "Verpackung"],
  ["lebensmittel", "Lebensmittel"],
  ["landwirtschaft", "Landwirtschaft"],
  ["konsumgueter", "Konsumgüter"],
  ["automotive", "Automotive"],
  ["medizintechnik", "Medizintechnik"],
  ["bauwesen", "Bauwesen"],
  ["textil", "Textil & Mode"],
  ["kreislaufwirtschaft", "Kreislaufwirtschaft"],
  ["forschung-und-entwicklung", "Forschung & Entwicklung"],
  ["chemie", "Chemie"],
  ["moebel-und-einrichtung", "Möbel & Einrichtung"],
];

// Know-how-Themen (Taxonomie wird beim Seed automatisch ergänzt)
const KNOWHOWS: ReadonlyArray<readonly [string, string]> = [
  ["bio-monomersynthese", "Bio-Monomersynthese"],
  ["compoundierung", "Compoundierung"],
  ["mechanisches-recycling", "Mechanisches Recycling"],
  ["chemisches-recycling", "Chemisches Recycling"],
  ["bioabbaubarkeit", "Bioabbaubarkeit"],
  ["lebenszyklusanalyse", "Lebenszyklusanalyse (LCA)"],
  ["fermentationstechnik", "Fermentationstechnik"],
  ["extrusion", "Extrusion"],
  ["blasformen", "Blasformen"],
  ["rheologie", "Rheologie"],
  ["oberflaechenanalytik", "Oberflächenanalytik"],
  ["rezepturentwicklung", "Rezepturentwicklung"],
  ["naturfaserverstaerkung", "Naturfaserverstärkung"],
  ["biobasierte-additive", "Biobasierte Additive"],
  ["bioraffinerie", "Bioraffinerie"],
];

const COMPANIES: SeedCompany[] = [
  {
    name: "BioPolymer Werke GmbH",
    description:
      "Hersteller hochwertiger PLA- und PHA-Granulate aus nachwachsenden Rohstoffen. Wir beliefern Verpackungs- und Konsumgüterhersteller in ganz Europa mit kompostierbaren und recyclingfähigen Biopolymeren.",
    contact_name: "Dr. Anna Hellwig",
    contact_phone: "+49 30 1234567",
    size_slug: "251-1000",
    industry_slugs: ["verpackung", "konsumgueter", "chemie"],
    technology: [
      { slug: "kunststofftechnik", trl: 9, notes: "Großserienproduktion PLA" },
      { slug: "spritzguss", trl: 8 },
    ],
    machine_slugs: ["spritzgussmaschine", "bearbeitungszentrum"],
    knowhows: [
      { slug: "bio-monomersynthese", score: 90 },
      { slug: "compoundierung", score: 85 },
      { slug: "rezepturentwicklung", score: 70 },
    ],
    demos: [
      {
        title: "PLA-Compoundierungsanlage Nord",
        description:
          "Demonstrationsanlage zur Herstellung biobasierter Compounds mit einer Kapazität von 5.000 t/a.",
      },
    ],
    services: [
      {
        title: "Auftragscompoundierung",
        description:
          "Wir entwickeln und produzieren maßgeschneiderte Biopolymer-Compounds nach Kundenanforderung.",
      },
    ],
  },
  {
    name: "CircuPlast Recycling AG",
    description:
      "Spezialist für mechanisches und chemisches Recycling von Post-Consumer-Kunststoffen. Wir schließen Stoffkreisläufe für Lebensmittelverpackungen, Folien und technische Kunststoffe.",
    contact_name: "Markus Berger",
    contact_phone: "+49 221 9876543",
    size_slug: "51-250",
    industry_slugs: ["kreislaufwirtschaft", "verpackung", "lebensmittel"],
    technology: [
      { slug: "kunststofftechnik", trl: 8, notes: "Sortierung und Aufbereitung" },
      { slug: "automatisierung", trl: 7 },
    ],
    machine_slugs: ["bearbeitungszentrum", "optisches-messsystem"],
    knowhows: [
      { slug: "mechanisches-recycling", score: 95 },
      { slug: "chemisches-recycling", score: 75 },
      { slug: "lebenszyklusanalyse", score: 60 },
    ],
    demos: [
      {
        title: "Pilotlinie Solvolyse",
        description:
          "Lösemittelbasierte Aufreinigung von Mischkunststoffen im 200-kg/h-Maßstab.",
      },
    ],
    services: [
      {
        title: "Materialaudit",
        description:
          "Analyse Ihrer Kunststoffströme inkl. Sortierfähigkeitsbewertung und Recyclat-Empfehlung.",
      },
      {
        title: "Closed-Loop-Beratung",
        description:
          "Konzeption geschlossener Materialkreisläufe für Markenhersteller und Verpacker.",
      },
    ],
  },
  {
    name: "Algae2Plastic Solutions GmbH",
    description:
      "Forschungsnahes Unternehmen für Biokunststoffe aus Mikroalgen. Wir entwickeln Bioraffinerieprozesse, die CO₂ als Rohstoff nutzen und zu vollständig bioabbaubaren Polymeren führen.",
    contact_name: "Dr. Yuki Lehmann",
    contact_phone: "+49 421 5550199",
    size_slug: "11-50",
    industry_slugs: ["forschung-und-entwicklung", "chemie"],
    technology: [
      { slug: "kunststofftechnik", trl: 4 },
      { slug: "automatisierung", trl: 5, notes: "Photobioreaktor-Steuerung" },
    ],
    machine_slugs: [],
    knowhows: [
      { slug: "fermentationstechnik", score: 90 },
      { slug: "bioraffinerie", score: 80 },
      { slug: "bio-monomersynthese", score: 65 },
    ],
    demos: [
      {
        title: "Photobioreaktor-Park Bremen",
        description:
          "200 m³ Reaktorvolumen für die kontinuierliche Kultivierung von PHA-produzierenden Algenstämmen.",
      },
    ],
    services: [
      {
        title: "Auftragsforschung",
        description:
          "Machbarkeitsstudien und Skalierungskonzepte für algenbasierte Bioprozesse.",
      },
    ],
  },
  {
    name: "Stärkewerk Mitteldeutschland eG",
    description:
      "Genossenschaftliche Verarbeitung heimischer Stärkepflanzen zu thermoplastischen Stärkeblends. Unsere Materialien finden Anwendung in Mulchfolien, Pflanztöpfen und Einwegartikeln.",
    contact_name: "Susanne Weidner",
    contact_phone: "+49 345 4445566",
    size_slug: "51-250",
    industry_slugs: ["landwirtschaft", "verpackung", "konsumgueter"],
    technology: [
      { slug: "kunststofftechnik", trl: 9, notes: "TPS-Blends Großserie" },
    ],
    machine_slugs: ["spritzgussmaschine"],
    knowhows: [
      { slug: "compoundierung", score: 80 },
      { slug: "extrusion", score: 75 },
      { slug: "bioabbaubarkeit", score: 70 },
    ],
    demos: [
      {
        title: "TPS-Compoundierlinie Halle",
        description:
          "Co-Rotations-Doppelschneckenextruder für Stärke-PLA-Blends, 2 t/h.",
      },
    ],
    services: [],
  },
  {
    name: "PolyVerde Compounds GmbH",
    description:
      "Herstellung biobasierter und biokompositer Werkstoffe mit Naturfaserverstärkung. Spezialisiert auf Hanf-, Flachs- und Holzfasercompounds für Spritzguss und Extrusion.",
    contact_name: "Florian Achterberg",
    contact_phone: "+49 89 7766554",
    size_slug: "11-50",
    industry_slugs: ["automotive", "moebel-und-einrichtung", "konsumgueter"],
    technology: [
      { slug: "kunststofftechnik", trl: 8 },
      { slug: "spritzguss", trl: 8 },
      { slug: "additive-fertigung", trl: 6 },
    ],
    machine_slugs: ["spritzgussmaschine", "3d-drucker-fdm"],
    knowhows: [
      { slug: "naturfaserverstaerkung", score: 95 },
      { slug: "compoundierung", score: 80 },
      { slug: "rezepturentwicklung", score: 70 },
    ],
    demos: [
      {
        title: "Biokomposit-Schauteile",
        description:
          "Kollektion von Innenraum-Bauteilen aus Hanf-PLA für Automotive-Anwendungen.",
      },
    ],
    services: [
      {
        title: "Materialentwicklung Biokomposite",
        description:
          "Gemeinsame Entwicklung kundenspezifischer Naturfasercompounds inkl. Musterteile.",
      },
    ],
  },
  {
    name: "GreenMold Spritzguss GmbH",
    description:
      "Lohnspritzguss mit Fokus auf biobasierte und kompostierbare Kunststoffe. Vom Werkzeugbau bis zur Serienfertigung aus einer Hand, zertifiziert nach ISO 9001 und ISCC PLUS.",
    contact_name: "Petra Lindner",
    contact_phone: "+49 7031 223344",
    size_slug: "51-250",
    industry_slugs: ["konsumgueter", "verpackung", "medizintechnik"],
    technology: [
      { slug: "spritzguss", trl: 9, notes: "Bio-Granulate, 80 Maschinen" },
      { slug: "werkzeugbau", trl: 8 },
      { slug: "automatisierung", trl: 7 },
    ],
    machine_slugs: [
      "spritzgussmaschine",
      "montageroboter",
      "koordinatenmessmaschine",
    ],
    knowhows: [
      { slug: "rheologie", score: 75 },
      { slug: "rezepturentwicklung", score: 60 },
    ],
    demos: [],
    services: [
      {
        title: "Lohnspritzguss Biokunststoffe",
        description:
          "Verarbeitung von PLA, PHA, Bio-PE und Stärkeblends auf modernen elektrischen Spritzgießmaschinen.",
      },
      {
        title: "Werkzeugbau",
        description:
          "Konstruktion und Fertigung von Spritzgießwerkzeugen, optimiert für biobasierte Polymere.",
      },
    ],
  },
  {
    name: "EcoPack Innovationen GmbH",
    description:
      "Designhaus für nachhaltige Verpackungen. Wir entwickeln Verpackungslösungen aus Biokunststoffen, Faserguss und Monomaterialien – von der Idee bis zur Serienreife.",
    contact_name: "Jana Großmann",
    contact_phone: "+49 40 1112233",
    size_slug: "11-50",
    industry_slugs: ["verpackung", "lebensmittel", "konsumgueter"],
    technology: [
      { slug: "cad-cam", trl: 9 },
      { slug: "additive-fertigung", trl: 8, notes: "Prototyping" },
    ],
    machine_slugs: ["3d-drucker-fdm", "3d-drucker-sla"],
    knowhows: [
      { slug: "bioabbaubarkeit", score: 80 },
      { slug: "lebenszyklusanalyse", score: 75 },
    ],
    demos: [],
    services: [
      {
        title: "Verpackungsdesign",
        description:
          "Entwicklung kompostierbarer und recyclingfähiger Verpackungen inkl. Prototypen und Tests.",
      },
      {
        title: "Nachhaltigkeits-Audit",
        description:
          "Bewertung bestehender Verpackungen und Roadmap zur Materialumstellung.",
      },
    ],
  },
  {
    name: "HempFiber Composites GmbH",
    description:
      "Anbau, Aufbereitung und Veredelung heimischer Hanffasern für die Kunststoffindustrie. Von der Faser bis zum spritzgussfertigen Compound aus einer Hand.",
    contact_name: "Tobias Reuter",
    contact_phone: "+49 38201 99887",
    size_slug: "11-50",
    industry_slugs: ["landwirtschaft", "automotive", "bauwesen"],
    technology: [
      { slug: "kunststofftechnik", trl: 7 },
      { slug: "automatisierung", trl: 6 },
    ],
    machine_slugs: ["spritzgussmaschine"],
    knowhows: [
      { slug: "naturfaserverstaerkung", score: 90 },
      { slug: "compoundierung", score: 70 },
    ],
    demos: [
      {
        title: "Faseraufschluss-Pilotanlage",
        description:
          "Mechanisch-enzymatische Aufbereitung von Hanf-Bastfasern für hochwertige Compounds.",
      },
    ],
    services: [
      {
        title: "Faserlieferung",
        description: "Kurz- und Langfasern aus regionalem Anbau, in Qualitäten nach DIN SPEC.",
      },
    ],
  },
  {
    name: "Lignin Solutions Lab GmbH",
    description:
      "Anwendungsentwicklung für Lignin-basierte Werkstoffe. Wir machen das Nebenprodukt der Papierindustrie zum funktionellen Bestandteil von Bioklebstoffen, Bindemitteln und Komposit-Bauteilen.",
    contact_name: "Dr. Henning Vogt",
    contact_phone: "+49 511 4433221",
    size_slug: "1-10",
    industry_slugs: ["chemie", "forschung-und-entwicklung", "bauwesen"],
    technology: [
      { slug: "kunststofftechnik", trl: 5 },
    ],
    machine_slugs: [],
    knowhows: [
      { slug: "bioraffinerie", score: 80 },
      { slug: "rezepturentwicklung", score: 70 },
      { slug: "biobasierte-additive", score: 65 },
    ],
    demos: [],
    services: [
      {
        title: "Lignin-Anwendungsstudien",
        description:
          "Wir prüfen Lignin-Fraktionen aus Ihrem Prozess auf Eignung als Klebstoff- oder Polymerkomponente.",
      },
    ],
  },
  {
    name: "BioFilm Technik GmbH",
    description:
      "Hersteller bioabbaubarer Folien für Landwirtschaft, Hygiene und Verpackung. Eigene Blasfolien- und Cast-Folien-Linien für Stärke-, PLA- und PBAT-Compounds.",
    contact_name: "Karim Özdemir",
    contact_phone: "+49 7141 887766",
    size_slug: "51-250",
    industry_slugs: ["landwirtschaft", "verpackung", "lebensmittel"],
    technology: [
      { slug: "kunststofftechnik", trl: 9 },
    ],
    machine_slugs: ["spritzgussmaschine"],
    knowhows: [
      { slug: "extrusion", score: 90 },
      { slug: "blasformen", score: 85 },
      { slug: "rheologie", score: 70 },
    ],
    demos: [
      {
        title: "Mulchfolien-Demonstrationsfeld",
        description:
          "Großflächiger Praxistest kompostierbarer Mulchfolien gemeinsam mit landwirtschaftlichen Partnern.",
      },
    ],
    services: [
      {
        title: "Folienentwicklung",
        description:
          "Maßgeschneiderte Bio-Folien nach Anforderungsprofil – Dicke, Permeabilität, Abbaurate.",
      },
    ],
  },
  {
    name: "ReGran Aufbereitung GmbH",
    description:
      "Spezialist für die Aufbereitung von Post-Consumer-Rezyklaten zu hochwertigen Mahlgut- und Granulat-Qualitäten. Eigenes Labor für Materialfreigaben und Lebensmittelkontaktbewertungen.",
    contact_name: "Beate Hofmann",
    contact_phone: "+49 5341 224466",
    size_slug: "11-50",
    industry_slugs: ["kreislaufwirtschaft", "verpackung", "konsumgueter"],
    technology: [
      { slug: "kunststofftechnik", trl: 8 },
      { slug: "pruefung-qualitaetssicherung", trl: 9 },
    ],
    machine_slugs: ["optisches-messsystem"],
    knowhows: [
      { slug: "mechanisches-recycling", score: 85 },
      { slug: "oberflaechenanalytik", score: 60 },
    ],
    demos: [],
    services: [
      {
        title: "Rezyklat-Lohnaufbereitung",
        description:
          "Waschen, Mahlen, Compoundieren und Granulieren Ihrer Post-Consumer-Ströme.",
      },
      {
        title: "Materialfreigabe-Lab",
        description:
          "Migrationstests und Freigaben für Lebensmittelkontakt nach EU 10/2011.",
      },
    ],
  },
  {
    name: "NaturFix Klebstoffe GmbH",
    description:
      "Entwicklung biobasierter Klebstoffe für Holz, Papier und Verpackungen. Unsere Rezepturen ersetzen petrochemische Bindemittel durch Lignin, Stärke und Proteine aus regionalen Quellen.",
    contact_name: "Dr. Lina Schober",
    contact_phone: "+49 7531 998877",
    size_slug: "11-50",
    industry_slugs: ["chemie", "moebel-und-einrichtung", "verpackung"],
    technology: [
      { slug: "kunststofftechnik", trl: 7 },
    ],
    machine_slugs: [],
    knowhows: [
      { slug: "rezepturentwicklung", score: 85 },
      { slug: "biobasierte-additive", score: 70 },
      { slug: "bioabbaubarkeit", score: 55 },
    ],
    demos: [],
    services: [
      {
        title: "Klebstoffentwicklung",
        description:
          "Kundenspezifische Bio-Bindemittel nach DIN EN 204 und ASTM D5868, inkl. Pilotchargen.",
      },
    ],
  },
  {
    name: "3D PrintBio Studio",
    description:
      "Additive Fertigung mit Biopolymeren für Designprototypen, medizintechnische Modelle und Kleinserien. Eigener Filament-Extruder für individuelle Bio-Compounds.",
    contact_name: "Mira Adler",
    contact_phone: "+49 30 5544332",
    size_slug: "1-10",
    industry_slugs: ["medizintechnik", "konsumgueter", "forschung-und-entwicklung"],
    technology: [
      { slug: "additive-fertigung", trl: 8, notes: "FDM, SLA, MJF" },
      { slug: "cad-cam", trl: 9 },
    ],
    machine_slugs: ["3d-drucker-fdm", "3d-drucker-sla", "3d-drucker-slm"],
    knowhows: [
      { slug: "rezepturentwicklung", score: 60 },
      { slug: "compoundierung", score: 55 },
    ],
    demos: [
      {
        title: "Bio-Filament-Extruder",
        description:
          "Eigene Anlage zur Herstellung von 1,75-mm-Filamenten aus PLA-, PHA- und Holzfaser-Compounds.",
      },
    ],
    services: [
      {
        title: "3D-Druck-Service",
        description:
          "Vom Konzept zum Bauteil – inkl. Materialberatung und Nachbearbeitung.",
      },
    ],
  },
  {
    name: "Pyro Cycle Anlagenbau GmbH",
    description:
      "Ingenieurbüro und Anlagenbauer für Pyrolyse- und Solvolyseanlagen. Wir liefern schlüsselfertige Recyclinganlagen für gemischte Kunststoffabfälle in den Maßstäben 1.000 – 50.000 t/a.",
    contact_name: "Ingo Brettmeister",
    contact_phone: "+49 234 5544332",
    size_slug: "51-250",
    industry_slugs: ["kreislaufwirtschaft", "chemie", "bauwesen"],
    technology: [
      { slug: "maschinenbau", trl: 8 },
      { slug: "automatisierung", trl: 8 },
      { slug: "sps-programmierung", trl: 9 },
    ],
    machine_slugs: ["bearbeitungszentrum", "schweissroboter"],
    knowhows: [
      { slug: "chemisches-recycling", score: 85 },
      { slug: "bioraffinerie", score: 60 },
    ],
    demos: [
      {
        title: "Demonstrator Pyrolyse 500 kg/h",
        description:
          "Containerlösung zur Verölung von Mischkunststoffen, vor Ort beim Kunden testbar.",
      },
    ],
    services: [
      {
        title: "Engineering",
        description:
          "Verfahrensauslegung, Basic Engineering und EPC für Recyclinganlagen.",
      },
    ],
  },
  {
    name: "AquaBio Lab GmbH",
    description:
      "Auftragsforschungsinstitut für wasserbasierte Biokunststoff-Systeme. Wir charakterisieren Quellverhalten, Abbauraten und Migrationsverhalten neuer Materialien für Marken, Verarbeiter und Behörden.",
    contact_name: "Dr. Felix Brandt",
    contact_phone: "+49 6151 776655",
    size_slug: "1-10",
    industry_slugs: ["forschung-und-entwicklung", "chemie", "lebensmittel"],
    technology: [
      { slug: "pruefung-qualitaetssicherung", trl: 9 },
    ],
    machine_slugs: ["optisches-messsystem", "koordinatenmessmaschine"],
    knowhows: [
      { slug: "bioabbaubarkeit", score: 90 },
      { slug: "oberflaechenanalytik", score: 80 },
      { slug: "lebenszyklusanalyse", score: 75 },
    ],
    demos: [],
    services: [
      {
        title: "Bioabbaubarkeits-Prüfung",
        description:
          "Norm- und Praxistests nach EN 13432, ISO 14855 und ASTM D6400.",
      },
      {
        title: "LCA-Studien",
        description:
          "Lebenszyklusanalysen für Materialien und Produkte nach ISO 14040/14044.",
      },
    ],
  },
];

interface IdMaps {
  industry: Map<string, number>;
  knowhow: Map<string, number>;
  technology: Map<string, number>;
  machine: Map<string, number>;
  size: Map<string, number>;
}

async function ensureTaxonomies(client: PoolClient): Promise<void> {
  for (const [slug, name] of INDUSTRIES) {
    await client.query(
      `INSERT INTO industries (slug, name) VALUES ($1, $2)
         ON CONFLICT (slug) DO NOTHING`,
      [slug, name]
    );
  }
  for (const [slug, name] of KNOWHOWS) {
    await client.query(
      `INSERT INTO knowhows (slug, name) VALUES ($1, $2)
         ON CONFLICT (slug) DO NOTHING`,
      [slug, name]
    );
  }
}

async function loadIdMaps(): Promise<IdMaps> {
  const [techs, machines, industries, knowhows, sizes] = await Promise.all([
    query<{ id: number; slug: string }>("SELECT id, slug FROM technologies"),
    query<{ id: number; slug: string }>("SELECT id, slug FROM machines"),
    query<{ id: number; slug: string }>("SELECT id, slug FROM industries"),
    query<{ id: number; slug: string }>("SELECT id, slug FROM knowhows"),
    query<{ id: number; slug: string }>("SELECT id, slug FROM company_sizes"),
  ]);
  const toMap = (rows: { id: number; slug: string }[]) =>
    new Map(rows.map((r) => [r.slug, r.id]));
  return {
    technology: toMap(techs.rows),
    machine: toMap(machines.rows),
    industry: toMap(industries.rows),
    knowhow: toMap(knowhows.rows),
    size: toMap(sizes.rows),
  };
}

function buildEmail(name: string): string {
  const slug = slugify(name) || "firma";
  return `test@${slug}.com`;
}

function buildAggregate(
  seed: SeedCompany,
  maps: IdMaps
): CompanyInputAggregate {
  const sizeId = maps.size.get(seed.size_slug) ?? null;

  const industry_ids = seed.industry_slugs
    .map((s) => maps.industry.get(s))
    .filter((id): id is number => typeof id === "number");

  const machine_ids = seed.machine_slugs
    .map((s) => maps.machine.get(s))
    .filter((id): id is number => typeof id === "number");

  const technologies = seed.technology
    .map((t) => {
      const id = maps.technology.get(t.slug);
      if (!id) return null;
      return {
        technology_id: id,
        trl: t.trl ?? null,
        notes: t.notes ?? "",
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const knowhows = seed.knowhows
    .map((k) => {
      const id = maps.knowhow.get(k.slug);
      if (!id) return null;
      return { knowhow_id: id, score: k.score };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    name: seed.name,
    description: seed.description,
    contact_name: seed.contact_name,
    contact_email: buildEmail(seed.name),
    contact_phone: seed.contact_phone,
    size_id: sizeId,
    industry_ids,
    machine_ids,
    technologies,
    knowhows,
    demos: seed.demos.map((d) => ({ title: d.title, description: d.description })),
    services: seed.services.map((s) => ({ title: s.title, description: s.description })),
    technology_suggestions: [],
  };
}

async function emailExists(email: string): Promise<boolean> {
  const { rowCount } = await query("SELECT 1 FROM users WHERE email = $1", [email]);
  return (rowCount ?? 0) > 0;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      force: { type: "boolean", default: false },
    },
    strict: false,
  });

  const force = Boolean(values.force);

  await withTransaction(async (client) => {
    await ensureTaxonomies(client);
  });

  const maps = await loadIdMaps();

  let created = 0;
  let skipped = 0;

  for (const seed of COMPANIES) {
    const email = buildEmail(seed.name);

    if (!force && (await emailExists(email))) {
      // eslint-disable-next-line no-console
      console.log(`↷ ${seed.name} – existiert bereits (${email}), übersprungen.`);
      skipped += 1;
      continue;
    }

    const aggregate = buildAggregate(seed, maps);
    const passwordHash = await hashPassword(seed.name);

    await withTransaction(async (client) => {
      await createCompanyWithUser(client, {
        company: aggregate,
        user: { email, password_hash: passwordHash },
        status: "approved",
      });
    });

    created += 1;
    // eslint-disable-next-line no-console
    console.log(`✓ ${seed.name}  →  ${email}  (Passwort: ${seed.name})`);
  }

  // eslint-disable-next-line no-console
  console.log(
    `\nFertig. ${created} Firmen angelegt, ${skipped} übersprungen, gesamt ${COMPANIES.length}.`
  );
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
