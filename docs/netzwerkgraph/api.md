# Netzwerkgraph: API

Zwei Router, ein gemeinsames Repository:

- [apps/api/src/modules/graph/router.ts](../../apps/api/src/modules/graph/router.ts)
  unter `/api/graph`, ohne Authentifizierung, nur lesend.
- [apps/api/src/modules/graph/admin-router.ts](../../apps/api/src/modules/graph/admin-router.ts)
  unter `/api/admin/graph`, eingehaengt in den Admin-Router und damit hinter
  `requireAuth` und `requireRole("admin")`.

Der einzige inhaltliche Unterschied ist das Flag `publicOnly`: Die oeffentliche
Sicht blendet Firmen ohne `status = 'approved'` aus, samt aller Kanten, die an
ihnen haengen, und zaehlt sie auch in `child_company_count` nicht mit. Der Admin
sieht den vollstaendigen Graphen.

Alle Eingaben werden ueber Zod-Schemas aus
[packages/shared/src/schemas.ts](../../packages/shared/src/schemas.ts)
validiert. Fehlerhafte Eingaben beantwortet die `validate`-Middleware
einheitlich mit 400 und `{ "error": "Validierungsfehler.", "details": ... }`.

## Zentrale Antwortstruktur: der Scope

Sowohl `GET /api/graph/scope` als auch `GET /api/admin/graph/scope` liefern
dasselbe Objekt. Es enthaelt alles, was eine Ansicht braucht.

```json
{
  "layer": {
    "id": "48614bd5-c5e9-45f0-ba77-630f1ca08cdc",
    "parent_id": null,
    "name": "Wertschöpfung",
    "slug": "wertschoepfung",
    "description": "Testebene",
    "color": null,
    "sort_order": 0,
    "child_layer_count": 1,
    "child_company_count": 1
  },
  "path": "wertschoepfung",
  "breadcrumb": [
    { "id": "48614bd5-...", "name": "Wertschöpfung", "slug": "wertschoepfung", "path": "wertschoepfung" }
  ],
  "layers": [
    {
      "id": "a0ad4127-a70e-4306-8ab2-c8a66274b50e",
      "parent_id": "48614bd5-...",
      "name": "Compounding",
      "slug": "compounding",
      "description": null,
      "color": null,
      "sort_order": 0,
      "child_layer_count": 0,
      "child_company_count": 0
    }
  ],
  "companies": [
    {
      "id": "0b5b0ff5-03a0-400e-84fe-6dd3ca097b6a",
      "parent_id": "48614bd5-...",
      "company_id": "ae37ebd0-77b4-458f-8922-93c08fe685d1",
      "company_slug": "musterfirma",
      "company_name": "Musterfirma GmbH",
      "logo_url": "http://localhost:4000/uploads/logos/79a4f67c.webp",
      "status": "approved",
      "sort_order": 1
    }
  ],
  "edges": [],
  "outward_edges": [
    {
      "id": "b8dda10b-02b8-4aa5-83eb-4658c84c8778",
      "scope_id": null,
      "source_id": "48614bd5-...",
      "target_id": "008fd90d-...",
      "edge_kind_id": 1,
      "edge_kind_slug": "kooperation",
      "edge_kind_name": "Kooperation",
      "color": "#0d9488",
      "directed": false,
      "label": "Test",
      "other_id": "008fd90d-...",
      "other_kind": "layer",
      "other_name": "Verarbeitung",
      "other_path": "verarbeitung",
      "other_company_slug": null,
      "direction": "undirected"
    }
  ]
}
```

Erlaeuterung der Felder, die nicht selbsterklaerend sind:

| Feld | Bedeutung |
| --- | --- |
| `layer` | Die geoeffnete Ebene selbst. `null` bedeutet Wurzelebene. |
| `path` | Pfad der geoeffneten Ebene, leer bei der Wurzel. |
| `breadcrumb` | Ahnenkette inklusive der Ebene selbst, von der Wurzel abwaerts. Jeder Eintrag traegt seinen eigenen `path`. |
| `layers`, `companies` | Direkte Kinder, sortiert nach `sort_order`. |
| `edges` | Verbindungen zwischen den Kindern. |
| `outward_edges` | Verbindungen, die die geoeffnete Ebene selbst auf Elternniveau hat. Im Inneren sonst unsichtbar, deshalb aufbereitet um den jeweils anderen Endpunkt. |
| `id` bei Firmen | Die Id des **Knotens**, nicht der Firma. Eine Firma kann mehrfach platziert sein; `company_id` ist der Verweis auf `companies`. |
| `direction` | `out`, wenn die Ebene Quelle einer gerichteten Kante ist, `in` bei Ziel, sonst `undirected`. |

