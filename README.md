# CREATE Cluster – Match-Making für die Bioökonomie der Kunststoffe

Schlanke B2B-Matchmaking-Plattform als reiner Marktplatz: Unternehmen
registrieren sich, Admins schalten Profile frei, Suchende durchforsten
Firmen nach Branchen, Technologien, Reifegrad (TRL), Maschinen, Know-how
und Unternehmensgröße und nehmen per `mailto:` Kontakt auf.

Das Profil umfasst neben Stammdaten auch Anzeigename, Website, Anschrift
(Strasse / PLZ / Ort / Land), Position des Ansprechpartners,
Know-how, Technologien (mit TRL und Freitext), Dienstleistungen,
Demonstrationsanlagen sowie Technologie-Vorschlaege fuer fehlende
Eintraege. Beim Bearbeiten warnt das Formular vor versehentlichem
Verlassen mit ungespeicherten Aenderungen (Sticky-Save + Prompt).

## Tech-Stack

- **Backend**: Node.js 20, Express 4, TypeScript, `pg` (pures SQL, kein ORM)
- **DB**: PostgreSQL 16 mit `pg_trgm`, `citext`, Volltextsuche (`german`)
- **Frontend**: Vite, React 18, TypeScript, Tailwind CSS, TanStack Query, React Router
- **Graph**: `@xyflow/react` (Darstellung), `elkjs` (Auto-Layout), `@dnd-kit` (Admin-Editor)
- **Auth**: JWT im HttpOnly-Cookie, `argon2`, Token-Versionierung pro User
- **Sicherheit**: `helmet`, CORS-Whitelist, `express-rate-limit` (Auth + Suche + Feedback)
- **Logging**: `pino` + `pino-http`
- **Uploads**: `multer` + `sharp` (WebP 512x512) auf lokales Volume
- **E-Mail**: `nodemailer` (SMTP), in Dev `mailpit` als lokaler Testserver
- **Migrations**: `node-pg-migrate` mit reinen SQL-Dateien
- **Validierung**: Zod (Schemas in `packages/shared`)
- **Sprache**: Deutsch (kein i18n-Framework)

## Projektstruktur

```
apps/
  api/                 Express-API (TypeScript, pures SQL)
    src/db/migrations  SQL-Migrationen (node-pg-migrate)
    src/modules        auth, companies, feedback, me, taxonomies, graph, admin
    src/lib            config, logger, jwt, password, uploads, slug,
                       mailer, mail-templates, settings, notifications
    src/middlewares    auth, validate, async-handler, require-role
    src/scripts        CLI-Skripte (z. B. create-admin)
    uploads/           lokales Docker-Volume für Logos
  web/                 Vite + React + Tailwind Frontend
    public/            statische Assets (Logo, favicon)
    src/pages          Home, Suche, Firma, Netzwerk, Profil, Login,
                       Registrieren, Feedback, PasswortVergessen,
                       PasswortZuruecksetzen, admin/*
    src/components     Layout, BrandMark, CompanyForm, CompanyLogo, graph/*
packages/shared/       Zod-Schemas + gemeinsame Types
docs/                  Ausführliche Entwicklerdokumentation (Netzwerkgraph)
docker-compose.yml     Postgres + Mailpit + API + Web für Dev
.env.example           Beispiel-Konfiguration
```

## Voraussetzungen

- Node.js 20+
- npm 10+
- Docker Desktop (optional, empfohlen für die Datenbank)

## Schnellstart mit Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Das startet Postgres, Mailpit, API (Port 3000) und Web (Port 5173). Die
Mailpit-Web-UI fängt in Dev sämtliche ausgehenden E-Mails ab und ist unter
<http://localhost:8025> erreichbar (SMTP auf Port 1025). Beim ersten Start:

```bash
# Migrationen einspielen
docker compose exec api npm run migrate:up

# Admin-Benutzer anlegen
docker compose exec api npm run admin:create -- \
  --email=admin@example.com --password=mind10Zeichen
```

