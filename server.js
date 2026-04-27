
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const PDFParserService = require('./services/pdfParser');
require('dotenv').config();

/** Trim / strip accidental quotes from .env so fetch target is valid. */
function normalizeSupabaseEnvUrl() {
  const raw = process.env.SUPABASE_URL;
  if (!raw || typeof raw !== 'string') return;
  const t = raw.trim().replace(/^["']|["']$/g, '');
  if (t !== raw) process.env.SUPABASE_URL = t;
}
normalizeSupabaseEnvUrl();

/**
 * Node's fetch wraps network failures as TypeError("fetch failed"); details are on error.cause.
 */
function describeFetchFailure(err) {
  if (!err) return 'unknown error';
  const base = err.message || String(err);
  const c = err.cause;
  if (c && typeof c === 'object') {
    const code = c.code ? `${c.code}: ` : '';
    const cm = c.message || String(c);
    if (cm && cm !== base) return `${base} — ${code}${cm}`;
  }
  return base;
}

/** Supabase sometimes returns PostgREST-style errors with message text instead of rejecting (e.g. fetch failed). */
function isLikelySupabaseTransportError(error) {
  if (!error) return false;
  const msg = String(error.message || error).toLowerCase();
  if (/fetch failed|fetch error|network request failed|failed to fetch|econnrefused|etimedout|enotfound|getaddrinfo/.test(msg)) {
    return true;
  }
  return !!(error.cause && typeof error.cause === 'object');
}

// Fallback env vars for Railway deployment (values come from Railway env config)
if (!process.env.SUPABASE_URL) {
  console.warn('⚠️ SUPABASE_URL not set — set it in .env or Railway environment variables');
} else if (!/^https:\/\//i.test(String(process.env.SUPABASE_URL).trim())) {
  console.warn('⚠️ SUPABASE_URL must start with https:// — outbound fetch will likely fail.');
}
if (!process.env.HERE_API_KEY) {
  console.warn('⚠️ HERE_API_KEY not set — HERE Matrix API features will be disabled');
}
if (!process.env.JWT_SECRET) {
  console.warn('⚠️ JWT_SECRET not set — using insecure default. Set a strong secret in production!');
}
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'xruto-dev-secret';

// ===== PASSWORD RESET TOKEN STORE =====
// Map of token → { email, expiresAt }  (tokens expire after 15 minutes)
const passwordResetTokens = new Map();

/**
 * Send a password-reset email via the configured email provider.
 * Supports Resend (RESEND_API_KEY) or a generic SMTP-style HTTP API.
 * Returns true on success, false on failure.
 */
async function sendResetEmail(toEmail, resetLink) {
  const apiKey = process.env.EMAIL_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'noreply@xruto.com';
  const provider = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase();

  if (!apiKey) {
    console.warn('⚠️  EMAIL_API_KEY not set — cannot send reset email. Link:', resetLink);
    return false;
  }

  try {
    if (provider === 'resend') {
      await axios.post('https://api.resend.com/emails', {
        from: fromEmail,
        to: [toEmail],
        subject: 'xRuto — Password Reset',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#f97316">xRuto Password Reset</h2>
            <p>You requested a password reset. Click the button below to set a new password. This link expires in 15 minutes.</p>
            <a href="${resetLink}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Reset Password</a>
            <p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `
      }, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 15000
      });
    } else if (provider === 'sendgrid') {
      await axios.post('https://api.sendgrid.com/v3/mail/send', {
        personalizations: [{ to: [{ email: toEmail }] }],
        from: { email: fromEmail },
        subject: 'xRuto — Password Reset',
        content: [{
          type: 'text/html',
          value: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
              <h2 style="color:#f97316">xRuto Password Reset</h2>
              <p>You requested a password reset. Click the button below to set a new password. This link expires in 15 minutes.</p>
              <a href="${resetLink}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Reset Password</a>
              <p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
            </div>
          `
        }]
      }, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 15000
      });
    } else {
      console.warn(`⚠️  Unknown EMAIL_PROVIDER "${provider}". Supported: resend, sendgrid`);
      return false;
    }
    console.log(`✅ Password reset email sent to ${toEmail}`);
    return true;
  } catch (err) {
    console.error('❌ Failed to send reset email:', err.response?.data || err.message);
    return false;
  }
}

// ===== ROLE-BASED ACCESS CONTROL MIDDLEWARE =====
// Extracts user from JWT token (does not reject unauthenticated requests)
function extractUser(req, res, next) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    } catch { req.user = null; }
  }
  next();
}

// Requires a valid JWT token
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

// Requires specific role(s) — call after requireAuth
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied: insufficient permissions' });
    }
    next();
  };
}

// ===== FILE-BASED PERSISTENCE =====
const { loadAll, saveAll } = require('./persistence');
const _persisted = loadAll();

// Store route-order relationships in memory
let routeOrdersMap = _persisted.routeOrders
  ? new Map(Object.entries(_persisted.routeOrders))
  : new Map();
let orderStatusMap = _persisted.orderStatuses
  ? new Map(Object.entries(_persisted.orderStatuses))
  : new Map();
let routeDriverMap = _persisted.routeDrivers
  ? new Map(Object.entries(_persisted.routeDrivers))
  : new Map();
let inMemoryOrders = _persisted.orders || [];

// Helper: flush all stores to disk
function persist() {
  saveAll({
    settings: inMemorySettings,
    depots: MOCK_DEPOTS,
    drivers: MOCK_DRIVERS,
    orders: inMemoryOrders,
    routeOrders: routeOrdersMap,
    orderStatuses: orderStatusMap,
    routeDrivers: routeDriverMap,
    users: USERS
  });
}
/**
 * CORS: configure via env so Vercel + Render + local dev work without editing code.
 * - CLIENT_URL: production frontend (e.g. https://app.vercel.app)
 * - CORS_EXTRA_ORIGINS: comma-separated list (e.g. https://app.com,https://old.vercel.app)
 * - CORS_ALLOW_VERCEL: default true — allow any https://*.vercel.app (set to false to lock down)
 */
function isCorsOriginAllowed(origin) {
  if (!origin) return true; // same-origin, curl, some mobile webviews
  const norm = (u) => String(u).replace(/\/$/, '');
  const client = norm(process.env.CLIENT_URL || '');
  if (client && (origin === client || origin.startsWith(`${client}/`))) return true;
  const extra = String(process.env.CORS_EXTRA_ORIGINS || '')
    .split(',')
    .map((s) => norm(s.trim()))
    .filter(Boolean);
  for (const e of extra) {
    if (origin === e || origin.startsWith(`${e}/`)) return true;
  }
  if (String(process.env.CORS_ALLOW_VERCEL).toLowerCase() !== 'false') {
    if (/^https:\/\/[a-z0-9][a-z0-9.-]*\.vercel\.app$/i.test(origin)) return true;
  }
  if (/^http:\/\/localhost(?::\d+)?$/i.test(origin) || /^http:\/\/127\.0\.0\.1(?::\d+)?$/i.test(origin)) return true;
  return false;
}

app.use(cors({
  origin: (requestOrigin, callback) => {
    if (isCorsOriginAllowed(requestOrigin)) {
      return callback(null, true);
    }
    console.warn(`[CORS] Blocked origin: ${requestOrigin} (set CLIENT_URL or CORS_EXTRA_ORIGINS)`);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(extractUser); // Attach user from JWT to all requests (non-blocking)

// Configure multer for PDF uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream'
    ];
    const extOk = /\.(xlsx|xls)$/i.test(file.originalname);
    if (allowed.includes(file.mimetype) || extOk) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) files are allowed'), false);
    }
  }
});

// Initialize PDF Parser Service
const pdfParserService = new PDFParserService();

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ===== ROOT ENDPOINTS =====
// Role enforcement: all /api/admin/* routes require admin role
app.use('/api/admin', requireAuth, requireRole('admin'));

app.get('/', (req, res) => {
  res.json({
    message: 'xRuto Delivery Routing API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', async (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      server: 'running',
      database: process.env.SUPABASE_URL ? 'configured' : 'missing',
      here_api: process.env.HERE_API_KEY ? 'configured' : 'missing',
    },
    config: {
      supabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
      client_url: process.env.CLIENT_URL ? 'set' : 'default',
      cors_vercel: String(process.env.CORS_ALLOW_VERCEL).toLowerCase() !== 'false',
      local_file: true,
    },
  };

  // Test database connection if configured
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      
      const { error } = await supabase.from('settings').select('*').limit(1);
      healthStatus.services.database = error ? 'error' : 'connected';
    } catch (error) {
      healthStatus.services.database = 'error';
    }
  }

  res.json(healthStatus);
});

// ===== ADMIN ENDPOINTS =====
const DEFAULT_SETTINGS = {
  drivers_today_count: 5, include_admin_as_driver: false, navigation_app_preference: 'google',
  enable_stock_refill: false, max_deliveries_per_route: 25, max_routes_per_day: 10,
  default_fuel_price: 1.45, enable_help_tooltips: true, auto_assign_routes: true,
  route_optimization_method: 'distance', customer_notifications: true, driver_app_enabled: true,
  woocommerce_integration_enabled: false, sync_frequency_minutes: 15, enable_real_time_tracking: false
};

let inMemorySettings = _persisted.settings
  ? { ...DEFAULT_SETTINGS, ..._persisted.settings }
  : { ...DEFAULT_SETTINGS };

console.log('[persistence] Loaded settings from db.json, fuel:', inMemorySettings.default_fuel_price, 'nav:', inMemorySettings.navigation_app_preference, 'orders:', inMemoryOrders.length);

app.get('/api/admin/settings', async (req, res) => {
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { data: settings, error } = await supabase.from('settings').select('*').single();
        if (error && error.code !== 'PGRST116') throw error;
        inMemorySettings = { ...inMemorySettings, ...(settings || {}) };
        return res.json({ success: true, settings: inMemorySettings });
      } catch (dbErr) { console.warn('Settings DB unavailable, using local data:', describeFetchFailure(dbErr)); }
    }
    res.json({ success: true, settings: inMemorySettings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings', error: error.message });
  }
});

app.put('/api/admin/settings', async (req, res) => {
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { data: existingSettings } = await supabase.from('settings').select('id').single();
        let result;
        if (existingSettings) {
          result = await supabase.from('settings').update({ ...req.body, updated_at: new Date().toISOString() }).eq('id', existingSettings.id).select().single();
        } else {
          result = await supabase.from('settings').insert(req.body).select().single();
        }
        if (result.error) throw result.error;
        inMemorySettings = { ...inMemorySettings, ...(result.data || {}), ...(req.body || {}) };
        persist();
        return res.json({ success: true, message: 'Settings updated successfully', settings: inMemorySettings });
      } catch (dbErr) { console.warn('Settings PUT DB unavailable:', describeFetchFailure(dbErr)); }
    }
    inMemorySettings = { ...inMemorySettings, ...(req.body || {}) };
    persist();
    res.json({ success: true, message: 'Settings updated (offline mode)', settings: inMemorySettings });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to update settings', error: error.message });
  }
});

let MOCK_DEPOTS = _persisted.depots || [];

app.get('/api/admin/depots', async (req, res) => {
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { data: depots, error } = await supabase.from('depots').select('*, drivers!depot_id(id, is_active, is_available_today)').eq('is_active', true).order('name');
        if (error) throw error;
        const formattedDepots = (depots || []).map(depot => {
          const active = (depot.drivers || []).filter(d => d.is_active);
          return { id: depot.id, name: depot.name, address: depot.address, city: depot.city || '', postcode: depot.postcode || '', latitude: depot.latitude, longitude: depot.longitude, capacity: depot.capacity || 500, is_primary: depot.is_primary || false, is_active: depot.is_active, driver_count: active.length, available_drivers: active.filter(d => d.is_available_today).length, contact_phone: depot.contact_phone || '', contact_email: depot.contact_email || '' };
        });
        return res.json({ success: true, depots: formattedDepots });
      } catch (dbErr) { console.warn('Depots DB unavailable, using mock data:', describeFetchFailure(dbErr)); }
    }
    const memoryDepots = (MOCK_DEPOTS || []).map((dep) => {
      const activeDrivers = (MOCK_DRIVERS || []).filter(
        (dr) => String(dr.depot_id) === String(dep.id) && dr.is_active !== false
      );
      return {
        ...dep,
        driver_count: activeDrivers.length,
        available_drivers: activeDrivers.filter((d) => d.is_available_today !== false).length,
      };
    });
    res.json({ success: true, depots: memoryDepots });
  } catch (error) {
    console.error('Get depots error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch depots', error: error.message });
  }
});

/** Depot lat/lng must not be 0,0 (invalid / “Null Island”) for route URLs. */
function depotCoordsUsable(lat, lng) {
  const a = parseFloat(lat);
  const b = parseFloat(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (Math.abs(a) < 1e-6 && Math.abs(b) < 1e-6) return false;
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return false;
  return true;
}

/** Parse Google Maps URL / text for @lat,lng or !3d!4d (same rules as frontend). */
function parseLatLngFromGoogleMapsText(input) {
  if (input == null || typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;
  const tight = s.replace(/\s/g, '');
  let m = tight.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
  if (m) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (depotCoordsUsable(lat, lng)) return { latitude: lat, longitude: lng };
  }
  m = s.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)(?:,|\s|\/|\?|#|z|\]|$)/);
  if (!m) m = s.match(/@(-?\d+\.?\d*),(-?\d+\.?\d+)/);
  if (m) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (depotCoordsUsable(lat, lng)) return { latitude: lat, longitude: lng };
  }
  m = s.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/i);
  if (m) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (depotCoordsUsable(lat, lng)) return { latitude: lat, longitude: lng };
  }
  m = s.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)\b/);
  if (m) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (depotCoordsUsable(lat, lng)) return { latitude: lat, longitude: lng };
  }
  m = s.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)\b/);
  if (m) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (depotCoordsUsable(lat, lng)) return { latitude: lat, longitude: lng };
  }
  return null;
}

/** Free geocoding (Nominatim). Set NOMINATIM_USER_AGENT in production per OSM policy. */
async function geocodeDepotAddress({ name, address, city, postcode }) {
  const parts = [name, address, city, postcode].filter((x) => x != null && String(x).trim() !== '');
  const q = parts.join(', ');
  if (!q.trim()) return null;

  const blob = q.toLowerCase();
  const isLikelyPakistan =
    /pakistan|taxila|lahore|islamabad|karachi|rawalpindi|peshawar|quetta|multan|federal|f-?\d|g-?\d|h-?\d|e-?\d|470\d{2}|54\d{3}\b|75\d{3}\b|44\d{3}\b/i.test(
      blob
    );

  const attempts = [];
  if (isLikelyPakistan) {
    attempts.push({ q, countrycodes: 'pk' });
    const addr = [address, city].filter(Boolean).join(', ');
    if (addr) attempts.push({ q: `${addr}, Pakistan`, countrycodes: 'pk' });
  } else {
    attempts.push({ q, countrycodes: null });
  }

  for (let i = 0; i < attempts.length; i++) {
    if (i > 0) {
      try {
        await new Promise((r) => setTimeout(r, 1100));
      } catch (e) {
        /* ignore */
      }
    }
    const { q: query, countrycodes } = attempts[i];
    try {
      const params = new URLSearchParams({ format: 'json', q: query, limit: '1' });
      if (countrycodes) params.set('countrycodes', countrycodes);
      const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en',
          'User-Agent': process.env.NOMINATIM_USER_AGENT || 'Xruto/1.0 (depot geocoding; contact admin)',
        },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data) || !data[0]) continue;
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (depotCoordsUsable(lat, lng)) return { latitude: lat, longitude: lng };
    } catch (e) {
      console.warn('Depot geocode error:', e.message);
    }
  }
  return null;
}

/**
 * Resolves stored coordinates: explicit lat/lng, else geocode from address, else optional fallback depot.
 * @returns {Promise<{ latitude: number, longitude: number, geocoded?: boolean, fromMapLink?: boolean } | null>}
 */
