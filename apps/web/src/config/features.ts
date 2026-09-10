/**
 * Zentrale Feature-Flags für das Web-Frontend.
 *
 * Hinweis: Diese Flags steuern ausschließlich die Anzeige in der UI.
 * Die zugrunde liegende API, Datenbank-Logik und Datenstrukturen bleiben
 * vollständig erhalten, sodass eine Funktion durch Umschalten des Flags
 * wieder aktiviert werden kann, ohne weitere Code-Änderungen vornehmen
 * zu müssen.
 */

/**
 * Steuert die Sichtbarkeit der Taxonomie "Maschinen".
 *
 * Wurde fachlich durch "Demonstrationsanlagen" ersetzt. Auf `true` setzen,
 * um die Maschinen-Taxonomie wieder im UI einzublenden (Profil, Suche,
 * Firmenansicht, Admin-Listen, Reporting, Taxonomie-Verwaltung).
 */
export const SHOW_MACHINES = false;

/**
 * Steuert die Sichtbarkeit des oeffentlichen Netzwerkgraphen.
 *
 * Auf `true` setzen, sobald der Graph im Admin unter /admin/graph mit Ebenen,
 * Firmen und Verbindungen befuellt ist. Die Admin-Pflege ist unabhaengig vom
 * Flag jederzeit erreichbar; das Flag blendet nur die oeffentliche Ansicht und
 * den Navigationslink ein.
 */
export const SHOW_NETWORK_GRAPH = false;