Danach ist die Anwendung unter <http://localhost:5173> erreichbar,
die API unter <http://localhost:4000>.

## Lokaler Dev-Start ohne Docker

```bash
cp .env.example .env
# Postgres lokal starten, z. B. via Docker:
docker run --name b2b-pg -e POSTGRES_PASSWORD=b2b_dev_password \
  -e POSTGRES_USER=b2b -e POSTGRES_DB=b2b_matchmaking \
  -p 5432:5432 -d postgres:16-alpine

# In .env DATABASE_URL anpassen: localhost statt postgres
# DATABASE_URL=postgres://b2b:b2b_dev_password@localhost:5432/b2b_matchmaking

npm install
npm run migrate:up
npm run admin:create -- --email=admin@example.com --password=mind10Zeichen
npm run dev
```

`npm run dev` startet API und Web parallel (über `npm-run-all`).

## NPM-Skripte (Root)

| Skript                 | Funktion                                                |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | API + Web parallel im Dev-Modus starten                 |
| `npm run build`        | Shared, API und Web produktiv bauen                     |
| `npm run lint`         | Lint für API und Web ausführen                          |
| `npm run migrate:up`   | Alle offenen Migrationen einspielen                     |
| `npm run migrate:down` | Letzte Migration zurücknehmen                           |
| `npm run admin:create` | Admin-Benutzer anlegen (`-- --email=... --password=...`)|
| `npm run seed:demo`    | 15 Demo-Firmen für Test/Präsentation anlegen (idempotent) |

## Wichtige API-Endpunkte

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/password/request    Einmal-Code per Mail anfordern
POST   /api/auth/password/reset      Code + neues Passwort einlösen

GET    /api/companies                ?page&limit
GET    /api/companies/search         ?q&tech=&machine=&industry=&size=&knowhow=
                                     &offers_services=true&trl_min=&trl_max=
                                     &page&limit
GET    /api/companies/:slug

GET    /api/me/company
PUT    /api/me/company
POST   /api/me/company/logo          (multipart "logo")

POST   /api/feedback                 öffentlich, 5/15min Limit, Honeypot

GET    /api/technologies          inkl. Gruppe, in Gruppen-/Sortierreihenfolge
GET    /api/technology-groups
GET    /api/machines
GET    /api/industries
GET    /api/knowhows
GET    /api/company-sizes
GET    /api/section-descriptions     Hilfetexte pro Abschnitt (oeffentlich)

GET    /api/graph/scope              ?path=ebene/unterebene (leer = Wurzel)
GET    /api/graph/edge-kinds         Verbindungstypen für die Legende
GET    /api/graph/find               ?q= Firmen im Graphen inkl. Pfad

GET    /api/admin/companies          ?q&status=pending|approved|suspended
POST   /api/admin/companies          Firma + Login-User in einem Schritt anlegen
GET    /api/admin/companies/:id
PUT    /api/admin/companies/:id
PATCH  /api/admin/companies/:id/status
DELETE /api/admin/companies/:id                 nur status=suspended (Hard-Delete inkl. User)
POST   /api/admin/companies/:id/logo
POST   /api/admin/companies/:id/mark-reviewed   Diff-Snapshot zuruecksetzen

GET    /api/admin/technology-suggestions       ?status=open|accepted|rejected|all
POST   /api/admin/technology-suggestions/:id/accept
POST   /api/admin/technology-suggestions/:id/reject
DELETE /api/admin/technology-suggestions/:id

GET/POST/PATCH/DELETE /api/admin/technologies[/:id]   Body: { name, group_id }
POST   /api/admin/technologies/:id/move   Body: { direction: up|down }
GET/POST/PATCH/DELETE /api/admin/technology-groups[/:id]
GET/POST/PATCH/DELETE /api/admin/machines[/:id]
GET/POST/PATCH/DELETE /api/admin/industries[/:id]
GET/POST/PATCH/DELETE /api/admin/knowhows[/:id]
GET/POST/PATCH/DELETE /api/admin/company-sizes[/:id]