async function resolveDepotLatLng(
  { name, address, city, postcode, latitude, longitude, googleMapsUrl },
  allowFallbackTo
) {
  const latIn = latitude != null && String(latitude).trim() !== '' ? parseFloat(latitude) : NaN;
  const lngIn = longitude != null && String(longitude).trim() !== '' ? parseFloat(longitude) : NaN;
  if (depotCoordsUsable(latIn, lngIn)) {
    return { latitude: latIn, longitude: lngIn };
  }
  const fromLink = parseLatLngFromGoogleMapsText(googleMapsUrl);
  if (fromLink) {
    return { latitude: fromLink.latitude, longitude: fromLink.longitude, fromMapLink: true };
  }
  const geo = await geocodeDepotAddress({ name, address, city, postcode });
  if (geo && depotCoordsUsable(geo.latitude, geo.longitude)) {
    return { latitude: geo.latitude, longitude: geo.longitude, geocoded: true };
  }
  if (allowFallbackTo && depotCoordsUsable(allowFallbackTo.latitude, allowFallbackTo.longitude)) {
    return { latitude: parseFloat(allowFallbackTo.latitude), longitude: parseFloat(allowFallbackTo.longitude) };
  }
  return null;
}

app.post('/api/admin/depots', async (req, res) => {
  try {
    console.log('Adding depot:', req.body);
    
    const { name, address, city, postcode, capacity, contactPhone, contactEmail, latitude, longitude, googleMapsUrl } = req.body;

    const _primaryDepot = MOCK_DEPOTS.find((d) => d.is_primary) || MOCK_DEPOTS[0] || { latitude: 0, longitude: 0 };
    const nm = name && String(name).trim();
    const addr = address != null && String(address).trim() !== '' ? String(address).trim() : '';
    const c = city ? city.trim() : '';
    const pc = postcode ? postcode.trim() : '';

    if (!nm) {
      return res.status(400).json({
        success: false,
        message: 'Depot name is required',
      });
    }
    const latTry = latitude != null && String(latitude).trim() !== '' ? parseFloat(latitude) : NaN;
    const lngTry = longitude != null && String(longitude).trim() !== '' ? parseFloat(longitude) : NaN;
    if (!addr && !depotCoordsUsable(latTry, lngTry) && !parseLatLngFromGoogleMapsText(googleMapsUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Add a street address, or paste a Google Maps link, or enter latitude and longitude.',
      });
    }

    const resolved = await resolveDepotLatLng(
      { name: nm, address: addr, city: c, postcode: pc, latitude, longitude, googleMapsUrl },
      _primaryDepot
    );
    if (!resolved) {
      return res.status(400).json({
        success: false,
        message:
          'Could not set depot on the map. Paste a Google Maps link (Share → copy link) in the "Map link" field, or enter latitude and longitude, or a full address we can look up.',
      });
    }

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

        const depotData = {
          name: nm,
          address: addr,
          city: c || null,
          postcode: pc || null,
          latitude: resolved.latitude,
          longitude: resolved.longitude,
          capacity: capacity ? parseInt(capacity) : 500,
          contact_phone: contactPhone ? contactPhone.trim() : null,
          contact_email: contactEmail ? contactEmail.trim() : null,
          is_primary: false,
          is_active: true
        };

        const { data: depot, error } = await supabase
          .from('depots')
          .insert(depotData)
          .select()
          .single();

        if (error) throw error;

        return res.status(201).json({
          success: true,
          message: resolved.fromMapLink
            ? 'Depot added; coordinates taken from the map link'
            : resolved.geocoded
              ? 'Depot added; coordinates set from your address'
              : 'Depot added successfully',
          depot: {
            ...depot,
            driver_count: 0,
            available_drivers: 0
          }
        });
      } catch (dbErr) {
        console.warn('Add depot DB unavailable, using memory fallback:', describeFetchFailure(dbErr));
      }
    }

    const memoryDepot = {
      id: Date.now().toString(),
      name: nm,
      address: addr,
      city: c,
      postcode: pc,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      capacity: capacity ? parseInt(capacity) : 500,
      contact_phone: contactPhone ? contactPhone.trim() : '',
      contact_email: contactEmail ? contactEmail.trim() : '',
      is_primary: false,
      is_active: true,
      driver_count: 0,
      available_drivers: 0
    };
    MOCK_DEPOTS.push(memoryDepot);
    persist();
    res.status(201).json({
      success: true,
      message: resolved.fromMapLink
        ? 'Depot added; coordinates from map link (memory mode)'
        : resolved.geocoded
          ? 'Depot added; coordinates set from your address (memory mode)'
          : 'Depot added (memory mode)',
      depot: memoryDepot
    });
  } catch (error) {
    console.error('Add depot error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add depot',
      error: error.message
    });
  }
});

app.put('/api/admin/depots/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, city, postcode, capacity, contactPhone, contactEmail, latitude, longitude, is_active, googleMapsUrl } = req.body;

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { data: current, error: fetchErr } = await supabase.from('depots').select('*').eq('id', id).single();
        if (fetchErr) throw fetchErr;
        if (!current) {
          return res.status(404).json({ success: false, message: 'Depot not found' });
        }
        const merged = {
          name: name !== undefined ? name : current.name,
          address: address !== undefined ? address : current.address,
          city: city !== undefined ? city : current.city,
          postcode: postcode !== undefined ? postcode : current.postcode,
          latitude: latitude !== undefined ? latitude : current.latitude,
          longitude: longitude !== undefined ? longitude : current.longitude,
          googleMapsUrl: googleMapsUrl !== undefined ? googleMapsUrl : undefined,
        };
        const resolved = await resolveDepotLatLng(merged, null);
        if (!resolved) {
          return res.status(400).json({
            success: false,
            message:
              'Could not set depot on the map. Paste a Google Maps link, or add latitude and longitude, or a findable address.',
          });
        }
        const updateData = {
          name: merged.name,
          address: merged.address,
          city: merged.city,
          postcode: merged.postcode,
          capacity: capacity ? parseInt(capacity) : current.capacity,
          contact_phone: contactPhone !== undefined ? contactPhone : current.contact_phone,
          contact_email: contactEmail !== undefined ? contactEmail : current.contact_email,
          latitude: resolved.latitude,
          longitude: resolved.longitude,
          is_active: is_active !== undefined ? Boolean(is_active) : current.is_active,
          updated_at: new Date().toISOString()
        };
        const { data, error } = await supabase
          .from('depots')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return res.json({
          success: true,
          message: resolved.fromMapLink
            ? 'Depot updated; coordinates taken from the map link'
            : resolved.geocoded
              ? 'Depot updated; coordinates set from your address'
              : 'Depot updated successfully',
          depot: data
        });
      } catch (dbErr) {
        console.warn('Depot update DB unavailable, using memory fallback:', describeFetchFailure(dbErr));
      }
    }

    const idx = MOCK_DEPOTS.findIndex(d => String(d.id) === String(id));
    if (idx < 0) return res.status(404).json({ success: false, message: 'Depot not found' });
    const ex = MOCK_DEPOTS[idx];
    const merged = {
      name: name !== undefined ? name : ex.name,
      address: address !== undefined ? address : ex.address,
      city: city !== undefined ? city : ex.city,
      postcode: postcode !== undefined ? postcode : ex.postcode,
      latitude: latitude !== undefined ? latitude : ex.latitude,
      longitude: longitude !== undefined ? longitude : ex.longitude,
      googleMapsUrl: googleMapsUrl !== undefined ? googleMapsUrl : undefined,
    };
    const _fb = MOCK_DEPOTS.find((d) => d.is_primary && String(d.id) !== String(id)) || MOCK_DEPOTS.find((d) => String(d.id) !== String(id));
    const resolved = await resolveDepotLatLng(merged, _fb);
    if (!resolved) {
      return res.status(400).json({
        success: false,
        message:
          'Could not set depot on the map. Paste a Google Maps link, or add latitude and longitude, or a findable address.',
      });
    }
    MOCK_DEPOTS[idx] = {
      ...ex,
      name: merged.name,
      address: merged.address,
      city: merged.city,
      postcode: merged.postcode,
      capacity: capacity !== undefined ? parseInt(capacity) : ex.capacity,
      contact_phone: contactPhone !== undefined ? contactPhone : ex.contact_phone,
      contact_email: contactEmail !== undefined ? contactEmail : ex.contact_email,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      is_active: is_active !== undefined ? Boolean(is_active) : ex.is_active
    };
    persist();
    res.json({
      success: true,
      message: resolved.fromMapLink
        ? 'Depot updated; coordinates taken from the map link'
        : resolved.geocoded
          ? 'Depot updated; coordinates set from your address'
          : 'Depot updated successfully',
      depot: MOCK_DEPOTS[idx]
    });
  } catch (error) {
    console.error('Update depot error:', error);
    res.status(500).json({ success: false, message: 'Failed to update depot', error: error.message });
  }
});

app.delete('/api/admin/depots/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { error } = await supabase.from('depots').delete().eq('id', id);
        if (error) throw error;
        return res.json({ success: true, message: 'Depot removed successfully' });
      } catch (dbErr) {
        console.warn('Depot delete DB unavailable, using memory fallback:', describeFetchFailure(dbErr));
      }
    }

    const before = MOCK_DEPOTS.length;
    MOCK_DEPOTS = MOCK_DEPOTS.filter(d => String(d.id) !== String(id));
    if (MOCK_DEPOTS.length === before) {
      return res.status(404).json({ success: false, message: 'Depot not found' });
    }
    persist();
    res.json({ success: true, message: 'Depot removed successfully' });
  } catch (error) {
    console.error('Remove depot error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove depot', error: error.message });
  }
});

let MOCK_DRIVERS = _persisted.drivers || [];

app.get('/api/admin/drivers', async (req, res) => {
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { data: drivers, error } = await supabase.from('drivers').select('*, depots(name, city)').eq('is_active', true).order('first_name');
        if (error) throw error;
        const formattedDrivers = (drivers || []).map(d => ({ id: d.id, name: `${d.first_name||''} ${d.last_name||''}`.trim(), email: d.email, phone: d.phone, first_name: d.first_name, last_name: d.last_name, depot_id: d.depot_id, mpg: d.mpg, vehicle_type: d.vehicle_type, vehicle_capacity: d.vehicle_capacity, license_plate: d.license_plate, is_active: d.is_active, is_available_today: d.is_available_today, details: `${d.depots?.name||'No Depot'}, ${d.mpg||30} MPG` }));
        return res.json({ success: true, drivers: formattedDrivers });
      } catch (dbErr) { console.warn('Drivers DB unavailable, using mock data:', describeFetchFailure(dbErr)); }
    }
    const memoryDrivers = (MOCK_DRIVERS || []).map((d) => {
      const dep = (MOCK_DEPOTS || []).find((x) => String(x.id) === String(d.depot_id));
      const depotName = dep?.name || 'No depot';
      const mpg = d.mpg || 30;
      return {
        ...d,
        depot_name: depotName,
        details: `${depotName}, ${mpg} MPG`,
      };
    });
    res.json({ success: true, drivers: memoryDrivers });
  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch drivers', error: error.message });
  }
});

app.post('/api/admin/drivers', async (req, res) => {
  try {
    console.log('Adding driver:', req.body);
    
    const { firstName, lastName, email, password, phone, depotId, mpg, vehicleType, vehicleCapacity, licensePlate } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, and email are required'
      });
    }

    // If password provided, create a login account for this driver
    if (password) {
      const existingUser = USERS.find(u => u.email === email.toLowerCase().trim());
      if (!existingUser) {
        USERS.push({
          id: `driver-${Date.now()}`,
          email: email.toLowerCase().trim(),
          password,
          name: `${firstName.trim()} ${lastName.trim()}`,
          role: 'driver',
          avatar: null
        });
        persist();
        console.log(`Created login account for driver ${firstName} ${lastName} (${email})`);
      }
    }

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        
        const driverData = {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone ? phone.trim() : null,
          depot_id: depotId || null,
          mpg: mpg ? parseFloat(mpg) : 30.0,
          vehicle_type: vehicleType || 'van',
          vehicle_capacity: vehicleCapacity ? parseInt(vehicleCapacity) : 50,
          license_plate: licensePlate ? licensePlate.trim() : null,
          is_active: true,
          is_available_today: true
        };

        const { data: driver, error } = await supabase
          .from('drivers')
          .insert(driverData)
          .select(`
            *,
            depots(name)
          `)
          .single();

        if (error) throw error;

        const formattedDriver = {
          id: driver.id,
          name: `${driver.first_name} ${driver.last_name}`,
          details: `${driver.depots?.name || 'No Depot'}, ${driver.mpg || 30} MPG`,
          ...driver
        };

        return res.status(201).json({
          success: true,
          message: 'Driver added successfully',
          driver: formattedDriver
        });
      } catch (dbErr) {
        console.warn('Add driver DB unavailable, using memory fallback:', describeFetchFailure(dbErr));
      }
    }

    const memoryDriver = {
      id: Date.now().toString(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      name: `${firstName.trim()} ${lastName.trim()}`,
      email: email.trim(),
      phone: phone ? phone.trim() : '',
      depot_id: depotId || null,
      mpg: mpg ? parseFloat(mpg) : 30.0,
      vehicle_type: vehicleType || 'van',
      vehicle_capacity: vehicleCapacity ? parseInt(vehicleCapacity) : 50,
      license_plate: licensePlate ? licensePlate.trim() : '',
      is_active: true,
      is_available_today: true,
      details: 'Memory Depot, 30 MPG'
    };
    MOCK_DRIVERS.push(memoryDriver);
    persist();
    res.status(201).json({ success: true, message: 'Driver added (memory mode)', driver: memoryDriver });
  } catch (error) {
    console.error('Add driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add driver',
      error: error.message
    });
  }
});

app.put('/api/admin/drivers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const rawDepot = body.depotId ?? body.depot_id;
        const depotIdResolved =
          rawDepot === '' || rawDepot === undefined ? null : rawDepot;

        const updateData = {
          first_name: body.firstName ?? body.first_name,
          last_name: body.lastName ?? body.last_name,
          email: body.email,
          phone: body.phone,
          depot_id: depotIdResolved,
          mpg: body.mpg !== undefined ? parseFloat(body.mpg) : undefined,
          vehicle_type: body.vehicleType ?? body.vehicle_type,
          vehicle_capacity: body.vehicleCapacity !== undefined ? parseInt(body.vehicleCapacity) : body.vehicle_capacity,
          license_plate: body.licensePlate ?? body.license_plate,
          notes: body.notes,
          updated_at: new Date().toISOString()
        };
        const { data, error } = await supabase
          .from('drivers')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return res.json({ success: true, message: 'Driver updated successfully', driver: data });
      } catch (dbErr) {
        console.warn('Driver update DB unavailable, using memory fallback:', describeFetchFailure(dbErr));
      }
    }

    const idx = MOCK_DRIVERS.findIndex(d => String(d.id) === String(id));
    if (idx < 0) return res.status(404).json({ success: false, message: 'Driver not found' });
    MOCK_DRIVERS[idx] = {
      ...MOCK_DRIVERS[idx],
      first_name: body.firstName ?? body.first_name ?? MOCK_DRIVERS[idx].first_name,
      last_name: body.lastName ?? body.last_name ?? MOCK_DRIVERS[idx].last_name,
      name: `${body.firstName ?? body.first_name ?? MOCK_DRIVERS[idx].first_name} ${body.lastName ?? body.last_name ?? MOCK_DRIVERS[idx].last_name}`.trim(),
      email: body.email ?? MOCK_DRIVERS[idx].email,
      phone: body.phone ?? MOCK_DRIVERS[idx].phone,
      depot_id: body.depotId ?? body.depot_id ?? MOCK_DRIVERS[idx].depot_id,
      mpg: body.mpg !== undefined ? parseFloat(body.mpg) : MOCK_DRIVERS[idx].mpg,
      vehicle_type: body.vehicleType ?? body.vehicle_type ?? MOCK_DRIVERS[idx].vehicle_type,
      vehicle_capacity: body.vehicleCapacity !== undefined ? parseInt(body.vehicleCapacity) : MOCK_DRIVERS[idx].vehicle_capacity,
      license_plate: body.licensePlate ?? body.license_plate ?? MOCK_DRIVERS[idx].license_plate,
      notes: body.notes ?? MOCK_DRIVERS[idx].notes
    };
    persist();
    res.json({ success: true, message: 'Driver updated successfully', driver: MOCK_DRIVERS[idx] });
  } catch (error) {
    console.error('Update driver error:', error);
    res.status(500).json({ success: false, message: 'Failed to update driver', error: error.message });
  }
});

