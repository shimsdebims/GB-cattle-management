import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

import { API_BASE_URL, ApiError, cattleAPI, feedingAPI, financialAPI, milkAPI } from './api';
import {
  EntityName,
  MilkConflict,
  PendingOperation,
  enqueue,
  getSyncState,
  isTempId,
  newClientId,
  newTempId,
  readCache,
  readConflicts,
  readFailed,
  readIdMap,
  readQueue,
  recordIdMapping,
  refreshQueueCounters,
  resolveId,
  setSyncState,
  writeCache,
  writeConflicts,
  writeFailed,
  writeLastSync,
  writeQueue,
} from './offlineStore';
import type {
  Cattle,
  CattleFormData,
  Expense,
  ExpenseFormData,
  Feeding,
  FeedingFormData,
  MilkFormData,
  MilkProduction,
  Revenue,
  RevenueFormData,
} from '../types';

/**
 * Offline-first data layer.
 *
 * Writes apply to the local cache immediately and enqueue a durable operation.
 * On reconnect the queue is replayed in order, mapping temporary ids to the
 * ids the server assigns so that later edits and related records still line up.
 */

/** Give up after this many transient failures and surface the op for review. */
const MAX_ATTEMPTS = 5;

/**
 * Minimum shape the cache helpers need. Deliberately not an index signature —
 * that would exclude the concrete record interfaces, which do not have one.
 */
interface LocalRecord {
  _id: string;
}

// ─── Cache helpers ───────────────────────────────────────────────────────────

async function upsertLocal<T extends LocalRecord>(
  entity: EntityName,
  record: T
): Promise<void> {
  const items = await readCache<T>(entity);
  const index = items.findIndex((item) => item._id === record._id);

  if (index === -1) items.unshift(record);
  else items[index] = record;

  await writeCache(entity, items);
}

async function patchLocal<T extends LocalRecord>(
  entity: EntityName,
  id: string,
  patch: Partial<T>
): Promise<T | null> {
  const items = await readCache<T>(entity);
  const index = items.findIndex((item) => item._id === id);
  if (index === -1) return null;

  const updated = {
    ...items[index],
    ...patch,
    updated_at: new Date().toISOString(),
  } as T;

  items[index] = updated;
  await writeCache(entity, items);
  return updated;
}

async function removeLocal(entity: EntityName, id: string): Promise<void> {
  const items = await readCache<LocalRecord>(entity);
  await writeCache(
    entity,
    items.filter((item) => item._id !== id)
  );
}

/** Swaps a temporary record for the server's version, preserving list order. */
async function replaceLocalId<T extends LocalRecord>(
  entity: EntityName,
  tempId: string,
  serverRecord: T
): Promise<void> {
  const items = await readCache<T>(entity);
  const index = items.findIndex((item) => item._id === tempId);

  if (index === -1) items.unshift(serverRecord);
  else items[index] = serverRecord;

  await writeCache(entity, items);
}

const nowIso = () => new Date().toISOString();

// ─── Connectivity ────────────────────────────────────────────────────────────

let listenerAttached = false;

/** While changes wait on the phone, try to send them this often. */
const RETRY_INTERVAL_MS = 30 * 1000;

/**
 * Starts connectivity tracking and keeps the queue moving.
 *
 * Sends queued changes at start-up, on every offline → online edge, whenever
 * the app comes back to the foreground, and every 30 s while any are waiting:
 * a send that fails half-way (lost reply, server waking up) is retried without
 * waiting for the connection to drop and return, which may never happen.
 */
export function initOfflineSync(): () => void {
  if (listenerAttached) return () => undefined;
  listenerAttached = true;

  // "Online" means the farm's server answers, not merely that some network is
  // up: the default probe (a Google URL) says nothing about our server.
  NetInfo.configure({
    reachabilityUrl: `${API_BASE_URL}/health`,
    reachabilityTest: async (response) => response.status === 200,
    reachabilityShortTimeout: 5 * 1000,
    reachabilityLongTimeout: 60 * 1000,
    reachabilityRequestTimeout: 15 * 1000,
  });

  void refreshQueueCounters().then(() => synchronize());

  const unsubscribe = NetInfo.addEventListener((netState) => {
    const isOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false);
    const wasOnline = getSyncState().isOnline;

    setSyncState({ isOnline });

    // Only trigger on the offline → online edge.
    if (isOnline && !wasOnline) void synchronize();
  });

  const retry = setInterval(() => {
    if (getSyncState().pendingCount > 0) void synchronize();
  }, RETRY_INTERVAL_MS);

  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') void synchronize();
  });

  return () => {
    listenerAttached = false;
    unsubscribe();
    clearInterval(retry);
    appState.remove();
  };
}