GET    /api/admin/feedback           ?handled=true|false&page&limit
PATCH  /api/admin/feedback/:id       Body: { handled: boolean }
DELETE /api/admin/feedback/:id

GET    /api/admin/settings           liefert { admin_notification_email }
PUT    /api/admin/settings           setzt die Notification-Adresse
POST   /api/admin/settings/test-mail Body: { email } — SMTP-Test mit festem Template

GET    /api/admin/section-descriptions
PUT    /api/admin/section-descriptions  Body: { descriptions: { <abschnitt>: text } }

GET    /api/admin/graph/scope        ?parent_id= (leer = Wurzel), speist die drei Listen
GET    /api/admin/graph/companies    ?q&parent_id — Autocomplete beim Aufnehmen
GET    /api/admin/graph/find         ?q= wie oeffentlich, ohne Freigabefilter
POST/PATCH /api/admin/graph/layers[/:id]
GET    /api/admin/graph/layers/:id/impact   zaehlt, was ein Loeschen mitnimmt
POST   /api/admin/graph/nodes               Firma in einer Ebene platzieren
POST   /api/admin/graph/nodes/:id/move      Body: { parent_id, sort_order? }
POST   /api/admin/graph/nodes/reorder       Body: { node_ids: [...] }
DELETE /api/admin/graph/nodes/:id
POST/PATCH/DELETE /api/admin/graph/edges[/:id]
GET/POST/PATCH/DELETE /api/admin/graph/edge-kinds[/:id]

