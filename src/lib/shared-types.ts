// Consolidated types for the Athena scouting application
// This file centralizes all shared type definitions to reduce redundancy

// ========== COMPETITION TYPES ==========

export type CompetitionType = 'FRC' | 'FTC';

// ========== DATABASE TYPES ==========

export interface PitEntry {
  id?: number;
  teamNumber: number;
  year: number;
  competitionType: CompetitionType;
  driveTrain: "Swerve" | "Mecanum" | "Tank" | "Other";
  weight?: number;
  length?: number;
  width?: number;
  eventName?: string;
  eventCode?: string;
  userId?: string;
  gameSpecificData: Record<string, number | string | boolean | Record<string, number | string | boolean>>;
  notes?: string;
  [extra: string]: unknown;
}

export interface MatchEntry {
  id?: number;
  matchNumber: number;
  teamNumber: number;
  year: number;
  competitionType: CompetitionType;
  alliance: 'red' | 'blue';
  alliancePosition?: number; // 1, 2, or 3 for alliance position
  eventName?: string;
  eventCode?: string;
  userId?: string;
  gameSpecificData: Record<string, number | string | boolean | Record<string, number | string | boolean>>;
  notes: string;
  timestamp: Date;
}

export interface CustomEvent {
  id?: number;
  eventCode: string;
  name: string;
  date: Date;
  endDate?: Date;
  matchCount: number;
  location?: string;
  region?: string;
  year: number;
  competitionType: CompetitionType;
}

// Database row types for SQL operations
export interface PitEntryRow {
  id: number;
  teamNumber: number;
  year: number;
  competitionType: string;
  driveTrain: string;
  weight: number | null;
  length: number | null;
  width: number | null;
  eventName: string | null;
  eventCode: string | null;
  userId: string | null;
  gameSpecificData: string;
  notes: string | null;
}

export interface MatchEntryRow {
  id: number;
  matchNumber: number;
  teamNumber: number;
  year: number;
  competitionType: string;
  alliance: string;
  alliancePosition: number | null;
  eventName: string | null;
  eventCode: string | null;
  userId: string | null;
  gameSpecificData: string;
  notes: string;
  timestamp: Date;
}

export interface CustomEventRow {
  id: number;
  eventCode: string;
  name: string;
  date: Date;
  endDate: Date | null;
  matchCount: number;
  location: string | null;
  region: string | null;
  year: number;
  competitionType: string;
}

// ========== SCHEDULING TYPES ==========