const isOnline = () => getSyncState().isOnline;

// ─── Queue execution ─────────────────────────────────────────────────────────

/**
 * A 4xx (other than 409 conflict, handled separately) means the payload will
 * never be accepted; retrying forever would block everything behind it.
 */
function isPermanentFailure(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.isNetworkError) return false;
  // 401 = logged out, not a bad payload: keep it queued until the next login.
  if (error.status === 401) return false;
  return error.status >= 400 && error.status < 500 && error.status !== 429;
}

const isLoggedOut = (error: unknown) => error instanceof ApiError && error.status === 401;

/** Rewrites any temp ids in an operation using the mapping learned so far. */
function resolveOperation(
  operation: PendingOperation,
  idMap: Record<string, string>
): PendingOperation {
  const payload = { ...operation.payload };

  // Milk and feeding reference a cow that may itself have been created offline.
  if (typeof payload.cattle_id === 'string') {
    payload.cattle_id = resolveId(payload.cattle_id, idMap);
  }

  return {
    ...operation,
    recordId: resolveId(operation.recordId, idMap),
    payload,
  };
}

type Executor = (op: PendingOperation) => Promise<{ _id: string } | void>;

const EXECUTORS: Record<EntityName, Record<string, Executor>> = {
  cattle: {
    CREATE: (op) => cattleAPI.create(op.payload as unknown as CattleFormData),
    UPDATE: (op) => cattleAPI.update(op.recordId, op.payload as Partial<CattleFormData>),
    DELETE: (op) => cattleAPI.remove(op.recordId),
  },
  milk: {
    CREATE: (op) => milkAPI.create(op.payload as unknown as MilkFormData),
    UPDATE: (op) => milkAPI.update(op.recordId, op.payload as Partial<MilkFormData>),
    DELETE: (op) => milkAPI.remove(op.recordId),
  },
  feeding: {
    CREATE: (op) => feedingAPI.create(op.payload as unknown as FeedingFormData),
    UPDATE: (op) => feedingAPI.update(op.recordId, op.payload as Partial<FeedingFormData>),
    DELETE: (op) => feedingAPI.remove(op.recordId),
  },
  expense: {
    CREATE: (op) => financialAPI.createExpense(op.payload as unknown as ExpenseFormData),
    UPDATE: (op) =>
      financialAPI.updateExpense(op.recordId, op.payload as Partial<ExpenseFormData>),
    DELETE: (op) => financialAPI.removeExpense(op.recordId),
  },
  revenue: {
    CREATE: (op) => financialAPI.createRevenue(op.payload as unknown as RevenueFormData),
    UPDATE: (op) =>
      financialAPI.updateRevenue(op.recordId, op.payload as Partial<RevenueFormData>),
    DELETE: (op) => financialAPI.removeRevenue(op.recordId),
  },
};

/**
 * Replays queued operations in order.
 *
 * Ordering matters: a cow must exist before its milk records, and a create must
 * land before the edit that follows it. A permanently rejected operation is
 * moved aside rather than left to block the queue.
 */