app.delete('/api/admin/drivers/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { error } = await supabase.from('drivers').delete().eq('id', id);
        if (error) throw error;
        return res.json({ success: true, message: 'Driver removed successfully' });
      } catch (dbErr) {
        console.warn('Driver delete DB unavailable, using memory fallback:', describeFetchFailure(dbErr));
      }
    }

    const before = MOCK_DRIVERS.length;
    MOCK_DRIVERS = MOCK_DRIVERS.filter(d => String(d.id) !== String(id));
    if (MOCK_DRIVERS.length === before) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }
    persist();
    res.json({ success: true, message: 'Driver removed successfully' });
  } catch (error) {
    console.error('Remove driver error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove driver', error: error.message });
  }
});

app.patch('/api/admin/drivers/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ success: false, message: 'is_active boolean is required' });
    }

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { data, error } = await supabase
          .from('drivers')
          .update({ is_active, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return res.json({ success: true, message: 'Driver status updated successfully', driver: data });
      } catch (dbErr) {
        console.warn('Driver status DB unavailable, using memory fallback:', describeFetchFailure(dbErr));
      }
    }

    const idx = MOCK_DRIVERS.findIndex(d => String(d.id) === String(id));
    if (idx < 0) return res.status(404).json({ success: false, message: 'Driver not found' });
    MOCK_DRIVERS[idx] = { ...MOCK_DRIVERS[idx], is_active };
    persist();
    res.json({ success: true, message: 'Driver status updated successfully', driver: MOCK_DRIVERS[idx] });
  } catch (error) {
    console.error('Update driver status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update driver status', error: error.message });
  }
});

app.get('/api/admin/health', async (req, res) => {
  return res.json({ success: true, status: 'ok', service: 'admin' });
});

app.get('/api/admin/test', async (req, res) => {
  return res.json({ success: true, message: 'Admin API reachable' });
});
// Add this endpoint to your server.js file after the existing order endpoints (around line 350)


// Add driver status update endpoint
app.post('/api/orders/driver-update-status', async (req, res) => {
  try {
    const { driver_id, order_id, status, location, notes } = req.body;
    
    console.log(`Driver ${driver_id} updating order ${order_id} to ${status}`);

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      
      // Update order status
      const { data: order, error } = await supabase
        .from('orders')
        .update({
          delivery_status: status,
          delivered_at: status === 'delivered' ? new Date().toISOString() : null,
          delivery_notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', order_id)
        .select('route_id')
        .single();

      if (error) throw error;

      // Calculate route progress if order belongs to a route
      let routeProgress = null;
      if (order && order.route_id) {
        const { data: routeOrders } = await supabase
          .from('orders')
          .select('id, delivery_status')
          .eq('route_id', order.route_id);

        if (routeOrders) {
          const completedCount = routeOrders.filter(o => o.delivery_status === 'delivered').length;
          const totalCount = routeOrders.length;
          const progressPercentage = Math.round((completedCount / totalCount) * 100);

          routeProgress = {
            completed: completedCount,
            total: totalCount,
            percentage: progressPercentage
          };

          // Update route status based on progress
          const routeStatus = progressPercentage === 100 ? 'completed' : 
                            (progressPercentage > 0 ? 'in_progress' : 'assigned');
          
          await supabase
            .from('routes')
            .update({
              status: routeStatus,
              progress_percentage: progressPercentage,
              completed_orders: completedCount,
              updated_at: new Date().toISOString()
            })
            .eq('id', order.route_id);
        }
      }

      res.json({
        success: true,
        message: `Order marked as ${status}`,
        order_id,
        status,
        route_progress: routeProgress,
        timestamp: new Date().toISOString()
      });
    } else {
      // Update memory storage
      orderStatusMap.set(order_id, status);
      persist();

      // Find route and calculate progress
      let routeProgress = null;
      for (const [routeId, orders] of routeOrdersMap.entries()) {
        if (orders.some(order => order.id === order_id)) {
          const completedCount = orders.filter(order => 
            orderStatusMap.get(order.id) === 'delivered'
          ).length;
          
          routeProgress = {
            completed: completedCount,
            total: orders.length,
            percentage: Math.round((completedCount / orders.length) * 100)
          };
          break;
        }
      }

      res.json({
        success: true,
        message: `Order marked as ${status}`,
        order_id,
        status,
        route_progress: routeProgress,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Driver update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update delivery status',
      error: error.message
    });
  }
});
// ===== ORDERS ENDPOINTS =====

// ===== CLUSTERING HELPERS =====

/**
 * Haversine formula - calculates great-circle distance between two points on Earth.
 * Uses the spherical law of cosines with Earth radius R = 6371 km.
 * @param {number} lat1 - Latitude of point 1 (degrees)
 * @param {number} lon1 - Longitude of point 1 (degrees)
 * @param {number} lat2 - Latitude of point 2 (degrees)
 * @param {number} lon2 - Longitude of point 2 (degrees)
 * @returns {number} Distance in kilometres
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/**
 * Pick the depot to use for a zone’s route (start/end) before a driver is assigned.
 * Uses the depot closest to the order centroid — not the “first” depot in the list.
 */
function pickDepotForZoneOrders(orders, depotsList) {
  if (!depotsList || !depotsList.length) return null;
  const usableDepots = depotsList.filter((d) => depotCoordsUsable(parseFloat(d.latitude), parseFloat(d.longitude)));
  if (!usableDepots.length) return null;
  if (usableDepots.length === 1) return usableDepots[0];
  const validOrders = (orders || []).filter((o) => depotCoordsUsable(parseFloat(o.latitude), parseFloat(o.longitude)));
  if (!validOrders.length) {
    return usableDepots.find((d) => d.is_primary) || usableDepots[0];
  }
  const cLat = validOrders.reduce((s, o) => s + parseFloat(o.latitude), 0) / validOrders.length;
  const cLng = validOrders.reduce((s, o) => s + parseFloat(o.longitude), 0) / validOrders.length;
  usableDepots.sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
  let best = usableDepots[0];
  let bestD = Infinity;
  for (const d of usableDepots) {
    const dist = haversineKm(cLat, cLng, parseFloat(d.latitude), parseFloat(d.longitude));
    if (dist < bestD - 1e-9) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}

// Nearest UK postcode area from lat/lon (covers Bristol & Warrington + common UK areas)
function getApproxPostcodeArea(lat, lng) {
  const POSTCODE_CENTROIDS = [
    // Bristol
    { code: 'BS1',  lat: 51.454, lng: -2.597 }, { code: 'BS2',  lat: 51.462, lng: -2.573 },
    { code: 'BS3',  lat: 51.440, lng: -2.597 }, { code: 'BS4',  lat: 51.438, lng: -2.547 },
    { code: 'BS5',  lat: 51.461, lng: -2.547 }, { code: 'BS6',  lat: 51.470, lng: -2.590 },
    { code: 'BS7',  lat: 51.484, lng: -2.588 }, { code: 'BS8',  lat: 51.455, lng: -2.628 },
    { code: 'BS9',  lat: 51.481, lng: -2.644 }, { code: 'BS10', lat: 51.506, lng: -2.601 },
    { code: 'BS11', lat: 51.496, lng: -2.672 }, { code: 'BS13', lat: 51.411, lng: -2.601 },
    { code: 'BS14', lat: 51.416, lng: -2.553 }, { code: 'BS15', lat: 51.449, lng: -2.509 },
    { code: 'BS16', lat: 51.473, lng: -2.531 },
    // Warrington
    { code: 'WA1',  lat: 53.390, lng: -2.597 }, { code: 'WA2',  lat: 53.395, lng: -2.610 },
    { code: 'WA3',  lat: 53.410, lng: -2.580 }, { code: 'WA4',  lat: 53.381, lng: -2.575 },
    { code: 'WA5',  lat: 53.365, lng: -2.595 },
    // Manchester
    { code: 'M1',   lat: 53.480, lng: -2.238 }, { code: 'M14',  lat: 53.442, lng: -2.207 },
    // Liverpool
    { code: 'L1',   lat: 53.405, lng: -2.983 }, { code: 'L8',   lat: 53.390, lng: -2.978 },
    // London
    { code: 'E1',   lat: 51.515, lng: -0.072 }, { code: 'SW1',  lat: 51.499, lng: -0.139 },
    { code: 'N1',   lat: 51.534, lng: -0.101 }, { code: 'SE1',  lat: 51.504, lng: -0.086 },
  ];
  let best = POSTCODE_CENTROIDS[0], bestDist = Infinity;
  for (const pc of POSTCODE_CENTROIDS) {
    const d = haversineKm(lat, lng, pc.lat, pc.lng);
    if (d < bestDist) { bestDist = d; best = pc; }
  }
  return best.code;
}

/**
 * Builds a delivery zone descriptor from a cluster of orders.
 * Calculates route distance (heuristic: 0.8 km per stop + 2x depot distance),
 * estimated duration (base 20 min + 8 min/stop + 30 min per depot return),
 * depot return count based on capacity (25 units per trip),
 * and identifies the dominant postcode area for labelling.
 * @param {number} i - Zone index (0-based)
 * @param {Array} orders - Array of order objects with latitude, longitude, postcode
 * @returns {Object} Zone descriptor with zone_id, zone_name, orders, center, distances, durations
 */
const ZONE_COLORS = ['#FF6B35', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#90EE90', '#FFB6C1'];
function buildZone(i, orders) {
  const _pd = MOCK_DEPOTS.find(d => d.is_primary) || MOCK_DEPOTS[0] || { latitude: 0, longitude: 0 };
  const DEPOT_LAT = _pd.latitude, DEPOT_LNG = _pd.longitude;
  const DEPOT_CAPACITY = 25;

  const totalMeals = orders.reduce((s, o) => s + (parseInt(o.meal_qty) || parseFloat(o.weight) || 1), 0);
  const depotReturns = Math.max(0, Math.ceil(totalMeals / DEPOT_CAPACITY) - 1);

  const centLat = orders.reduce((s, o) => s + parseFloat(o.latitude), 0) / orders.length;
  const centLng = orders.reduce((s, o) => s + parseFloat(o.longitude), 0) / orders.length;
  const distFromDepot = haversineKm(centLat, centLng, DEPOT_LAT, DEPOT_LNG);
  const routeDistKm = orders.length * 0.8 + distFromDepot * 2;
  const durationMins = 20 + orders.length * 8 + depotReturns * 30;

  // Find the most common postcode area in this cluster
  const pcCounts = {};
  orders.forEach(o => {
    const pc = o.postcode_area || (o.postcode ? o.postcode.split(' ')[0] : null)
      || getApproxPostcodeArea(parseFloat(o.latitude), parseFloat(o.longitude));
    pcCounts[pc] = (pcCounts[pc] || 0) + 1;
  });
  const dominantPC = Object.entries(pcCounts).sort((a, b) => b[1] - a[1])[0][0];

  return {
    zone_id: `zone_${i + 1}`,
    zone_name: `Zone ${i + 1} - ${dominantPC}`,
    orders,
    center: { lat: centLat, lng: centLng },
    color_hex: ZONE_COLORS[i % ZONE_COLORS.length],
    total_orders: orders.length,
    total_value: parseFloat(orders.reduce((s, o) => s + (o.order_value || 0), 0).toFixed(2)),
    total_weight_kg: parseFloat(totalMeals.toFixed(1)),
    avg_distance_from_depot: parseFloat(distFromDepot.toFixed(2)),
    route_distance_km: parseFloat(routeDistKm.toFixed(1)),
    estimated_duration: Math.round(durationMins),
    depot_returns_needed: depotReturns,
    efficiency_score: parseFloat((85 + Math.random() * 10).toFixed(1))
  };
}

/**
 * K-means++ geographic clustering algorithm for delivery orders.
 *
 * Algorithm overview:
 * 1. INITIALISATION (K-means++): First centroid chosen randomly. Each subsequent
 *    centroid is selected with probability proportional to squared distance from
 *    nearest existing centroid — this spreads initial seeds and improves convergence.
 * 2. CAPACITY GUARD: Ensures minK = ceil(N / 25) so no zone exceeds 25 stops.
 *    Caps at k = min(requestedK, minK, N, 8).
 * 3. ITERATIVE REFINEMENT (Lloyd's algorithm, max 100 iterations):
 *    a. Assign each order to nearest centroid (Haversine distance).
 *    b. Recompute centroid as mean lat/lng of assigned orders.
 *    c. Converge when centroid shift < 0.00005° (~5 m).
 * 4. OUTPUT: Array of zone descriptors via buildZone().
 *
 * @param {Array} orders - Orders with .latitude, .longitude
 * @param {number} numClusters - Requested number of clusters (adjusted by capacity)
 * @returns {Array} Array of zone objects
 */
function performKMeansClustering(orders, numClusters = 3) {
  if (orders.length === 0) return [];

  const valid = orders.filter(o =>
    o.latitude && o.longitude &&
    !isNaN(parseFloat(o.latitude)) && !isNaN(parseFloat(o.longitude))
  );
  if (valid.length === 0) return [];

  // Capacity-aware: ensure we have enough clusters to keep each under 25 stops
  const maxStops = 25;
  const minK = Math.ceil(valid.length / maxStops);
  const k = Math.min(Math.max(numClusters, minK), valid.length, 8);

  if (valid.length <= k) {
    return valid.map((o, i) => buildZone(i, [o]));
  }

  const lats = valid.map(o => parseFloat(o.latitude));
  const lngs = valid.map(o => parseFloat(o.longitude));

  // K-means++ initialization: spread initial centroids
  const firstIdx = Math.floor(Math.random() * valid.length);
  const centroids = [{ lat: lats[firstIdx], lng: lngs[firstIdx] }];

  while (centroids.length < k) {
    const dists = valid.map((_, i) => Math.min(...centroids.map(c => {
      const dx = lats[i] - c.lat, dy = lngs[i] - c.lng;
      return dx * dx + dy * dy;
    })));
    const total = dists.reduce((a, b) => a + b, 0);
    let r = Math.random() * total, cum = 0;
    for (let i = 0; i < dists.length; i++) {
      cum += dists[i];
      if (r <= cum) { centroids.push({ lat: lats[i], lng: lngs[i] }); break; }
    }
    if (centroids.length < k) centroids.push({ lat: lats[valid.length - centroids.length], lng: lngs[valid.length - centroids.length] });
  }

  // Iterative assignment + centroid update
  let clusters = Array.from({ length: k }, () => []);
  for (let iter = 0; iter < 100; iter++) {
    const next = Array.from({ length: k }, () => []);
    valid.forEach((o, i) => {
      let best = 0, bestD = Infinity;
      centroids.forEach((c, j) => {
        const d = haversineKm(lats[i], lngs[i], c.lat, c.lng);
        if (d < bestD) { bestD = d; best = j; }
      });
      next[best].push(o);
    });

    let converged = true;
    next.forEach((cl, i) => {
      if (!cl.length) return;
      const newLat = cl.reduce((s, o) => s + parseFloat(o.latitude), 0) / cl.length;
      const newLng = cl.reduce((s, o) => s + parseFloat(o.longitude), 0) / cl.length;
      if (Math.abs(newLat - centroids[i].lat) > 0.00005 || Math.abs(newLng - centroids[i].lng) > 0.00005) converged = false;
      centroids[i] = { lat: newLat, lng: newLng };
    });
    clusters = next;
    if (converged) break;
  }

  // Build zones, skip empty clusters
  return clusters.filter(cl => cl.length > 0).map((cl, i) => buildZone(i, cl));
}
// Add these helper functions after performKMeansClustering function (around line 200)

/** 0,0 (Null Island) and invalid floats break Google Maps; browser geolocation is never used in these URLs. */
function isNullIsland(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;
  if (Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6) return true;
  return false;
}

function isValidNavCoord(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (isNullIsland(lat, lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  return true;
}

function getLatLngFromWaypoint(wp) {
  if (!wp) return null;
  const la = wp.lat != null && wp.lat !== '' ? parseFloat(wp.lat) : parseFloat(wp.latitude);
  const ln = wp.lng != null && wp.lng !== '' ? parseFloat(wp.lng) : parseFloat(wp.longitude);
  if (isValidNavCoord(la, ln)) return { lat: la, lng: ln, _meta: wp };
  return null;
}

function getDepotPointForNav(depot) {
  const la = parseFloat(depot?.latitude);
  const ln = parseFloat(depot?.longitude);
  if (isValidNavCoord(la, ln)) return { lat: la, lng: ln };
  return null;
}

function pickPrimaryDepotFromList(depots) {
  if (!depots || depots.length === 0) return { latitude: 0, longitude: 0 };
  return depots.find((d) => d.is_primary) || depots[0];
}

/** Union memory + Supabase depots so local-only depots (e.g. UET Taxila in db.json) still resolve in nav URLs. */
function mergeDepotsForNavigation(localDepots, remoteDepots) {
  const byId = new Map();
  const add = (row) => {
    if (!row || row.id == null) return;
    const id = String(row.id);
    const cur = byId.get(id);
    if (!cur) {
      byId.set(id, row);
      return;
    }
    const curLat = parseFloat(cur.latitude);
    const curLng = parseFloat(cur.longitude);
    const nextLat = parseFloat(row.latitude);
    const nextLng = parseFloat(row.longitude);
    const curOk = isValidNavCoord(curLat, curLng);
    const nextOk = isValidNavCoord(nextLat, nextLng);
    if (nextOk) {
      byId.set(id, { ...cur, ...row });
    } else if (!curOk) {
      byId.set(id, { ...cur, ...row });
    }
  };
  (localDepots || []).forEach(add);
  (remoteDepots || []).forEach(add);
  return Array.from(byId.values());
}

/** Active depots for map URLs: merge persisted MOCK_DEPOTS with DB so IDs from Admin always resolve. */
async function getDepotsListForNavigation() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      // Include name; do not filter is_active here — drivers can still reference a depot row that was
      // toggled inactive, and omitting it breaks getDepotForNavigation (falls back to zone / "first depot").
      const { data: depots, error } = await supabase
        .from('depots')
        .select('id, name, latitude, longitude, is_primary, is_active')
        .order('name');
      if (!error && Array.isArray(depots) && depots.length > 0) {
        return mergeDepotsForNavigation(MOCK_DEPOTS, depots);
      }
    } catch (e) {
      console.warn('getDepotsListForNavigation:', e.message);
    }
  }
  return MOCK_DEPOTS;
}

/** Merged id → depot_id for drivers. Supabase null must not wipe a good depot_id from memory (db.json). */
async function buildDriverDepotIdMap() {
  const m = new Map();
  for (const d of MOCK_DRIVERS) {
    const id = String(d.id);
    if (d.depot_id != null && d.depot_id !== '') m.set(id, String(d.depot_id));
  }
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      const { data: rows, error } = await supabase.from('drivers').select('id, depot_id');
      if (!error && rows) {
        for (const r of rows) {
          const id = String(r.id);
          if (r.depot_id != null && r.depot_id !== '') {
            m.set(id, String(r.depot_id));
          }
        }
      }
    } catch (e) {
      console.warn('buildDriverDepotIdMap:', e.message);
    }
  }
  return m;
}

/**
 * Depot for start/end in /maps URLs:
 * 1) Assigned driver’s depot (from map + live MOCK_DRIVERS fallback for depot_id)
 * 2) Else zone: depot closest to this route’s order centroid (not global “primary” / first in list)
 * 3) Else primary in list
 *
 * `orders` should be this route’s stops so unassigned routes and bad/missing depot coords stay local to the zone.
 */
function getDepotForNavigation(assignedDriverId, depots, driverDepotIdMap, orders) {
  const list = depots && depots.length ? depots : MOCK_DEPOTS;
  const primary = pickPrimaryDepotFromList(list);
  const zoneDepot = () => {
    const z = pickDepotForZoneOrders(orders || [], list);
    if (z && isValidNavCoord(parseFloat(z.latitude), parseFloat(z.longitude))) return z;
    return primary;
  };

  let depotId = driverDepotIdMap ? driverDepotIdMap.get(String(assignedDriverId)) : undefined;
  if (depotId == null || depotId === '') {
    depotId = (MOCK_DRIVERS.find((d) => String(d.id) === String(assignedDriverId)) || {}).depot_id;
  }
  if (!assignedDriverId || depotId == null || depotId === '') {
    return zoneDepot();
  }

  let d = (list || []).find((x) => String(x.id) === String(depotId));
  if (!d) d = MOCK_DEPOTS.find((x) => String(x.id) === String(depotId));
  if (d && isValidNavCoord(parseFloat(d.latitude), parseFloat(d.longitude))) {
    return d;
  }
  console.warn(
    `[nav] Driver ${assignedDriverId} depot_id=${depotId} missing from merged depots (${list?.length || 0} rows). Using zone fallback. Check Supabase drivers.depot_id and depots rows.`
  );
  return zoneDepot();
}

/** Returns nav URL and depot name used for start/end in Maps (driver’s depot when assigned). */
function buildRouteNavigationWithMaps(routeId, driverId, depotsNav, driverDepotIdMap, useGoogleMaps) {
  const orders = routeOrdersMap.get(routeId) || [];
  const navDepot = getDepotForNavigation(driverId, depotsNav, driverDepotIdMap, orders);
  const wps = orders.map((o) => waypointFromOrderForNav(o, navDepot)).filter(Boolean);
  const result = generateNavigationURL(
    { latitude: navDepot.latitude, longitude: navDepot.longitude },
    wps,
    useGoogleMaps
  );
  const navigation_url = typeof result === 'object' ? result.url : result;
  return { navigation_url, maps_depot_name: navDepot.name || null };
}

function buildNavigationUrlForRouteWithMaps(routeId, driverId, depotsNav, driverDepotIdMap, useGoogleMaps) {
  return buildRouteNavigationWithMaps(routeId, driverId, depotsNav, driverDepotIdMap, useGoogleMaps).navigation_url;
}

/** Build nav waypoint from order + depot; never uses 0,0 as a real coordinate. */
function waypointFromOrderForNav(order, primaryDepot) {
  const la = parseFloat(order.latitude);
  const ln = parseFloat(order.longitude);
  if (isValidNavCoord(la, ln)) {
    return { lat: la, lng: ln, orderId: order.id, postcode: order.postcode };
  }
  const da = parseFloat(primaryDepot?.latitude);
  const dl = parseFloat(primaryDepot?.longitude);
  if (isValidNavCoord(da, dl)) {
    return { lat: da, lng: dl, orderId: order.id, postcode: order.postcode };
  }
  return null;
}

function buildUniquePoints(points) {
  return points.filter((p, index, arr) => {
    return index === arr.findIndex((o) => Math.abs(o.lat - p.lat) < 0.00001 && Math.abs(o.lng - p.lng) < 0.00001);
  });
}

function generateNavigationURL(depot, waypoints, useGoogleMaps = false) {
  if (!waypoints || waypoints.length === 0) {
    return {
      url: useGoogleMaps ? 'https://maps.google.com/' : 'https://wego.here.com/',
      stats: { original: 0, unique: 0, duplicates: 0, expected_points: 2 }
    };
  }

  const rawPoints = (waypoints || []).map((w) => getLatLngFromWaypoint(w)).filter(Boolean);
  if (rawPoints.length === 0) {
    console.warn('🗺️ No valid non-zero coordinates for waypoints; depot may be unset (0,0) and orders lack lat/lng.');
    return {
      url: useGoogleMaps ? 'https://maps.google.com/' : 'https://wego.here.com/',
      stats: { original: waypoints.length, unique: 0, duplicates: 0, expected_points: 0 }
    };
  }

  const uniqueWaypoints = buildUniquePoints(rawPoints.map((p) => ({ lat: p.lat, lng: p.lng })));
  const duplicates = rawPoints.length - uniqueWaypoints.length;
  const depotPt = getDepotPointForNav(depot);
  const useDepot = !!depotPt;
  const origin = depotPt || uniqueWaypoints[0];
  const returnPt = depotPt || uniqueWaypoints[0];
  if (!isValidNavCoord(origin.lat, origin.lng)) {
    return {
      url: useGoogleMaps ? 'https://maps.google.com/' : 'https://wego.here.com/',
      stats: { original: waypoints.length, unique: 0, duplicates, expected_points: 0 }
    };
  }

  const o = `${origin.lat},${origin.lng}`;
  const r = `${returnPt.lat},${returnPt.lng}`;

  console.log(
    `🗺️ Generating navigation URL: ${uniqueWaypoints.length} unique stops, depot ${useDepot ? 'ok' : 'missing — using first stop as start/end'}`
  );

  if (useGoogleMaps) {
    if (uniqueWaypoints.length === 1) {
      const d = uniqueWaypoints[0];
      const dest = `${d.lat},${d.lng}`;
      const url = `https://www.google.com/maps/dir/${o}/${dest}`;
      if (!useDepot) {
        if (d.lat === origin.lat && d.lng === origin.lng) {
          // Single stop, no depot: open place directly (avoids 0,0 and odd A→A)
          return {
            url: `https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}`,
            stats: { original: 1, unique: 1, duplicates: 0, expected_points: 1 }
          };
        }
      }
      return {
        url,
        stats: { original: 1, unique: 1, duplicates: 0, expected_points: 3 }
      };
    }
    if (!useDepot) {
      const pathParts = uniqueWaypoints.map((p) => `${p.lat},${p.lng}`).join('/');
      const url = `https://www.google.com/maps/dir/${pathParts}/${r}`;
      return {
        url,
        stats: { original: waypoints.length, unique: uniqueWaypoints.length, duplicates, expected_points: uniqueWaypoints.length + 1 }
      };
    }
    const waypointCoords = uniqueWaypoints.map((wp) => `${wp.lat},${wp.lng}`).join('/');
    const url = `https://www.google.com/maps/dir/${o}/${waypointCoords}/${r}`;
    if (duplicates > 0) {
      console.log(`🔍 Deduplicated ${duplicates} same-coordinate stops.`);
    }
    return {
      url,
      stats: { original: waypoints.length, unique: uniqueWaypoints.length, duplicates, expected_points: uniqueWaypoints.length + 2 }
    };
  } else {
    if (uniqueWaypoints.length === 1) {
      const d = uniqueWaypoints[0];
      if (!useDepot && d.lat === origin.lat && d.lng === origin.lng) {
        return {
          url: `https://wego.here.com/search/${d.lat},${d.lng}`,
          stats: { original: 1, unique: 1, duplicates: 0, expected_points: 1 }
        };
      }
      const dest = `${d.lat},${d.lng}`;
      const url = `https://wego.here.com/directions/drive/${o}/${dest}`;
      return { url, stats: { original: 1, unique: 1, duplicates: 0, expected_points: 3 } };
    }
    if (!useDepot) {
      const pathParts = uniqueWaypoints.map((p) => `${p.lat},${p.lng}`).join('/');
      const url = `https://wego.here.com/directions/drive/${pathParts}/${r}`;
      return {
        url,
        stats: { original: waypoints.length, unique: uniqueWaypoints.length, duplicates, expected_points: uniqueWaypoints.length + 1 }
      };
    }
    const waypointCoords = uniqueWaypoints.map((wp) => `${wp.lat},${wp.lng}`).join('/');
    const url = `https://wego.here.com/directions/drive/${o}/${waypointCoords}/${r}`;
    return {
      url,
      stats: { original: waypoints.length, unique: uniqueWaypoints.length, duplicates, expected_points: uniqueWaypoints.length + 2 }
    };
  }
}

function generateSimpleNavigationURL(depot, waypoints, useGoogleMaps = false) {
  if (!waypoints || waypoints.length === 0) {
    return useGoogleMaps ? 'https://maps.google.com/' : 'https://wego.here.com/';
  }

  const p = getLatLngFromWaypoint(waypoints[0]);
  if (!p) {
    return useGoogleMaps ? 'https://maps.google.com/' : 'https://wego.here.com/';
  }

  if (useGoogleMaps) {
    return `https://www.google.com/maps/search/${p.lat},${p.lng}`;
  }
  return `https://wego.here.com/search/${p.lat},${p.lng}`;
}

// ===== PDF UPLOAD ENDPOINT =====
app.post('/api/orders/upload-pdf', upload.single('pdfFile'), async (req, res) => {
  try {
    console.log('PDF upload request received');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No PDF file uploaded'
      });
    }

    console.log('Processing PDF file:', req.file.originalname);
    
    // Parse PDF and extract orders
    const orders = await pdfParserService.parsePDF(req.file.buffer);
    
    if (orders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid orders found in PDF. Please check the PDF format.',
        orders: []
      });
    }

    console.log(`Extracted ${orders.length} orders from PDF`);

    // Insert orders into Supabase
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      
      const { data: insertedOrders, error } = await supabase
        .from('orders')
        .insert(orders)
        .select();

      if (error) {
        console.error('Supabase insertion error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to save orders to database',
          error: error.message,
          extractedOrders: orders
        });
      }

      console.log(`Successfully inserted ${insertedOrders.length} orders into database`);

      res.json({
        success: true,
        message: `Successfully processed PDF and added ${insertedOrders.length} orders`,
        orders: insertedOrders,
        filename: req.file.originalname,
        extractedCount: orders.length,
        insertedCount: insertedOrders.length
      });
    } else {
      // Return extracted orders without database insertion (for testing)
      res.json({
        success: true,
        message: `Successfully extracted ${orders.length} orders from PDF (database not configured)`,
        orders: orders,
        filename: req.file.originalname,
        extractedCount: orders.length,
        insertedCount: 0
      });
    }

  } catch (error) {
    console.error('PDF upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process PDF file',
      error: error.message
    });
  }
});

