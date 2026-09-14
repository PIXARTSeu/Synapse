-- Support files shipped next to a skill's SKILL.md / AGENT.md (formats, templates,
-- references/). Filled by import-skills, served by skill_read({ name, file }).
CREATE TABLE IF NOT EXISTS skill_files (
  skill_name TEXT NOT NULL,
  path       TEXT NOT NULL,
  content    TEXT NOT NULL,
  bytes      INTEGER NOT NULL,
  PRIMARY KEY (skill_name, path)
);