export async function synchronize(): Promise<void> {
  if (!isOnline() || getSyncState().isSyncing) return;

  const queue = await readQueue();
  if (queue.length === 0) {
    await writeLastSync(Date.now());
    await refreshQueueCounters();
    return;
  }

  setSyncState({ isSyncing: true });

  const idMap = await readIdMap();
  const remaining: PendingOperation[] = [];
  const failed = await readFailed();
  // Ops folded into a milk conflict (later edits of a clashing offline entry).
  const absorbed = new Set<string>();
  // Latest server version per record, learned during this run, so a second
  // queued edit of the same record is not mistaken for someone else's change.
  const latestVersion: Record<string, string> = {};

  for (const original of queue) {
    if (absorbed.has(original.id)) continue;
    const operation = resolveOperation(original, idMap);

    if (operation.entity === 'milk' && operation.type === 'UPDATE') {
      if (isTempId(original.recordId)) {
        // Edits of a record this phone created: no server version to compare.
        delete operation.payload.expected_updated_at;
      } else if (latestVersion[operation.recordId] && operation.payload.expected_updated_at) {
        operation.payload.expected_updated_at = latestVersion[operation.recordId];
      }
    }

    // A create that never synced cannot be updated or deleted server-side yet.
    if (operation.type !== 'CREATE' && isTempId(operation.recordId)) {
      remaining.push(original);
      continue;
    }

    try {
      const result = await EXECUTORS[operation.entity][operation.type](operation);

      // Learn the server id so later operations and the cache can be corrected.
      if (operation.type === 'CREATE' && result && isTempId(original.recordId)) {
        idMap[original.recordId] = result._id;
        await recordIdMapping(original.recordId, result._id);
        await replaceLocalId(operation.entity, original.recordId, result as LocalRecord);
      }
      if (result && 'updated_at' in result && typeof result.updated_at === 'string') {
        latestVersion[result._id] = result.updated_at;
        if (operation.type === 'UPDATE') await upsertLocal(operation.entity, result as LocalRecord);
      }
    } catch (error) {
      // Session ended: stop here and keep this and everything after it, with
      // no attempt counted. The queue resumes after the next login.
      if (isLoggedOut(error)) {
        const index = queue.indexOf(original);
        remaining.push(...queue.slice(index));
        break;
      }

      // Same cow, same day, different figures: never drop either one. Park it
      // for him to decide, with any later offline edits of the same entry.
      if (operation.entity === 'milk' && isMilkClash(error)) {
        const laterOps = queue.slice(queue.indexOf(original) + 1);
        const sameEntry = isTempId(original.recordId)
          ? laterOps.filter((op) => op.entity === 'milk' && op.recordId === original.recordId)
          : [];
        sameEntry.forEach((op) => absorbed.add(op.id));

        // Deleted again on this phone before syncing: nothing left to keep.
        if (!sameEntry.some((op) => op.type === 'DELETE')) {
          const mine = sameEntry.reduce(
            (acc, op) => ({ ...acc, ...op.payload }),
            operation.payload
          );
          await addMilkConflict(mine, (error as ApiError).data as MilkConflict['server']);
        }
        if (isTempId(original.recordId)) await removeLocal('milk', original.recordId);
        continue;
      }

      const attempts = original.attempts + 1;
      const lastError =
        error instanceof ApiError ? error.displayMessage : String(error);

      if (isPermanentFailure(error) || attempts >= MAX_ATTEMPTS) {
        failed.push({ ...original, attempts, lastError });
      } else {
        remaining.push({ ...original, attempts, lastError });
        // Network is down again — stop and keep the rest of the queue intact.
        if (error instanceof ApiError && error.isNetworkError) {
          const index = queue.indexOf(original);
          remaining.push(...queue.slice(index + 1));
          break;
        }
      }
    }
  }

  await writeQueue(remaining);
  await writeFailed(failed);
  await writeLastSync(Date.now());

  setSyncState({ isSyncing: false });
  await refreshQueueCounters();
}

/** Clears operations the server permanently rejected. */
export async function discardFailedOperations(): Promise<void> {
  await writeFailed([]);
  await refreshQueueCounters();
}

export const getFailedOperations = readFailed;

// ─── Generic read-through ────────────────────────────────────────────────────

async function readThrough<T extends LocalRecord>(
  entity: EntityName,
  fetcher: () => Promise<{ items: T[] }>
): Promise<T[]> {
  if (!isOnline()) return readCache<T>(entity);

  try {
    const { items } = await fetcher();
    await writeCache(entity, items);
    return items;
  } catch (error) {
    // Serve the cache rather than an empty screen.
    console.warn(`offlineApi: falling back to cached ${entity}`, error);
    return readCache<T>(entity);
  }
}

// ─── Generic write-through ───────────────────────────────────────────────────

