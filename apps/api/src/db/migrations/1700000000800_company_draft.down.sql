UPDATE companies SET status = 'pending' WHERE status = 'draft';

ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_status_check;
ALTER TABLE companies
  ADD CONSTRAINT companies_status_check
  CHECK (status IN ('pending','approved','suspended'));
