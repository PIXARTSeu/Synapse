# Attribution — mattpocock/skills (Matt Pocock)

The following 17 skills were imported **verbatim**, with their support files, from
the open-source **skills** collection and are redistributed under the MIT License.
They are third-party content, kept unmodified; local Pixarts skills are tracked
separately.

- **Source:** https://github.com/mattpocock/skills
- **Commit:** `3cca18b368ae95cdbdebbff572ccafa662551015`
- **License:** MIT — Copyright (c) 2026 Matt Pocock
- **Imported:** 2026-09-14

Each copy lives in two places: `.agents/skills/<name>/` (Codex, local imports) and
`packages/codegraph/data/lifecycle-skills/<name>/` (production bundle). Claude
loads them through SkillBrain (`skill_read`, support files via
`skill_read({ name, file })`). Do not install the `mattpocock-skills` Claude Code
plugin: it duplicates the superpowers process skills this repo already uses.

## Skills imported

| Group | Skills |
|-------|--------|
| Interviewing | grilling, grill-me, grill-with-docs, to-questionnaire, wait-what |
| Design | domain-modeling, codebase-design, improve-codebase-architecture |
| Issue flow | setup-matt-pocock-skills, to-tickets, triage, wayfinder |
| Utilities | research, teach, wizard, resolving-merge-conflicts, handoff |

## Not imported

| Upstream skill(s) | Reason |
|-------------------|--------|
| tdd, diagnosing-bugs, code-review, implement, to-spec, prototype, writing-for-agents | Covered by the superpowers plugin |
| ask-matt | Router over skills that are not imported; `skill_route` is the router here |
| misc/* | Tied to Matt's courses and libraries (scaffold-exercises, migrate-to-shoehorn, …) |
| in-progress/* | Unstable upstream |

## Cross-references

The upstream text is left as written. When an imported skill names a skill that
was not imported, use the local equivalent:

| Upstream name | Use instead |
|---------------|-------------|
| implement | `superpowers:executing-plans` or `superpowers:subagent-driven-development` |
| tdd | `superpowers:test-driven-development` |
| to-spec | `superpowers:brainstorming` (spec in `docs/superpowers/specs/`) |
| prototype | the spike path of `superpowers:brainstorming` |
| code-review | `superpowers:requesting-code-review` |
| diagnosing-bugs | `superpowers:systematic-debugging` |

## Updating

Re-copy the 17 directories from a newer upstream commit into both locations and
update the commit above in both copies of this file.

---

MIT License

Copyright (c) 2026 Matt Pocock

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
