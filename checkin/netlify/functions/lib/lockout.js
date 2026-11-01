/**
 * Wrong-PIN lockout: MAX_TRIES wrong PINs for one person locks them for LOCK_MIN minutes.
 *
 * On Netlify the counts live in Netlify Blobs (store "pin-lockout", one key per Contact Id), so they
 * survive across function instances. Without Blobs (local dev-server) they live in memory.
 */
const MAX_TRIES = 5;
const LOCK_MIN = 15;

let store = null;
const memory = new Map();

/** Call once per request with the Lambda event; picks Blobs when Netlify provides it. */
function connect(event) {
  if (store || !event.blobs) return;
  const { connectLambda, getStore } = require('@netlify/blobs');
  connectLambda(event);
  store = getStore('pin-lockout');
}

async function read(key) {
  if (store) return (await store.get(key, { type: 'json' })) || null;
  return memory.get(key) || null;
}

async function write(key, value) {
  if (store) return value ? store.setJSON(key, value) : store.delete(key);
  if (value) memory.set(key, value); else memory.delete(key);
}

/** The time the lock ends (ISO), or null if this person isn't locked. */
async function lockedUntil(contactId) {
  const entry = await read(contactId);
  return entry && entry.until && new Date(entry.until) > new Date() ? entry.until : null;
}

/** Count a wrong PIN; returns the lock end (ISO) if this one locked them. */
async function fail(contactId) {
  const entry = (await read(contactId)) || { tries: 0 };
  const tries = (entry.until ? 0 : entry.tries) + 1;
  if (tries >= MAX_TRIES) {
    const until = new Date(Date.now() + LOCK_MIN * 60000).toISOString();
    await write(contactId, { tries: 0, until });
    return until;
  }
  await write(contactId, { tries });
  return null;
}

async function clear(contactId) {
  await write(contactId, null);
}

module.exports = { connect, lockedUntil, fail, clear, MAX_TRIES, LOCK_MIN };
