import NetInfo from '@react-native-community/netinfo';

import { ApiError, cattleAPI, feedingAPI, financialAPI, milkAPI } from './api';
import {
  EntityName,
  PendingOperation,
  enqueue,
  getSyncState,
  isTempId,
  newTempId,
  readCache,
  readFailed,
  readIdMap,
  readQueue,
  recordIdMapping,
  refreshQueueCounters,
  resolveId,
  setSyncState,
  writeCache,
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

/** Starts connectivity tracking and replays the queue when we come back online. */
export function initOfflineSync(): () => void {
  if (listenerAttached) return () => undefined;
  listenerAttached = true;

  void refreshQueueCounters();

  const unsubscribe = NetInfo.addEventListener((netState) => {
    const isOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false);
    const wasOnline = getSyncState().isOnline;

    setSyncState({ isOnline });

    // Only trigger on the offline → online edge.
    if (isOnline && !wasOnline) void synchronize();
  });

  return () => {
    listenerAttached = false;
    unsubscribe();
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
  return error.status >= 400 && error.status < 500 && error.status !== 429;
}

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

  for (const original of queue) {
    const operation = resolveOperation(original, idMap);

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
    } catch (error) {
      // The server already has this record (e.g. duplicate milk day): the
      // operation is satisfied, so drop it instead of retrying forever.
      if (error instanceof ApiError && error.status === 409) {
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

async function createRecord<TRecord extends LocalRecord, TForm>(
  entity: EntityName,
  form: TForm,
  optimistic: TRecord,
  remote: (data: TForm) => Promise<TRecord>
): Promise<TRecord> {
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

  // Sync
  synchronize,
  discardFailedOperations,
  getFailedOperations,
};

export default offlineApi;
