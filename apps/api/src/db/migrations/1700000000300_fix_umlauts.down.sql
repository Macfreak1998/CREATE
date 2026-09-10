-- Revert: Umlaut-Korrekturen zurücknehmen (nur falls aktuelle Werte exakt übereinstimmen).

UPDATE technologies SET name = 'Schweissen'
  WHERE slug = 'schweissen' AND name = 'Schweißen';

UPDATE technologies SET name = 'Oberflaechenbehandlung'
  WHERE slug = 'oberflaechenbehandlung' AND name = 'Oberflächenbehandlung';

UPDATE technologies SET name = 'Waermebehandlung'
  WHERE slug = 'waermebehandlung' AND name = 'Wärmebehandlung';

UPDATE technologies SET name = 'Pruefung und Qualitaetssicherung'
  WHERE slug = 'pruefung-qualitaetssicherung' AND name = 'Prüfung und Qualitätssicherung';

UPDATE machines SET name = 'CNC-Fraesmaschine 3-Achsen'
  WHERE slug = 'cnc-fraesmaschine-3-achsen' AND name = 'CNC-Fräsmaschine 3-Achsen';

UPDATE machines SET name = 'CNC-Fraesmaschine 5-Achsen'
  WHERE slug = 'cnc-fraesmaschine-5-achsen' AND name = 'CNC-Fräsmaschine 5-Achsen';

UPDATE machines SET name = 'Dreh-Fraeszentrum'
  WHERE slug = 'drehfraeszentrum' AND name = 'Dreh-Fräszentrum';

UPDATE machines SET name = 'Schweissroboter'
  WHERE slug = 'schweissroboter' AND name = 'Schweißroboter';

UPDATE machines SET name = 'Pressfuegeanlage'
  WHERE slug = 'pressfuegeanlage' AND name = 'Pressfügeanlage';

UPDATE machines SET name = 'Bestueckungsautomat'
  WHERE slug = 'bestueckungsautomat' AND name = 'Bestückungsautomat';