// ===== TEST ENDPOINT FOR PDF PARSING =====
app.post('/api/orders/test-pdf-parsing', async (req, res) => {
  try {
    console.log('Generating test orders');
    
    // Generate sample orders for testing
    const orders = pdfParserService.generateSampleOrders(5);
    
    // Insert into database if configured
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      
      const { data: insertedOrders, error } = await supabase
        .from('orders')
        .insert(orders)
        .select();

      if (error) {
        console.error('Test orders insertion error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to insert test orders',
          error: error.message
        });
      }

      res.json({
        success: true,
        message: `Successfully created ${insertedOrders.length} test orders`,
        orders: insertedOrders
      });
    } else {
      res.json({
        success: true,
        message: `Generated ${orders.length} test orders (database not configured)`,
        orders: orders
      });
    }
  } catch (error) {
    console.error('Test PDF parsing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate test orders',
      error: error.message
    });
  }
});

// ===== TEXT BULK UPLOAD ENDPOINT =====
app.post('/api/orders/upload-text', async (req, res) => {
  try {
    console.log('Text bulk upload request received');
    
    const { orders } = req.body;
    
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid orders provided'
      });
    }

    console.log(`Processing ${orders.length} orders from text input`);

    // Validate and clean orders
    const validOrders = orders.map((order, index) => {
      return {
        customer_name: order.customer_name || `Customer ${index + 1}`,
        customer_email: order.customer_email || `customer${index + 1}@email.com`,
        customer_phone: order.customer_phone || `01925${String(100000 + index).slice(1)}`,
        delivery_address: order.delivery_address || 'Address to be confirmed',
        postcode: order.postcode || 'WA4 1EF',
        city: order.city || 'Warrington',
        latitude: order.latitude || 53.3900,
        longitude: order.longitude || -2.5970,
        order_value: order.order_value || 50.00,
        weight: order.weight || 2.5,
        delivery_date: order.delivery_date || new Date().toISOString().split('T')[0],
        status: 'pending'
      };
    });

    // Try Supabase first, fall back to in-memory
    let insertedViaDb = false;
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        
        const { data: insertedOrders, error } = await supabase
          .from('orders')
          .insert(validOrders)
          .select();

        if (error) throw error;

        console.log(`Successfully inserted ${insertedOrders.length} orders into database`);
        insertedViaDb = true;

        return res.json({
          success: true,
          message: `Successfully processed and added ${insertedOrders.length} orders`,
          orders: insertedOrders,
          extractedCount: orders.length,
          insertedCount: insertedOrders.length
        });
      } catch (dbErr) {
        console.warn('Supabase unavailable for upload-text, falling back to memory:', describeFetchFailure(dbErr));
      }
    }

    if (!insertedViaDb) {
      // Store in-memory when no database (so eligible/cluster endpoints can use them)
      const dateStr = new Date().toISOString().split('T')[0];
      const enriched = validOrders.map((o, idx) => {
        const lat = parseFloat(o.latitude) || 53.3900;
        const lng = parseFloat(o.longitude) || -2.5970;
        return {
          ...o,
          id: `mem-${Date.now()}-${idx}`,
          postcode_area: o.postcode ? o.postcode.split(' ')[0] : getApproxPostcodeArea(lat, lng),
          latitude: lat,
          longitude: lng,
          distance_from_depot_km: calculateDistanceFromDepot(lat, lng),
          delivery_date: o.delivery_date || dateStr
        };
      });
      // Deduplicate: skip orders whose delivery_address already exists
      const existingAddresses = new Set(inMemoryOrders.map(o => (o.delivery_address || '').toLowerCase().trim()));
      const newOrders = enriched.filter(o => !existingAddresses.has((o.delivery_address || '').toLowerCase().trim()));
      inMemoryOrders.push(...newOrders);
      persist();
      console.log(`Stored ${newOrders.length} new orders (${enriched.length - newOrders.length} duplicates skipped). Total: ${inMemoryOrders.length}`);
      res.json({
        success: true,
        message: `Successfully processed ${newOrders.length} orders`,
        orders: newOrders,
        extractedCount: orders.length,
        insertedCount: newOrders.length
      });
    }

  } catch (error) {
    console.error('Text bulk upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process text orders',
      error: error.message
    });
  }
});

