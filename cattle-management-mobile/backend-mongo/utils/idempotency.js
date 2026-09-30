/**
 * Safe retries for creates.
 *
 * The app puts a unique `client_id` on every new record. On a patchy
 * connection a save can reach the server while the reply is lost; the app then
 * retries with the same id, and the server returns the record it already made
 * instead of creating a second one.
 */

/** A usable client id, or undefined. Null is never stored: the sparse unique
 * index still indexes null, so two id-less records would collide. */
function cleanClientId(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/**
 * Runs `create` unless a record with this client id already exists.
 * @returns {{ record: import('mongoose').Document, replayed: boolean }}
 */
async function createOnce(Model, clientId, create) {
  if (clientId) {
    const existing = await Model.findOne({ client_id: clientId });
    if (existing) return { record: existing, replayed: true };
  }

  try {
    return { record: await create(), replayed: false };
  } catch (error) {
    // Two copies of the same retry arrived together: the loser returns the winner.
    if (clientId && error.code === 11000 && error.keyPattern?.client_id) {
      const existing = await Model.findOne({ client_id: clientId });
      if (existing) return { record: existing, replayed: true };
    }
    throw error;
  }
}

module.exports = { cleanClientId, createOnce };