async function createRecord<TRecord extends LocalRecord, TForm extends { client_id?: string }>(
  entity: EntityName,
  rawForm: TForm,
  rawOptimistic: TRecord,
  remote: (data: TForm) => Promise<TRecord>
): Promise<TRecord> {
  // The same id goes with the first attempt and every retry from the queue.
  const form = { ...rawForm, client_id: rawForm.client_id ?? newClientId() };
  const optimistic = { ...rawOptimistic, client_id: form.client_id };
  await upsertLocal(entity, optimistic);

  if (isOnline()) {
    try {
      const saved = await remote(form);
      await replaceLocalId(entity, optimistic._id, saved);
      return saved;
    } catch (error) {
      // A rejected payload should surface now, not silently queue forever.
      if (isPermanentFailure(error)) {
        await removeLocal(entity, optimistic._id);
        throw error;
      }
    }
  }

  await enqueue({
    entity,
    type: 'CREATE',
    recordId: optimistic._id,
    payload: form as unknown as Record<string, unknown>,
  });
  await refreshQueueCounters();

  return optimistic;
}

async function updateRecord<TRecord extends LocalRecord, TForm>(
  entity: EntityName,
  id: string,
  patch: Partial<TForm>,
  remote: (id: string, data: Partial<TForm>) => Promise<TRecord>
): Promise<TRecord> {
  const local = await patchLocal<TRecord>(entity, id, patch as Partial<TRecord>);

  if (isOnline() && !isTempId(id)) {
    try {
      const saved = await remote(id, patch);
      await upsertLocal(entity, saved);
      return saved;
    } catch (error) {
      if (isPermanentFailure(error)) throw error;
    }
  }

  await enqueue({
    entity,
    type: 'UPDATE',
    recordId: id,
    payload: patch as Record<string, unknown>,
  });
  await refreshQueueCounters();

  // Never return undefined: fall back to a minimal shape if the record was not
  // cached, which the previous implementation did not guard against.
  return (local ?? ({ _id: id, ...patch } as unknown as TRecord));
}

async function deleteRecord(
  entity: EntityName,
  id: string,
  remote: (id: string) => Promise<unknown>
): Promise<void> {
  await removeLocal(entity, id);

  // A record that only ever existed locally: drop its pending create instead of
  // asking the server to delete something it has never seen.
  if (isTempId(id)) {
    const queue = await readQueue();
    await writeQueue(queue.filter((op) => op.recordId !== id));
    await refreshQueueCounters();
    return;
  }

  if (isOnline()) {
    try {
      await remote(id);
      return;
    } catch (error) {
      // Already gone server-side is a success from the user's perspective.
      if (error instanceof ApiError && error.status === 404) return;
      if (isPermanentFailure(error)) throw error;
    }
  }

  await enqueue({ entity, type: 'DELETE', recordId: id, payload: {} });
  await refreshQueueCounters();
}

// ─── Milk: day entry and conflicts ───────────────────────────────────────────

type MilkValues = Pick<MilkFormData, 'quantity_liters' | 'morning_liters' | 'evening_liters'>;

/** A 409 that carries the server's record for the same cow and day. */
function isMilkClash(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    (error.code === 'MILK_DAY_EXISTS' || error.code === 'MILK_CHANGED') &&
    Boolean(error.data)
  );
}

const pickValues = (source: Record<string, unknown>): MilkValues => ({
  quantity_liters: source.quantity_liters as number | null | undefined,
  morning_liters: source.morning_liters as number | null | undefined,
  evening_liters: source.evening_liters as number | null | undefined,
});

/** Parks a clash for him to resolve and shows the server's figures meanwhile. */
async function addMilkConflict(
  mineSource: Record<string, unknown>,
  server: MilkConflict['server']
): Promise<void> {
  const conflicts = await readConflicts();
  const cattleId = typeof server.cattle_id === 'string' ? server.cattle_id : server.cattle_id._id;
  // An edit's payload has no date; the server's record always does.
  const day = String(mineSource.date_recorded ?? server.date_recorded).slice(0, 10);

  // A newer clash for the same cow and day replaces the older one.
  const others = conflicts.filter(
    (c) => !(c.cattle_id === cattleId && c.date_recorded === day)
  );
  others.push({
    id: newTempId(),
    cattle_id: cattleId,
    date_recorded: day,
    mine: pickValues(mineSource),
    server,
    createdAt: Date.now(),
  });
  await writeConflicts(others);
  await upsertLocal('milk', server as unknown as LocalRecord);
  await refreshQueueCounters();
}

