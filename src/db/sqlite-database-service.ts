import type BetterSqlite3 from 'better-sqlite3';
import { DatabaseService } from './database-service';
import {
  PitEntry,
  MatchEntry,
  CustomEvent,
  SqliteConfig,
  CompetitionType,
  ScoutingBlock,
  BlockAssignment,
  ScoutingBlockWithAssignments,
} from './types';
import { Picklist, PicklistEntry, PicklistNote } from '@/lib/shared-types';

export class SqliteDatabaseService implements DatabaseService {
  private db: BetterSqlite3.Database | null = null;
  private config: SqliteConfig;

  constructor(config: SqliteConfig = {}) {
    this.config = config;
  }

  private getDb(): BetterSqlite3.Database {
    if (this.db) return this.db;

    // Dynamic import to avoid issues when better-sqlite3 is not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof BetterSqlite3;
    const filename = this.config.filename ?? './local.db';
    this.db = new Database(filename);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initializeTables();
    return this.db;
  }

  private initializeTables(): void {
    const db = this.db!;

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'scout',
        push_subscriptions TEXT,
        preferredPartners TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS pitEntries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teamNumber INTEGER NOT NULL,
        year INTEGER NOT NULL,
        competitionType TEXT DEFAULT 'FRC' NOT NULL,
        driveTrain TEXT NOT NULL,
        weight REAL,
        length REAL,
        width REAL,
        eventName TEXT,
        eventCode TEXT,
        userId TEXT,
        gameSpecificData TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE (teamNumber, eventCode, year, competitionType)
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS matchEntries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matchNumber INTEGER NOT NULL,
        teamNumber INTEGER NOT NULL,
        year INTEGER NOT NULL,
        competitionType TEXT DEFAULT 'FRC' NOT NULL,
        alliance TEXT NOT NULL,
        alliancePosition INTEGER,
        eventName TEXT,
        eventCode TEXT,
        userId TEXT,
        gameSpecificData TEXT,
        notes TEXT,
        timestamp TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE (teamNumber, matchNumber, eventCode, year, competitionType)
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS customEvents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eventCode TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        endDate TEXT,
        matchCount INTEGER NOT NULL DEFAULT 0,
        location TEXT,
        region TEXT,
        year INTEGER NOT NULL,
        competitionType TEXT DEFAULT 'FRC' NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS scoutingBlocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eventCode TEXT NOT NULL,
        year INTEGER NOT NULL,
        blockNumber INTEGER NOT NULL,
        startMatch INTEGER NOT NULL,
        endMatch INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE (eventCode, year, blockNumber),
        CHECK (endMatch >= startMatch)
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS blockAssignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        blockId INTEGER NOT NULL,
        userId TEXT NOT NULL,
        alliance TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (blockId) REFERENCES scoutingBlocks(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE (blockId, alliance, position),
        CHECK (alliance IN ('red', 'blue')),
        CHECK (position BETWEEN 0 AND 2)
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS picklists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eventCode TEXT NOT NULL,
        year INTEGER NOT NULL,
        competitionType TEXT DEFAULT 'FRC' NOT NULL,
        picklistType TEXT DEFAULT 'main' NOT NULL,
        name TEXT,
        createdBy TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE (eventCode, year, competitionType, picklistType)
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS picklistEntries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        picklistId INTEGER NOT NULL,
        teamNumber INTEGER NOT NULL,
        rank INTEGER NOT NULL,
        qualRanking INTEGER,
        source TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (picklistId) REFERENCES picklists(id) ON DELETE CASCADE,
        UNIQUE (picklistId, teamNumber)
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS picklistNotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        picklistId INTEGER NOT NULL,
        teamNumber INTEGER NOT NULL,
        note TEXT,
        userId TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (picklistId) REFERENCES picklists(id) ON DELETE CASCADE
      )
    `);

    // Indexes for performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_pit_entries_competition ON pitEntries(competitionType, year);
      CREATE INDEX IF NOT EXISTS idx_match_entries_competition ON matchEntries(competitionType, year);
      CREATE INDEX IF NOT EXISTS idx_custom_events_competition ON customEvents(competitionType, year);
      CREATE INDEX IF NOT EXISTS idx_scouting_blocks_event ON scoutingBlocks(eventCode, year);
      CREATE INDEX IF NOT EXISTS idx_block_assignments_user ON blockAssignments(userId);
      CREATE INDEX IF NOT EXISTS idx_block_assignments_block ON blockAssignments(blockId);
      CREATE INDEX IF NOT EXISTS idx_picklist_event ON picklists(eventCode, year, competitionType);
      CREATE INDEX IF NOT EXISTS idx_picklist_entries_picklist ON picklistEntries(picklistId);
      CREATE INDEX IF NOT EXISTS idx_picklist_notes_picklist ON picklistNotes(picklistId, teamNumber);
    `);
  }

  private rowToPitEntry(row: Record<string, unknown>): PitEntry {
    return {
      id: row.id as number,
      teamNumber: row.teamNumber as number,
      year: row.year as number,
      competitionType: ((row.competitionType as string) || 'FRC') as CompetitionType,
      driveTrain: row.driveTrain as 'Swerve' | 'Mecanum' | 'Tank' | 'Other',
      weight: row.weight !== null && row.weight !== undefined ? (row.weight as number) : undefined,
      length: row.length !== null && row.length !== undefined ? (row.length as number) : undefined,
      width: row.width !== null && row.width !== undefined ? (row.width as number) : undefined,
      eventName: (row.eventName as string) || undefined,
      eventCode: (row.eventCode as string) || undefined,
      userId: (row.userId as string) || undefined,
      gameSpecificData: JSON.parse((row.gameSpecificData as string) || '{}'),
      notes: (row.notes as string) || undefined,
    };
  }

  private rowToMatchEntry(row: Record<string, unknown>): MatchEntry {
    return {
      id: row.id as number,
      matchNumber: row.matchNumber as number,
      teamNumber: row.teamNumber as number,
      year: row.year as number,
      competitionType: ((row.competitionType as string) || 'FRC') as CompetitionType,
      alliance: row.alliance as 'red' | 'blue',
      alliancePosition: row.alliancePosition !== null && row.alliancePosition !== undefined
        ? (row.alliancePosition as number) : undefined,
      eventName: (row.eventName as string) || undefined,
      eventCode: (row.eventCode as string) || undefined,
      userId: (row.userId as string) || undefined,
      gameSpecificData: JSON.parse((row.gameSpecificData as string) || '{}'),
      notes: row.notes as string,
      timestamp: new Date(row.timestamp as string),
    };
  }

  // Pit scouting methods
  async addPitEntry(entry: Omit<PitEntry, 'id'>): Promise<number> {
    const db = this.getDb();
    try {
      const stmt = db.prepare(`
        INSERT INTO pitEntries (teamNumber, year, competitionType, driveTrain, weight, length, width, eventName, eventCode, userId, gameSpecificData, notes)
        VALUES (@teamNumber, @year, @competitionType, @driveTrain, @weight, @length, @width, @eventName, @eventCode, @userId, @gameSpecificData, @notes)
      `);
      const result = stmt.run({
        teamNumber: entry.teamNumber,
        year: entry.year,
        competitionType: entry.competitionType,
        driveTrain: entry.driveTrain,
        weight: entry.weight ?? null,
        length: entry.length ?? null,
        width: entry.width ?? null,
        eventName: entry.eventName ?? null,
        eventCode: entry.eventCode ?? null,
        userId: entry.userId ?? null,
        gameSpecificData: JSON.stringify(entry.gameSpecificData),
        notes: entry.notes ?? null,
      });
      return result.lastInsertRowid as number;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('UNIQUE constraint failed') && msg.includes('pitEntries')) {
        throw new Error(`Duplicate pit entry: Team ${entry.teamNumber} already has a pit scouting entry for this event`);
      }
      throw error;
    }
  }

  async getPitEntry(teamNumber: number, year: number, competitionType?: CompetitionType): Promise<PitEntry | undefined> {
    const db = this.getDb();
    let query = 'SELECT * FROM pitEntries WHERE teamNumber = ? AND year = ?';
    const params: unknown[] = [teamNumber, year];
    if (competitionType) {
      query += ' AND competitionType = ?';
      params.push(competitionType);
    }
    const row = db.prepare(query).get(...params) as Record<string, unknown> | undefined;
    return row ? this.rowToPitEntry(row) : undefined;
  }

  async getAllPitEntries(year?: number, eventCode?: string, competitionType?: CompetitionType): Promise<PitEntry[]> {
    const db = this.getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (year !== undefined) { conditions.push('year = ?'); params.push(year); }
    if (eventCode !== undefined) { conditions.push('eventCode = ?'); params.push(eventCode); }
    if (competitionType !== undefined) { conditions.push('competitionType = ?'); params.push(competitionType); }
    const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
    const rows = db.prepare(`SELECT * FROM pitEntries${where}`).all(...params) as Record<string, unknown>[];
    return rows.map(r => this.rowToPitEntry(r));
  }

  async updatePitEntry(id: number, updates: Partial<PitEntry>): Promise<void> {
    const db = this.getDb();
    const setParts: string[] = [];
    const params: unknown[] = [];
    const fieldMap: Record<string, () => void> = {
      teamNumber: () => { setParts.push('teamNumber = ?'); params.push(updates.teamNumber); },
      year: () => { setParts.push('year = ?'); params.push(updates.year); },
      competitionType: () => { setParts.push('competitionType = ?'); params.push(updates.competitionType); },
      driveTrain: () => { setParts.push('driveTrain = ?'); params.push(updates.driveTrain); },
      weight: () => { setParts.push('weight = ?'); params.push(updates.weight ?? null); },
      length: () => { setParts.push('length = ?'); params.push(updates.length ?? null); },
      width: () => { setParts.push('width = ?'); params.push(updates.width ?? null); },
      eventName: () => { setParts.push('eventName = ?'); params.push(updates.eventName ?? null); },
      eventCode: () => { setParts.push('eventCode = ?'); params.push(updates.eventCode ?? null); },
      gameSpecificData: () => { setParts.push('gameSpecificData = ?'); params.push(JSON.stringify(updates.gameSpecificData)); },
      notes: () => { setParts.push('notes = ?'); params.push(updates.notes ?? null); },
    };
    for (const key of Object.keys(updates)) {
      if (key in fieldMap && updates[key as keyof PitEntry] !== undefined) fieldMap[key]();
    }
    if (setParts.length === 0) return;
    setParts.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE pitEntries SET ${setParts.join(', ')} WHERE id = ?`).run(...params);
  }

  async deletePitEntry(id: number): Promise<void> {
    this.getDb().prepare('DELETE FROM pitEntries WHERE id = ?').run(id);
  }

  async checkPitScoutExists(teamNumber: number, eventCode: string): Promise<boolean> {
    const db = this.getDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM pitEntries WHERE teamNumber = ? AND eventCode = ?').get(teamNumber, eventCode) as { count: number };
    return row.count > 0;
  }

  // Match scouting methods
  async addMatchEntry(entry: Omit<MatchEntry, 'id'>): Promise<number> {
    const db = this.getDb();
    try {
      const stmt = db.prepare(`
        INSERT INTO matchEntries (matchNumber, teamNumber, year, competitionType, alliance, alliancePosition, eventName, eventCode, userId, gameSpecificData, notes, timestamp)
        VALUES (@matchNumber, @teamNumber, @year, @competitionType, @alliance, @alliancePosition, @eventName, @eventCode, @userId, @gameSpecificData, @notes, @timestamp)
      `);
      const result = stmt.run({
        matchNumber: entry.matchNumber,
        teamNumber: entry.teamNumber,
        year: entry.year,
        competitionType: entry.competitionType,
        alliance: entry.alliance,
        alliancePosition: entry.alliancePosition ?? null,
        eventName: entry.eventName ?? null,
        eventCode: entry.eventCode ?? null,
        userId: entry.userId ?? null,
        gameSpecificData: JSON.stringify(entry.gameSpecificData),
        notes: entry.notes ?? null,
        timestamp: entry.timestamp instanceof Date ? entry.timestamp.toISOString() : String(entry.timestamp),
      });
      return result.lastInsertRowid as number;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('UNIQUE constraint failed') && msg.includes('matchEntries')) {
        throw new Error(`Duplicate match entry: Team ${entry.teamNumber} already has an entry for match ${entry.matchNumber} at this event`);
      }
      throw error;
    }
  }

  async getMatchEntries(teamNumber: number, year?: number, competitionType?: CompetitionType): Promise<MatchEntry[]> {
    const db = this.getDb();
    let query = 'SELECT * FROM matchEntries WHERE teamNumber = ?';
    const params: unknown[] = [teamNumber];
    if (year !== undefined) { query += ' AND year = ?'; params.push(year); }
    if (competitionType !== undefined) { query += ' AND competitionType = ?'; params.push(competitionType); }
    const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
    return rows.map(r => this.rowToMatchEntry(r));
  }

  async getAllMatchEntries(year?: number, eventCode?: string, competitionType?: CompetitionType): Promise<MatchEntry[]> {
    const db = this.getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (year !== undefined) { conditions.push('year = ?'); params.push(year); }
    if (eventCode !== undefined) { conditions.push('eventCode = ?'); params.push(eventCode); }
    if (competitionType !== undefined) { conditions.push('competitionType = ?'); params.push(competitionType); }
    const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
    const rows = db.prepare(`SELECT * FROM matchEntries${where}`).all(...params) as Record<string, unknown>[];
    return rows.map(r => this.rowToMatchEntry(r));
  }

  async updateMatchEntry(id: number, updates: Partial<MatchEntry>): Promise<void> {
    const db = this.getDb();
    const setParts: string[] = [];
    const params: unknown[] = [];
    const fieldMap: Record<string, () => void> = {
      matchNumber: () => { setParts.push('matchNumber = ?'); params.push(updates.matchNumber); },
      teamNumber: () => { setParts.push('teamNumber = ?'); params.push(updates.teamNumber); },
      year: () => { setParts.push('year = ?'); params.push(updates.year); },
      competitionType: () => { setParts.push('competitionType = ?'); params.push(updates.competitionType); },
      alliance: () => { setParts.push('alliance = ?'); params.push(updates.alliance); },
      alliancePosition: () => { setParts.push('alliancePosition = ?'); params.push(updates.alliancePosition ?? null); },
      eventName: () => { setParts.push('eventName = ?'); params.push(updates.eventName ?? null); },
      eventCode: () => { setParts.push('eventCode = ?'); params.push(updates.eventCode ?? null); },
      gameSpecificData: () => { setParts.push('gameSpecificData = ?'); params.push(JSON.stringify(updates.gameSpecificData)); },
      notes: () => { setParts.push('notes = ?'); params.push(updates.notes ?? null); },
      timestamp: () => {
        const ts = updates.timestamp;
        setParts.push('timestamp = ?');
        params.push(ts instanceof Date ? ts.toISOString() : String(ts));
      },
    };
    for (const key of Object.keys(updates)) {
      if (key in fieldMap && updates[key as keyof MatchEntry] !== undefined) fieldMap[key]();
    }
    if (setParts.length === 0) return;
    setParts.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE matchEntries SET ${setParts.join(', ')} WHERE id = ?`).run(...params);
  }

  async deleteMatchEntry(id: number): Promise<void> {
    this.getDb().prepare('DELETE FROM matchEntries WHERE id = ?').run(id);
  }

  async checkMatchScoutExists(teamNumber: number, matchNumber: number, eventCode: string): Promise<boolean> {
    const db = this.getDb();
    const row = db.prepare(
      'SELECT COUNT(*) as count FROM matchEntries WHERE teamNumber = ? AND matchNumber = ? AND eventCode = ?'
    ).get(teamNumber, matchNumber, eventCode) as { count: number };
    return row.count > 0;
  }

  // Custom events
  async addCustomEvent(event: Omit<CustomEvent, 'id'>): Promise<number> {
    const db = this.getDb();
    const result = db.prepare(`
      INSERT INTO customEvents (eventCode, name, date, endDate, matchCount, location, region, year, competitionType)
      VALUES (@eventCode, @name, @date, @endDate, @matchCount, @location, @region, @year, @competitionType)
    `).run({
      eventCode: event.eventCode,
      name: event.name,
      date: event.date instanceof Date ? event.date.toISOString().split('T')[0] : String(event.date),
      endDate: event.endDate ? (event.endDate instanceof Date ? event.endDate.toISOString().split('T')[0] : String(event.endDate)) : null,
      matchCount: event.matchCount,
      location: event.location ?? null,
      region: event.region ?? null,
      year: event.year,
      competitionType: event.competitionType,
    });
    return result.lastInsertRowid as number;
  }

  async getCustomEvent(eventCode: string, competitionType?: CompetitionType): Promise<CustomEvent | undefined> {
    const db = this.getDb();
    let query = 'SELECT * FROM customEvents WHERE eventCode = ?';
    const params: unknown[] = [eventCode];
    if (competitionType) { query += ' AND competitionType = ?'; params.push(competitionType); }
    const row = db.prepare(query).get(...params) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      id: row.id as number,
      eventCode: row.eventCode as string,
      name: row.name as string,
      date: new Date(row.date as string),
      endDate: row.endDate ? new Date(row.endDate as string) : undefined,
      matchCount: row.matchCount as number,
      location: (row.location as string) || undefined,
      region: (row.region as string) || undefined,
      year: row.year as number,
      competitionType: ((row.competitionType as string) || 'FRC') as CompetitionType,
    };
  }

  async getAllCustomEvents(year?: number, competitionType?: CompetitionType): Promise<CustomEvent[]> {
    const db = this.getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (year !== undefined) { conditions.push('year = ?'); params.push(year); }
    if (competitionType !== undefined) { conditions.push('competitionType = ?'); params.push(competitionType); }
    const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
    const rows = db.prepare(`SELECT * FROM customEvents${where} ORDER BY date DESC`).all(...params) as Record<string, unknown>[];
    return rows.map(row => ({
      id: row.id as number,
      eventCode: row.eventCode as string,
      name: row.name as string,
      date: new Date(row.date as string),
      endDate: row.endDate ? new Date(row.endDate as string) : undefined,
      matchCount: row.matchCount as number,
      location: (row.location as string) || undefined,
      region: (row.region as string) || undefined,
      year: row.year as number,
      competitionType: ((row.competitionType as string) || 'FRC') as CompetitionType,
    }));
  }

  async updateCustomEvent(eventCode: string, updates: Partial<CustomEvent>): Promise<void> {
    const db = this.getDb();
    const setParts: string[] = [];
    const params: unknown[] = [];
    const validFields = ['name', 'date', 'endDate', 'matchCount', 'location', 'region', 'year'];
    for (const [key, value] of Object.entries(updates)) {
      if (validFields.includes(key)) {
        setParts.push(`${key} = ?`);
        if ((key === 'date' || key === 'endDate') && value instanceof Date) {
          params.push(value.toISOString().split('T')[0]);
        } else {
          params.push(value ?? null);
        }
      }
    }
    if (setParts.length === 0) return;
    setParts.push("updated_at = datetime('now')");
    params.push(eventCode);
    db.prepare(`UPDATE customEvents SET ${setParts.join(', ')} WHERE eventCode = ?`).run(...params);
  }

  async deleteCustomEvent(eventCode: string): Promise<void> {
    this.getDb().prepare('DELETE FROM customEvents WHERE eventCode = ?').run(eventCode);
  }

  // Scouting block methods
  async addScoutingBlock(block: Omit<ScoutingBlock, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const db = this.getDb();
    const result = db.prepare(`
      INSERT INTO scoutingBlocks (eventCode, year, blockNumber, startMatch, endMatch)
      VALUES (@eventCode, @year, @blockNumber, @startMatch, @endMatch)
    `).run(block);
    return result.lastInsertRowid as number;
  }

  async getScoutingBlock(id: number): Promise<ScoutingBlock | undefined> {
    return this.getDb().prepare('SELECT * FROM scoutingBlocks WHERE id = ?').get(id) as ScoutingBlock | undefined;
  }

  async getScoutingBlocks(eventCode: string, year: number): Promise<ScoutingBlock[]> {
    return this.getDb().prepare(
      'SELECT * FROM scoutingBlocks WHERE eventCode = ? AND year = ? ORDER BY blockNumber'
    ).all(eventCode, year) as ScoutingBlock[];
  }

  async updateScoutingBlock(id: number, updates: Partial<ScoutingBlock>): Promise<void> {
    const db = this.getDb();
    const setParts: string[] = [];
    const params: unknown[] = [];
    if (updates.blockNumber !== undefined) { setParts.push('blockNumber = ?'); params.push(updates.blockNumber); }
    if (updates.startMatch !== undefined) { setParts.push('startMatch = ?'); params.push(updates.startMatch); }
    if (updates.endMatch !== undefined) { setParts.push('endMatch = ?'); params.push(updates.endMatch); }
    if (setParts.length === 0) return;
    setParts.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE scoutingBlocks SET ${setParts.join(', ')} WHERE id = ?`).run(...params);
  }

  async deleteScoutingBlock(id: number): Promise<void> {
    this.getDb().prepare('DELETE FROM scoutingBlocks WHERE id = ?').run(id);
  }

  async deleteScoutingBlocksByEvent(eventCode: string, year: number): Promise<void> {
    this.getDb().prepare('DELETE FROM scoutingBlocks WHERE eventCode = ? AND year = ?').run(eventCode, year);
  }

  // Block assignment methods
  async addBlockAssignment(assignment: Omit<BlockAssignment, 'id' | 'created_at'>): Promise<number> {
    const db = this.getDb();
    // Upsert: update userId if the slot already exists
    const existing = db.prepare(
      'SELECT id FROM blockAssignments WHERE blockId = ? AND alliance = ? AND position = ?'
    ).get(assignment.blockId, assignment.alliance, assignment.position) as { id: number } | undefined;
    if (existing) {
      db.prepare('UPDATE blockAssignments SET userId = ? WHERE id = ?').run(assignment.userId, existing.id);
      return existing.id;
    }
    const result = db.prepare(`
      INSERT INTO blockAssignments (blockId, userId, alliance, position)
      VALUES (@blockId, @userId, @alliance, @position)
    `).run(assignment);
    return result.lastInsertRowid as number;
  }

  async getBlockAssignment(id: number): Promise<BlockAssignment | undefined> {
    return this.getDb().prepare('SELECT * FROM blockAssignments WHERE id = ?').get(id) as BlockAssignment | undefined;
  }

  async getBlockAssignments(blockId: number): Promise<BlockAssignment[]> {
    return this.getDb().prepare(
      'SELECT * FROM blockAssignments WHERE blockId = ? ORDER BY alliance, position'
    ).all(blockId) as BlockAssignment[];
  }

  async getBlockAssignmentsByEvent(eventCode: string, year: number): Promise<BlockAssignment[]> {
    return this.getDb().prepare(`
      SELECT ba.* FROM blockAssignments ba
      INNER JOIN scoutingBlocks sb ON ba.blockId = sb.id
      WHERE sb.eventCode = ? AND sb.year = ?
      ORDER BY sb.blockNumber, ba.alliance, ba.position
    `).all(eventCode, year) as BlockAssignment[];
  }

  async getBlockAssignmentsByUser(userId: string): Promise<BlockAssignment[]> {
    return this.getDb().prepare('SELECT * FROM blockAssignments WHERE userId = ?').all(userId) as BlockAssignment[];
  }

  async updateBlockAssignment(id: number, updates: Partial<BlockAssignment>): Promise<void> {
    const db = this.getDb();
    const setParts: string[] = [];
    const params: unknown[] = [];
    if (updates.userId !== undefined) { setParts.push('userId = ?'); params.push(updates.userId); }
    if (updates.alliance !== undefined) { setParts.push('alliance = ?'); params.push(updates.alliance); }
    if (updates.position !== undefined) { setParts.push('position = ?'); params.push(updates.position); }
    if (setParts.length === 0) return;
    params.push(id);
    db.prepare(`UPDATE blockAssignments SET ${setParts.join(', ')} WHERE id = ?`).run(...params);
  }

  async deleteBlockAssignment(id: number): Promise<void> {
    this.getDb().prepare('DELETE FROM blockAssignments WHERE id = ?').run(id);
  }

  async deleteBlockAssignmentsByBlock(blockId: number): Promise<void> {
    this.getDb().prepare('DELETE FROM blockAssignments WHERE blockId = ?').run(blockId);
  }

  // Combined query for blocks with assignments
  async getScoutingBlocksWithAssignments(eventCode: string, year: number, scoutsPerAlliance: number = 3): Promise<ScoutingBlockWithAssignments[]> {
    const blocks = await this.getScoutingBlocks(eventCode, year);
    const assignments = await this.getBlockAssignmentsByEvent(eventCode, year);

    return blocks.map(block => {
      const blockAssignments = assignments.filter(a => a.blockId === block.id);
      const redScouts: (string | null)[] = Array(scoutsPerAlliance).fill(null);
      const blueScouts: (string | null)[] = Array(scoutsPerAlliance).fill(null);
      blockAssignments.forEach(assignment => {
        if (assignment.position < scoutsPerAlliance) {
          if (assignment.alliance === 'red') redScouts[assignment.position] = assignment.userId;
          else blueScouts[assignment.position] = assignment.userId;
        }
      });
      return { ...block, redScouts, blueScouts };
    });
  }

  // User preferred partners
  async updateUserPreferredPartners(userId: string, preferredPartners: string[]): Promise<void> {
    this.getDb().prepare(
      "UPDATE users SET preferredPartners = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(JSON.stringify(preferredPartners), userId);
  }

  async getUserPreferredPartners(userId: string): Promise<string[]> {
    const row = this.getDb().prepare('SELECT preferredPartners FROM users WHERE id = ?').get(userId) as { preferredPartners: string | null } | undefined;
    if (!row?.preferredPartners) return [];
    try { return JSON.parse(row.preferredPartners); } catch { return []; }
  }

  // Picklist methods
  async addPicklist(picklist: Omit<Picklist, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const db = this.getDb();
    const p = picklist as Record<string, unknown>;
    const result = db.prepare(`
      INSERT INTO picklists (eventCode, year, competitionType, picklistType, name, createdBy)
      VALUES (@eventCode, @year, @competitionType, @picklistType, @name, @createdBy)
    `).run({
      eventCode: p.eventCode,
      year: p.year,
      competitionType: p.competitionType,
      picklistType: p.picklistType ?? 'main',
      name: p.name ?? null,
      createdBy: p.createdBy ?? null,
    });
    return result.lastInsertRowid as number;
  }

  async getPicklist(id: number): Promise<Picklist | undefined> {
    const row = this.getDb().prepare('SELECT * FROM picklists WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.rowToPicklist(row);
  }

  async getPicklistByEvent(eventCode: string, year: number, competitionType?: CompetitionType, picklistType?: string): Promise<Picklist | undefined> {
    const db = this.getDb();
    let query = 'SELECT * FROM picklists WHERE eventCode = ? AND year = ?';
    const params: unknown[] = [eventCode, year];
    if (competitionType) { query += ' AND competitionType = ?'; params.push(competitionType); }
    if (picklistType) { query += ' AND picklistType = ?'; params.push(picklistType); }
    query += ' ORDER BY id ASC';
    const row = db.prepare(query).get(...params) as Record<string, unknown> | undefined;
    return row ? this.rowToPicklist(row) : undefined;
  }

  async getPicklistsByEvent(eventCode: string, year: number, competitionType?: CompetitionType): Promise<Picklist[]> {
    const db = this.getDb();
    let query = 'SELECT * FROM picklists WHERE eventCode = ? AND year = ?';
    const params: unknown[] = [eventCode, year];
    if (competitionType) { query += ' AND competitionType = ?'; params.push(competitionType); }
    query += ' ORDER BY picklistType, id';
    const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
    return rows.map(r => this.rowToPicklist(r));
  }

  private rowToPicklist(row: Record<string, unknown>): Picklist {
    return {
      id: row.id as number,
      eventCode: row.eventCode as string,
      year: row.year as number,
      competitionType: ((row.competitionType as string) || 'FRC') as CompetitionType,
      picklistType: row.picklistType as string,
      name: (row.name as string) || undefined,
      createdBy: (row.createdBy as string) || undefined,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    } as unknown as Picklist;
  }

  async updatePicklist(id: number, updates: Partial<Picklist>): Promise<void> {
    const db = this.getDb();
    const setParts: string[] = [];
    const params: unknown[] = [];
    const u = updates as Record<string, unknown>;
    if (u.name !== undefined) { setParts.push('name = ?'); params.push(u.name); }
    if (u.picklistType !== undefined) { setParts.push('picklistType = ?'); params.push(u.picklistType); }
    if (setParts.length === 0) return;
    setParts.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE picklists SET ${setParts.join(', ')} WHERE id = ?`).run(...params);
  }

  async deletePicklist(id: number): Promise<void> {
    this.getDb().prepare('DELETE FROM picklists WHERE id = ?').run(id);
  }

  async addPicklistEntry(entry: Omit<PicklistEntry, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const db = this.getDb();
    const e = entry as Record<string, unknown>;
    const result = db.prepare(`
      INSERT INTO picklistEntries (picklistId, teamNumber, rank, qualRanking, source, notes)
      VALUES (@picklistId, @teamNumber, @rank, @qualRanking, @source, @notes)
    `).run({
      picklistId: e.picklistId,
      teamNumber: e.teamNumber,
      rank: e.rank,
      qualRanking: e.qualRanking ?? null,
      source: e.source ?? null,
      notes: e.notes ?? null,
    });
    return result.lastInsertRowid as number;
  }

  async getPicklistEntry(id: number): Promise<PicklistEntry | undefined> {
    const row = this.getDb().prepare('SELECT * FROM picklistEntries WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToPicklistEntry(row) : undefined;
  }

  async getPicklistEntries(picklistId: number): Promise<PicklistEntry[]> {
    const rows = this.getDb().prepare('SELECT * FROM picklistEntries WHERE picklistId = ? ORDER BY rank').all(picklistId) as Record<string, unknown>[];
    return rows.map(r => this.rowToPicklistEntry(r));
  }

  private rowToPicklistEntry(row: Record<string, unknown>): PicklistEntry {
    return {
      id: row.id as number,
      picklistId: row.picklistId as number,
      teamNumber: row.teamNumber as number,
      rank: row.rank as number,
      qualRanking: row.qualRanking !== null ? (row.qualRanking as number) : undefined,
      source: (row.source as string) || undefined,
      notes: (row.notes as string) || undefined,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    } as unknown as PicklistEntry;
  }

  async updatePicklistEntry(id: number, updates: Partial<PicklistEntry>): Promise<void> {
    const db = this.getDb();
    const setParts: string[] = [];
    const params: unknown[] = [];
    const u = updates as Record<string, unknown>;
    if (u.rank !== undefined) { setParts.push('rank = ?'); params.push(u.rank); }
    if (u.notes !== undefined) { setParts.push('notes = ?'); params.push(u.notes); }
    if (u.source !== undefined) { setParts.push('source = ?'); params.push(u.source); }
    if (setParts.length === 0) return;
    setParts.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE picklistEntries SET ${setParts.join(', ')} WHERE id = ?`).run(...params);
  }

  async deletePicklistEntry(id: number): Promise<void> {
    this.getDb().prepare('DELETE FROM picklistEntries WHERE id = ?').run(id);
  }

  async updatePicklistEntryRank(picklistId: number, teamNumber: number, newRank: number): Promise<void> {
    this.getDb().prepare(
      "UPDATE picklistEntries SET rank = ?, updated_at = datetime('now') WHERE picklistId = ? AND teamNumber = ?"
    ).run(newRank, picklistId, teamNumber);
  }

  async reorderPicklistEntries(picklistId: number, entries: { teamNumber: number; rank: number }[]): Promise<void> {
    const db = this.getDb();
    const reorder = db.transaction(() => {
      if (entries.length > 0) {
        const placeholders = entries.map(() => '?').join(', ');
        const teamNumbers = entries.map(e => e.teamNumber);
        db.prepare(
          `DELETE FROM picklistEntries WHERE picklistId = ? AND teamNumber NOT IN (${placeholders})`
        ).run(picklistId, ...teamNumbers);
      } else {
        db.prepare('DELETE FROM picklistEntries WHERE picklistId = ?').run(picklistId);
      }

      for (const e of entries) {
        const existing = db.prepare(
          'SELECT id FROM picklistEntries WHERE picklistId = ? AND teamNumber = ?'
        ).get(picklistId, e.teamNumber);
        if (existing) {
          db.prepare(
            "UPDATE picklistEntries SET rank = ?, updated_at = datetime('now') WHERE picklistId = ? AND teamNumber = ?"
          ).run(e.rank, picklistId, e.teamNumber);
        } else {
          db.prepare(
            'INSERT INTO picklistEntries (picklistId, teamNumber, rank) VALUES (?, ?, ?)'
          ).run(picklistId, e.teamNumber, e.rank);
        }
      }
    });
    reorder();
  }

  async addPicklistNote(note: Omit<PicklistNote, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const db = this.getDb();
    const n = note as Record<string, unknown>;
    const result = db.prepare(`
      INSERT INTO picklistNotes (picklistId, teamNumber, note, userId)
      VALUES (@picklistId, @teamNumber, @note, @userId)
    `).run({
      picklistId: n.picklistId,
      teamNumber: n.teamNumber,
      note: n.note ?? n.content ?? null,
      userId: n.userId ?? null,
    });
    return result.lastInsertRowid as number;
  }

  async getPicklistNote(id: number): Promise<PicklistNote | undefined> {
    const row = this.getDb().prepare('SELECT * FROM picklistNotes WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToPicklistNote(row) : undefined;
  }

  async getPicklistNotes(picklistId: number, teamNumber?: number): Promise<PicklistNote[]> {
    const db = this.getDb();
    let query = 'SELECT * FROM picklistNotes WHERE picklistId = ?';
    const params: unknown[] = [picklistId];
    if (teamNumber !== undefined) { query += ' AND teamNumber = ?'; params.push(teamNumber); }
    query += ' ORDER BY created_at DESC';
    const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
    return rows.map(r => this.rowToPicklistNote(r));
  }

  private rowToPicklistNote(row: Record<string, unknown>): PicklistNote {
    return {
      id: row.id as number,
      picklistId: row.picklistId as number,
      teamNumber: row.teamNumber as number,
      note: (row.note as string) || '',
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    } as unknown as PicklistNote;
  }

  async updatePicklistNote(id: number, updates: Partial<PicklistNote>): Promise<void> {
    const db = this.getDb();
    const setParts: string[] = [];
    const params: unknown[] = [];
    const u = updates as Record<string, unknown>;
    if (u.note !== undefined || u.content !== undefined) {
      setParts.push('note = ?');
      params.push(u.note ?? u.content);
    }
    if (setParts.length === 0) return;
    setParts.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE picklistNotes SET ${setParts.join(', ')} WHERE id = ?`).run(...params);
  }

  async deletePicklistNote(id: number): Promise<void> {
    this.getDb().prepare('DELETE FROM picklistNotes WHERE id = ?').run(id);
  }

  // Export/Import/Reset
  async exportData(year?: number): Promise<{ pitEntries: PitEntry[]; matchEntries: MatchEntry[] }> {
    const pitEntries = await this.getAllPitEntries(year);
    const matchEntries = await this.getAllMatchEntries(year);
    return { pitEntries, matchEntries };
  }

  async importData(data: { pitEntries: PitEntry[]; matchEntries: MatchEntry[] }): Promise<void> {
    const years = new Set<number>();
    data.pitEntries.forEach(e => years.add(e.year));
    data.matchEntries.forEach(e => years.add(e.year));

    const db = this.getDb();
    const doImport = db.transaction(() => {
      for (const year of years) {
        db.prepare('DELETE FROM pitEntries WHERE year = ?').run(year);
        db.prepare('DELETE FROM matchEntries WHERE year = ?').run(year);
      }
    });
    doImport();

    for (const entry of data.pitEntries) await this.addPitEntry(entry);
    for (const entry of data.matchEntries) await this.addMatchEntry(entry);
  }

  async resetDatabase(): Promise<void> {
    const db = this.getDb();
    const reset = db.transaction(() => {
      db.prepare('DELETE FROM pitEntries').run();
      db.prepare('DELETE FROM matchEntries').run();
      // Reset auto-increment counters
      db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('pitEntries', 'matchEntries')").run();
    });
    reset();
  }
}
