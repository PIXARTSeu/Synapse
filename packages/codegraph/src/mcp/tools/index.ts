/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export interface ToolContext {
  /**
   * The authenticated user this MCP session belongs to.
   * Set by http-server.ts when an API key (or OAuth bearer) is matched on /mcp
   * initialize. Tools that operate on user-scoped data (e.g. user_env_*) require
   * this — they fail with a clear error when it is missing rather than falling
   * back to a default user.
   */
  userId?: string
  /**
   * Server-wide Anthropic API key fallback (process.env.ANTHROPIC_API_KEY),
   * mirroring RouteContext.anthropicApiKey (routes/index.ts). Used by
   * `skill_scan`'s optional LLM judge layer (Task 8) when no per-user key is
   * found via UsersEnvStore. Undefined in stdio mode.
   */
  anthropicApiKey?: string
}

export type ToolRegistrar = (server: McpServer, ctx: ToolContext) => void

import { registerMemoryTools } from './memory.js'
import { registerProjectTools } from './projects.js'
import { registerSessionTools } from './sessions.js'
import { registerSkillTools } from './skills.js'
import { registerCodegraphTools } from './codegraph.js'
import { registerComponentTools } from './components.js'
import { registerUserEnvTools } from './users-env.js'
import { registerWhiteboardTools } from './whiteboards.js'
import { registerStudioTools } from './studio.js'

export function registerAllTools(server: McpServer, ctx: ToolContext): void {
  registerMemoryTools(server, ctx)
  registerProjectTools(server, ctx)
  registerSessionTools(server, ctx)
  registerSkillTools(server, ctx)
  registerCodegraphTools(server, ctx)
  registerComponentTools(server, ctx)
  registerUserEnvTools(server, ctx)
  registerWhiteboardTools(server, ctx)
  registerStudioTools(server, ctx)
}
