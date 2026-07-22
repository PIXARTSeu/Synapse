# Synapse (SkillBrain) — AI Operating Context

> **How to use this file:** paste its content into your `~/.claude/CLAUDE.md`
> (global instructions, applies to every project). The MCP server is already
> connected — this file gives you the *rules* that make you actually exploit it.
> Without these rules you have the tools but won't use them proactively.

You are connected to **Synapse**, the team's collective memory, via the `codegraph`
MCP server (~30 tools). Use it. These are the operating rules.

---

## At session start — always

```
session_resume({ project: "<project name>" })
```

Returns: last session summary, next steps, blockers, related memories, and your
**capability profile** (which credentials / MCP / integrations you have available).
**Read it before doing anything else.**

---

## The 4 pillars

### 1. Memory — save in REAL TIME (don't wait for session end)

| Event | Action |
|-------|--------|
| Bug fixed after 2+ attempts | `memory_add({ type: "BugFix", ... })` |
| User corrects your approach | `memory_add({ type: "Preference", ... })` |
| Non-obvious pattern discovered | `memory_add({ type: "Pattern", ... })` |
| Architectural decision made | `memory_add({ type: "Decision", ... })` |
| Something should NOT be done | `memory_add({ type: "AntiPattern", ... })` |

Rules:
- **Propose before saving** — never save silently. The user approves what gets saved.
- **Search first** — `memory_search({ query })` before implementing something.
- **`skill:<name>` tag is mandatory** when a memory relates to a skill domain
  (e.g. `tags: ["nextjs", "performance", "skill:nextjs"]`).
- **At task completion** call `memory_suggest({ taskDescription, outcome, project })`
  and propose 1–3 candidates for approval. Skip if the task was trivial.
- Always set `project: "<current project>"` on every memory.

### 2. Skills — from Synapse, NEVER from disk

```
skill_route({ task: "<current task>" })   → recommended skills
skill_read({ name: "<skill>" })           → load full content
```

- **Never** `Read`/`grep` local `SKILL.md` files. The MCP server is the single source
  of truth. If `skill_read` returns "not found", the skill doesn't exist — don't fall
  back to disk.
- Reinforce useful skills at the end: `skill_decay({ usefulSkills: [...] })`.

### 3. Sessions

- Resume at start (above). At the end:
```
session_end({ summary, deliverables, workType, nextSteps, status, filesChanged, commits })
```
- Session creation, project detection and branch detection are **automatic** — don't
  do them manually.

### 4. Credentials — capability-check protocol

Before using any external service that needs a credential:

1. **Already loaded** — `session_resume` lists services you have. Read it.
2. **Lazy fetch** — when you actually need a value: `user_env_get({ varName, project })`.
3. **Conflict** — if the response has `conflict: true` (you have it AND the project has
   the same var), **STOP and ASK the user** which to use. Do not pick silently.
4. **Missing** — if `user_env_available({ service })` is false, ask the user for the
   value, use it, then offer `user_env_set` so future sessions have it.

The 4 `user_env_*` tools (`list`, `get`, `available`, `set`) are the **only** way to
access personal credentials — never read them from disk or env vars.

---

## Before implementing anything

```
memory_search({ query: "<what you're about to do>" })
skill_route({ task: "<current task>" })
```

Check what the team already knows before writing new code.

---

## Tool categories (all via the `codegraph` MCP server)

- **Memory**: memory_add, memory_search, memory_query, memory_load, memory_suggest,
  memory_add_edge, memory_stats, memory_decay
- **Skills**: skill_list, skill_read, skill_route, skill_stats
- **Sessions**: session_start, session_resume, session_end, session_history,
  session_heartbeat
- **Credentials**: user_env_list, user_env_get, user_env_available, user_env_set
- **Projects**: project_list, project_get, project_scan
- **Code intelligence**: codegraph_query, codegraph_context, codegraph_impact,
  codegraph_detect_changes, codegraph_rename

---

## The one rule that matters most

**Don't work in isolation.** Before starting → resume + search. While working → save
what you learn (with approval). At the end → close the session. That loop is what turns
Synapse from "some MCP tools" into a team that remembers.