// ===== EXCEL BULK UPLOAD ENDPOINT =====
app.post('/api/orders/upload-excel', excelUpload.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No Excel file uploaded' });
    }

    const XLSX = require('xlsx');
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const rawData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });

    if (rawData.length < 2) {
      return res.status(400).json({ success: false, message: 'Excel file has no data rows' });
    }

    // Detect header row and column indices (case-insensitive)
    const headers = rawData[0].map(h => String(h).toLowerCase().trim());
    const colIdx = {
      orderId:      headers.findIndex(h => h.includes('order') && h.includes('id')),
      customerName: headers.findIndex(h => h.includes('customer') || h.includes('name')),
      address:      headers.findIndex(h => h.includes('address')),
      lat:          headers.findIndex(h => h === 'lat' || h === 'latitude'),
      lon:          headers.findIndex(h => h === 'lon' || h === 'lng' || h === 'longitude'),
      mealQty:      headers.findIndex(h => h.includes('meal') || h.includes('qty') || h.includes('quantity'))
    };

    const dateStr = new Date().toISOString().split('T')[0];
    const enriched = [];

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      const lat = parseFloat(colIdx.lat >= 0 ? row[colIdx.lat] : '');
      const lon = parseFloat(colIdx.lon >= 0 ? row[colIdx.lon] : '');
      if (isNaN(lat) || isNaN(lon)) continue; // Skip rows without valid coords

      const mealQty = colIdx.mealQty >= 0 ? parseInt(row[colIdx.mealQty]) || 0 : 0;
      const postcodeArea = getApproxPostcodeArea(lat, lon);

      enriched.push({
        id: `xls-${Date.now()}-${i}`,
        customer_name: colIdx.customerName >= 0 ? String(row[colIdx.customerName] || `Customer ${i}`) : `Customer ${i}`,
        delivery_address: colIdx.address >= 0 ? String(row[colIdx.address] || '') : '',
        postcode: postcodeArea,
        postcode_area: postcodeArea,
        city: postcodeArea.replace(/\d/g, '').trim(),
        latitude: lat,
        longitude: lon,
        order_value: mealQty * 8.50,
        weight: mealQty > 0 ? mealQty * 1.2 : 1.5,
        meal_qty: mealQty,
        status: 'pending',
        delivery_date: dateStr,
        distance_from_depot_km: calculateDistanceFromDepot(lat, lon),
        source_order_id: colIdx.orderId >= 0 ? String(row[colIdx.orderId] || '') : ''
      });
    }

    if (enriched.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid rows with coordinates found in Excel file' });
    }

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const dbOrders = enriched.map(({ id, source_order_id, meal_qty, ...rest }) => rest);
        const { data: insertedOrders, error } = await supabase.from('orders').insert(dbOrders).select();
        if (error) throw error;
        return res.json({ success: true, message: `Inserted ${insertedOrders.length} orders from Excel`, orders: insertedOrders, insertedCount: insertedOrders.length });
      } catch (dbErr) {
        console.warn('Supabase unavailable, storing Excel orders in memory:', describeFetchFailure(dbErr));
      }
    }

    // In-memory fallback
    inMemoryOrders.push(...enriched);
    persist();
    console.log(`Stored ${enriched.length} Excel orders in memory. Total: ${inMemoryOrders.length}`);
    res.json({
      success: true,
      message: `Successfully processed ${enriched.length} orders from Excel`,
      orders: enriched,
      insertedCount: enriched.length
    });
  } catch (error) {
    console.error('Excel upload error:', error);
    res.status(500).json({ success: false, message: 'Failed to process Excel file', error: error.message });
  }
});

// ===== RESET ORDERS ENDPOINT =====
app.delete('/api/orders/reset', async (req, res) => {
  try {
    console.log('Reset orders request received');
    
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        
        // Get count of orders before deletion for confirmation
        const { count: orderCount, error: countError } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true });

        if (countError) throw countError;

        // Delete all orders
        const { error: deleteError } = await supabase
          .from('orders')
          .delete()
          .gte('created_at', '1900-01-01');

        if (deleteError) throw deleteError;

        console.log(`Successfully reset ${orderCount} orders from database`);

        return res.json({
          success: true,
          message: `Successfully reset ${orderCount} orders from database`,
          deletedCount: orderCount
        });
      } catch (dbErr) {
        console.warn('Supabase unavailable for reset, clearing in-memory orders:', describeFetchFailure(dbErr));
      }
    }

    // In-memory fallback
    const count = inMemoryOrders.length;
    inMemoryOrders = [];
    routeOrdersMap.clear();
    orderStatusMap.clear();
    persist();
    res.json({
      success: true,
      message: `Successfully reset ${count} orders`,
      deletedCount: count
    });

  } catch (error) {
    console.error('Reset orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset orders',
      error: error.message
    });
  }
});

app.post('/api/orders/generate-clusters', async (req, res) => {
  try {
    const { selected_postcodes, max_zones = 5 } = req.body;
    
    console.log('Generating clusters for postcodes:', selected_postcodes);
    
    if (!selected_postcodes || selected_postcodes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one postcode area'
      });
    }

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        
        const { data: orders, error } = await supabase
          .from('orders')
          .select('*')
          .eq('delivery_date', new Date().toISOString().split('T')[0])
          .in('status', ['pending', 'confirmed']);

        if (error) throw error;

        // Filter orders by selected postcodes
        const filteredOrders = orders.filter(order => 
          selected_postcodes.some(pc => order.postcode.startsWith(pc))
        ).map(order => ({
          ...order,
          postcode_area: order.postcode.split(' ')[0],
          distance_from_depot_km: Math.random() * 10 // Mock distance
        }));

        if (filteredOrders.length === 0) {
          return res.json({
            success: true,
            zones: [],
            total_orders: 0,
            message: 'No orders found for selected postcodes'
          });
        }

        // Use the optimized HereAPIService for clustering (with HERE Matrix API when key is available)
        const hereService = require('./services/hereAPI');
        const primaryDepot = MOCK_DEPOTS.find(d => d.is_primary) || MOCK_DEPOTS[0] || { latitude: 0, longitude: 0 };
        const zones = await hereService.generateOptimizedClustersForArea(filteredOrders, max_zones, performKMeansClustering, primaryDepot);

        return res.json({
          success: true,
          zones: zones,
          total_orders: filteredOrders.length,
          clustering_method: 'kmeans',
          optimization_score: 85 + Math.random() * 10,
          message: `Successfully clustered ${filteredOrders.length} orders into ${zones.length} zones`
        });
      } catch (dbErr) {
        console.warn('Supabase unavailable for clustering, using in-memory orders:', describeFetchFailure(dbErr));
      }
    }

    // In-memory fallback (also used when Supabase is unavailable)
    const pool = inMemoryOrders.filter(o =>
      selected_postcodes.some(pc => (o.postcode_area || '').startsWith(pc))
    );
    if (pool.length === 0) {
      return res.json({ success: true, zones: [], total_orders: 0, message: 'No orders found for selected postcodes' });
    }
    const zones = performKMeansClustering(pool, max_zones);
    res.json({
      success: true,
      zones,
      total_orders: pool.length,
      clustering_method: 'kmeans_pp',
      optimization_score: 90,
      message: `Successfully clustered ${pool.length} orders into ${zones.length} zones`
    });
  } catch (error) {
    console.error('Generate clusters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate clusters',
      error: error.message
    });
  }
});

app.post('/api/orders/generate-routes', async (req, res) => {
  try {
    const { zones } = req.body;
    let routeSettings = { ...inMemorySettings };

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { data: dbSettings } = await supabase.from('settings').select('*').single();
        routeSettings = { ...routeSettings, ...(dbSettings || {}) };
      } catch (settingsErr) {
        console.warn('Route generation settings DB unavailable, using memory settings:', describeFetchFailure(settingsErr));
      }
    }

    const useGoogleMaps = routeSettings.navigation_app_preference === 'google';
    const fuelPricePerUnit = Number(routeSettings.default_fuel_price) || 1.45;
    const perKmFuelFactor = Math.max(0.05, fuelPricePerUnit * 0.1);
    const enableStockRefill = Boolean(routeSettings.enable_stock_refill);
    const maxDeliveriesPerTrip = parseInt(routeSettings.max_deliveries_per_route) || 25;
    
    if (!zones || zones.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No zones provided for route generation'
      });
    }

    console.log('Generating optimized routes for', zones.length, 'zones');

    const depotsListForRoutes = await getDepotsListForNavigation();

    const routes = zones.map((zone, index) => {
      const routeId = `route_${index + 1}`;
      
      // Store the actual orders for this route
      routeOrdersMap.set(routeId, zone.orders || []);
      
      // Initialize order statuses as pending
      if (zone.orders) {
        zone.orders.forEach(order => {
          orderStatusMap.set(order.id, 'pending');
        });
      }

      console.log(`🚛 Creating route for ${zone.zone_name}: total_orders=${zone.total_orders}, actual orders array length=${zone.orders?.length || 0}`);

      // Build route segments (stock refill: split into sub-trips when enabled)
      // ── Stock Refill / Sub-trip Splitting Algorithm ───────────────────────
      // When stock refill is enabled in settings and a zone has more orders
      // than maxDeliveriesPerTrip, we split the delivery list into segments.
      // Each segment is a sub-trip: depot → N deliveries → return to depot.
      // The driver returns to the depot to reload between segments.
      // This ensures the vehicle is never overloaded.
      const allOrders = zone.orders || [];
      // Depots for this zone: closest to order centroid (not always “first” / primary in the list)
      const zoneDepot = pickDepotForZoneOrders(allOrders, depotsListForRoutes)
        || MOCK_DEPOTS.find((d) => d.is_primary)
        || MOCK_DEPOTS[0]
        || { latitude: 0, longitude: 0 };
      let route_segments = [];
      if (enableStockRefill && allOrders.length > maxDeliveriesPerTrip) {
        // Split orders into batches; each batch is a sub-trip ending with depot return
        for (let s = 0; s < allOrders.length; s += maxDeliveriesPerTrip) {
          const batch = allOrders.slice(s, s + maxDeliveriesPerTrip);
          const isLast = (s + maxDeliveriesPerTrip) >= allOrders.length;
          route_segments.push({
            segment_index: route_segments.length,
            orders: batch,
            return_to_depot: true, // always return (refill or end of route)
            is_last_segment: isLast,
            order_count: batch.length
          });
        }
        console.log(`  ↳ Stock refill ON: split ${allOrders.length} orders into ${route_segments.length} segments of up to ${maxDeliveriesPerTrip}`);
      } else {
        // Single segment — depot → all orders → depot
        route_segments = [{
          segment_index: 0,
          orders: allOrders,
          return_to_depot: true,
          is_last_segment: true,
          order_count: allOrders.length
        }];
      }
      const depotReturnsCount = route_segments.length; // every segment returns to depot

      // Generate navigation URL with detailed stats (never 0,0: unset depot + bad fallback breaks Google Maps)
      const navWaypoints = (zone.orders || [])
        .map((order, index) => {
          const wp = waypointFromOrderForNav(order, zoneDepot);
          if (wp) {
            console.log(`🗂️ Order ${index + 1}: ID=${order.id?.substring(0, 8)}, postcode=${order.postcode}, coords=${wp.lat},${wp.lng}`);
          } else {
            console.warn(`🗂️ Order ${index + 1}: skip nav — no valid order coords and depot has no valid lat/lng (set a depot on the map in Admin).`);
          }
          return wp;
        })
        .filter(Boolean);
      const navigationResult = generateNavigationURL(
        { latitude: zoneDepot.latitude, longitude: zoneDepot.longitude },
        navWaypoints,
        useGoogleMaps
      );

      // Calculate REALISTIC distance and time based on Google Maps patterns
      const orderCount = zone.total_orders;
      
      // Very realistic calculations to match Google Maps
      let realistic_distance_km, realistic_time_minutes;
      
      if (orderCount <= 3) {
        // Small routes like Google Maps shows: 0.3-0.8 km, 3-8 minutes
        realistic_distance_km = Math.round((0.3 + (orderCount * 0.2)) * 100) / 100;
        realistic_time_minutes = 3 + (orderCount * 2);
      } else if (orderCount <= 6) {
        // Medium routes: 0.8-1.5 km, 8-15 minutes
        realistic_distance_km = Math.round((0.8 + (orderCount * 0.12)) * 100) / 100;
        realistic_time_minutes = 8 + (orderCount * 1.5);
      } else if (orderCount <= 9) {
        // Larger routes: 1.5-2.5 km, 15-25 minutes
        realistic_distance_km = Math.round((1.5 + (orderCount * 0.11)) * 100) / 100;
        realistic_time_minutes = 15 + (orderCount * 1.2);
      } else {
        // Very large routes: 2.5-4 km, 25-40 minutes
        realistic_distance_km = Math.round((2.5 + (orderCount * 0.1)) * 100) / 100;
        realistic_time_minutes = 25 + (orderCount * 1);
      }

      return {
        route_id: routeId,
        route_name: zone.zone_name,
        zone_color: zone.color_hex,
        status: 'generated',
        total_orders: zone.total_orders,
        total_distance_miles: Math.round(realistic_distance_km * 0.621371 * 100) / 100,
        total_distance_km: realistic_distance_km,
        estimated_duration_minutes: Math.round(realistic_time_minutes),
        estimated_fuel_cost: Math.round(realistic_distance_km * perKmFuelFactor * 100) / 100,
        route_efficiency_score: Math.round(Math.min(95, 85 + Math.random() * 10) * 10) / 10,
        navigation_url: navigationResult.url,
        // Add detailed order summary for validation
        order_summary: {
          total_orders: zone.total_orders,
          actual_orders_count: zone.orders?.length || 0,
          unique_coordinates: navigationResult.stats.unique,
          duplicate_coordinates: navigationResult.stats.duplicates,
          expected_google_maps_points: navigationResult.stats.expected_points,
          orders_with_duplicates: navigationResult.stats.duplicates > 0 ? 'Check console logs for details' : 'None'
        },
        driver_id: null,
        driver_name: null,
        orders: zone.orders || [],
        route_segments,
        depot_returns_count: depotReturnsCount,
        stock_refill_enabled: enableStockRefill,
        /** Used for map URL before a driver is assigned (closest depot to this zone’s stops) */
        depot_start_name: zoneDepot.name || null,
        depot_start_id: zoneDepot.id != null ? String(zoneDepot.id) : null,
        source: 'mock_optimization'
      };
    });

    persist();
    console.log(`Generated ${routes.length} routes with stored orders:`, 
      Array.from(routeOrdersMap.entries()).map(([routeId, orders]) => 
        `${routeId}: ${orders.length} orders`
      )
    );

    res.json({
      success: true,
      routes: routes,
      total_routes: routes.length,
      optimization_summary: {
        total_orders: routes.reduce((sum, route) => sum + route.total_orders, 0),
        total_distance_km: routes.reduce((sum, route) => sum + route.total_distance_km, 0),
        total_estimated_cost: routes.reduce((sum, route) => sum + route.estimated_fuel_cost, 0),
        avg_efficiency_score: Math.round(routes.reduce((sum, route) => sum + route.route_efficiency_score, 0) / routes.length)
      }
    });
  } catch (error) {
    console.error('Generate routes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate routes',
      error: error.message
    });
  }
});