/** Total of one side of a conflict: the split when there is one. */
export function milkTotal(values: MilkValues): number {
  if (values.morning_liters != null || values.evening_liters != null) {
    return (values.morning_liters ?? 0) + (values.evening_liters ?? 0);
  }
  return values.quantity_liters ?? 0;
}

const hasSplit = (v: MilkValues) => v.morning_liters != null || v.evening_liters != null;

export type ConflictChoice = 'server' | 'mine' | 'sum';

/**
 * Resolves a clash: keep the server's figures, replace them with this phone's,
 * or add the two (two people each recorded part of the day's milk).
 */
export async function resolveMilkConflict(id: string, choice: ConflictChoice): Promise<void> {
  const conflicts = await readConflicts();
  const conflict = conflicts.find((c) => c.id === id);
  if (!conflict) return;

  await writeConflicts(conflicts.filter((c) => c.id !== id));
  await refreshQueueCounters();
  if (choice === 'server') return;

  const { mine, server } = conflict;
  let values: MilkValues;
  if (choice === 'mine') {
    values = hasSplit(mine)
      ? { morning_liters: mine.morning_liters ?? null, evening_liters: mine.evening_liters ?? null }
      : { quantity_liters: mine.quantity_liters, morning_liters: null, evening_liters: null };
  } else if (hasSplit(mine) && hasSplit(server)) {
    values = {
      morning_liters: (mine.morning_liters ?? 0) + (server.morning_liters ?? 0),
      evening_liters: (mine.evening_liters ?? 0) + (server.evening_liters ?? 0),
    };
  } else {
    values = {
      quantity_liters: milkTotal(mine) + milkTotal(server),
      morning_liters: null,
      evening_liters: null,
    };
  }

  const outcome = await saveMilkEntry({
    cattle_id: conflict.cattle_id,
    date_recorded: conflict.date_recorded,
    existing: server as unknown as MilkProduction,
    values,
  });
  if (outcome.status === 'error') throw new Error(outcome.message);
}

export const getMilkConflicts = readConflicts;

export type MilkSaveOutcome =
  | { status: 'saved' }
  | { status: 'queued' }
  | { status: 'conflict' }
  | { status: 'error'; message: string };

/**
 * Saves one cow's milk for one day: an edit of the existing record when there
 * is one, else a new record. Clashes become conflicts, never lost entries.
 */
export async function saveMilkEntry({
  cattle_id,
  date_recorded,
  existing,
  values,
}: {
  cattle_id: string;
  date_recorded: string;
  existing?: MilkProduction;
  values: MilkValues;
}): Promise<MilkSaveOutcome> {
  const queuedBefore = (await readQueue()).length;
  // Always carry the day total: the server ignores it when a split is given,
  // but the phone's own copy needs it while the change waits offline.
  values = { ...values, quantity_liters: milkTotal(values) };
  try {
    if (existing) {
      await offlineApi.updateMilk(existing._id, {
        ...values,
        // Lets the server spot an edit made on another phone in the meantime.
        ...(isTempId(existing._id) ? {} : { expected_updated_at: existing.updated_at }),
      });
    } else {
      await offlineApi.createMilk({
        cattle_id,
        date_recorded,
        ...values,
      });
    }
  } catch (error) {
    if (isMilkClash(error)) {
      await addMilkConflict(
        { cattle_id, date_recorded, ...values },
        (error as ApiError).data as MilkConflict['server']
      );
      return { status: 'conflict' };
    }
    return {
      status: 'error',
      message: error instanceof ApiError ? error.displayMessage : 'Could not save.',
    };
  }
  const queued = (await readQueue()).length > queuedBefore;
  return { status: queued ? 'queued' : 'saved' };
}

const sameDay = (record: MilkProduction, date: string) =>
  String(record.date_recorded).slice(0, 10) === date;

/**
 * Every milk record for one day: from the server when online (any date, not
 * only the recent ones in the cache), plus entries still waiting to sync.
 */
