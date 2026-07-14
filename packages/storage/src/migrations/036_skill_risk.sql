-- Security-gate verdict recorded by @skillbrain/skill-guard.
ALTER TABLE skills ADD COLUMN risk_score INTEGER;
ALTER TABLE skills ADD COLUMN risk_recommendation TEXT CHECK(risk_recommendation IN ('SAFE','CAUTION','BLOCK'));
ALTER TABLE skills ADD COLUMN risk_findings TEXT DEFAULT '[]';
ALTER TABLE skills ADD COLUMN risk_scanned_at TEXT;
