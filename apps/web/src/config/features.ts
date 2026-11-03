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
 * Steuert, ob Admins die Netzwerkansicht unter /netzwerk sehen.
 *
 * Die Seite und /api/graph sind zusaetzlich nur nach Admin-Login erreichbar.
 * Auf `false` setzen blendet den Navigationslink und die Ansicht auch fuer
 * Admins aus. Die Pflege unter /admin/graph bleibt davon unberuehrt.
 */
export const SHOW_NETWORK_GRAPH = true;