## Oeffentliche Endpunkte

### GET /api/graph/scope

| Parameter | Typ | Bedeutung |
| --- | --- | --- |
| `path` | string, optional | Ebenenpfad aus Slugs, z. B. `verarbeitung/compounding`. Leer oder fehlend bedeutet Wurzelebene. |

```bash
curl "http://localhost:4000/api/graph/scope?path=wertschoepfung"
```

Antworten: 200 mit dem Scope-Objekt, 404 mit
`{"error":"Ebene nicht gefunden."}`, wenn ein Segment des Pfades nicht
aufloesbar ist.

### GET /api/graph/edge-kinds

Liefert die Verbindungstypen fuer die Legende, sortiert nach `sort_order`:

```json
[
  { "id": 1, "slug": "kooperation", "name": "Kooperation", "color": "#0d9488", "directed": false, "sort_order": 10 },
  { "id": 2, "slug": "liefert-an", "name": "Liefert an", "color": "#2563eb", "directed": true, "sort_order": 20 }
]
```

### GET /api/graph/find

| Parameter | Typ | Bedeutung |
| --- | --- | --- |
| `q` | string, 2 bis 80 Zeichen | Teil des Firmennamens, case-insensitive |

Liefert maximal 20 Treffer, **einen pro Platzierung**:

```json
[
  {
    "node_id": "0b5b0ff5-...",
    "company_id": "ae37ebd0-...",
    "company_name": "Musterfirma GmbH",
    "company_slug": "musterfirma",
    "parent_id": "48614bd5-...",
    "parent_path": "wertschoepfung",
    "breadcrumb": [ { "id": "48614bd5-...", "name": "Wertschöpfung", "slug": "wertschoepfung", "path": "wertschoepfung" } ]
  }
]
```

`parent_path` ist der Pfad, den das Frontend oeffnen muss, um den Knoten zu
zeigen. Bei einer Platzierung direkt in der Wurzel ist er leer.

## Admin-Endpunkte

Alle Endpunkte liegen unter `/api/admin/graph` und antworten ohne gueltige
Admin-Session mit 401 `{"error":"Nicht angemeldet."}` beziehungsweise 403 bei
fehlender Rolle.

### GET /scope

Wie die oeffentliche Variante, adressiert aber ueber `parent_id` statt ueber
einen Pfad, weil der Admin ohnehin mit Ids arbeitet. Ohne `parent_id` wird die
Wurzelebene geliefert. Diese eine Antwort speist die drei Listen und die
Dropdowns des Verbindungsdialogs.

### GET /find

Wie oeffentlich, aber ohne Freigabefilter.

### Ebenen

| Methode | Pfad | Body |
| --- | --- | --- |
| POST | `/layers` | `{ "parent_id": null, "name": "Wertschöpfung", "description": null, "color": null }` |
| PATCH | `/layers/:id` | `{ "name": "...", "description": null, "color": null, "sort_order": 0 }` |
| GET | `/layers/:id/impact` | – |

Der Slug wird serverseitig aus dem Namen erzeugt und bei Bedarf mit einem
Zaehlersuffix eindeutig gemacht; er ist nicht Teil des Bodys. Beim Umbenennen
aendert er sich mit, bestehende Deep-Links auf die Ebene werden dadurch
ungueltig.

`impact` gibt zurueck, was ein Loeschen mitnehmen wuerde:

```json
{ "layers": 1, "companies": 1, "edges": 1 }
```

Gezaehlt werden alle Nachfahren, nicht nur direkte Kinder, sowie alle Kanten,
die an der Ebene selbst oder an einem Nachfahren haengen.

### Knoten

