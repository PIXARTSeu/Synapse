/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import type Database from 'better-sqlite3'
import { randomId } from './utils/hash.js'
import type { TokenSource, Conflict } from './design-token-parser.js'

// ── Types ──────────────────────────────────────────────

export type SectionType =
  | 'hero' | 'navbar' | 'footer' | 'cta' | 'pricing' | 'features'
  | 'testimonials' | 'faq' | 'comparison' | 'process' | 'gallery'
  | 'demo' | 'form' | 'card' | 'other'

export interface UiComponent {
  id: string
  project: string
  name: string
  sectionType: SectionType
  description?: string
  filePath?: string
  tags: string[]
  propsSchema: Record<string, unknown>
  codeSnippet?: string
  designTokens: Record<string, unknown>
  createdAt: string
  updatedAt: string
  status: 'active' | 'pending' | 'deprecated'
  createdByUserId?: string
  updatedByUserId?: string
}

export interface UiComponentInput {
  project: string
  name: string
  sectionType: SectionType
  description?: string
  filePath?: string
  tags?: string[]
  propsSchema?: Record<string, unknown>
  codeSnippet?: string
  designTokens?: Record<string, unknown>
  status?: 'active' | 'pending' | 'deprecated'
  createdByUserId?: string
  updatedByUserId?: string
}

export interface DesignSystem {
  id: string
  project: string
  clientName?: string
  colors: Record<string, string>
  fonts: Record<string, unknown>
  spacing: Record<string, unknown>
  radius: Record<string, string>
  animations: unknown[]
  darkMode: boolean
  colorFormat: 'hex' | 'oklch' | 'hsl'
  tailwindConfig?: string
  notes?: string
  palette?:        Record<string, Record<string, string>>
  semanticColors?: Record<string, Record<string, string>>
  shadows?:        Record<string, string>
  typography?:     Record<string, unknown>
  effects?:        Record<string, unknown>
  components?:     Record<string, Record<string, string>>
  assets?:         Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface DesignSystemInput {
  project: string
  clientName?: string
  colors?: Record<string, string>
  fonts?: Record<string, unknown>
  spacing?: Record<string, unknown>
  radius?: Record<string, string>
  animations?: unknown[]
  darkMode?: boolean
  colorFormat?: 'hex' | 'oklch' | 'hsl'
  tailwindConfig?: string
  notes?: string
  palette?:        Record<string, Record<string, string>>
  semanticColors?: Record<string, Record<string, string>>
  shadows?:        Record<string, string>
  typography?:     Record<string, unknown>
  effects?:        Record<string, unknown>
  components?:     Record<string, Record<string, string>>
  assets?:         Record<string, unknown>
}

export interface ComponentSearchResult {
  component: UiComponent
  rank: number
}

export interface ComponentComment {
  id: string
  componentId: string
  userId?: string
  userEmail?: string
  text: string
  createdAt: string
}

export interface DesignSystemScan {
  id: string
  project: string
  scannedAt: string
  sources: TokenSource[]
  merged: Partial<DesignSystemInput>
  conflicts: Conflict[]
  status: 'pending' | 'applied' | 'dismissed'
}

// ── Store ──────────────────────────────────────────────

export class ComponentsStore {
  constructor(private db: Database.Database) {}

  // ── UI Components CRUD ────────────────────────────

