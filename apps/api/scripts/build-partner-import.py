#!/usr/bin/env python3
"""Baut partner-import.json aus Partnerliste + Umfrage Technologieplattform.

Filter Partnerliste: Hauptansprechpartner = x UND LOI abgelegt? = x
Anreicherung: Umfrage-Antworten per Name/E-Mail-Matching.
"""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path

import openpyxl

PARTNER = Path(
    "/Volumes/SSK Drive/SKZ/250127_CREATE_Liste potentieller Partner.xlsx"
)
SURVEY = Path("/Volumes/SSK Drive/SKZ/Umfrage Technologieplattform(1-11).xlsx")
OUT_DIR = Path(__file__).resolve().parents[1] / "data"
OUT = OUT_DIR / "partner-import.json"
REPORT = OUT_DIR / "partner-import-report.json"

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

INDUSTRY_FROM_KUERZEL = {
    "ber": ("beratung-und-dienstleistungen", "Beratung und Dienstleistungen"),
    "fe": ("forschung-und-entwicklung", "Forschung und Entwicklung"),
    "lw": (
        "landwirtschaftliche-rohstoffproduktion",
        "Landwirtschaftliche Rohstoffproduktion",
    ),
    "her": (
        "kunststoff-chemikalien-rohstofferzeugung",
        "Kunststoff-, Chemikalien- und Rohstofferzeugung",
    ),
    "ver": (
        "kunststoffverarbeitung-compoundeur",
        "Kunststoffverarbeitung, Compoundeur",
    ),
    "masch": ("kunststoffmaschinenbau", "Kunststoffmaschinenbau"),
    "ver2": (
        "verarbeitung-vertrieb-endprodukte",
        "Verarbeitung und Vertrieb von Endprodukten",
    ),
    "rec": (
        "kunststoffrecycling",
        "Kunststoffrecycling inkl. Entsorgung und Sortierung",
    ),
}

SURVEY_INDUSTRY_MAP = {
    "forschung & entwicklung": (
        "forschung-und-entwicklung",
        "Forschung und Entwicklung",
    ),
    "forschung und entwicklung": (
        "forschung-und-entwicklung",
        "Forschung und Entwicklung",
    ),
    "beratung & dienstleistung (kommunikation, forschung, technik, finanzen etc.)": (
        "beratung-und-dienstleistungen",
        "Beratung und Dienstleistungen",
    ),
    "kunststoffindustrie": (
        "kunststoffverarbeitung-compoundeur",
        "Kunststoffverarbeitung, Compoundeur",
    ),
    "weiteres verarbeitendes gewerbe": (
        "verarbeitung-vertrieb-endprodukte",
        "Verarbeitung und Vertrieb von Endprodukten",
    ),
    "energieerzeugung": ("energieerzeugung", "Energieerzeugung"),
    "psa herstellung": ("psa-herstellung", "PSA Herstellung"),
}

SIZE_MAP = [
    (re.compile(r"kleinst", re.I), "1-10"),
    (re.compile(r"kleine unternehmen", re.I), "11-50"),
    (re.compile(r"mittlere unternehmen", re.I), "51-250"),
    (re.compile(r"mittelgro", re.I), "251-1000"),
    (re.compile(r"gro[sß]unternehmen|\(gu\)", re.I), "gt-1000"),
]

KNOWHOW_RELEVANCE = {
    "sehr relevant": 90,
    "relevant": 70,
    "wenig relevant": 40,
    "nicht relevant": 10,
}

KNOWHOW_TOPICS = [
    (32, "materialentwicklung-verarbeitung", "Materialentwicklung und Verarbeitung"),
    (33, "nachhaltigkeitsbetrachtung", "Nachhaltigkeitsbetrachtung"),
    (34, "marktzugang-best-practices", "Marktzugang und Best Practices"),
    (35, "chemie-erneuerbarer-materialien", "Chemie erneuerbarer Materialien"),
    (
        36,
        "kreislaufschliessung-biomasse",
        "Kreislaufschließung durch Biomasse als Rohstoff und Kompostierbarkeit",
    ),
]

LEGAL_NOISE = {
    "gmbh",
    "co",
    "kg",
    "ag",
    "se",
    "eg",
    "e.v.",
    "ev",
    "ug",
    "&",
    "und",
    "the",
    "inc",
    "ltd",
    "group",
    "gruppe",
    "industrie",
    "industrien",
}


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower()
    text = (
        text.replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .replace("ß", "ss")
    )
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:80] or "eintrag"