export interface ScoutingBlock {
  id?: number;
  eventCode: string;
  year: number;
  blockNumber: number;
  startMatch: number;
  endMatch: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface BlockAssignment {
  id?: number;
  blockId: number;
  userId: string;
  alliance: 'red' | 'blue';
  position: number; // 0, 1, or 2
  created_at?: Date;
}

export interface ScoutingBlockWithAssignments extends ScoutingBlock {
  redScouts: (string | null)[]; // Array of user IDs or null (2 for FTC, 3 for FRC)
  blueScouts: (string | null)[]; // Array of user IDs or null (2 for FTC, 3 for FRC)
}

// ========== PICKLIST TYPES ==========

export interface Picklist {
  id?: number;
  eventCode: string;
  year: number;
  competitionType: CompetitionType;
  picklistType: 'pick1' | 'pick2' | 'main'; // pick1/pick2 for FRC, main for FTC
  created_at?: Date;
  updated_at?: Date;
}

export interface PicklistEntry {
  id?: number;
  picklistId: number;
  teamNumber: number;
  rank: number; // Position in the picklist (1-indexed)
  qualRanking?: number; // Initial qualification ranking from TBA/FIRST FTC
  created_at?: Date;
  updated_at?: Date;
}

export interface PicklistNote {
  id?: number;
  picklistId: number;
  teamNumber: number;
  note: string;
  created_by?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface PicklistRow {
  id: number;
  eventCode: string;
  year: number;
  competitionType: string;
  picklistType: string;
  created_at: Date;
  updated_at: Date;
}

export interface PicklistEntryRow {
  id: number;
  picklistId: number;
  teamNumber: number;
  rank: number;
  qualRanking: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface PicklistNoteRow {
  id: number;
  picklistId: number;
  teamNumber: number;
  note: string;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

// ========== SCHEDULING DATABASE SERVICE TYPES ==========

// ========== DATABASE SERVICE TYPES ==========

export interface DatabaseService {
  // Connection management
  getPool?(): Promise<import('mssql').ConnectionPool>;

  // Pit scouting
  addPitEntry(entry: Omit<PitEntry, 'id'>): Promise<number>;
  getPitEntry(teamNumber: number, year: number, competitionType?: CompetitionType): Promise<PitEntry | undefined>;
  getAllPitEntries(year?: number, eventCode?: string, competitionType?: CompetitionType): Promise<PitEntry[]>;
  updatePitEntry(id: number, updates: Partial<PitEntry>): Promise<void>;
  deletePitEntry(id: number): Promise<void>;
  checkPitScoutExists(teamNumber: number, eventCode: string): Promise<boolean>;

  // Match scouting
  addMatchEntry(entry: Omit<MatchEntry, 'id'>): Promise<number>;
  getMatchEntries(teamNumber: number, year?: number, competitionType?: CompetitionType): Promise<MatchEntry[]>;
  getAllMatchEntries(year?: number, eventCode?: string, competitionType?: CompetitionType): Promise<MatchEntry[]>;
  updateMatchEntry(id: number, updates: Partial<MatchEntry>): Promise<void>;
  deleteMatchEntry(id: number): Promise<void>;
  checkMatchScoutExists(teamNumber: number, matchNumber: number, eventCode: string): Promise<boolean>;

  // Custom events
  addCustomEvent(event: Omit<CustomEvent, 'id'>): Promise<number>;
  getCustomEvent(eventCode: string, competitionType?: CompetitionType): Promise<CustomEvent | undefined>;
  getAllCustomEvents(year?: number, competitionType?: CompetitionType): Promise<CustomEvent[]>;
  updateCustomEvent(eventCode: string, updates: Partial<CustomEvent>): Promise<void>;
  deleteCustomEvent(eventCode: string): Promise<void>;

  // Scouting blocks
  addScoutingBlock(block: Omit<ScoutingBlock, 'id' | 'created_at' | 'updated_at'>): Promise<number>;
  getScoutingBlock(id: number): Promise<ScoutingBlock | undefined>;
  getScoutingBlocks(eventCode: string, year: number): Promise<ScoutingBlock[]>;
  updateScoutingBlock(id: number, updates: Partial<ScoutingBlock>): Promise<void>;
  deleteScoutingBlock(id: number): Promise<void>;
  deleteScoutingBlocksByEvent(eventCode: string, year: number): Promise<void>;

  // Block assignments
  addBlockAssignment(assignment: Omit<BlockAssignment, 'id' | 'created_at'>): Promise<number>;
  getBlockAssignment(id: number): Promise<BlockAssignment | undefined>;
  getBlockAssignments(blockId: number): Promise<BlockAssignment[]>;
  getBlockAssignmentsByEvent(eventCode: string, year: number): Promise<BlockAssignment[]>;
  getBlockAssignmentsByUser(userId: string): Promise<BlockAssignment[]>;
  updateBlockAssignment(id: number, updates: Partial<BlockAssignment>): Promise<void>;
  deleteBlockAssignment(id: number): Promise<void>;
  deleteBlockAssignmentsByBlock(blockId: number): Promise<void>;

  // Scouting blocks with assignments (combined query)
  getScoutingBlocksWithAssignments(eventCode: string, year: number, scoutsPerAlliance?: number): Promise<ScoutingBlockWithAssignments[]>;

  // User preferred partners
  updateUserPreferredPartners(userId: string, preferredPartners: string[]): Promise<void>;
  getUserPreferredPartners(userId: string): Promise<string[]>;

  // Picklist methods
  addPicklist(picklist: Omit<Picklist, 'id' | 'created_at' | 'updated_at'>): Promise<number>;
  getPicklist(id: number): Promise<Picklist | undefined>;
  getPicklistByEvent(eventCode: string, year: number, competitionType: CompetitionType, picklistType?: string): Promise<Picklist | undefined>;
  getPicklistsByEvent(eventCode: string, year: number, competitionType: CompetitionType): Promise<Picklist[]>;
  updatePicklist(id: number, updates: Partial<Picklist>): Promise<void>;
  deletePicklist(id: number): Promise<void>;

  // Picklist entries (team rankings within a picklist)
  addPicklistEntry(entry: Omit<PicklistEntry, 'id' | 'created_at' | 'updated_at'>): Promise<number>;
  getPicklistEntry(id: number): Promise<PicklistEntry | undefined>;
  getPicklistEntries(picklistId: number): Promise<PicklistEntry[]>;
  updatePicklistEntry(id: number, updates: Partial<PicklistEntry>): Promise<void>;
  deletePicklistEntry(id: number): Promise<void>;
  updatePicklistEntryRank(picklistId: number, teamNumber: number, rank: number): Promise<void>;
  reorderPicklistEntries(picklistId: number, entries: Array<{teamNumber: number, rank: number}>): Promise<void>;

  // Picklist notes (qualitative notes per team in a picklist)
  addPicklistNote(note: Omit<PicklistNote, 'id' | 'created_at' | 'updated_at'>): Promise<number>;
  getPicklistNote(id: number): Promise<PicklistNote | undefined>;
  getPicklistNotes(picklistId: number, teamNumber?: number): Promise<PicklistNote[]>;
  updatePicklistNote(id: number, updates: Partial<PicklistNote>): Promise<void>;
  deletePicklistNote(id: number): Promise<void>;

  // Sync operations
  exportData(year?: number, competitionType?: CompetitionType): Promise<{pitEntries: PitEntry[], matchEntries: MatchEntry[]}>;
  importData(data: {pitEntries: PitEntry[], matchEntries: MatchEntry[]}): Promise<void>;
  resetDatabase(): Promise<void>;
  syncToCloud?(): Promise<void>;
  syncFromCloud?(): Promise<void>;
}

export type DatabaseProvider = 'azuresql' | 'sqlite';

export interface AzureSqlConfig {
  server?: string;
  database?: string;
  user?: string;
  password?: string;
  connectionString?: string;
  useManagedIdentity?: boolean;
}

export interface SqliteConfig {
  /** Path to the SQLite database file. Defaults to './local.db' */
  filename?: string;
}

export interface DatabaseConfig {
  provider: DatabaseProvider;
  local?: {
    name: string;
  };
  azuresql?: AzureSqlConfig;
  sqlite?: SqliteConfig;
}

// ========== GAME CONFIGURATION TYPES ==========

export interface ScoringDefinition {
  label: string;
  description: string;
  // Simple scoring: use points for boolean values or as multiplier for numbers
  points?: number;
  // Enum scoring: use pointValues for string-based enum scoring
  // Example: pointValues: { "shallow": 3, "deep": 6, "none": 0 }
  pointValues?: Record<string, number>;
  // Explicit type definition for form rendering
  type?: 'boolean' | 'select' | 'number';
  // Optional increments array for number fields to show quick increment buttons
  // Example: increments: [1, 5, 10] will show +1, +5, +10 and -1, -5, -10 buttons
  increments?: number[];
}

export interface YearConfig {
  competitionType: CompetitionType;
  gameName: string;
  startPositions?: string[]; // Configurable autonomous start positions (e.g., ["left", "center", "right"])
  scoring: {
    autonomous: Record<string, ScoringDefinition>;
    teleop: Record<string, ScoringDefinition>;
    endgame: Record<string, ScoringDefinition>;
    fouls?: Record<string, ScoringDefinition>;
  };
  pitScouting: {
    autonomous: Record<string, {
      label: string;
      type: 'text' | 'number' | 'boolean' | 'select';
      options?: string[];
    }>;
    teleoperated: Record<string, {
      label: string;
      type: 'text' | 'number' | 'boolean' | 'select';
      options?: string[];
    }>;
    endgame: Record<string, {
      label: string;
      type: 'text' | 'number' | 'boolean' | 'select';
      options?: string[];
    }>;
  };
}

export interface GameConfig {
  FRC: {
    [year: string]: YearConfig;
  };
  FTC: {
    [year: string]: YearConfig;
  };
}

// ========== EVENT TYPES ==========

export interface Event {
  name: string;
  region: string; // Region as used by FIRST API
  code: string;   // Event Code as used by FIRST API
}

// ========== STATISTICS AND ANALYSIS TYPES ==========

export interface TeamStats {
  totalMatches: number;
  avgScore: number;
  epa: number;
  autoStats: Record<string, number>;
  teleopStats: Record<string, number>;
  endgameStats: Record<string, number>;
}

export interface EPABreakdown {
  team?: string;
  auto: number;
  teleop: number;
  endgame: number;
  penalties: number;
  totalEPA: number;
}

// ========== DASHBOARD AND UI TYPES ==========

export interface DashboardStats {
  totalTeams: number;
  uniqueMatches: number;
  totalMatches: number;
  totalPitScouts: number;
  matchCompletion: number;
  teamStats: Array<{
    teamNumber: number;
    name: string;
    matchesPlayed: number;
    totalEPA: number;
  }>;
  recentActivity: Array<{
    teamNumber: number;
    matchNumber: number;
    timestamp: Date;
  }>;
}

export interface AnalysisData {
  scoringAnalysis: Array<{
    category: string;
    average: number;
    count: number;
    data: number[];
  }>;
  teamEPAData: Array<{
    teamNumber: number;
    name: string;
    matchesPlayed: number;
    totalEPA: number;
    autoEPA: number;
    teleopEPA: number;
    endgameEPA: number;
    penaltiesEPA: number;
  }>;
  totalMatches: number;
  totalTeams: number;
}

export interface TeamData {
  teamNumber: number;
  year?: number;
  eventCode?: string;
  matchEntries: MatchEntry[];
  pitEntry: PitEntry | null;
  stats: TeamStats | null;
  epa: EPABreakdown | null;
  matchCount: number;
}

export interface PicklistData {
  teams: Array<{
    teamNumber: number;
    name: string;
    driveTrain: string;
    weight: number;
    length: number;
    width: number;
    matchesPlayed: number;
    totalEPA: number;
    autoEPA: number;
    teleopEPA: number;
    endgameEPA: number;
    rank: number;
  }>;
  totalTeams: number;
  lastUpdated: string;
}

// ========== FORM DATA TYPES ==========

export interface DynamicMatchData {
  // Basic match info
  matchNumber: number;
  teamNumber: number;
  alliance: 'red' | 'blue';
  alliancePosition?: number; // 1, 2, or 3 for alliance position

  // Game-specific data stored as flexible object
  autonomous: Record<string, number | string | boolean>;
  teleop: Record<string, number | string | boolean>;
  endgame: Record<string, number | string | boolean>;
  fouls: Record<string, number | string | boolean>;

  // Common fields
  notes: string;
}

export interface DynamicPitData {
  team: number;
  drivetrain: string;
  weight: string;
  length: string;
  width: string;
  hasAuto: boolean;
  notes: string;
  gameSpecificData: Record<string, number | string | boolean | string[]>;
}

// ========== TEAM LIST TYPES ==========

export interface TeamWithImages {
  // Extends TbaTeam from TBA API types
  key: string;
  team_number: number;
  nickname: string;
  name: string;
  school_name: string;
  city: string;
  state_prov: string;
  country: string;
  address: string;
  postal_code: string;
  gmaps_place_id: string;
  gmaps_url: string;
  lat: number;
  lng: number;
  location_name: string;
  website: string;
  rookie_year: number;
  images: string[];
}
