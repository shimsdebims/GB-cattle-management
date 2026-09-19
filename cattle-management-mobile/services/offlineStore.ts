import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persistence and shared state for the offline layer.
 *
 * Responsibilities kept here so `offlineApi` can focus on entity behaviour:
 *  - cached collections
 *  - the durable operation queue
 *  - temporary-id → server-id mapping
 *  - a single observable connectivity/sync state
 */

export type EntityName = 'cattle' | 'milk' | 'feeding' | 'expense' | 'revenue';

export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface PendingOperation {
  id: string;
  entity: EntityName;
  type: OperationType;
  /** Local id of the affected record (temporary or real). */
  recordId: string;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  /** Operations the server rejected permanently; they need user attention. */
  failedCount: number;
  lastSyncAt: number | null;
}

// ─── Storage keys ────────────────────────────────────────────────────────────

const CACHE_KEYS: Record<EntityName, string> = {
  cattle: 'cache:cattle',
  milk: 'cache:milk',
  feeding: 'cache:feeding',
  expense: 'cache:expense',
  revenue: 'cache:revenue',
};

const QUEUE_KEY = 'sync:queue';
const FAILED_KEY = 'sync:failed';
const ID_MAP_KEY = 'sync:idmap';
const LAST_SYNC_KEY = 'sync:lastSyncAt';

// ─── Temporary ids ───────────────────────────────────────────────────────────

const TEMP_PREFIX = 'temp_';

/**
 * Includes a random suffix: the previous implementation used only Date.now(),
 * so two records created in the same millisecond collided.
 */
export function newTempId(): string {
  return `${TEMP_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export const isTempId = (id: string): boolean =>
  typeof id === 'string' && id.startsWith(TEMP_PREFIX);

// ─── Generic JSON storage ────────────────────────────────────────────────────

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (error) {
    console.warn(`offlineStore: failed to read ${key}`, error);
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`offlineStore: failed to write ${key}`, error);
  }
}

// ─── Cached collections ──────────────────────────────────────────────────────

export const readCache = <T>(entity: EntityName): Promise<T[]> =>
  readJson<T[]>(CACHE_KEYS[entity], []);

export const writeCache = <T>(entity: EntityName, items: T[]): Promise<void> =>
  writeJson(CACHE_KEYS[entity], items);

export async function clearAllCaches(): Promise<void> {
  await AsyncStorage.multiRemove([
    ...Object.values(CACHE_KEYS),
    QUEUE_KEY,
    FAILED_KEY,
    ID_MAP_KEY,
    LAST_SYNC_KEY,
  ]);
}

// ─── Operation queue ─────────────────────────────────────────────────────────

export const readQueue = (): Promise<PendingOperation[]> =>
  readJson<PendingOperation[]>(QUEUE_KEY, []);

export const writeQueue = (ops: PendingOperation[]): Promise<void> =>
  writeJson(QUEUE_KEY, ops);

export const readFailed = (): Promise<PendingOperation[]> =>
  readJson<PendingOperation[]>(FAILED_KEY, []);

export const writeFailed = (ops: PendingOperation[]): Promise<void> =>
  writeJson(FAILED_KEY, ops);

export async function enqueue(
  operation: Omit<PendingOperation, 'id' | 'createdAt' | 'attempts'>
): Promise<void> {
  const queue = await readQueue();
  queue.push({
    ...operation,
    id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    attempts: 0,
  });
  await writeQueue(queue);
}

// ─── Temp-id → server-id map ─────────────────────────────────────────────────

export const readIdMap = (): Promise<Record<string, string>> =>
  readJson<Record<string, string>>(ID_MAP_KEY, {});

export async function recordIdMapping(tempId: string, realId: string): Promise<void> {
  const map = await readIdMap();
  map[tempId] = realId;
  await writeJson(ID_MAP_KEY, map);
}

/** Resolves a possibly-temporary id to its server id, if known. */
export function resolveId(id: string, map: Record<string, string>): string {
  return map[id] ?? id;
}

// ─── Last sync ───────────────────────────────────────────────────────────────

export async function readLastSync(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
  return raw ? Number(raw) : null;
}

export const writeLastSync = (timestamp: number): Promise<void> =>
  AsyncStorage.setItem(LAST_SYNC_KEY, String(timestamp));

// ─── Observable sync state ───────────────────────────────────────────────────

/**
 * One shared state object. Previously each `useOfflineAPI()` call kept its own
 * copy and `isOnline` was hardcoded true, so the sync badge and the screens
 * disagreed about connectivity.
 */
type Listener = (state: SyncState) => void;

let state: SyncState = {
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  failedCount: 0,
  lastSyncAt: null,
};

const listeners = new Set<Listener>();

export const getSyncState = (): SyncState => state;

export function setSyncState(patch: Partial<SyncState>): void {
  const next = { ...state, ...patch };

  const unchanged = (Object.keys(next) as Array<keyof SyncState>).every(
    (key) => next[key] === state[key]
  );
  if (unchanged) return;

  state = next;
  listeners.forEach((listener) => listener(state));
}

export function subscribeToSyncState(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

/** Recomputes queue counters from storage and publishes them. */
export async function refreshQueueCounters(): Promise<void> {
  const [queue, failed, lastSyncAt] = await Promise.all([
    readQueue(),
    readFailed(),
    readLastSync(),
  ]);

  setSyncState({
    pendingCount: queue.length,
    failedCount: failed.length,
    lastSyncAt,
  });
}