def clean(s):
    if s is None:
        return None
    s = str(s).replace("\xa0", " ").strip()
    if s in ("", "/", "-", "–", "None", "null"):
        return None
    return s


def normalize_name(name: str) -> str:
    n = (clean(name) or "").lower()
    n = unicodedata.normalize("NFKD", n)
    n = "".join(c for c in n if not unicodedata.combining(c))
    n = (
        n.replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .replace("ß", "ss")
    )
    for token in LEGAL_NOISE:
        n = re.sub(rf"\b{re.escape(token)}\b", " ", n)
    n = re.sub(r"[^a-z0-9]+", " ", n)
    return re.sub(r"\s+", " ", n).strip()


def name_score(a: str, b: str) -> float:
    na, nb = normalize_name(a), normalize_name(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    if na in nb or nb in na:
        shorter = min(len(na), len(nb))
        longer = max(len(na), len(nb))
        if shorter >= 5 and shorter / longer >= 0.45:
            return 0.95
        return 0.5
    ta, tb = set(na.split()), set(nb.split())
    jaccard = len(ta & tb) / len(ta | tb) if (ta | tb) else 0.0
    seq = SequenceMatcher(None, na, nb).ratio()
    if min(len(na), len(nb)) <= 8:
        return max(jaccard, seq if seq >= 0.9 else 0.0)
    return max(jaccard, seq)


def parse_address(addr: str | None, plz_fallback=None, city_fallback=None):
    street = None
    postal = clean(plz_fallback)
    city = clean(city_fallback)
    country = "Deutschland"
    if not addr:
        if postal and len(str(postal)) == 4:
            country = "Österreich"
        return street, postal, city, country
    lines = [
        ln.strip() for ln in str(addr).replace("\r", "").split("\n") if ln.strip()
    ]
    if not lines:
        return street, postal, city, country
    if len(lines) >= 2:
        street = lines[0]
        m = re.match(r"^(\d{4,5})\s+(.+)$", lines[1])
        if m:
            postal = m.group(1)
            city = m.group(2).strip(" /")
        else:
            city = lines[1]
    else:
        m = re.match(r"^(.+?)\s+(\d{4,5})\s+(.+)$", lines[0])
        if m:
            street = m.group(1)
            postal = m.group(2)
            city = m.group(3).strip(" /")
        else:
            m2 = re.match(r"^(\d{4,5})\s+(.+)$", lines[0])
            if m2:
                postal = m2.group(1)
                city = m2.group(2).strip(" /")
            else:
                street = lines[0]
    if city:
        city = re.sub(r"\s*/\s*Hessen\s*$", "", city, flags=re.I).strip()
    if postal and len(str(postal)) == 4:
        country = "Österreich"
    return street, postal, city, country


def normalize_website(url: str | None):
    u = clean(url)
    if not u:
        return None
    if not re.match(r"^https?://", u, re.I):
        u = "https://" + u
    return u


def parse_contact_block(block: str | None):
    if not block:
        return {}
    lines = [
        ln.strip() for ln in str(block).replace("\r", "").split("\n") if ln.strip()
    ]
    out: dict = {}
    emails: list[str] = []
    phones: list[str] = []
    names: list[str] = []
    positions: list[str] = []
    for ln in lines:
        if "," in ln and "@" in ln and len(lines) == 1:
            parts = [p.strip() for p in ln.split(",")]
            for p in parts:
                if EMAIL_RE.match(p):
                    emails.append(p)
                elif re.search(r"\d{5,}", p) and re.search(r"[\d+/\-\s]{8,}", p):
                    phones.append(p)
                elif not names:
                    names.append(p)
                else:
                    positions.append(p)
            continue
        if EMAIL_RE.match(ln.split()[0] if ln else ""):
            emails.append(ln.split()[0])
        elif EMAIL_RE.search(ln):
            emails.append(EMAIL_RE.search(ln).group(0))
        elif re.search(r"(\+?\d[\d\s/\-]{6,}\d)", ln) and not re.search(
            r"[A-Za-zÄÖÜäöüß]{4,}", ln
        ):
            phones.append(ln)
        elif not names:
            if "," in ln:
                parts = [p.strip() for p in ln.split(",")]
                names.append(parts[0])
                for p in parts[1:]:
                    if EMAIL_RE.match(p):
                        emails.append(p)
                    elif re.search(r"\d{6,}", p):
                        phones.append(p)
                    elif not positions:
                        positions.append(p)
            else:
                names.append(ln)
        elif not positions:
            positions.append(ln)
        elif re.search(r"\d", ln):
            phones.append(ln)
    if names:
        out["name"] = names[0]
    if positions:
        out["position"] = positions[0]
    if emails:
        out["email"] = emails[0]
    if phones:
        out["phone"] = phones[0]
    return out


def map_size(size_str):
    if not size_str:
        return None
    for rx, size_slug in SIZE_MAP:
        if rx.search(str(size_str)):
            return size_slug
    return None


def split_services(text):
    if not text:
        return []
    items = []
    chunks = re.split(r"\n\s*\n+", str(text).strip())
    for ch in chunks:
        lines = [ln.strip() for ln in ch.split("\n") if ln.strip()]
        if not lines:
            continue
        title = lines[0][:200]
        desc = "\n".join(lines[1:]) if len(lines) > 1 else None
        if len(chunks) == 1 and len(lines) > 1 and all(len(l) < 120 for l in lines):
            for ln in lines:
                items.append(
                    {"title": ln[:200], "description": None, "sort_order": len(items)}
                )
            return items
        items.append({"title": title, "description": desc, "sort_order": len(items)})
    return items[:20]


def split_demos(text):
    if not text:
        return []
    items = []
    for ln in str(text).split("\n"):
        ln = ln.strip()
        if not ln:
            continue
        items.append({"title": ln[:200], "description": None, "sort_order": len(items)})
    return items[:20]


def tech_suggestions_from_text(text, trl_fallback=None):
    if not text:
        return []
    suggestions = []
    parts = re.split(r"\n\s*\n+", str(text).strip())
    if len(parts) == 1:
        lines = [ln.strip() for ln in str(text).split("\n") if ln.strip()]
        current = None
        for ln in lines:
            m = re.search(r"TRL\s*(\d)(?:\s*[-–]\s*(\d))?", ln, re.I)
            if m and re.match(r"^TRL", ln, re.I):
                if current:
                    lo = int(m.group(1))
                    hi = int(m.group(2)) if m.group(2) else lo
                    current["trl"] = max(1, min(9, (lo + hi) // 2))
                continue
            if m and not re.match(r"^TRL", ln, re.I):
                name = re.sub(
                    r"\(TRL.*?\)|TRL\s*\d(?:\s*[-–]\s*\d)?", "", ln, flags=re.I
                ).strip(" .;")
                lo = int(m.group(1))
                hi = int(m.group(2)) if m.group(2) else lo
                if name:
                    suggestions.append(
                        {
                            "name": name[:200],
                            "notes": None,
                            "trl": max(1, min(9, (lo + hi) // 2)),
                        }
                    )
                continue
            if current and current.get("name") and not current.get("notes"):
                current["notes"] = ln
            else:
                if current:
                    suggestions.append(current)
                current = {"name": ln[:200], "notes": None, "trl": None}
        if current:
            suggestions.append(current)
    else:
        for p in parts:
            lines = [ln.strip() for ln in p.split("\n") if ln.strip()]
            if not lines:
                continue
            name = lines[0][:200]
            notes = "\n".join(lines[1:]) if len(lines) > 1 else None
            trl = None
            m = re.search(r"TRL\s*(\d)(?:\s*[-–]\s*(\d))?", p, re.I)
            if m:
                lo = int(m.group(1))
                hi = int(m.group(2)) if m.group(2) else lo
                trl = max(1, min(9, (lo + hi) // 2))
                notes = (
                    re.sub(r"TRL\s*\d(?:\s*[-–]\s*\d)?", "", notes or "", flags=re.I).strip()
                    or None
                )
            suggestions.append({"name": name, "notes": notes, "trl": trl})

    out = []
    for s in suggestions:
        name = clean(s.get("name"))
        if not name or name.lower().startswith("trl"):
            continue
        trl = s.get("trl")
        if trl is None and trl_fallback and 1 <= int(trl_fallback) <= 9:
            trl = int(trl_fallback)
        out.append({"name": name, "notes": clean(s.get("notes")), "trl": trl})
    return out[:15]


def load_partners():
    wb = openpyxl.load_workbook(PARTNER, data_only=True)
    ws = wb["Partnerliste"]
    headers = {}
    for cell in ws[2]:
        if cell.value:
            headers[cell.column] = str(cell.value).strip()
    rows = []
    for row in ws.iter_rows(min_row=3, values_only=False):
        vals = {headers.get(c.column): c.value for c in row if c.column in headers}
        hap = str(vals.get("Hauptansprechpartner") or "").strip().lower()
        loi = str(vals.get("LOI abgelegt?") or "").strip().lower()
        if hap != "x" or loi != "x":
            continue
        if not clean(vals.get("Unternehmen")):
            continue
        rows.append(vals)
    return rows


def load_surveys():
    wb = openpyxl.load_workbook(SURVEY, data_only=True)
    ws = wb["Sheet1"]
    surveys = [list(row) for row in ws.iter_rows(min_row=2, values_only=True)]
    return surveys


def find_survey(partner_name, partner_email, surveys):
    pe = (clean(partner_email) or "").lower()
    best = None
    best_score = 0.0
    for s in surveys:
        contact = str(s[12] or "").lower()
        score = 0.0
        if pe and pe in contact:
            score = 1.0
        else:
            score = max(
                name_score(partner_name, str(s[6] or "")),
                name_score(partner_name, str(s[7] or "")) if s[7] else 0.0,
            )
        if score > best_score:
            best_score = score
            best = s
    if best_score >= 0.8:
        return best, best_score
    return None, best_score


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    partners = load_partners()
    surveys = load_surveys()

    tax_industries: dict[str, str] = {}
    tax_knowhows: dict[str, str] = {}
    tax_sizes = {
        "1-10": {"name": "1 - 10 Mitarbeitende", "sort_order": 10},
        "11-50": {"name": "11 - 50 Mitarbeitende", "sort_order": 20},
        "51-250": {"name": "51 - 250 Mitarbeitende", "sort_order": 30},
        "251-1000": {"name": "251 - 1.000 Mitarbeitende", "sort_order": 40},
        "gt-1000": {"name": "mehr als 1.000 Mitarbeitende", "sort_order": 50},
    }

    companies = []
    report: dict = {
        "matched_survey": [],
        "no_survey": [],
        "skipped": [],
        "warnings": [],
    }
    used_emails: set[str] = set()

    for vals in partners:
        name = clean(vals.get("Unternehmen"))
        assert name
        email = clean(vals.get("Email"))
        vorname = clean(vals.get("Vorname"))
        nachname = clean(vals.get("Nachname"))
        contact_name = " ".join(p for p in [vorname, nachname] if p) or None
        phone = clean(vals.get("Telefon"))
        position = clean(vals.get("Rolle"))
        plz = clean(vals.get("PLZ"))
        anschrift = clean(vals.get("Anschrift"))
        branche_k = clean(vals.get("Kürzel Hauptbranche"))
        branche = clean(vals.get("Hauptbranche"))
        trl_raw = vals.get("TRL")
        tech_text = clean(vals.get("Technologie"))
        bezug = clean(
            vals.get("Bezug zur Bioökonomie nach eigenen Angaben aus LOI:")
        )

        try:
            trl_val = (
                int(trl_raw)
                if trl_raw is not None and str(trl_raw).strip() not in ("", "0", "None")
                else None
            )
            if trl_val is not None and not (1 <= trl_val <= 9):
                trl_val = None
        except (TypeError, ValueError):
            trl_val = None

        survey, score = find_survey(name, email, surveys)
        display_name = None
        website = None
        description = bezug
        street = None
        postal = plz
        city = anschrift
        country = "Deutschland"
        size_slug = None
        industry_slugs: list[str] = []
        services: list[dict] = []
        demos: list[dict] = []
        knowhows: list[dict] = []
        tech_suggestions: list[dict] = []

        if branche_k and branche_k.lower() in INDUSTRY_FROM_KUERZEL:
            slug, iname = INDUSTRY_FROM_KUERZEL[branche_k.lower()]
            industry_slugs.append(slug)
            tax_industries[slug] = iname
        elif branche:
            slug = slugify(branche)
            industry_slugs.append(slug)
            tax_industries[slug] = branche

        if survey:
            display_name = clean(survey[7])
            website = normalize_website(survey[8])
            if clean(survey[11]):
                description = clean(survey[11])
            st, po, ci, co = parse_address(survey[5], postal, city)
            street, postal, city, country = st, po or postal, ci or city, co
            size_slug = map_size(survey[13])
            for part in str(survey[14] or "").split(";"):
                part = part.strip()
                if not part:
                    continue
                key = part.lower()
                if key in SURVEY_INDUSTRY_MAP:
                    slug, iname = SURVEY_INDUSTRY_MAP[key]
                else:
                    slug, iname = slugify(part), part
                if slug not in industry_slugs:
                    industry_slugs.append(slug)
                tax_industries[slug] = iname
            sc = parse_contact_block(survey[12])
            if not contact_name and sc.get("name"):
                contact_name = sc["name"]
            if not position and sc.get("position"):
                position = sc["position"]
            if not phone and sc.get("phone"):
                phone = sc["phone"]
            if (not email or not EMAIL_RE.match(email)) and sc.get("email"):
                email = sc["email"]
            services = split_services(survey[24])
            if str(survey[25] or "").strip().lower() == "ja":
                demos = split_demos(survey[26])
            tech_suggestions = tech_suggestions_from_text(survey[23], trl_val)
            for col, slug, iname in KNOWHOW_TOPICS:
                val = survey[col] if col < len(survey) else None
                score_kh = KNOWHOW_RELEVANCE.get(str(val or "").strip().lower())
                if score_kh and score_kh >= 40:
                    knowhows.append({"slug": slug, "name": iname, "score": score_kh})
                    tax_knowhows[slug] = iname
            report["matched_survey"].append(
                {
                    "partner": name,
                    "survey": survey[6],
                    "score": round(score, 3),
                }
            )
        else:
            report["no_survey"].append(
                {"partner": name, "best_score": round(score, 3)}
            )
            street, postal, city, country = parse_address(None, postal, city)

        if not tech_suggestions and tech_text:
            tech_suggestions = tech_suggestions_from_text(tech_text, trl_val)
            if not tech_suggestions:
                tech_suggestions = [
                    {"name": tech_text[:200], "notes": None, "trl": trl_val}
                ]

        technologies = []
        if trl_val or tech_text or tech_suggestions:
            technologies.append(
                {
                    "slug": "kunststofftechnik",
                    "name": "Kunststofftechnik",
                    "trl": trl_val,
                    "notes": (tech_text[:500] if tech_text else None),
                }
            )

        if not email or not EMAIL_RE.match(email):
            report["skipped"].append(
                {"partner": name, "reason": f"ungültige E-Mail: {email!r}"}
            )
            continue

        email_l = email.lower()
        user_email = email_l
        if user_email in used_emails:
            local, domain = user_email.split("@", 1)
            user_email = f"{local}+{slugify(name)[:20]}@{domain}"
            report["warnings"].append(
                {
                    "partner": name,
                    "warning": f"E-Mail-Konflikt, Login als {user_email}",
                }
            )
        used_emails.add(user_email)

        if not contact_name:
            contact_name = name
            report["warnings"].append(
                {
                    "partner": name,
                    "warning": "kein Ansprechpartner-Name, Firmenname verwendet",
                }
            )

        companies.append(
            {
                "name": name,
                "display_name": display_name,
                "description": description,
                "website_url": website,
                "street": street,
                "postal_code": str(postal) if postal else None,
                "city": city,
                "country": country,
                "contact_name": contact_name,
                "contact_position": position,
                "contact_email": email_l,
                "contact_phone": phone,
                "user_email": user_email,
                "size_slug": size_slug,
                "industry_slugs": industry_slugs,
                "machine_slugs": [],
                "technologies": technologies,
                "knowhows": [
                    {"slug": k["slug"], "name": k["name"], "score": k["score"]}
                    for k in knowhows
                ],
                "demos": demos,
                "services": services,
                "technology_suggestions": tech_suggestions,
            }
        )

    payload = {
        "version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "taxonomies": {
            "industries": [
                {"slug": s, "name": n}
                for s, n in sorted(tax_industries.items(), key=lambda x: x[1])
            ],
            "machines": [],
            "technologies": [
                {"slug": "kunststofftechnik", "name": "Kunststofftechnik"}
            ],
            "knowhows": [
                {"slug": s, "name": n}
                for s, n in sorted(tax_knowhows.items(), key=lambda x: x[1])
            ],
            "sizes": [{"slug": s, **v} for s, v in tax_sizes.items()],
        },
        "companies": companies,
    }

    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    report["summary"] = {
        "partners_filtered": len(partners),
        "companies_ready": len(companies),
        "survey_matches": len(report["matched_survey"]),
        "no_survey": len(report["no_survey"]),
        "skipped": len(report["skipped"]),
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report["summary"], indent=2, ensure_ascii=False))
    print(f"Wrote {OUT}")
    print(f"Report {REPORT}")


if __name__ == "__main__":
    main()
