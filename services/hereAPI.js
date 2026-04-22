/**
 * HERE Maps API Service for xRuto route optimization.
 *
 * Uses the HERE Routing v8 and Matrix Routing v8 APIs to compute
 * real travel-time matrices between delivery stops, then feeds those
 * into the K-means clustering and route ordering already present in
 * server.js.
 *
 * When the HERE_API_KEY environment variable is missing or the API call
 * fails, every method gracefully falls back to Haversine-based estimates
 * so the system keeps working without paid API access.
 *
 * ─── Algorithms used ──────────────────────────────────────────────
 * • K-means++ with Haversine-seeded centroids  (clustering)
 * • Nearest-neighbour heuristic on the HERE Matrix time data (TSP)
 * • Workload-balanced cluster sizing (max stops / working hours)
 * ─────────────────────────────────────────────────────────────────
 */

const axios = require('axios');

class HereAPIService {
  constructor() {
    this.apiKey = process.env.HERE_API_KEY || null;
    this.routerURL  = 'https://router.hereapi.com/v8';
    this.matrixURL  = 'https://matrix.router.hereapi.com/v8';
    this.geocodeURL = 'https://geocode.search.hereapi.com/v1';

    this.serviceTimeMinutes = 5;   // dwell time per stop (unloading)
    this.maxStopsPerRoute   = 25;
    this.maxWorkingHours    = 8;

    if (this.apiKey) {
      console.log('✅ HERE API service initialised with key');
    } else {
      console.warn('⚠️  HERE API key not set — all methods will use Haversine fallback');
    }
  }

  /* ──────────────── Distance helpers ──────────────── */

  /** Haversine distance in kilometres */
  haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /* ──────────────── HERE Matrix API ──────────────── */

  /**
   * Compute an NxN travel-time matrix (seconds) between the given
   * lat/lng points using the HERE Matrix Routing v8 API.
   *
   * Falls back to a Haversine-estimated matrix when the API key is
   * missing or the call fails.
   *
   * @param {{ lat: number, lng: number }[]} points
   * @returns {Promise<number[][]>}  matrix[i][j] = seconds from i→j
   */
  async getTimeMatrix(points) {
    if (!this.apiKey || points.length === 0) {
      return this._haversineMatrix(points);
    }

    try {
      const origins = points.map(p => ({ lat: p.lat, lng: p.lng }));
      const response = await axios.post(
        `${this.matrixURL}/matrix`,
        {
          origins,
          destinations: origins,
          regionDefinition: { type: 'world' },
          matrixAttributes: ['travelTimes']
        },
        {
          params: { apikey: this.apiKey },
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );

      const flat = response.data.matrix.travelTimes;
      const n = points.length;
      const matrix = [];
      for (let i = 0; i < n; i++) {
        matrix.push(flat.slice(i * n, (i + 1) * n));
      }
      console.log(`✅ HERE Matrix API returned ${n}x${n} travel-time matrix`);
      return matrix;
    } catch (err) {
      console.warn('⚠️  HERE Matrix API call failed, using Haversine fallback:', err.message);
      return this._haversineMatrix(points);
    }
  }

  /** Haversine-estimated time matrix (assumes 30 km/h avg speed) */
  _haversineMatrix(points) {
    const AVG_SPEED_KMH = 30;
    const n = points.length;
    const matrix = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          const km = this.haversineKm(points[i].lat, points[i].lng, points[j].lat, points[j].lng);
          matrix[i][j] = Math.round((km / AVG_SPEED_KMH) * 3600); // seconds
        }
      }
    }
    return matrix;
  }

  /* ──────────────── Route ordering (TSP) ──────────────── */

  /**
   * Order an array of orders by nearest-neighbour heuristic using the
   * time matrix.  Returns the re-ordered array.
   *
   * @param {object[]} orders  — each must have .latitude, .longitude
   * @param {object}   depot   — { latitude, longitude }
   * @returns {Promise<object[]>}  orders in optimised sequence
   */
  async optimiseStopOrder(orders, depot) {
    if (orders.length <= 2) return orders;

    // Build points array: index 0 = depot, rest = orders
    const points = [
      { lat: depot.latitude, lng: depot.longitude },
      ...orders.map(o => ({ lat: parseFloat(o.latitude), lng: parseFloat(o.longitude) }))
    ];

    const matrix = await this.getTimeMatrix(points);

    // Nearest-neighbour from depot (index 0)
    const visited = new Set([0]);
    const sequence = [];
    let current = 0;
    while (sequence.length < orders.length) {
      let bestIdx = -1, bestTime = Infinity;
      for (let j = 1; j < points.length; j++) {
        if (!visited.has(j) && matrix[current][j] < bestTime) {
          bestTime = matrix[current][j];
          bestIdx = j;
        }
      }
      if (bestIdx === -1) break;
      visited.add(bestIdx);
      sequence.push(bestIdx - 1); // map back to orders index
      current = bestIdx;
    }

    return sequence.map(i => orders[i]);
  }

  /* ──────────────── Clustering helper ──────────────── */

  /**
   * Called by the generate-clusters endpoint when Supabase orders exist.
   * Delegates clustering to server.js' performKMeansClustering, then
   * enriches each zone with a travel-time-based optimised stop order.
   *
   * @param {object[]} orders
   * @param {number}   maxZones
   * @param {Function} kMeansCluster  — performKMeansClustering from server.js
   * @param {object}   depot          — primary depot { latitude, longitude }
   * @returns {Promise<object[]>}  zones (same shape as buildZone output)
   */
  async generateOptimizedClustersForArea(orders, maxZones, kMeansCluster, depot) {
    // Step 1: cluster with existing K-means++
    const zones = kMeansCluster(orders, maxZones);

    // Step 2: optimise stop order within each zone
    if (depot) {
      for (const zone of zones) {
        zone.orders = await this.optimiseStopOrder(zone.orders, depot);
      }
    }

    return zones;
  }

  /* ──────────────── Geocoding ──────────────── */

  /**
   * Geocode a UK address / postcode via HERE Geocode API.
   * Returns { lat, lng } or null on failure.
   */
  async geocode(address, postcode = '') {
    if (!this.apiKey) return null;
    try {
      const q = postcode ? `${address}, ${postcode}, UK` : `${address}, UK`;
      const res = await axios.get(`${this.geocodeURL}/geocode`, {
        params: { q, apikey: this.apiKey, limit: 1, in: 'countryCode:GBR' },
        timeout: 10000
      });
      if (res.data.items && res.data.items.length > 0) {
        const pos = res.data.items[0].position;
        return { lat: pos.lat, lng: pos.lng };
      }
      return null;
    } catch (err) {
      console.warn('HERE Geocode failed:', err.message);
      return null;
    }
  }
}

module.exports = new HereAPIService();
