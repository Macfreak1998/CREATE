# Netzwerkgraph: Betrieb

## Inbetriebnahme

1. **Migration einspielen.**

   ```bash
   # lokal
   npm run migrate:up

   # Docker-Setup
   docker compose exec api npm run migrate:up
   ```

   Im Produktions-Image laufen die Migrationen beim Start des API-Containers
   automatisch. Die Migration legt die drei Tabellen an und bringt vier
   Verbindungstypen mit.

2. **Container neu bauen.** Der Graph bringt neue Abhaengigkeiten mit
   (`@xyflow/react`, `elkjs`, `@dnd-kit/*`). Die Dev-Container haben ihre
   `node_modules` im Image, ein blosses Neustarten reicht deshalb nicht:

   ```bash
   docker compose up -d --build
   ```

3. **Graph befuellen.** Unter `/admin/graph` Ebenen anlegen, Firmen aufnehmen,
   Verbindungen setzen. Die Seite ist unabhaengig vom Feature-Flag erreichbar.

4. **Oeffentliche Ansicht freischalten.** In
   [apps/web/src/config/features.ts](../../apps/web/src/config/features.ts)
   `SHOW_NETWORK_GRAPH` auf `true` setzen und das Frontend neu bauen. Erst
   danach erscheinen der Navigationspunkt "Netzwerk" und der Graph unter
   `/netzwerk`.

## Laufende Pflege

**Verbindungstypen** werden unter `/admin/graph` im aufklappbaren Bereich
"Verbindungstypen" gepflegt. Farbe und Richtung wirken sofort auf die
oeffentliche Darstellung und die Legende. Ein Typ, der noch verwendet wird,
laesst sich nicht loeschen; die Meldung nennt die Zahl der betroffenen
Verbindungen.

**Struktur aendern** geht ueber die Buttons oder per Drag & Drop. Zwei Dinge
sind dabei nicht offensichtlich:

- Beim Verschieben eines Knotens werden seine Verbindungen geloescht. Sie
  gehoerten zur alten Ebene und haetten danach Endpunkte in zwei verschiedenen
  Ebenen.
- Beim Umbenennen einer Ebene aendert sich ihr Slug und damit der Link zu ihr.
  Bereits geteilte Links auf diese Ebene laufen ins Leere.

**Firmen** verschwinden automatisch aus dem Graphen, wenn sie in der
Firmenverwaltung geloescht werden. Wird eine Firma auf "nicht freigegeben"
gesetzt, bleibt sie im Admin sichtbar und verschwindet nur aus der
oeffentlichen Ansicht.

## Troubleshooting

**Eine Firma fehlt im oeffentlichen Graphen, ist im Admin aber da.**
Der haeufigste Fall: Ihr Status ist nicht `approved`. Die oeffentliche Sicht
filtert solche Firmen samt ihrer Verbindungen heraus. Im Admin steht dann ein
Status-Hinweis neben dem Namen.

```sql
SELECT c.name, c.status
  FROM graph_nodes n JOIN companies c ON c.id = n.company_id
 WHERE n.kind = 'company' AND c.status <> 'approved';
```

**Eine Ebene wirkt leer, obwohl sie Firmen enthaelt.**
Dieselbe Ursache: Die Kinderzahlen der oeffentlichen Sicht zaehlen nur
freigegebene Firmen, die Zahl am Kreis passt also zum Inhalt nach dem
Hineinzoomen. Im Admin sind beide Zahlen ungefiltert.

**Eine Verbindung laesst sich nicht anlegen.**
Beide Endpunkte muessen in derselben Ebene liegen. Die Dropdowns zeigen
ausschliesslich Knoten der aktuellen Auswahl; taucht der gewuenschte Partner
nicht auf, liegt er in einer anderen Ebene. Entweder den Knoten verschieben oder
die Beziehung eine Ebene hoeher zwischen den beiden Ebenen modellieren.

**Verwaiste Kanten.**
Sollten durch einen Fehler Kanten entstanden sein, deren Endpunkte in
verschiedenen Ebenen liegen, findet dieser Befehl sie:

```sql
SELECT e.id
  FROM graph_edges e
  JOIN graph_nodes s ON s.id = e.source_id
  JOIN graph_nodes t ON t.id = e.target_id
 WHERE s.parent_id IS DISTINCT FROM t.parent_id
    OR s.parent_id IS DISTINCT FROM e.scope_id;
```

Erwartet wird ein leeres Ergebnis. Treffer koennen gefahrlos geloescht werden,
sie sind in keiner Ansicht sichtbar.

**Zyklusversuch.**
Der Versuch, eine Ebene in eine ihrer eigenen Unterebenen zu verschieben, wird
mit einer Meldung abgelehnt. Das ist kein Fehler, sondern die Baum-Invariante:
Ein Ring waere von keiner Ansicht mehr erreichbar. Wer eine Ebene tatsaechlich
unter ihr bisheriges Kind haengen will, verschiebt zuerst das Kind nach oben.

**Der Graph ist oeffentlich leer.**
Pruefen, ob `SHOW_NETWORK_GRAPH` gesetzt und das Frontend danach neu gebaut
wurde. Das Flag wird zur Buildzeit ausgewertet.

## Performance

Der Aufwand haengt nicht an der Groesse des Gesamtgraphen, sondern an der
Groesse der einzelnen Ebene. Pro Ansicht werden nur die direkten Kinder einer
Ebene geladen und layoutet.

- Datenbankseitig sind das drei kleine Queries auf `graph_nodes_parent_idx` und
  `graph_edges_scope_idx` plus zwei Zaehl-Subselects pro Ebene.
- Im Browser rechnet `elkjs` bei einigen Dutzend Knoten im
  Millisekundenbereich. Das Ergebnis wird im Query-Cache gehalten und bei
  unveraendertem Inhalt nie neu berechnet.
- Beim Hovern ueber eine Ebene wird deren Inhalt vorgeladen.

Zwei Punkte werden relevant, wenn der Graph deutlich waechst:

1. **Sehr grosse Ebenen.** Ab ungefaehr 150 Knoten in einer einzigen Ebene wird
   das Layout spuerbar und die Darstellung unuebersichtlich. Die Antwort darauf
   ist fachlich, nicht technisch: Unter-Ebenen bilden. Wer es dennoch technisch
   loesen will, kann `elkjs` in einen Web Worker verlagern
   (`elkjs/lib/elk-worker.js`) oder das Ergebnis serverseitig in einer Spalte
   `layout_json` puffern.
2. **Die Firmensuche** laedt alle Ebenen, um Pfade zu bilden. Das ist bei
   Dutzenden bis wenigen Hundert Ebenen guenstiger als eine Rekursion pro
   Treffer. Im fuenfstelligen Bereich waere stattdessen eine rekursive CTE ueber
   nur die Ahnenkette der Treffer angebracht, siehe
   [datenmodell.md](datenmodell.md).

## Backup und Wiederherstellung

Die drei Graph-Tabellen haengen an `companies`, aber nicht umgekehrt. Ein
Dump des Graphen allein ist damit moeglich und beim Umzug zwischen Umgebungen
nur dann sinnvoll, wenn die Firmen-Ids uebereinstimmen:

```bash
docker compose exec postgres pg_dump -U b2b -d b2b_matchmaking \
  -t graph_nodes -t graph_edges -t graph_edge_kinds > graph.sql
```

Der bestehende Firmen-Export in der Admin-Oberflaeche enthaelt den Graphen
nicht.