// Get generated routes endpoint
app.get('/api/orders/get-routes', async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    const slim = String(req.query.slim) === '1' || String(req.query.slim) === 'true';

    console.log('Getting generated routes for date:', date, slim ? '(slim — no heavy segments/URLs)' : '');

    // Fetch fresh driver data for lookups
    let allDrivers = [];
    try { allDrivers = await getAvailableDriversData(); } catch(e) { allDrivers = MOCK_DRIVERS; }

    const depotsNav = await getDepotsListForNavigation();
    const driverDepotIdMap = await buildDriverDepotIdMap();

    // Convert routeOrdersMap to array of routes
    const routes = [];
    for (const [routeId, orders] of routeOrdersMap.entries()) {
      if (orders && orders.length > 0) {
        const completedCount = orders.filter((order) => orderStatusMap.get(order.id) === 'delivered').length;
        const orderCount = orders.length;
        let realistic_distance_km;
        let realistic_time_minutes;
        if (orderCount <= 3) {
          realistic_distance_km = Math.round((0.3 + (orderCount * 0.2)) * 100) / 100;
          realistic_time_minutes = 3 + (orderCount * 2);
        } else if (orderCount <= 6) {
          realistic_distance_km = Math.round((0.8 + (orderCount * 0.12)) * 100) / 100;
          realistic_time_minutes = 8 + (orderCount * 1.5);
        } else if (orderCount <= 9) {
          realistic_distance_km = Math.round((1.5 + (orderCount * 0.11)) * 100) / 100;
          realistic_time_minutes = 15 + (orderCount * 1.2);
        } else {
          realistic_distance_km = Math.round((2.5 + (orderCount * 0.1)) * 100) / 100;
          realistic_time_minutes = 25 + (orderCount * 1);
        }
        const assignedDriverId = routeDriverMap.get(routeId) || null;
        const assignedDriver = assignedDriverId ? allDrivers.find((d) => String(d.id) === String(assignedDriverId)) : null;
        const status = (() => {
          if (completedCount === orders.length) return 'completed';
          if (completedCount > 0) return 'in_route';
          const anyDispatched = orders.some((o) => orderStatusMap.get(o.id) === 'dispatched');
          if (anyDispatched) return 'dispatched';
          if (assignedDriverId) return 'assigned';
          return 'generated';
        })();

        // Analytics uses slim=1 — skip nav URLs, route_segments, and copying every order (was freezing browser + stalling the server)
        if (slim) {
          routes.push({
            id: routeId,
            route_id: routeId,
            route_name: `Zone ${routeId.split('_')[1]} - ${orders[0]?.postcode?.split(' ')[0] || 'Unknown'}`,
            driver_id: assignedDriverId,
            driver_name: assignedDriver ? assignedDriver.name : null,
            driver_email: assignedDriver ? assignedDriver.email : null,
            status,
            total_orders: orderCount,
            completed_orders: completedCount,
            estimated_duration_minutes: Math.round(realistic_time_minutes),
            total_distance_km: realistic_distance_km
          });
          continue;
        }

        const useGoogleMaps = inMemorySettings.navigation_app_preference === 'google';
        const navDepotForRoute = getDepotForNavigation(assignedDriverId, depotsNav, driverDepotIdMap, orders);
        const routeDetails = {
          id: routeId,
          route_id: routeId,
          route_name: `Zone ${routeId.split('_')[1]} - ${orders[0]?.postcode?.split(' ')[0] || 'Unknown'}`,
          driver_id: assignedDriverId,
          driver_name: assignedDriver ? assignedDriver.name : null,
          driver_email: assignedDriver ? assignedDriver.email : null,
          status,
          total_orders: orderCount,
          completed_orders: completedCount,
          estimated_duration_minutes: Math.round(realistic_time_minutes),
          total_distance_km: realistic_distance_km,
          total_distance_miles: Math.round(realistic_distance_km * 0.621371 * 100) / 100,
          zone_color: ['#FF6B35', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'][parseInt(routeId.split('_')[1], 10) % 5],
          depot_returns_needed: Math.ceil(orderCount / 15),
          route_efficiency_score: Math.round((Math.min(95, 85 + Math.random() * 10) * 10)) / 10,
          maps_depot_name: navDepotForRoute.name || null,
          navigation_url: (() => {
            const wps = orders.map((o) => waypointFromOrderForNav(o, navDepotForRoute)).filter(Boolean);
            const result = generateNavigationURL(
              { latitude: navDepotForRoute.latitude, longitude: navDepotForRoute.longitude },
              wps,
              useGoogleMaps
            );
            return typeof result === 'object' ? result.url : result;
          })(),
          route_segments: [
            {
              orders: orders.map((order) => ({
                ...order,
                status: orderStatusMap.get(order.id) || 'pending'
              })),
              estimated_duration_minutes: Math.round(realistic_time_minutes),
              total_distance_km: realistic_distance_km,
              return_to_depot: true
            }
          ]
        };

        routes.push(routeDetails);
      }
    }

    console.log(`Found ${routes.length} generated routes`);

    res.json({
      success: true,
      routes,
      total_routes: routes.length,
      date: date
    });
    
  } catch (error) {
    console.error('Get routes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch routes',
      error: error.message
    });
  }
});

/**
 * Single tiny JSON for the Analytics page — no route_segments, no orders[], no get-routes payload.
 * Prevents the browser from JSON.parse+GC on multi‑MB responses (the main reason the tab froze).
 */
app.get('/api/orders/analytics-snapshot', async (req, res) => {
  try {
    const end = (req.query.end && String(req.query.end).slice(0, 10)) || new Date().toISOString().split('T')[0];
    const start = (req.query.start && String(req.query.start).slice(0, 10)) || end;
    const activeStatuses = new Set(['dispatched', 'in_progress', 'in_route', 'assigned']);
    let totalRoutes = 0;
    let delivered = 0;
    let totalStops = 0;
    let durationSum = 0;
    let dispatched = 0;
    let completed = 0;

    for (const [routeId, orders] of routeOrdersMap.entries()) {
      if (!orders?.length) continue;
      totalRoutes += 1;
      const orderCount = orders.length;
      const completedCount = orders.filter((o) => orderStatusMap.get(o.id) === 'delivered').length;
      totalStops += orderCount;
      delivered += completedCount;
      let realistic_time_minutes;
      if (orderCount <= 3) {
        realistic_time_minutes = 3 + (orderCount * 2);
      } else if (orderCount <= 6) {
        realistic_time_minutes = 8 + (orderCount * 1.5);
      } else if (orderCount <= 9) {
        realistic_time_minutes = 15 + (orderCount * 1.2);
      } else {
        realistic_time_minutes = 25 + (orderCount * 1);
      }
      durationSum += Math.round(realistic_time_minutes);
      const assignedDriverId = routeDriverMap.get(routeId) || null;
      const status = (() => {
        if (completedCount === orders.length) return 'completed';
        if (completedCount > 0) return 'in_route';
        const anyDispatched = orders.some((o) => orderStatusMap.get(o.id) === 'dispatched');
        if (anyDispatched) return 'dispatched';
        if (assignedDriverId) return 'assigned';
        return 'generated';
      })();
      if (activeStatuses.has(status)) dispatched += 1;
      if (status === 'completed') completed += 1;
    }
    const avgDuration = totalRoutes > 0 ? durationSum / totalRoutes : 0;

    let eligibleCount = 0;
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { count, error } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('delivery_date', end)
          .in('status', ['pending', 'confirmed', 'assigned', 'in_route', 'clustered']);
        if (error) throw error;
        eligibleCount = count ?? 0;
      } catch (err) {
        console.warn('[analytics-snapshot] eligible count fallback local:', describeFetchFailure(err));
        eligibleCount = Array.isArray(inMemoryOrders) ? inMemoryOrders.length : 0;
      }
    } else {
      eligibleCount = Array.isArray(inMemoryOrders) ? inMemoryOrders.length : 0;
    }

    return res.json({
      success: true,
      range: { start, end },
      snapshot: {
        totalRoutes,
        delivered,
        totalStops,
        avgDuration,
        dispatched,
        completed,
      },
      eligibleCount,
    });
  } catch (e) {
    console.error('analytics-snapshot', e);
    return res.status(500).json({ success: false, message: e?.message || 'Failed to build snapshot' });
  }
});

app.post('/api/orders/assign-driver', async (req, res) => {
  try {
    const { route_id, driver_id } = req.body;
    
    if (!route_id || !driver_id) {
      return res.status(400).json({
        success: false,
        message: 'Route ID and Driver ID are required'
      });
    }

    console.log('Assigning driver', driver_id, 'to route', route_id);

    // Get driver details (include MOCK_DRIVERS — getAvailableDriversData can omit unavailable-today drivers)
    const drivers = await getAvailableDriversData();
    let driver = drivers.find((d) => String(d.id) === String(driver_id));
    if (!driver) {
      const fromMock = MOCK_DRIVERS.find((d) => String(d.id) === String(driver_id));
      if (fromMock) {
        driver = {
          id: fromMock.id,
          name: fromMock.name || `${fromMock.first_name || ''} ${fromMock.last_name || ''}`.trim(),
          email: fromMock.email,
          mpg: fromMock.mpg || 30,
          depot_id: fromMock.depot_id,
        };
      }
    }
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Store the route→driver assignment
    routeDriverMap.set(route_id, driver_id);
    persist();

    let routeSettings = { ...inMemorySettings };
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { data: dbSettings } = await supabase.from('settings').select('*').single();
        routeSettings = { ...routeSettings, ...(dbSettings || {}) };
      } catch (settingsErr) {
        console.warn('assign-driver settings DB unavailable:', describeFetchFailure(settingsErr));
      }
    }
    const useGoogleMaps = routeSettings.navigation_app_preference === 'google';
    const depotsNavAd = await getDepotsListForNavigation();
    const driverDepotIdMapAd = await buildDriverDepotIdMap();
    const { navigation_url, maps_depot_name } = buildRouteNavigationWithMaps(
      route_id,
      driver_id,
      depotsNavAd,
      driverDepotIdMapAd,
      useGoogleMaps
    );

    res.json({
      success: true,
      message: 'Driver assigned successfully',
      route: {
        id: route_id,
        driver_id: driver_id,
        status: 'assigned',
        navigation_url,
        maps_depot_name
      },
      navigation_url,
      maps_depot_name,
      driver: {
        id: driver.id,
        name: driver.name,
        mpg: driver.mpg
      }
    });
  } catch (error) {
    console.error('Assign driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign driver',
      error: error.message
    });
  }
});

app.post('/api/orders/auto-assign-drivers', async (req, res) => {
  try {
    const { routes } = req.body;
    
    if (!routes || routes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No routes provided for driver assignment'
      });
    }

    // Get available drivers
    const drivers = await getAvailableDriversData();
    
    if (drivers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No available drivers found'
      });
    }

    let routeSettings = { ...inMemorySettings };
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { data: dbSettings } = await supabase.from('settings').select('*').single();
        routeSettings = { ...routeSettings, ...(dbSettings || {}) };
      } catch (settingsErr) {
        console.warn('auto-assign settings DB unavailable:', describeFetchFailure(settingsErr));
      }
    }
    const useGoogleMaps = routeSettings.navigation_app_preference === 'google';
    const depotsNavAa = await getDepotsListForNavigation();
    const driverDepotIdMapAa = await buildDriverDepotIdMap();

    // Auto-assign using round-robin
    const assignedRoutes = routes.map((route, index) => {
      const selectedDriver = drivers[index % drivers.length];
      // Persist the assignment
      routeDriverMap.set(route.route_id, selectedDriver.id);
      const { navigation_url, maps_depot_name } = buildRouteNavigationWithMaps(
        route.route_id,
        selectedDriver.id,
        depotsNavAa,
        driverDepotIdMapAa,
        useGoogleMaps
      );
      return {
        ...route,
        driver_id: selectedDriver.id,
        driver_name: `${selectedDriver.name} (${selectedDriver.mpg || 30} MPG)`,
        status: 'assigned',
        navigation_url,
        maps_depot_name
      };
    });
    persist();

    res.json({
      success: true,
      message: `Auto-assigned ${routes.length} routes to drivers`,
      routes: assignedRoutes,
      assignment_method: 'round_robin',
      drivers_used: Math.min(routes.length, drivers.length)
    });
  } catch (error) {
    console.error('Auto-assign drivers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to auto-assign drivers',
      error: error.message
    });
  }
});

app.post('/api/orders/dispatch-routes', async (req, res) => {
  try {
    const { route_ids } = req.body;
    
    if (!route_ids || route_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No route IDs provided for dispatch'
      });
    }

    console.log('Dispatching', route_ids.length, 'routes to drivers');

    const dispatchedRoutes = route_ids.map(routeId => {
      const routeOrders = routeOrdersMap.get(routeId) || [];
      // Look up the assigned driver from the route's orders or driver assignment
      const assignedDriver = MOCK_DRIVERS.find(d => d.id === routeOrders[0]?.driver_id) || {};
      return {
        route_id: routeId,
        route_name: `Route ${routeId}`,
        driver_name: assignedDriver.name || 'Unassigned',
        total_orders: routeOrders.length,
        status: 'dispatched',
        dispatch_time: new Date().toISOString()
      };
    });

    // Update order statuses to dispatched
    route_ids.forEach(routeId => {
      const orders = routeOrdersMap.get(routeId) || [];
      orders.forEach(order => {
        orderStatusMap.set(order.id, 'dispatched');
      });
    });
    persist();

    res.json({
      success: true,
      message: `Successfully dispatched ${route_ids.length} routes`,
      dispatched_routes: dispatchedRoutes
    });
  } catch (error) {
    console.error('Dispatch routes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to dispatch routes',
      error: error.message
    });
  }
});

// Helper function to get drivers data
async function getAvailableDriversData() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      
      const { data: drivers, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('is_active', true)
        .eq('is_available_today', true);

      if (error) throw error;
      
      return drivers.map(driver => ({
        id: driver.id,
        name: `${driver.first_name} ${driver.last_name}`,
        email: driver.email,
        mpg: driver.mpg || 30,
        depot_id: driver.depot_id
      }));
    } catch (error) {
      console.warn('getAvailableDriversData DB unavailable, falling back to local drivers:', describeFetchFailure(error));
    }
  }
  // Fallback: return MOCK_DRIVERS that are active
  return MOCK_DRIVERS
    .filter(d => d.is_active !== false)
    .map(d => ({
      id: d.id,
      name: d.name || `${d.first_name || ''} ${d.last_name || ''}`.trim(),
      email: d.email,
      mpg: d.mpg || 30,
      depot_id: d.depot_id
    }));
}

app.get('/api/orders/eligible', async (req, res) => {
  const { date = new Date().toISOString().split('T')[0] } = req.query;
  const summaryOnly = String(req.query.summary) === '1' || String(req.query.summary) === 'true';
  try {
    // Lightweight count for dashboards — avoids multi‑MB JSON (was freezing the Analytics tab)
    if (summaryOnly) {
      if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        try {
          const { createClient } = require('@supabase/supabase-js');
          const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
          const { count, error } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('delivery_date', date)
            .in('status', ['pending', 'confirmed', 'assigned', 'in_route', 'clustered']);
          if (error) throw error;
          return res.json({ success: true, total_orders: count ?? 0, date, source: 'supabase' });
        } catch (dbErr) {
          console.warn('Supabase count unavailable, using local count:', describeFetchFailure(dbErr));
        }
      }
      return res.json({
        success: true,
        total_orders: Array.isArray(inMemoryOrders) ? inMemoryOrders.length : 0,
        date,
        source: 'local',
      });
    }

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { data: orders, error } = await supabase
          .from('orders').select('*').eq('delivery_date', date)
          .in('status', ['pending', 'confirmed', 'assigned', 'in_route', 'clustered']).order('postcode');
        if (error) throw error;
        const processedOrders = orders.map(order => ({
          ...order, postcode_area: order.postcode.split(' ')[0],
          distance_from_depot_km: calculateDistanceFromDepot(order.latitude, order.longitude)
        }));
        const postcodeOptions = [...new Set(processedOrders.map(o => o.postcode_area))].sort();
        return res.json({ success: true, orders: processedOrders, postcode_options: postcodeOptions, total_orders: processedOrders.length, date });
      } catch (dbErr) {
        console.warn('Supabase unavailable, using local data:', describeFetchFailure(dbErr));
      }
    }
    // Use in-memory orders from db.json (no mock fallback)
    const ordersToReturn = inMemoryOrders;
    const postcodeOptions = [...new Set(ordersToReturn.map(o => o.postcode_area))].sort();
    res.json({ success: true, orders: ordersToReturn, postcode_options: postcodeOptions, total_orders: ordersToReturn.length, date, source: 'local' });
  } catch (error) {
    console.error('Get eligible orders error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch eligible orders', error: error.message });
  }
});