| Methode | Pfad | Body | Zweck |
| --- | --- | --- | --- |
| POST | `/nodes` | `{ "parent_id": "...", "company_id": "..." }` | Firma in einer Ebene platzieren |
| POST | `/nodes/:id/move` | `{ "parent_id": "..." \| null, "sort_order": 3 }` | Knoten verschieben, auch Ebenen |
| POST | `/nodes/reorder` | `{ "node_ids": ["...", "..."] }` | Reihenfolge setzen, Index im Array wird zu `sort_order` |
| DELETE | `/nodes/:id` | – | Knoten samt Nachfahren und Kanten loeschen |

`move` gilt fuer beide Knotenarten. Beim Verschieben werden die Kanten des
Knotens geloescht, weil sie sonst zwei verschiedene Ebenen verbinden wuerden.
Ebenen bekommen bei Bedarf einen neuen Slug, falls der bisherige in der
Zielebene schon belegt ist.

### Verbindungen

| Methode | Pfad | Body |
| --- | --- | --- |
| POST | `/edges` | `{ "source_id": "...", "target_id": "...", "edge_kind_id": 1, "label": "Test" }` |
| PATCH | `/edges/:id` | `{ "edge_kind_id": 2, "label": null }` |
| DELETE | `/edges/:id` | – |

`scope_id` wird nicht uebergeben, sondern aus den Endpunkten abgeleitet. Beide
muessen dieselbe Elternebene haben.

### Verbindungstypen

`GET`, `POST`, `PATCH /:id` und `DELETE /:id` unter `/edge-kinds`. Body fuer
Anlegen und Aendern:

```json
{ "name": "Kooperation", "color": "#0d9488", "directed": false, "sort_order": 10 }
```

`color` muss ein sechsstelliger Hex-Wert sein, der Slug entsteht aus dem Namen.

## Fehlerfaelle

| Status | Situation | Meldung |
| --- | --- | --- |
| 400 | Kanten-Endpunkte in verschiedenen Ebenen | `Verbindungen sind nur zwischen Knoten derselben Ebene moeglich.` |
| 400 | Kante auf sich selbst | `Eine Verbindung braucht zwei verschiedene Knoten.` |
| 400 | Ebene in eigene Unterebene verschoben | `Eine Ebene kann nicht in sich selbst oder eine ihrer Unterebenen verschoben werden.` |
| 400 | unbekannter Verbindungstyp beim Anlegen einer Kante | `Unbekannter Verbindungstyp.` |
| 400 | Zod-Validierung | `Validierungsfehler.` samt `details` |
| 401 / 403 | keine Admin-Session | `Nicht angemeldet.` |
| 404 | Ebene, Knoten, Firma, Verbindung oder Pfad nicht gefunden | jeweils sprechend |
| 409 | Firma bereits in dieser Ebene | `Diese Firma ist in dieser Ebene bereits vorhanden.` |
| 409 | Verbindung dieses Typs besteht schon | `Zwischen diesen Knoten besteht bereits eine Verbindung dieses Typs.` |
| 409 | Verbindungstyp noch in Benutzung | `Dieser Verbindungstyp wird noch von N Verbindung(en) verwendet.` |

Die 409-Faelle entstehen aus Datenbank-Constraints. Das Repository faengt den
Postgres-Fehlercode `23505` ab und uebersetzt ihn in eine verstaendliche
Meldung, statt den Rohfehler durchzureichen. Fachliche Fehler werden als
`GraphError` mit Statuscode geworfen und vom globalen Error-Handler in
[apps/api/src/app.ts](../../apps/api/src/app.ts) ausgeliefert.

## Manueller Smoke-Test

Die wichtigsten Faelle lassen sich mit `curl` gegen die laufende Dev-Umgebung
pruefen. Zuerst anmelden und das Cookie behalten:

```bash
curl -s -c /tmp/c.txt -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"..."}'

# Ebene anlegen
curl -s -b /tmp/c.txt -X POST http://localhost:4000/api/admin/graph/layers \
  -H 'Content-Type: application/json' \
  -d '{"parent_id":null,"name":"Wertschöpfung"}'

# Scope der Wurzel lesen
curl -s -b /tmp/c.txt http://localhost:4000/api/admin/graph/scope
```
