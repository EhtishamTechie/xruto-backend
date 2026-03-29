/**
 * File-based persistence for xRuto backend.
 * Stores all in-memory data to a local JSON file so it survives server restarts.
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');
const SAVE_DEBOUNCE_MS = 500;

let _saveTimer = null;

/**
 * Load all persisted data from disk.
 * Returns an object with keys: settings, depots, drivers, orders, routeOrders, orderStatuses
 * Missing keys get undefined (caller supplies defaults).
 */
function loadAll() {
  try {
    if (!fs.existsSync(DB_PATH)) return {};
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    if (!raw || raw.trim() === '') return {};
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[persistence] Failed to read db.json, starting fresh:', err.message);
    return {};
  }
}

/**
 * Save all data to disk (debounced so rapid mutations don't thrash I/O).
 * @param {object} data - { settings, depots, drivers, orders, routeOrders, orderStatuses }
 */
function saveAll(data) {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      // Convert Maps to plain objects for JSON serialization
      const serializable = {
        settings: data.settings || {},
        depots: data.depots || [],
        drivers: data.drivers || [],
        orders: data.orders || [],
        users: data.users || [],
        routeOrders: data.routeOrders instanceof Map
          ? Object.fromEntries(data.routeOrders)
          : (data.routeOrders || {}),
        orderStatuses: data.orderStatuses instanceof Map
          ? Object.fromEntries(data.orderStatuses)
          : (data.orderStatuses || {}),
        routeDrivers: data.routeDrivers instanceof Map
          ? Object.fromEntries(data.routeDrivers)
          : (data.routeDrivers || {})
      };
      fs.writeFileSync(DB_PATH, JSON.stringify(serializable, null, 2), 'utf-8');
    } catch (err) {
      console.error('[persistence] Failed to write db.json:', err.message);
    }
  }, SAVE_DEBOUNCE_MS);
}

module.exports = { loadAll, saveAll };