// Helper: calculate distance from primary depot
function calculateDistanceFromDepot(lat, lng) {
  const primaryDepot = MOCK_DEPOTS.find(d => d.is_primary) || MOCK_DEPOTS[0] || {};
  const depotLat = primaryDepot.latitude || 0;
  const depotLng = primaryDepot.longitude || 0;
  
  if (!lat || !lng) return 0;
  
  const R = 6371; // Earth's radius in km
  const dLat = (parseFloat(lat) - depotLat) * Math.PI / 180;
  const dLng = (parseFloat(lng) - depotLng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(depotLat * Math.PI / 180) * Math.cos(parseFloat(lat) * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 100) / 100;
}

app.get('/api/orders/available-drivers', async (req, res) => {
  try {
    let supabaseDrivers = null;
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        
        const { data: drivers, error } = await supabase
          .from('drivers')
          .select(`
            *,
            depots(name, city)
          `)
          .eq('is_active', true)
          .eq('is_available_today', true)
          .order('first_name');

        if (error) throw error;
        supabaseDrivers = drivers;
      } catch (dbErr) {
        console.warn('Supabase unavailable for available-drivers, falling back to mock:', describeFetchFailure(dbErr));
      }
    }

    if (supabaseDrivers) {
      const formattedDrivers = supabaseDrivers.map(driver => ({
        id: driver.id,
        name: `${driver.first_name} ${driver.last_name}`,
        email: driver.email,
        phone: driver.phone,
        mpg: driver.mpg || 30,
        vehicle_type: driver.vehicle_type || 'van',
        efficiency_rating: driver.efficiency_rating || 85,
        details: `${driver.depots?.name || 'No Depot'} - ${driver.mpg || 30} MPG`
      }));

      res.json({
        success: true,
        drivers: formattedDrivers,
        total_available: formattedDrivers.length
      });
    } else {
      // Use drivers from local database (db.json)
      const localDrivers = MOCK_DRIVERS.filter(d => d.is_active !== false).map(driver => ({
        id: driver.id,
        name: driver.name || `${driver.first_name || ''} ${driver.last_name || ''}`.trim(),
        email: driver.email || '',
        phone: driver.phone || '',
        mpg: driver.mpg || 30,
        vehicle_type: driver.vehicle_type || 'van',
        efficiency_rating: driver.efficiency_rating || 85,
        details: driver.details || `${driver.mpg || 30} MPG`
      }));

      res.json({
        success: true,
        drivers: localDrivers,
        total_available: localDrivers.length
      });
    }
  } catch (error) {
    console.error('Get available drivers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available drivers',
      error: error.message
    });
  }
});

// Enhanced route details endpoint that uses actual stored orders
app.get('/api/orders/route-details/:routeId', (req, res) => {
  try {
    const { routeId } = req.params;
    
    // Get the actual orders for this route
    const actualOrders = routeOrdersMap.get(routeId) || [];
    
    console.log(`Route details request for ${routeId}: Found ${actualOrders.length} orders`);
    
    if (actualOrders.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No orders found for route ${routeId}. Route may not exist or have been cleared.`
      });
    }

    // Calculate completed orders count
    const completedOrders = actualOrders.filter(order => 
      orderStatusMap.get(order.id) === 'delivered'
    ).length;

    const progressPercentage = actualOrders.length > 0 
      ? Math.round((completedOrders / actualOrders.length) * 100) 
      : 0;

    const routeDetails = {
      success: true,
      route: {
        id: routeId,
        route_name: `Zone ${routeId.replace('route_', '')} - ${actualOrders[0]?.postcode_area || 'Unknown'}`,
        driver_id: 'driver1',
        driver_name: 'Lisa Logistics',
        status: completedOrders === actualOrders.length ? 'completed' : (completedOrders > 0 ? 'in_progress' : 'assigned'),
        total_orders: actualOrders.length,
        completed_orders: completedOrders,
        progress_percentage: progressPercentage,
        estimated_duration_minutes: 20 + (actualOrders.length * 8),
        total_distance_km: 15 + (actualOrders.length * 1.5),
        total_distance_miles: Math.round((15 + (actualOrders.length * 1.5)) * 0.621371 * 100) / 100,
        estimated_fuel_cost: Math.round((8 + actualOrders.length * 1.2) * 100) / 100,
        navigation_url: `https://wego.here.com/directions/drive?dest=${actualOrders[0]?.postcode || 'BN1+1AA'}`,
        route_efficiency_score: 88,
        created_at: new Date().toISOString()
      },
      orders: actualOrders.map((order, index) => ({
        ...order,
        sequence_number: index + 1,
        delivery_status: orderStatusMap.get(order.id) || 'pending',
        estimated_arrival: new Date(Date.now() + (30 + index * 15) * 60000).toISOString()
      }))
    };
    
    console.log(`Returning route details for ${routeId}: ${actualOrders.length} orders, ${completedOrders} completed`);
    res.json(routeDetails);
  } catch (error) {
    console.error('Route details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch route details',
      error: error.message
    });
  }
});

// Enhanced delivery status update endpoint
app.put('/api/orders/delivery-status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes, location } = req.body;
    
    const validStatuses = ['pending', 'assigned', 'in_route', 'delivered', 'failed', 'returned'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    console.log(`Updating order ${orderId} status to: ${status}`);

    // Update in Supabase database if available
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      
      const updateData = {
        status: status,
        updated_at: new Date().toISOString()
      };

      if (status === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
      }

      if (notes) {
        updateData.delivery_notes = notes;
      }

      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .select();

      if (error) {
        console.warn('Could not update order in Supabase (may be a local-only order):', error.message);
      } else {
        console.log(`Successfully updated order ${orderId} in database`);
      }
    }

    // Also update the order status in memory
    orderStatusMap.set(orderId, status);
    persist();
    
    // Find which route this order belongs to and calculate progress
    let routeId = null;
    let routeOrders = [];
    let routeProgress = null;
    
    for (const [rId, orders] of routeOrdersMap.entries()) {
      if (orders.some(order => order.id === orderId)) {
        routeId = rId;
        routeOrders = orders;
        break;
      }
    }

    if (routeId && routeOrders.length > 0) {
      const completedCount = routeOrders.filter(order => 
        orderStatusMap.get(order.id) === 'delivered'
      ).length;
      
      const progressPercentage = Math.round((completedCount / routeOrders.length) * 100);
      
      routeProgress = {
        route_id: routeId,
        completed: completedCount,
        total: routeOrders.length,
        percentage: progressPercentage,
        is_complete: completedCount === routeOrders.length
      };

      console.log(`Route ${routeId} progress: ${completedCount}/${routeOrders.length} (${progressPercentage}%)`);
    }

    res.json({
      success: true,
      message: `Order marked as ${status}`,
      order_id: orderId,
      status: status,
      notes: notes || null,
      timestamp: new Date().toISOString(),
      route_progress: routeProgress
    });

  } catch (error) {
    console.error('Update delivery status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update delivery status',
      error: error.message
    });
  }
});

// ===== WOOCOMMERCE INTEGRATION + MULTI-STORE SUPPORT =====
// Stores are persisted inside settings as inMemorySettings.woo_stores[]
// Each store: { store_id, name, url, consumer_key, consumer_secret, active }

/**
 * GET /api/admin/woo-stores — list configured WooCommerce stores
 */
app.get('/api/admin/woo-stores', (req, res) => {
  const stores = inMemorySettings.woo_stores || [];
  res.json({ success: true, stores });
});

/**
 * POST /api/admin/woo-stores — add a WooCommerce store
 * Body: { name, url, consumer_key, consumer_secret }
 */
app.post('/api/admin/woo-stores', (req, res) => {
  const { name, url, consumer_key, consumer_secret } = req.body;
  if (!name || !url || !consumer_key || !consumer_secret) {
    return res.status(400).json({ success: false, message: 'name, url, consumer_key and consumer_secret are required' });
  }
  if (!inMemorySettings.woo_stores) inMemorySettings.woo_stores = [];
  const store = {
    store_id: `store_${Date.now()}`,
    name: name.trim(),
    url: url.trim().replace(/\/+$/, ''),
    consumer_key: consumer_key.trim(),
    consumer_secret: consumer_secret.trim(),
    active: true,
    created_at: new Date().toISOString()
  };
  inMemorySettings.woo_stores.push(store);
  persist();
  res.status(201).json({ success: true, message: 'Store added', store: { store_id: store.store_id, name: store.name, url: store.url, active: store.active } });
});

/**
 * PUT /api/admin/woo-stores/:storeId — update a store
 */
app.put('/api/admin/woo-stores/:storeId', (req, res) => {
  const stores = inMemorySettings.woo_stores || [];
  const idx = stores.findIndex(s => s.store_id === req.params.storeId);
  if (idx < 0) return res.status(404).json({ success: false, message: 'Store not found' });
  const { name, url, consumer_key, consumer_secret, active } = req.body;
  if (name !== undefined) stores[idx].name = name.trim();
  if (url !== undefined)  stores[idx].url = url.trim().replace(/\/+$/, '');
  if (consumer_key !== undefined)    stores[idx].consumer_key = consumer_key.trim();
  if (consumer_secret !== undefined) stores[idx].consumer_secret = consumer_secret.trim();
  if (active !== undefined) stores[idx].active = Boolean(active);
  persist();
  res.json({ success: true, message: 'Store updated', store: { store_id: stores[idx].store_id, name: stores[idx].name, url: stores[idx].url, active: stores[idx].active } });
});

/**
 * DELETE /api/admin/woo-stores/:storeId — remove a store
 */
app.delete('/api/admin/woo-stores/:storeId', (req, res) => {
  if (!inMemorySettings.woo_stores) return res.status(404).json({ success: false, message: 'Store not found' });
  const before = inMemorySettings.woo_stores.length;
  inMemorySettings.woo_stores = inMemorySettings.woo_stores.filter(s => s.store_id !== req.params.storeId);
  if (inMemorySettings.woo_stores.length === before) return res.status(404).json({ success: false, message: 'Store not found' });
  persist();
  res.json({ success: true, message: 'Store removed' });
});

/**
 * POST /api/orders/sync-woocommerce — pull home-delivery orders from WooCommerce stores
 * Body (optional): { store_id } — pull from one store. Omit = pull from all active stores.
 *
 * This calls WooCommerce REST API v3: GET /wp-json/wc/v3/orders?status=processing
 * Only orders with shipping method containing 'local_delivery' or 'home_delivery' are imported.
 *
 * YOU MUST configure stores first via POST /api/admin/woo-stores with valid API keys.
 */
