# Entwicklerdokumentation

Ergaenzende technische Dokumentation zur CREATE-Plattform. Die
Kurzuebersicht zu Setup, Tech-Stack und Betrieb steht weiterhin im
[README im Projektwurzelverzeichnis](../README.md); hier liegen die
ausfuehrlichen Beschreibungen einzelner Teilsysteme.

## Netzwerkgraph

Graphische Darstellung der Beziehungen zwischen den Firmen im Netzwerk:
geschachtelte Ebenen, Firmen als Knoten, Drill-down-Navigation.

| Dokument | Inhalt |
| --- | --- |
| [netzwerkgraph/konzept.md](netzwerkgraph/konzept.md) | Fachmodell, Begriffe, getroffene Entscheidungen und verworfene Alternativen |
| [netzwerkgraph/datenmodell.md](netzwerkgraph/datenmodell.md) | Tabellen, Indizes, Invarianten, wiederkehrende SQL-Muster, Loeschsemantik |
| [netzwerkgraph/api.md](netzwerkgraph/api.md) | Alle Endpunkte mit Parametern, Beispiel-Payloads und Fehlerfaellen |
| [netzwerkgraph/frontend.md](netzwerkgraph/frontend.md) | Komponentenbaum, Datenfluss, Layout-Pipeline, Zoom-Uebergang |
| [netzwerkgraph/betrieb.md](netzwerkgraph/betrieb.md) | Migration, Pflege, Feature-Flag, Troubleshooting, Performance |

Empfohlene Lesereihenfolge fuer den Einstieg: Konzept, Datenmodell, API.