  addComponent(input: UiComponentInput): UiComponent {
    const now = new Date().toISOString()
    const id = `UC-${randomId()}`
    const component: UiComponent = {
      id,
      project: input.project,
      name: input.name,
      sectionType: input.sectionType,
      description: input.description,
      filePath: input.filePath,
      tags: input.tags ?? [],
      propsSchema: input.propsSchema ?? {},
      codeSnippet: input.codeSnippet,
      designTokens: input.designTokens ?? {},
      createdAt: now,
      updatedAt: now,
      status: input.status ?? 'active',
      createdByUserId: input.createdByUserId,
    }

    try {
      this.db.prepare(`
        INSERT INTO ui_components
          (id, project, name, section_type, description, file_path, tags, props_schema, code_snippet, design_tokens, created_at, updated_at, status, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        component.id, component.project, component.name, component.sectionType,
        component.description ?? null, component.filePath ?? null,
        JSON.stringify(component.tags), JSON.stringify(component.propsSchema),
        component.codeSnippet ?? null, JSON.stringify(component.designTokens),
        component.createdAt, component.updatedAt, component.status,
        component.createdByUserId ?? null,
      )
    } catch {
      // Fall back to insert without ownership columns if migration 010 not applied yet
      this.db.prepare(`
        INSERT INTO ui_components
          (id, project, name, section_type, description, file_path, tags, props_schema, code_snippet, design_tokens, created_at, updated_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        component.id, component.project, component.name, component.sectionType,
        component.description ?? null, component.filePath ?? null,
        JSON.stringify(component.tags), JSON.stringify(component.propsSchema),
        component.codeSnippet ?? null, JSON.stringify(component.designTokens),
        component.createdAt, component.updatedAt, component.status,
      )
    }

    this.populateFts(component)
    return component
  }

  getComponent(id: string): UiComponent | undefined {
    const row = this.db.prepare('SELECT * FROM ui_components WHERE id = ?').get(id) as any
    return row ? this.rowToComponent(row) : undefined
  }

  listComponents(filters: { project?: string; sectionType?: SectionType; tag?: string; limit?: number } = {}): UiComponent[] {
    let sql = 'SELECT * FROM ui_components WHERE 1=1'
    const params: unknown[] = []

    if (filters.project) {
      sql += ' AND project = ?'
      params.push(filters.project)
    }
    if (filters.sectionType) {
      sql += ' AND section_type = ?'
      params.push(filters.sectionType)
    }
    if (filters.tag) {
      sql += ' AND tags LIKE ?'
      params.push(`%"${filters.tag}"%`)
    }

    sql += ' ORDER BY project, section_type, name'
    if (filters.limit) {
      sql += ' LIMIT ?'
      params.push(filters.limit)
    }

    return (this.db.prepare(sql).all(...params) as any[]).map(this.rowToComponent)
  }

  searchComponents(query: string, limit = 20): ComponentSearchResult[] {
    const tokens = query
      .replace(/[_-]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 1)

    if (tokens.length === 0) return []
    const ftsQuery = tokens.map((w) => `"${w}"`).join(' OR ')

    try {
      const rows = this.db.prepare(`
        SELECT uc.*, fts.rank
        FROM ui_components_fts fts
        JOIN ui_components uc ON uc.rowid = fts.rowid
        WHERE ui_components_fts MATCH ?
        ORDER BY fts.rank
        LIMIT ?
      `).all(ftsQuery, limit) as any[]

      return rows.map((r) => ({
        component: this.rowToComponent(r),
        rank: r.rank,
      }))
    } catch {
      return []
    }
  }

  deleteComponent(id: string): void {
    this.db.prepare('DELETE FROM ui_components WHERE id = ?').run(id)
  }

  // ── Component Comments ────────────────────────────

  addComment(componentId: string, text: string, userId?: string, userEmail?: string): ComponentComment {
    const id = `CC-${randomId()}`
    const createdAt = new Date().toISOString()
    this.db.prepare(`
      INSERT INTO component_comments (id, component_id, user_id, user_email, text, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, componentId, userId ?? null, userEmail ?? null, text, createdAt)
    return { id, componentId, userId, userEmail, text, createdAt }
  }

  listComments(componentId: string): ComponentComment[] {
    return (this.db.prepare(
      'SELECT * FROM component_comments WHERE component_id = ? ORDER BY created_at ASC'
    ).all(componentId) as any[]).map((r) => ({
      id: r.id,
      componentId: r.component_id,
      userId: r.user_id ?? undefined,
      userEmail: r.user_email ?? undefined,
      text: r.text,
      createdAt: r.created_at,
    }))
  }

  deleteComment(commentId: string): void {
    this.db.prepare('DELETE FROM component_comments WHERE id = ?').run(commentId)
  }

  componentStats(): { total: number; byProject: Record<string, number>; bySectionType: Record<string, number> } {
    const total = (this.db.prepare('SELECT COUNT(*) as c FROM ui_components').get() as any).c

    const byProject = (this.db.prepare('SELECT project, COUNT(*) as c FROM ui_components GROUP BY project').all() as any[])
      .reduce((acc, r) => ({ ...acc, [r.project]: r.c }), {} as Record<string, number>)

    const bySectionType = (this.db.prepare('SELECT section_type, COUNT(*) as c FROM ui_components GROUP BY section_type').all() as any[])
      .reduce((acc, r) => ({ ...acc, [r.section_type]: r.c }), {} as Record<string, number>)

    return { total, byProject, bySectionType }
  }

  // ── Design Systems CRUD ───────────────────────────

  upsertDesignSystem(input: DesignSystemInput): DesignSystem {
    const now = new Date().toISOString()
    const existing = this.getDesignSystem(input.project)

    if (existing) {
      const updated: DesignSystem = {
        ...existing,
        clientName: input.clientName ?? existing.clientName,
        colors: input.colors ?? existing.colors,
        fonts: input.fonts ?? existing.fonts,
        spacing: input.spacing ?? existing.spacing,
        radius: input.radius ?? existing.radius,
        animations: input.animations ?? existing.animations,
        darkMode: input.darkMode ?? existing.darkMode,
        colorFormat: input.colorFormat ?? existing.colorFormat,
        tailwindConfig: input.tailwindConfig ?? existing.tailwindConfig,
        notes: input.notes ?? existing.notes,
        palette:        input.palette        ?? existing.palette,
        semanticColors: input.semanticColors ?? existing.semanticColors,
        shadows:        input.shadows        ?? existing.shadows,
        typography:     input.typography     ?? existing.typography,
        effects:        input.effects        ?? existing.effects,
        components:     input.components     ?? existing.components,
        assets:         input.assets         ?? existing.assets,
        updatedAt: now,
      }
      this.db.prepare(`
        UPDATE design_systems SET
          client_name = ?, colors = ?, fonts = ?, spacing = ?, radius = ?,
          animations = ?, dark_mode = ?, color_format = ?, tailwind_config = ?,
          notes = ?,
          palette = ?, semantic_colors = ?, shadows = ?, typography = ?,
          effects = ?, components = ?, assets = ?,
          updated_at = ?
        WHERE project = ?
      `).run(
        updated.clientName ?? null, JSON.stringify(updated.colors),
        JSON.stringify(updated.fonts), JSON.stringify(updated.spacing),
        JSON.stringify(updated.radius), JSON.stringify(updated.animations),
        updated.darkMode ? 1 : 0, updated.colorFormat,
        updated.tailwindConfig ?? null, updated.notes ?? null,
        JSON.stringify(updated.palette ?? {}),
        JSON.stringify(updated.semanticColors ?? {}),
        JSON.stringify(updated.shadows ?? {}),
        JSON.stringify(updated.typography ?? {}),
        JSON.stringify(updated.effects ?? {}),
        JSON.stringify(updated.components ?? {}),
        JSON.stringify(updated.assets ?? {}),
        updated.updatedAt, updated.project,
      )
      return updated
    }

    const ds: DesignSystem = {
      id: `DS-${input.project}`,
      project: input.project,
      clientName: input.clientName,
      colors: input.colors ?? {},
      fonts: input.fonts ?? {},
      spacing: input.spacing ?? {},
      radius: input.radius ?? {},
      animations: input.animations ?? [],
      darkMode: input.darkMode ?? false,
      colorFormat: input.colorFormat ?? 'hex',
      tailwindConfig: input.tailwindConfig,
      notes: input.notes,
      palette:        input.palette        ?? {},
      semanticColors: input.semanticColors ?? {},
      shadows:        input.shadows        ?? {},
      typography:     input.typography     ?? {},
      effects:        input.effects        ?? {},
      components:     input.components     ?? {},
      assets:         input.assets         ?? {},
      createdAt: now,
      updatedAt: now,
    }

    this.db.prepare(`
      INSERT INTO design_systems
        (id, project, client_name, colors, fonts, spacing, radius, animations,
         dark_mode, color_format, tailwind_config, notes,
         palette, semantic_colors, shadows, typography, effects, components, assets,
         created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ds.id, ds.project, ds.clientName ?? null,
      JSON.stringify(ds.colors), JSON.stringify(ds.fonts),
      JSON.stringify(ds.spacing), JSON.stringify(ds.radius),
      JSON.stringify(ds.animations), ds.darkMode ? 1 : 0,
      ds.colorFormat, ds.tailwindConfig ?? null,
      ds.notes ?? null,
      JSON.stringify(ds.palette ?? {}),
      JSON.stringify(ds.semanticColors ?? {}),
      JSON.stringify(ds.shadows ?? {}),
      JSON.stringify(ds.typography ?? {}),
      JSON.stringify(ds.effects ?? {}),
      JSON.stringify(ds.components ?? {}),
      JSON.stringify(ds.assets ?? {}),
      ds.createdAt, ds.updatedAt,
    )

    return ds
  }

  getDesignSystem(project: string): DesignSystem | undefined {
    const row = this.db.prepare('SELECT * FROM design_systems WHERE project = ?').get(project) as any
    return row ? this.rowToDesignSystem(row) : undefined
  }

  listDesignSystems(): DesignSystem[] {
    return (this.db.prepare('SELECT * FROM design_systems ORDER BY project').all() as any[])
      .map(this.rowToDesignSystem)
  }

  // ── Design System Scans ───────────────────────────

  addDesignSystemScan(scan: {
    project: string
    sources: TokenSource[]
    merged: Partial<DesignSystemInput>
    conflicts: Conflict[]
  }): DesignSystemScan {
    const now = new Date().toISOString()
    // One OPEN scan per project (partial unique index idx_dss_open, migration 034).
    // session_start re-scans on every run; without this, an unresolved-conflict
    // project stacked a brand-new pending scan each session and flooded the review
    // queue. If an open scan already exists, refresh it in place with the latest
    // conflict data instead of inserting a duplicate.
    const existing = this.db.prepare(
      `SELECT id FROM design_system_scans WHERE project = ? AND status = 'pending' LIMIT 1`
    ).get(scan.project) as { id: string } | undefined
    if (existing) {
      this.db.prepare(`
        UPDATE design_system_scans
           SET scanned_at = ?, sources = ?, merged = ?, conflicts = ?
         WHERE id = ?
      `).run(
        now,
        JSON.stringify(scan.sources),
        JSON.stringify(scan.merged),
        JSON.stringify(scan.conflicts),
        existing.id,
      )
      return { id: existing.id, scannedAt: now, status: 'pending' as const, ...scan }
    }
    const id = `DSS-${randomId()}`
    this.db.prepare(`
      INSERT INTO design_system_scans (id, project, scanned_at, sources, merged, conflicts, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      id, scan.project, now,
      JSON.stringify(scan.sources),
      JSON.stringify(scan.merged),
      JSON.stringify(scan.conflicts),
    )
    return { id, scannedAt: now, status: 'pending' as const, ...scan }
  }

  getPendingScans(project?: string): DesignSystemScan[] {
    const sql = project
      ? `SELECT * FROM design_system_scans WHERE status = 'pending' AND project = ? ORDER BY scanned_at DESC`
      : `SELECT * FROM design_system_scans WHERE status = 'pending' ORDER BY scanned_at DESC`
    const rows = project
      ? (this.db.prepare(sql).all(project) as any[])
      : (this.db.prepare(sql).all() as any[])
    return rows.map(this.rowToScan)
  }

  applyDesignSystemScan(scanId: string, resolved: Partial<DesignSystemInput>): DesignSystem {
    const row = this.db.prepare('SELECT * FROM design_system_scans WHERE id = ?').get(scanId) as any
    if (!row) throw new Error(`Scan ${scanId} not found`)
    const ds = this.upsertDesignSystem({ project: row.project, ...resolved })
    this.db.prepare(`UPDATE design_system_scans SET status = 'applied' WHERE id = ?`).run(scanId)
    return ds
  }

  dismissDesignSystemScan(scanId: string): void {
    this.db.prepare(`UPDATE design_system_scans SET status = 'dismissed' WHERE id = ?`).run(scanId)
  }

  mergeDesignSystems(primary: string, alias: string): DesignSystem {
    const pri = this.getDesignSystem(primary)
    const ali = this.getDesignSystem(alias)
    if (!pri) throw new Error(`Primary design system '${primary}' not found`)
    if (!ali) throw new Error(`Alias design system '${alias}' not found`)

    // Merge tokens: alias provides base, primary overrides (primary wins on conflict)
    const merged: DesignSystemInput = {
      project: primary,
      clientName: pri.clientName ?? ali.clientName,
      colors: { ...ali.colors, ...pri.colors },
      fonts: { ...ali.fonts, ...pri.fonts },
      spacing: { ...ali.spacing, ...pri.spacing },
      radius: { ...ali.radius, ...pri.radius },
      animations: pri.animations.length ? pri.animations : ali.animations,
      darkMode: pri.darkMode || ali.darkMode,
      colorFormat: pri.colorFormat,
      tailwindConfig: pri.tailwindConfig ?? ali.tailwindConfig,
      notes: [pri.notes, ali.notes].filter(Boolean).join('\n\n') || undefined,
      // Shallow merge: primary's top-level group keys replace alias's (e.g. palette.brand fully replaced, not deep-merged per shade)
      palette:        { ...(ali.palette ?? {}), ...(pri.palette ?? {}) },
      semanticColors: { ...(ali.semanticColors ?? {}), ...(pri.semanticColors ?? {}) },
      shadows:        { ...(ali.shadows ?? {}), ...(pri.shadows ?? {}) },
      typography:     { ...(ali.typography ?? {}), ...(pri.typography ?? {}) } as Record<string, unknown>,
      effects:        { ...(ali.effects ?? {}), ...(pri.effects ?? {}) } as Record<string, unknown>,
      components:     { ...(ali.components ?? {}), ...(pri.components ?? {}) },
      assets:         { ...(ali.assets ?? {}), ...(pri.assets ?? {}) } as Record<string, unknown>,
    }

    const result = this.upsertDesignSystem(merged)
    this.db.prepare('DELETE FROM design_systems WHERE project = ?').run(alias)
    return result
  }

  private rowToScan(row: any): DesignSystemScan {
    return {
      id: row.id,
      project: row.project,
      scannedAt: row.scanned_at,
      sources: JSON.parse(row.sources || '[]'),
      merged: JSON.parse(row.merged || '{}'),
      conflicts: JSON.parse(row.conflicts || '[]'),
      status: row.status,
    }
  }

  // ── FTS Population ────────────────────────────────

  private populateFts(component: UiComponent): void {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO ui_components_fts(rowid, name, description, tags, section_type)
        VALUES ((SELECT rowid FROM ui_components WHERE id = ?), ?, ?, ?, ?)
      `).run(
        component.id,
        component.name,
        component.description ?? '',
        component.tags.join(' '),
        component.sectionType,
      )
    } catch {}
  }

  // ── Row Mappers ───────────────────────────────────

  private rowToComponent(row: any): UiComponent {
    return {
      id: row.id,
      project: row.project,
      name: row.name,
      sectionType: row.section_type as SectionType,
      description: row.description ?? undefined,
      filePath: row.file_path ?? undefined,
      tags: JSON.parse(row.tags || '[]'),
      propsSchema: JSON.parse(row.props_schema || '{}'),
      codeSnippet: row.code_snippet ?? undefined,
      designTokens: JSON.parse(row.design_tokens || '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status ?? 'active',
      createdByUserId: row.created_by_user_id ?? undefined,
      updatedByUserId: row.updated_by_user_id ?? undefined,
    }
  }

  private rowToDesignSystem(row: any): DesignSystem {
    return {
      id: row.id,
      project: row.project,
      clientName: row.client_name ?? undefined,
      colors: JSON.parse(row.colors || '{}'),
      fonts: JSON.parse(row.fonts || '{}'),
      spacing: JSON.parse(row.spacing || '{}'),
      radius: JSON.parse(row.radius || '{}'),
      animations: JSON.parse(row.animations || '[]'),
      darkMode: row.dark_mode === 1,
      colorFormat: row.color_format as 'hex' | 'oklch' | 'hsl',
      tailwindConfig: row.tailwind_config ?? undefined,
      notes: row.notes ?? undefined,
      palette:        JSON.parse(row.palette         || '{}'),
      semanticColors: JSON.parse(row.semantic_colors || '{}'),
      shadows:        JSON.parse(row.shadows         || '{}'),
      typography:     JSON.parse(row.typography      || '{}'),
      effects:        JSON.parse(row.effects         || '{}'),
      components:     JSON.parse(row.components      || '{}'),
      assets:         JSON.parse(row.assets          || '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
