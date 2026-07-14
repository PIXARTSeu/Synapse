/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

// ── Database / migrations ─────────────────────────────
export { openDb, closeDb, getDbPath, getCodegraphDir, clearDb } from './db.js'
export { runMigrations, getAppliedMigrations } from './migrator.js'
export { loadMeta, saveMeta } from './meta.js'
export { loadRegistry, getRegistryEntry, upsertRegistry, removeFromRegistry } from './registry.js'
export { migrate, migrate as migrateLearnings } from './migrate-learnings.js'
export { importSkills, recategorizeSkills, detectCategory } from './import-skills.js'
export type { RecategorizeResult } from './import-skills.js'
export { applyGate } from './skill-gate.js'
export type { GateFields } from './skill-gate.js'
export { backfillSkillUsage } from './backfill-skill-usage.js'
export type { BackfillReport } from './backfill-skill-usage.js'

// ── Crypto ────────────────────────────────────────────
export { encrypt, decrypt, isEncryptionAvailable, assertEncryptionUsable, rotateKey } from './crypto.js'
export type { EncryptedValue } from './crypto.js'

// ── Stores ────────────────────────────────────────────
export { MemoryStore } from './memory-store.js'
export type {
  Memory,
  MemoryInput,
  MemoryQuery,
  MemorySearchResult,
  MemoryEdge,
  MemoryType,
  MemoryEdgeType,
  MemoryStatus,
  MemoryScope,
  DecayResult,
  SessionLog,
  SessionStatus,
  WorkType,
  Notification,
} from './memory-store.js'

export { SkillsStore, ConcurrencyError } from './skills-store.js'
export type {
  Skill,
  SkillType,
  SkillVersion,
  SkillUpsertOptions,
  SkillSearchResult,
} from './skills-store.js'

export { ProjectsStore } from './projects-store.js'
export type { Project, TeamMember, EnvVar } from './projects-store.js'

export { OAuthStore } from './oauth-store.js'
export { UsersEnvStore } from './users-env-store.js'
export { ComponentsStore } from './components-store.js'
export type { UiComponent, UiComponentInput, ComponentComment, DesignSystem as ComponentsDesignSystem, DesignSystemInput, DesignSystemScan, ComponentSearchResult, SectionType } from './components-store.js'
export { AuditStore } from './audit-store.js'
export { GraphStore } from './graph-store.js'

export { WhiteboardsStore, WhiteboardConcurrencyError } from './whiteboards-store.js'
export type {
  Whiteboard,
  WhiteboardSummary,
  WhiteboardScope,
  WhiteboardComment,
} from './whiteboards-store.js'

// ── Helpers ───────────────────────────────────────────
export { deriveEdgeCandidates } from './memory-edge-derivation.js'
export type { EdgeCandidate } from './memory-edge-derivation.js'

export { startDecayScheduler } from './decay-scheduler.js'
export type { DecaySchedulerOpts } from './decay-scheduler.js'

export { scanProject } from './project-scanner.js'
export { parseComponentFile, extractUsedTokens } from './component-parser.js'
export {
  detectDesignFiles,
  parseTailwindConfig,
  parseTailwindConfigFromContent,
  parseCSSVariables,
  parseCSSVariablesFromContent,
  parseTokensJson,
  parseTokensJsonFromContent,
  mergeTokenSources,
} from './design-token-parser.js'
export type { TokenSource } from './design-token-parser.js'

// ── Graph types (re-exported for graph-store consumers) ──
export type { GraphNode, GraphEdge, FileRecord, RepoMeta, NodeLabel, EdgeType } from './types/graph.js'

// ── Embeddings ────────────────────────────────────────
export { EmbeddingService, cosine, vectorToBlob, blobToVector } from './embedding-service.js'

export { StudioStore } from './studio-store.js'
export type {
  Conversation, ConversationSummary, Message, Job,
  DesignSystem, DesignSystemSummary, DsVersion,
  StudioSkill, StudioDirection, MediaTemplate, BriefData,
} from './studio-store.js'
