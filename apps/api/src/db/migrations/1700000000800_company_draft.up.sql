-- Entwurfs-Status fuer admin-seitig angelegte Firmen, die erst nach
-- Supervisor-Freigabe oeffentlich sichtbar werden und Zugangsdaten erhalten.

ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_status_check;
ALTER TABLE companies
  ADD CONSTRAINT companies_status_check
  CHECK (status IN ('draft','pending','approved','suspended'));