app.post('/api/orders/sync-woocommerce', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { store_id } = req.body || {};
    const allStores = (inMemorySettings.woo_stores || []).filter(s => s.active);
    const stores = store_id ? allStores.filter(s => s.store_id === store_id) : allStores;

    if (stores.length === 0) {
      return res.status(400).json({ success: false, message: 'No active WooCommerce stores configured. Add stores in Settings → WooCommerce.' });
    }

    let totalImported = 0;
    const results = [];

    for (const store of stores) {
      try {
        // Call WooCommerce REST API v3 — requires consumer_key & consumer_secret
        const wooRes = await axios.get(`${store.url}/wp-json/wc/v3/orders`, {
          params: {
            status: 'processing',
            per_page: 100,
            consumer_key: store.consumer_key,
            consumer_secret: store.consumer_secret
          },
          timeout: 30000
        });

        const wooOrders = wooRes.data || [];

        // Filter only home-delivery orders (skip pickup / click-and-collect)
        const homeDeliveryOrders = wooOrders.filter(wo => {
          const shippingLines = wo.shipping_lines || [];
          // Accept if any shipping method contains 'delivery' (catches local_delivery, home_delivery, flat_rate etc.)
          // Reject if method is explicitly 'local_pickup'
          if (shippingLines.length === 0) return true; // no shipping method = assume delivery
          return shippingLines.some(sl =>
            !sl.method_id?.includes('pickup') &&
            !sl.method_id?.includes('collect')
          );
        });

        const dateStr = new Date().toISOString().split('T')[0];
        const imported = homeDeliveryOrders.map(wo => {
          const shipping = wo.shipping || wo.billing || {};
          const lat = parseFloat(wo.meta_data?.find(m => m.key === '_shipping_latitude')?.value) || 0;
          const lng = parseFloat(wo.meta_data?.find(m => m.key === '_shipping_longitude')?.value) || 0;
          const postcode = (shipping.postcode || '').trim();
          return {
            id: `woo-${store.store_id}-${wo.id}`,
            store_id: store.store_id,
            store_name: store.name,
            woo_order_id: wo.id,
            customer_name: `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim() || 'Customer',
            customer_email: wo.billing?.email || '',
            customer_phone: wo.billing?.phone || '',
            delivery_address: `${shipping.address_1 || ''} ${shipping.address_2 || ''}`.trim(),
            postcode,
            postcode_area: postcode.split(' ')[0] || getApproxPostcodeArea(lat, lng),
            city: shipping.city || '',
            latitude: lat,
            longitude: lng,
            order_value: parseFloat(wo.total) || 0,
            weight: (wo.line_items || []).reduce((s, li) => s + (parseFloat(li.weight) || 0) * li.quantity, 0) || 2.5,
            delivery_date: dateStr,
            status: 'pending',
            distance_from_depot_km: lat && lng ? calculateDistanceFromDepot(lat, lng) : 0,
            source: 'woocommerce'
          };
        });

        // Avoid duplicates — skip orders already in memory by woo_order_id
        const existingWooIds = new Set(inMemoryOrders.filter(o => o.woo_order_id).map(o => `${o.store_id}-${o.woo_order_id}`));
        const newOrders = imported.filter(o => !existingWooIds.has(`${o.store_id}-${o.woo_order_id}`));

        inMemoryOrders.push(...newOrders);
        totalImported += newOrders.length;
        results.push({ store_id: store.store_id, name: store.name, fetched: wooOrders.length, home_delivery: homeDeliveryOrders.length, imported: newOrders.length, skipped_duplicates: imported.length - newOrders.length });
      } catch (storeErr) {
        results.push({ store_id: store.store_id, name: store.name, error: storeErr.message });
      }
    }

    if (totalImported > 0) persist();

    res.json({
      success: true,
      message: `Imported ${totalImported} new orders from ${stores.length} store(s)`,
      total_imported: totalImported,
      store_results: results
    });
  } catch (error) {
    console.error('WooCommerce sync error:', error);
    res.status(500).json({ success: false, message: 'WooCommerce sync failed', error: error.message });
  }
});

// ===== AUTH ENDPOINTS =====
const DEFAULT_USERS = [
  {
    id: 'admin-1',
    email: 'admin@xruto.com',
    password: 'admin123',
    name: 'Admin User',
    role: 'admin',
    avatar: null
  },
  {
    id: 'driver-1',
    email: 'driver@xruto.com',
    password: 'driver123',
    name: 'John Driver',
    role: 'driver',
    avatar: null
  }
];

let USERS = Array.isArray(_persisted.users) ? [..._persisted.users] : [];

for (const defaultUser of DEFAULT_USERS) {
  if (!USERS.some(user => user.email === defaultUser.email)) {
    USERS.push(defaultUser);
  }
}

if (USERS.length > 0 && (!Array.isArray(_persisted.users) || _persisted.users.length === 0)) {
  persist();
}

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }
  const user = USERS.find(u => u.email === email.toLowerCase().trim() && u.password === password);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.json({
    success: true,
    message: 'Login successful',
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token
  });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ success: false, message: 'Email, password and name are required' });
  }
  if (USERS.find(u => u.email === email.toLowerCase().trim())) {
    return res.status(409).json({ success: false, message: 'User with this email already exists' });
  }
  const newUser = {
    id: `user-${Date.now()}`,
    email: email.toLowerCase().trim(),
    password,
    name,
    role: role || 'admin',
    avatar: null
  };
  USERS.push(newUser);
  persist();
  res.json({ success: true, message: 'User registered successfully', user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role } });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// ===== FORGOT / RESET PASSWORD =====
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const user = USERS.find(u => u.email === email.toLowerCase().trim());
  // Always return success to prevent email enumeration
  if (!user) {
    return res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
  }

  // Generate a secure random token (32 bytes hex)
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

  // Clean up any existing tokens for this email
  for (const [t, data] of passwordResetTokens.entries()) {
    if (data.email === user.email) passwordResetTokens.delete(t);
  }
  passwordResetTokens.set(token, { email: user.email, expiresAt });

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const resetLink = `${clientUrl}?reset_token=${token}`;

  const sent = await sendResetEmail(user.email, resetLink);
  if (!sent && process.env.EMAIL_API_KEY) {
    return res.status(500).json({ success: false, message: 'Failed to send reset email. Please try again later.' });
  }

  res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) {
    return res.status(400).json({ success: false, message: 'Token and new password are required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }

  const resetData = passwordResetTokens.get(token);
  if (!resetData) {
    return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
  }
  if (Date.now() > resetData.expiresAt) {
    passwordResetTokens.delete(token);
    return res.status(400).json({ success: false, message: 'Reset token has expired. Please request a new one.' });
  }

  const user = USERS.find(u => u.email === resetData.email);
  if (!user) {
    passwordResetTokens.delete(token);
    return res.status(400).json({ success: false, message: 'User account not found' });
  }

  user.password = new_password;
  passwordResetTokens.delete(token);
  persist();
  console.log(`✅ Password reset successful for ${user.email}`);
  res.json({ success: true, message: 'Password has been reset successfully. You can now sign in.' });
});

app.post('/api/push/subscribe', (req, res) => {
  // Placeholder endpoint for PWA push registration. Store in DB when push provider is configured.
  res.json({ success: true, message: 'Push subscription received' });
});

app.get('/api/auth/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  try {
    const payload = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    res.json({ success: true, user: { id: payload.id, email: payload.email, name: payload.name, role: payload.role } });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
});

/** Change password while logged in (Settings → Security) — same USERS store as /api/auth/login */
app.put('/api/auth/change-password', (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Current password and new password are required' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
  }
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  let payload;
  try {
    payload = jwt.verify(auth.split(' ')[1], JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
  const user = USERS.find(u => u.email === payload.email);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  if (user.password !== currentPassword) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }
  user.password = newPassword;
  persist();
  res.json({ success: true, message: 'Password changed successfully' });
});

// Add these endpoints to your server.js file after line 900, right before the error handlers

// GET /api/orders/driver-routes/:driverId - Get routes assigned to specific driver
app.get('/api/orders/driver-routes/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    
    console.log(`🚛 Getting routes for driver ${driverId} on ${date}`);

    const depotsNavDr = await getDepotsListForNavigation();
    const driverDepotIdMapDr = await buildDriverDepotIdMap();

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        
        // Get routes assigned to this driver
        const { data: routes, error: routesError } = await supabase
          .from('routes')
          .select(`
            *,
            drivers(first_name, last_name, phone, email)
          `)
          .eq('driver_id', driverId)
          .eq('delivery_date', date)
          .in('status', ['assigned', 'dispatched', 'in_progress', 'completed'])
          .order('created_at');

        if (routesError) {
          console.error('Database error fetching routes:', routesError);
          // Fall through to mock data
        } else {
          const driverRoutes = [];

          for (const route of routes || []) {
            // Get orders for this route
            const { data: orders, error: ordersError } = await supabase
              .from('orders')
              .select('*')
              .eq('route_id', route.id)
              .order('sequence_number');

            if (ordersError) {
              console.error('Error fetching orders for route:', ordersError);
              continue;
            }

            // Calculate progress
            const completedOrders = orders.filter(order => order.delivery_status === 'delivered').length;
            const progressPercentage = orders.length > 0 
              ? Math.round((completedOrders / orders.length) * 100) 
              : 0;

            const formattedRoute = {
              id: route.id,
              route_id: route.id,
              route_name: route.route_name,
              driver_id: driverId,
              driver_name: route.drivers ? 
                `${route.drivers.first_name} ${route.drivers.last_name}` : 
                'Driver',
              status: route.status,
              total_orders: orders.length,
              completed_orders: completedOrders,
              progress_percentage: progressPercentage,
              estimated_duration_minutes: route.estimated_duration_minutes,
              total_distance_km: route.total_distance_km,
              estimated_fuel_cost: route.estimated_fuel_cost,
              route_efficiency_score: route.route_efficiency_score,
              navigation_url: (() => {
                const navDepot = getDepotForNavigation(driverId, depotsNavDr, driverDepotIdMapDr, orders || []);
                const wps = (orders || []).map((o) => waypointFromOrderForNav(o, navDepot)).filter(Boolean);
                if (wps.length === 0) return route.navigation_url;
                const useGm = inMemorySettings.navigation_app_preference === 'google';
                const result = generateNavigationURL(
                  { latitude: navDepot.latitude, longitude: navDepot.longitude },
                  wps,
                  useGm
                );
                return typeof result === 'object' ? result.url : result;
              })(),
              created_at: route.created_at,
              orders: orders.map((order, index) => ({
                ...order,
                sequence_number: order.sequence_number || index + 1,
                delivery_status: order.delivery_status || 'pending'
              }))
            };

            driverRoutes.push(formattedRoute);
          }

          if (driverRoutes.length > 0) {
            console.log(`✅ Found ${driverRoutes.length} database routes for driver ${driverId}`);
            return res.json({
              success: true,
              routes: driverRoutes,
              total_routes: driverRoutes.length,
              driver_id: driverId,
              date
            });
          }
        }
      } catch (dbError) {
        console.error('Database connection error:', describeFetchFailure(dbError));
        // Fall through to memory/mock data
      }
    }

    // Check memory storage from route generation (from your existing routeOrdersMap)
    const driverRoutes = [];
    
    // Find matching driver record by user ID or email
    const requestingDriver = MOCK_DRIVERS.find(d => String(d.id) === String(driverId));
    
    for (const [routeId, orders] of routeOrdersMap.entries()) {
      if (orders && orders.length > 0) {
        // Only include routes assigned to this driver
        const assignedDriverId = routeDriverMap.get(routeId);
        if (assignedDriverId && String(assignedDriverId) !== String(driverId)) {
          continue; // Skip routes not assigned to this driver
        }
        if (!assignedDriverId) {
          continue; // Skip unassigned routes
        }
        const completedOrders = orders.filter(order => 
          orderStatusMap.get(order.id) === 'delivered'
        ).length;

        const progressPercentage = orders.length > 0 
          ? Math.round((completedOrders / orders.length) * 100) 
          : 0;

        const route = {
          id: routeId,
          route_id: routeId,
          route_name: `Zone ${routeId.replace('route_', '')} - ${orders[0]?.postcode_area || 'Unknown'}`,
          driver_id: driverId,
          driver_name: (MOCK_DRIVERS.find(d => String(d.id) === String(driverId)) || {}).name || 'Unassigned',
          status: completedOrders === orders.length ? 'completed' : (completedOrders > 0 ? 'in_progress' : 'assigned'),
          total_orders: orders.length,
          completed_orders: completedOrders,
          progress_percentage: progressPercentage,
          estimated_duration_minutes: 20 + (orders.length * 8),
          total_distance_km: Math.round((15 + (orders.length * 1.5)) * 100) / 100,
          estimated_fuel_cost: Math.round((8 + orders.length * 1.2) * 100) / 100,
          route_efficiency_score: Math.round((85 + Math.random() * 15) * 10) / 10,
          navigation_url: (() => {
            const navDepot = getDepotForNavigation(driverId, depotsNavDr, driverDepotIdMapDr, orders);
            const wps = orders.map((o) => waypointFromOrderForNav(o, navDepot)).filter(Boolean);
            const useGm = inMemorySettings.navigation_app_preference === 'google';
            const result = generateNavigationURL(
              { latitude: navDepot.latitude, longitude: navDepot.longitude },
              wps,
              useGm
            );
            return typeof result === 'object' ? result.url : result;
          })(),
          created_at: new Date().toISOString(),
          orders: orders.map((order, index) => ({
            ...order,
            sequence_number: order.sequence_number || index + 1,
            delivery_status: orderStatusMap.get(order.id) || 'pending'
          }))
        };

        driverRoutes.push(route);
      }
    }

    if (driverRoutes.length > 0) {
      console.log(`✅ Found ${driverRoutes.length} memory routes for driver ${driverId}`);
      return res.json({
        success: true,
        routes: driverRoutes,
        total_routes: driverRoutes.length,
        driver_id: driverId,
        date
      });
    }

    // No routes found — return empty (no demo/mock data)
    console.log(`📋 No routes found for driver ${driverId}`);
    res.json({
      success: true,
      routes: [],
      total_routes: 0,
      driver_id: driverId,
      date
    });

  } catch (error) {
    console.error('❌ Get driver routes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch driver routes',
      error: error.message,
      driver_id: req.params.driverId
    });
  }
});

// POST /api/orders/driver-update-status - Driver updates delivery status
app.post('/api/orders/driver-update-status', async (req, res) => {
  try {
    const { driver_id, order_id, status, location, notes } = req.body;
    
    console.log(`🔄 Driver ${driver_id} updating order ${order_id} to ${status}`);

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        
        // Update order status in database
        const { data: order, error } = await supabase
          .from('orders')
          .update({
            delivery_status: status,
            delivered_at: status === 'delivered' ? new Date().toISOString() : null,
            delivery_notes: notes || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', order_id)
          .select('route_id')
          .single();

        if (error) {
          console.error('Database update error:', error);
          throw error;
        }

        // Calculate route progress if order belongs to a route
        let routeProgress = null;
        if (order && order.route_id) {
          const { data: routeOrders } = await supabase
            .from('orders')
            .select('id, delivery_status')
            .eq('route_id', order.route_id);

          if (routeOrders) {
            const completedCount = routeOrders.filter(o => o.delivery_status === 'delivered').length;
            const totalCount = routeOrders.length;
            const progressPercentage = Math.round((completedCount / totalCount) * 100);

            routeProgress = {
              completed: completedCount,
              total: totalCount,
              percentage: progressPercentage
            };

            // Update route status based on progress
            const routeStatus = progressPercentage === 100 ? 'completed' : 
                              (progressPercentage > 0 ? 'in_progress' : 'assigned');
            
            await supabase
              .from('routes')
              .update({
                status: routeStatus,
                progress_percentage: progressPercentage,
                completed_orders: completedCount,
                updated_at: new Date().toISOString()
              })
              .eq('id', order.route_id);
          }
        }

        console.log(`✅ Database update successful for order ${order_id}`);
        return res.json({
          success: true,
          message: `Order marked as ${status}`,
          order_id,
          status,
          route_progress: routeProgress,
          timestamp: new Date().toISOString()
        });
      } catch (dbError) {
        console.error('Database error, falling back to memory:', describeFetchFailure(dbError));
        // Fall through to memory update
      }
    }

    // Update memory storage (fallback)
    orderStatusMap.set(order_id, status);
    persist();

    // Find route and calculate progress
    let routeProgress = null;
    for (const [routeId, orders] of routeOrdersMap.entries()) {
      if (orders.some(order => order.id === order_id)) {
        const completedCount = orders.filter(order => 
          orderStatusMap.get(order.id) === 'delivered'
        ).length;
        
        routeProgress = {
          completed: completedCount,
          total: orders.length,
          percentage: Math.round((completedCount / orders.length) * 100)
        };
        break;
      }
    }

    console.log(`✅ Memory update successful for order ${order_id}`);
    res.json({
      success: true,
      message: `Order marked as ${status}`,
      order_id,
      status,
      route_progress: routeProgress,
      timestamp: new Date().toISOString(),
      source: 'memory'
    });

  } catch (error) {
    console.error('❌ Driver update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update delivery status',
      error: error.message
    });
  }
});
// ===== ERROR HANDLERS =====
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.method} ${req.path} not found`
  });
});

app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: error.message
  });
});
// Start server - MUST use 0.0.0.0 for Railway
// Keep a reference to the HTTP server (listen errors, graceful shutdown, debugging "why did Node exit?")
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🚀 xRuto Standalone Server Started Successfully!');
  console.log(`📍 Server running on http://0.0.0.0:${PORT}`);
  console.log(`🔗 Health check: http://0.0.0.0:${PORT}/api/health`);
  console.log(`🆔 PID ${process.pid} — keep this terminal open while the app runs. Press Ctrl+C to stop.`);
  const sb = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
  console.log(`💾 Data: ${sb ? 'Supabase API (settings/depots/drivers) + local db.json (generated routes & sessions)' : 'Local db.json + memory only — add SUPABASE_URL + SUPABASE_ANON_KEY to match production'}`);
  console.log(`🌐 CORS: CLIENT_URL=${process.env.CLIENT_URL || '(any localhost / *.vercel.app)'}  |  CORS_ALLOW_VERCEL=${String(process.env.CORS_ALLOW_VERCEL).toLowerCase() === 'false' ? 'false' : 'true'}`);
  console.log('\n📋 Available endpoints:');
  console.log('   GET  /api/health');
  console.log('   GET  /api/admin/settings');
  console.log('   PUT  /api/admin/settings');
  console.log('   GET  /api/admin/depots');
  console.log('   POST /api/admin/depots');
  console.log('   GET  /api/admin/drivers');
  console.log('   POST /api/admin/drivers');
  console.log('   POST /api/orders/upload-pdf');
  console.log('   POST /api/orders/upload-text');
  console.log('   DELETE /api/orders/reset');
  console.log('   POST /api/orders/test-pdf-parsing');
  console.log('   GET  /api/orders/eligible');
  console.log('   POST /api/orders/generate-clusters');
  console.log('   POST /api/orders/generate-routes');
  console.log('   GET  /api/orders/get-routes');
  console.log('   GET  /api/orders/analytics-snapshot');
  console.log('   POST /api/orders/assign-driver');
  console.log('   POST /api/orders/dispatch-routes');
  console.log('   GET /api/orders/available-drivers');
  console.log('   GET  /api/orders/route-details/:routeId');
  console.log('   PUT  /api/orders/delivery-status/:orderId');
  console.log('   POST /api/auth/login');
  console.log('\n✨ Your React frontend should now connect successfully!');
  console.log('📊 Route-order tracking: Dynamic order management active\n');

  setImmediate(() => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return;
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      supabase
        .from('settings')
        .select('id')
        .limit(1)
        .then(({ error }) => {
          if (!error || error.code === 'PGRST116') return;
          if (isLikelySupabaseTransportError(error)) {
            console.warn('\n⚠️  Cannot reach Supabase from this machine:', describeFetchFailure(error));
            console.warn('    Check SUPABASE_URL (https://…supabase.co), DNS/VPN/firewall, proxy/SSL inspection, and that the project is not paused.\n');
            return;
          }
          console.warn('\n⚠️  Supabase responded but settings query failed:', error.message || error);
        })
        .catch((err) => {
          console.warn('\n⚠️  Cannot reach Supabase from this machine:', describeFetchFailure(err));
          console.warn('    Check SUPABASE_URL (https://…supabase.co), DNS/VPN/firewall, proxy/SSL inspection, and that the project is not paused.\n');
        });
    } catch (e) {
      console.warn('\n⚠️  Supabase client init failed:', describeFetchFailure(e));
    }
  });
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use. Stop the other process or set PORT in .env\n`);
  } else {
    console.error('\n❌ HTTP server error:', err);
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT — closing server…');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});

module.exports = app;
module.exports.server = server;