GET    /api/admin/stats
```

## Konfiguration (.env)

Die wichtigsten Variablen (siehe `.env.example`):

| Variable                  | Beschreibung                                    |
| ------------------------- | ----------------------------------------------- |
| `DATABASE_URL`            | Postgres-Connection-String                      |
| `JWT_SECRET`              | Geheimnis für JWT-Signierung                    |
| `COOKIE_SECRET`           | Geheimnis für signierte Cookies                 |
| `COOKIE_SECURE`           | `true` in Produktion (HTTPS-only Cookies)       |
| `CORS_ORIGIN`             | erlaubte Frontend-URLs, kommagetrennt           |
| `UPLOADS_DIR`             | absoluter Pfad zum Upload-Ordner                |
| `PUBLIC_UPLOADS_BASE_URL` | öffentliche Basis-URL der Logos                 |
| `APP_BASE_URL`            | Frontend-Basis-URL (für Reset- und Admin-Links) |
| `SMTP_HOST`               | SMTP-Server (Dev: `mailpit`)                    |
| `SMTP_PORT`               | SMTP-Port (Dev: `1025`)                         |
| `SMTP_SECURE`             | `true` für TLS, sonst leer                      |
| `SMTP_USER` / `SMTP_PASSWORD` | optionale SMTP-Auth                         |
| `MAIL_FROM`               | Absenderadresse für ausgehende Mails            |
| `VITE_API_BASE_URL`       | API-URL für das Frontend                        |

## Such- und Filterlogik

- Volltextsuche per `to_tsvector('german', ...)` über Firmenname (Gewicht A),
  Beschreibung (B), Demo- und Service-Titel (B), sowie Technologien,
  Maschinen, Branchen, aktivem Know-how (Score > 0), Tech-Notes,
  Demo- und Service-Beschreibungen (alle C).
- Zusätzlich Trigram-Fallback (`name ILIKE '%...%'`) für robuste Treffer
  bei Tippfehlern.
- Filter werden **UND-verknüpft**: eine Firma muss *alle* gewählten
  Technologien, Maschinen, Branchen bzw. Know-how-Themen besitzen.
- Das Suchfeld unterstuetzt sowohl eine **Live-Suche** (`?q=`, mit 300 ms
  Debounce) als auch fest gepinnte **Tag-Chips** (`?qs=tag1,tag2`, max. 8
  Eintraege, kommasepariert). Mit `Enter` oder `,` im Suchfeld wird der
  aktuelle Suchbegriff zu einem Tag fixiert. Alle `qs`-Tags werden
  UND-verknuepft mit dem aktuellen Live-`q` und sind als entfernbare
  Chips ueber der Trefferliste sichtbar.
- Unternehmensgröße ist Single-Select; mehrere zulässige Werte (`size=1,2`)
  werden als `size_id IN (...)` ausgewertet.
- TRL-Filter (`trl_min`, `trl_max`) verlangt mindestens eine Technologie
  der Firma im gegebenen Reifegrad-Korridor.
- `offers_services=true` filtert auf Firmen mit mindestens einem
  Dienstleistungseintrag.
- Ergebnisse sind auf Firmen mit `status = 'approved'` beschränkt.

## Sicherheits-Essentials

- `argon2` für Passwort-Hashes und Reset-Codes
- JWT im HttpOnly-Cookie, `SameSite=Lax`, signiert mit `cookie-parser`
- Token-Versionierung pro User: nach Passwort-Reset werden alle bestehenden
  Sessions automatisch ungültig (Cookie wird beim nächsten Request gelöscht)
- Passwort-Reset: 6-stelliger Einmal-Code, 30 min gültig, single-use,
  Code wird nur als Argon2-Hash gespeichert; Antwort des Request-Endpoints
  ist immer identisch (kein User-Enumeration)
- `helmet`, CORS-Whitelist, `express-rate-limit` (Login/Register/Reset:
  20 fehlgeschlagene Versuche pro 15 min und IP, `/auth/me` und `/logout`
  sind ausgenommen; Suche: 60/min, Feedback: 5/15min)
- Zod-Validierung aller Eingaben (Body und Query)
- Honeypot-Feld auf der Feedback-Seite gegen einfache Spam-Bots
- Logo-Upload: MIME-Filter, Re-Encode via `sharp` (512x512 WebP), 2 MB Limit
- Admins werden ausschließlich über das CLI-Script angelegt

## Admin-Bereich

Unter `/admin` finden eingeloggte Admins:

- **Dashboard**: Kennzahlen auf einen Blick
- **Firmen**: Liste mit Suchfeld (Volltextsuche ueber Firmenname, Profil,
  Kontakt- und Login-E-Mail, 300 ms Debounce, Status-unabhaengig) und
  Status-Filter (`pending` / `approved` / `suspended` =
  Abgelehnt); Anlegen, Bearbeiten, Logo-Upload sowie Freischalten und
  Ablehnen. Die frueheren Werte `rejected` und `suspended` wurden zu einem
  einzigen Status "Abgelehnt" (intern `suspended`) zusammengefasst; das
  Profil bleibt dabei vollstaendig erhalten und kann durch eine erneute
  Freigabe wieder veroeffentlicht werden. Abgelehnte Firmen koennen
  endgueltig geloescht werden (Firma, Login-User und Relationen inkl. Logo).
- **Diff-Highlight im Profil**: Beim Bearbeiten einer Firma werden alle
  Felder, die sich seit der letzten Freigabe geaendert haben, feldgenau
  hervorgehoben. Ueber "Als geprueft markieren" wird der Diff-Snapshot
  zurueckgesetzt, ohne den Status zu aendern.
- **Tech-Vorschlaege**: Firmen koennen im Profilformular neue Technologien
  vorschlagen. Bereits eingereichte Vorschlaege werden der Firma im Profil
  read-only mit Status-Badge (offen / angenommen / abgelehnt) angezeigt;
  in den letzten 90 Tagen entschiedene Vorschlaege bleiben dort sichtbar.
  Admins koennen einzelne Vorschlaege direkt in der Firma-Bearbeitung oder
  zentral unter `/admin/tech-vorschlaege` (Filter offen / angenommen /
  abgelehnt / alle) verarbeiten: "Annehmen" legt - falls noch nicht
  vorhanden - eine globale Technologie in der gewaehlten Gruppe an und
  verknuepft sie automatisch mit der einreichenden Firma. "Ablehnen" oder
  "Loeschen" entfernt den Vorschlag aus der Pipeline.
- **Branchen**: CRUD für die Branchen-Taxonomie
- **Größen**: CRUD für Unternehmensgrößen (mit Sortierung)
- **Know-how**: CRUD für Know-how-Themen
- **Technologien**: CRUD für Technologie-Gruppen (Name, Beschreibung,
  Sortierung) und Technologien. Jede Technologie gehört zu höchstens einer
  Gruppe; ohne Zuordnung landet sie im Block "Ohne Gruppe" am Listenende.
  Die Reihenfolge innerhalb einer Gruppe wird über Auf-/Ab-Pfeile getauscht
  und gilt für Suche, Firmenformular und Profilanzeige. Die
  Gruppenbeschreibung erscheint dort als Tooltip am Gruppentitel. Beim
  Löschen einer Gruppe bleiben ihre Technologien erhalten. Ausserdem CRUD
  für Maschinen.
- **Netzwerkgraph**: Editor unter `/admin/graph` mit drei Listen (Ebenen,
  Firmen, Verbindungen) für die aktuell geöffnete Ebene. Ebenen anlegen und
  öffnen, Firmen aus der Datenbank aufnehmen, Verbindungen zwischen zwei
  Knoten derselben Ebene setzen, Verbindungstypen pflegen. Umsortieren und
  Verschieben per Drag & Drop oder über Buttons. Siehe
  [docs/netzwerkgraph](docs/netzwerkgraph/konzept.md).
- **Reporting**: Firmen nach Status, Top-10 für Technologien, Maschinen,
  Branchen und Know-how, Registrierungen pro Woche
- **Hilfetexte**: Beschreibungstext pro Abschnitt (Unternehmensgröße,
  Branchen, Know-how, Technologien, Maschinen, Demonstrationsanlagen,
  Dienstleistungen). Der Text erscheint als Tooltip neben der Überschrift –
  in der Suche bei den Filtern und im Firmenformular. Leere Felder blenden
  den Hinweis aus. Gespeichert wird in `app_settings` unter
  `section_description.<abschnitt>`.
- **Feedback**: Inbox für Nutzer-Feedback; Filter offen/erledigt, als
  erledigt markieren oder löschen
- **Einstellungen**: zentrale Empfänger-E-Mail-Adresse für
  Admin-Benachrichtigungen (neue Firmen zur Freigabe, neues Feedback);
  Test-Mailversand an eine beliebige Adresse zur Pruefung der SMTP-Konfiguration.

## Netzwerkgraph

Grafische Darstellung der Beziehungen im Netzwerk: geschachtelte Ebenen, in
denen Firmen als Knoten liegen. Ein Klick auf eine Ebene zoomt hinein und
blendet alles andere aus; Verbindungen bestehen jeweils zwischen Knoten
derselben Ebene und haben einen farbigen Typ sowie eine freie Beschriftung.
Positionen werden nicht gespeichert, sondern pro Ebene deterministisch mit
`elkjs` berechnet.

Gepflegt wird der Graph unter `/admin/graph`, öffentlich sichtbar ist er unter
`/netzwerk` — dort nur mit freigegebenen Firmen und erst, wenn
`SHOW_NETWORK_GRAPH` in `apps/web/src/config/features.ts` aktiviert ist.

Ausführliche Dokumentation in [`docs/netzwerkgraph/`](docs/netzwerkgraph/):
[Konzept](docs/netzwerkgraph/konzept.md),
[Datenmodell](docs/netzwerkgraph/datenmodell.md),
[API](docs/netzwerkgraph/api.md),
[Frontend](docs/netzwerkgraph/frontend.md),
[Betrieb](docs/netzwerkgraph/betrieb.md).

## E-Mail-Benachrichtigungen

- Bei jeder Firmenregistrierung sowie nach jeder Profil- oder Logo-Änderung
  (Status springt auf `pending`) wird die im Admin-Panel hinterlegte
  Notification-Adresse per Mail informiert.
- Eingehendes Feedback wird zusätzlich an dieselbe Adresse weitergeleitet.
- Wechselt der Admin den Status einer Firma auf `approved` oder
  `suspended` (Abgelehnt), erhaelt die Firma automatisch eine
  Benachrichtigung an die Kontakt-E-Mail.
- Ist keine Adresse hinterlegt, werden keine Mails versendet (nur Logging).
- Versand erfolgt fire-and-forget: ein SMTP-Ausfall blockiert keine
  User-Aktion, der Fehler wird via `pino` geloggt.

## Bekannte Einschränkungen (MVP)

- Keine In-App-Chats; Kontakt erfolgt per `mailto:` direkt an den Ansprechpartner
- Nur eine zentrale Notification-Adresse (kein Listen-/Mehrfachversand)
- Ein Login pro Firma (1:1-Beziehung `users` ↔ `companies`)
- Nur Deutsch

## Tests & Qualität

Für den MVP sind noch keine automatisierten Tests enthalten. Für spätere
Iterationen empfehlen sich:

- Vitest / Node's Testrunner für API-Units und Integrationstests
- Playwright für E2E-Flows (Registrierung, Suche, Admin-Freischaltung)
- GitHub Actions für Lint, Typecheck, Migrate, Tests

## Produktion

### Architektur (Single-Domain)

Im Prod-Setup laeuft alles hinter **einer** Domain. Das Web-Image (nginx)
liefert die gebaute SPA aus und leitet `/api` sowie `/uploads` intern an den
API-Container (`create-api:3000`) weiter. Dadurch entfaellt CORS, Cookies
(`SameSite=Lax`, `Secure`) funktionieren direkt und das Frontend braucht kein
eingebackenes `VITE_API_BASE_URL` (Aufrufe sind relativ). Der Reverse-Proxy
(z. B. Nginx Proxy Manager) zeigt nur auf den Web-Container.

```
Browser ──HTTPS──> NPM ──> create-web (nginx :80)
                              ├─ /            -> SPA (try_files /index.html)
                              ├─ /api/...     -> create-api:3000
                              └─ /uploads/... -> create-api:3000