export async function getMilkForDay(date: string): Promise<MilkProduction[]> {
  const cached = await readCache<MilkProduction>('milk');
  const unsynced = cached.filter((r) => isTempId(r._id) && sameDay(r, date));

  if (!isOnline()) return cached.filter((r) => sameDay(r, date));

  try {
    const { items } = await milkAPI.list({ date_from: date, date_to: date, limit: 200 });
    for (const item of items) await upsertLocal('milk', item);
    return [...items, ...unsynced];
  } catch (error) {
    console.warn('offlineApi: falling back to cached milk for the day', error);
    return cached.filter((r) => sameDay(r, date));
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const offlineApi = {
  // Cattle
  getCattle: () => readThrough<Cattle>('cattle', () => cattleAPI.list({ limit: 200 })),

  createCattle: (form: CattleFormData) =>
    createRecord<Cattle, CattleFormData>(
      'cattle',
      form,
      {
        _id: newTempId(),
        ...form,
        created_at: nowIso(),
        updated_at: nowIso(),
      } as Cattle,
      cattleAPI.create
    ),

  updateCattle: (id: string, patch: Partial<CattleFormData>) =>
    updateRecord<Cattle, CattleFormData>('cattle', id, patch, cattleAPI.update),

  deleteCattle: (id: string) => deleteRecord('cattle', id, cattleAPI.remove),

  // Milk
  getMilk: () => readThrough<MilkProduction>('milk', () => milkAPI.list({ limit: 200 })),

  createMilk: (form: MilkFormData) =>
    createRecord<MilkProduction, MilkFormData>(
      'milk',
      form,
      {
        _id: newTempId(),
        ...form,
        created_at: nowIso(),
        updated_at: nowIso(),
      } as MilkProduction,
      milkAPI.create
    ),

  updateMilk: (id: string, patch: Partial<MilkFormData>) =>
    updateRecord<MilkProduction, MilkFormData>('milk', id, patch, milkAPI.update),

  deleteMilk: (id: string) => deleteRecord('milk', id, milkAPI.remove),

  // Feeding
  getFeeding: () => readThrough<Feeding>('feeding', () => feedingAPI.list({ limit: 200 })),

  createFeeding: (form: FeedingFormData) =>
    createRecord<Feeding, FeedingFormData>(
      'feeding',
      form,
      {
        _id: newTempId(),
        ...form,
        total_cost:
          form.cost_per_unit != null ? form.quantity_kg * form.cost_per_unit : undefined,
        created_at: nowIso(),
        updated_at: nowIso(),
      } as Feeding,
      feedingAPI.create
    ),

  updateFeeding: (id: string, patch: Partial<FeedingFormData>) =>
    updateRecord<Feeding, FeedingFormData>('feeding', id, patch, feedingAPI.update),

  deleteFeeding: (id: string) => deleteRecord('feeding', id, feedingAPI.remove),

  // Expenses
  getExpenses: () =>
    readThrough<Expense>('expense', () => financialAPI.listExpenses({ limit: 200 })),

  createExpense: (form: ExpenseFormData) =>
    createRecord<Expense, ExpenseFormData>(
      'expense',
      form,
      {
        _id: newTempId(),
        ...form,
        amount:
          form.amount ??
          (form.quantity != null && form.cost_per_unit != null
            ? form.quantity * form.cost_per_unit
            : 0),
        created_at: nowIso(),
        updated_at: nowIso(),
      } as Expense,
      financialAPI.createExpense
    ),

  updateExpense: (id: string, patch: Partial<ExpenseFormData>) =>
    updateRecord<Expense, ExpenseFormData>(
      'expense',
      id,
      patch,
      financialAPI.updateExpense
    ),

  deleteExpense: (id: string) => deleteRecord('expense', id, financialAPI.removeExpense),

  // Revenue
  getRevenue: () =>
    readThrough<Revenue>('revenue', () => financialAPI.listRevenue({ limit: 200 })),

  createRevenue: (form: RevenueFormData) =>
    createRecord<Revenue, RevenueFormData>(
      'revenue',
      form,
      {
        _id: newTempId(),
        ...form,
        created_at: nowIso(),
        updated_at: nowIso(),
      } as Revenue,
      financialAPI.createRevenue
    ),

  updateRevenue: (id: string, patch: Partial<RevenueFormData>) =>
    updateRecord<Revenue, RevenueFormData>(
      'revenue',
      id,
      patch,
      financialAPI.updateRevenue
    ),

  deleteRevenue: (id: string) => deleteRecord('revenue', id, financialAPI.removeRevenue),

  // Milk day entry
  getMilkForDay,
  saveMilkEntry,
  getMilkConflicts,
  resolveMilkConflict,

  // Sync
  synchronize,
  discardFailedOperations,
  getFailedOperations,
};

export default offlineApi;
