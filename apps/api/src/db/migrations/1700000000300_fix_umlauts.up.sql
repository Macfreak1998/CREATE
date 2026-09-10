-- Korrigiert deutsche Umlaute in den vorab eingespielten Taxonomie-Werten.
-- Idempotent: ändert nur Datensätze, deren aktueller Name noch der alte ASCII-Wert ist.
-- Slugs (technische IDs) bleiben unverändert.

UPDATE technologies SET name = 'Schweißen'
  WHERE slug = 'schweissen' AND name = 'Schweissen';

UPDATE technologies SET name = 'Oberflächenbehandlung'
  WHERE slug = 'oberflaechenbehandlung' AND name = 'Oberflaechenbehandlung';

UPDATE technologies SET name = 'Wärmebehandlung'
  WHERE slug = 'waermebehandlung' AND name = 'Waermebehandlung';

UPDATE technologies SET name = 'Prüfung und Qualitätssicherung'
  WHERE slug = 'pruefung-qualitaetssicherung' AND name = 'Pruefung und Qualitaetssicherung';

UPDATE machines SET name = 'CNC-Fräsmaschine 3-Achsen'
  WHERE slug = 'cnc-fraesmaschine-3-achsen' AND name = 'CNC-Fraesmaschine 3-Achsen';

UPDATE machines SET name = 'CNC-Fräsmaschine 5-Achsen'
  WHERE slug = 'cnc-fraesmaschine-5-achsen' AND name = 'CNC-Fraesmaschine 5-Achsen';

UPDATE machines SET name = 'Dreh-Fräszentrum'
  WHERE slug = 'drehfraeszentrum' AND name = 'Dreh-Fraeszentrum';

UPDATE machines SET name = 'Schweißroboter'
  WHERE slug = 'schweissroboter' AND name = 'Schweissroboter';

UPDATE machines SET name = 'Pressfügeanlage'
  WHERE slug = 'pressfuegeanlage' AND name = 'Pressfuegeanlage';

UPDATE machines SET name = 'Bestückungsautomat'
  WHERE slug = 'bestueckungsautomat' AND name = 'Bestueckungsautomat';