```

### Images bauen und nach Docker Hub pushen

Der Ubuntu-Server ist i. d. R. `amd64`. Beim Bauen auf Apple Silicon daher
zwingend die Zielplattform setzen (`buildx`):

```bash
# einmalig
docker buildx create --use

# API
docker buildx build --platform linux/amd64 \
  -f apps/api/Dockerfile --target prod \
  -t creator3256897/create-api:v1.4 --push .

# Web
docker buildx build --platform linux/amd64 \
  -f apps/web/Dockerfile --target prod \
  -t creator3256897/create-web:v1.4 --push .
```

### Datenbank-Migrationen & Admin

- **Migrationen** laufen automatisch beim Start des API-Containers
  (Entrypoint `docker-entrypoint.sh`, idempotent via `node-pg-migrate`).
  Abschaltbar mit `RUN_MIGRATIONS=false`.
- **Ersten Admin anlegen** (einmalig, nach dem ersten Start):

```bash
docker exec -it create-api \
  node apps/api/dist/scripts/create-admin.js \
  --email=admin@example.com --password=mind10Zeichen
```

- Optional Demo-Daten: `node apps/api/dist/scripts/seed-companies.js`.

### Wichtige Prod-Env-Variablen

`COOKIE_SECURE=true`, `APP_BASE_URL=https://<domain>`,
`CORS_ORIGIN=https://<domain>`,
`PUBLIC_UPLOADS_BASE_URL=https://<domain>/uploads`,
`DATABASE_URL=postgres://<user>:<pw>@postgres:5432/<db>`, `PORT=3000`.
