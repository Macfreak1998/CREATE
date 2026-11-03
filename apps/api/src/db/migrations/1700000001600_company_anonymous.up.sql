-- Admin markiert einzelne Firmen als anonym. Sie erscheinen im Netzwerk
-- ohne Namen, auch wenn sie nur als Entwurf vorliegen.

ALTER TABLE companies
  ADD COLUMN anonymous boolean NOT NULL DEFAULT false;
