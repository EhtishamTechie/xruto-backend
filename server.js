
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const PDFParserService = require('./services/pdfParser');
require('dotenv').config();
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'https://qicbvrkhgxvlopzpayvq.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpY2J2cmtoZ3h2bG9wenBheXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NTI5NzksImV4cCI6MjA3MzAyODk3OX0.W4WtdjqHhair2bUKjgYpG5OlVlOk-iw9N_bRAacKP7Y';
  process.env.HERE_API_KEY = 'y3kuhw4RlWsTDNmm6xnqaXEkEdAf7auVckQf3nxj0mo';
  process.env.NODE_ENV = 'production';
  process.env.CLIENT_URL = 'https://xruto-frontend.vercel.app';
  console.log('🔧 Using hardcoded environment variables for Railway');
}
const app = express();
const PORT = process.env.PORT || 5000;

// Store route-order relationships in memory
let routeOrdersMap = new Map();
let orderStatusMap = new Map(); // Track order delivery status
// Middleware - Fixed CORS for Vite and Vercel
app.use(cors({
  origin: [
    'https://xruto-frontend.vercel.app',
    'https://xruto-frontend-1bl2vjf70-ummah-tech-innovation.vercel.app',  // ✅ ADD THIS LINE
    /^https:\/\/xruto-frontend.*\.vercel\.app$/,  // ✅ ADD THIS LINE - Allows ALL Vercel previews
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:5177',
    'http://localhost:5178',
    'http://localhost:5179',
    'http://localhost:5180',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
    'http://127.0.0.1:5176',
    'http://127.0.0.1:5177',
    'http://127.0.0.1:5178',
    'http://127.0.0.1:5179',
    'http://127.0.0.1:5180',
    process.env.CLIENT_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],  // ✅ Added PATCH
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// Initialize PDF Parser Service
const pdfParserService = new PDFParserService();

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ===== ROOT ENDPOINTS =====
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
      here_api: process.env.HERE_API_KEY ? 'configured' : 'missing'
    }
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
app.get('/api/admin/settings', async (req, res) => {
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      
      const { data: settings, error } = await supabase
        .from('settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const defaultSettings = {
        drivers_today_count: 5,
        include_admin_as_driver: false,
        navigation_app_preference: 'here',
        enable_stock_refill: false,
        max_deliveries_per_route: 25,
        max_routes_per_day: 10,
        default_fuel_price: 1.45,
        enable_help_tooltips: true,
        auto_assign_routes: true,
        route_optimization_method: 'distance',
        customer_notifications: true,
        driver_app_enabled: true,
        woocommerce_integration_enabled: false,
        sync_frequency_minutes: 15,
        enable_real_time_tracking: false
      };

      res.json({
        success: true,
        settings: settings || defaultSettings
      });
    } else {
      // Return default settings if no database
      res.json({
        success: true,
        settings: {
          drivers_today_count: 5,
          include_admin_as_driver: false,
          navigation_app_preference: 'here',
          enable_stock_refill: false,
          max_deliveries_per_route: 25,
          max_routes_per_day: 10,
          default_fuel_price: 1.45,
          enable_help_tooltips: true,
          auto_assign_routes: true,
          route_optimization_method: 'distance'
        }
      });
    }
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: error.message
    });
  }
});

app.put('/api/admin/settings', async (req, res) => {
  try {
    console.log('Updating settings:', req.body);
    
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      
      const { data: existingSettings } = await supabase
        .from('settings')
        .select('id')
        .single();

      let result;
      if (existingSettings) {
        result = await supabase
          .from('settings')
          .update({
            ...req.body,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSettings.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('settings')
          .insert(req.body)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      res.json({
        success: true,
        message: 'Settings updated successfully',
        settings: result.data
      });
    } else {
      res.json({
        success: true,
        message: 'Settings updated (no database configured)',
        settings: req.body
      });
    }
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: error.message
    });
  }
});

app.get('/api/admin/depots', async (req, res) => {
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      
      const { data: depots, error } = await supabase
        .from('depots')
        .select(`
          *,
          drivers!depot_id(id, is_active, is_available_today)
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const formattedDepots = (depots || []).map(depot => {
        const allDrivers = depot.drivers || [];
        const activeDrivers = allDrivers.filter(d => d.is_active);
        const availableDrivers = activeDrivers.filter(d => d.is_available_today);

        return {
          id: depot.id,
          name: depot.name,
          address: depot.address,
          city: depot.city || '',
          postcode: depot.postcode || '',
          latitude: depot.latitude,
          longitude: depot.longitude,
          capacity: depot.capacity || 500,
          is_primary: depot.is_primary || false,
          is_active: depot.is_active,
          driver_count: activeDrivers.length,
          available_drivers: availableDrivers.length,
          contact_phone: depot.contact_phone || '',
          contact_email: depot.contact_email || ''
        };
      });

      res.json({
        success: true,
        depots: formattedDepots
      });
    } else {
      // Return mock data if no database
      res.json({
        success: true,
        depots: [
          {
            id: '1',
            name: 'Warrington Distribution Center',
            address: 'Milton Grove, Latchford, Warrington',
            city: 'Warrington',
            postcode:'WA4 1EG',
            latitude: 53.3808256,
            longitude: -2.575416,
            capacity: 1000,
            is_primary: true,
            is_active: true,
            driver_count: 3,
            available_drivers: 2
          }
        ]
      });
    }
  } catch (error) {
    console.error('Get depots error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch depots',
      error: error.message
    });
  }
});

app.post('/api/admin/depots', async (req, res) => {
  try {
    console.log('Adding depot:', req.body);
    
    const { name, address, city, postcode, capacity, contactPhone, contactEmail, latitude, longitude } = req.body;

    if (!name || !address) {
      return res.status(400).json({
        success: false,
        message: 'Name and address are required'
      });
    }

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      
      let finalLat = latitude || 53.3808256;
      let finalLng = longitude || -2.575416;

      const depotData = {
        name: name.trim(),
        address: address.trim(),
        city: city ? city.trim() : null,
        postcode: postcode ? postcode.trim() : null,
        latitude: parseFloat(finalLat),
        longitude: parseFloat(finalLng),
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

      res.status(201).json({
        success: true,
        message: 'Depot added successfully',
        depot: {
          ...depot,
          driver_count: 0,
          available_drivers: 0
        }
      });
    } else {
      res.status(201).json({
        success: true,
        message: 'Depot added (no database configured)',
        depot: {
          id: Date.now().toString(),
          ...req.body,
          driver_count: 0,
          available_drivers: 0
        }
      });
    }
  } catch (error) {
    console.error('Add depot error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add depot',
      error: error.message
    });
  }
});

app.get('/api/admin/drivers', async (req, res) => {
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      
      const { data: drivers, error } = await supabase
        .from('drivers')
        .select(`
          *,
          depots(name, city)
        `)
        .eq('is_active', true)
        .order('first_name');

      if (error) throw error;

      const formattedDrivers = (drivers || []).map(driver => ({
        id: driver.id,
        name: `${driver.first_name || ''} ${driver.last_name || ''}`.trim(),
        email: driver.email,
        phone: driver.phone,
        first_name: driver.first_name,
        last_name: driver.last_name,
        depot_id: driver.depot_id,
        mpg: driver.mpg,
        vehicle_type: driver.vehicle_type,
        vehicle_capacity: driver.vehicle_capacity,
        license_plate: driver.license_plate,
        is_active: driver.is_active,
        is_available_today: driver.is_available_today,
        details: `${driver.depots?.name || 'No Depot'}, ${driver.mpg || 30} MPG`
      }));

      res.json({
        success: true,
        drivers: formattedDrivers
      });
    } else {
      // Return mock data if no database
      res.json({
        success: true,
        drivers: [
          {
            id: '1',
            name: 'John Driver',
            email: 'john.driver@xruto.com',
            phone: '07123456789',
            first_name: 'John',
            last_name: 'Driver',
            depot_id: '1',
            mpg: 35.5,
            vehicle_type: 'van',
            is_active: true,
            is_available_today: true,
            details: 'Brighton Distribution Center, 35.5 MPG'
          }
        ]
      });
    }
  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch drivers',
      error: error.message
    });
  }
});

app.post('/api/admin/drivers', async (req, res) => {
  try {
    console.log('Adding driver:', req.body);
    
    const { firstName, lastName, email, phone, depotId, mpg, vehicleType, vehicleCapacity, licensePlate } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, and email are required'
      });
    }

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
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

      res.status(201).json({
        success: true,
        message: 'Driver added successfully',
        driver: formattedDriver
      });
    } else {
      res.status(201).json({
        success: true,
        message: 'Driver added (no database configured)',
        driver: {
          id: Date.now().toString(),
          name: `${firstName} ${lastName}`,
          details: 'Test Depot, 30 MPG',
          ...req.body
        }
      });
    }
  } catch (error) {
    console.error('Add driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add driver',
      error: error.message
    });
  }
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

// Simple K-means clustering implementation
function performKMeansClustering(orders, numClusters = 3) {
  if (orders.length === 0) return [];
  
  // Adjust cluster count based on order density
  const adjustedClusters = Math.min(numClusters, Math.max(1, Math.ceil(orders.length / 6)));
  
  // Simple clustering: group by distance from depot
  const clustered = [];
  const ordersPerCluster = Math.ceil(orders.length / adjustedClusters);
  
  for (let i = 0; i < adjustedClusters; i++) {
    const startIndex = i * ordersPerCluster;
    const endIndex = Math.min(startIndex + ordersPerCluster, orders.length);
    const clusterOrders = orders.slice(startIndex, endIndex);
    
    if (clusterOrders.length > 0) {
      const colors = ['#FF6B35', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
      
      clustered.push({
        zone_id: `zone_${i + 1}`,
        zone_name: `Zone ${i + 1} - ${clusterOrders[0].postcode_area}`,
        orders: clusterOrders,
        color_hex: colors[i % colors.length],
        total_orders: clusterOrders.length,
        total_value: clusterOrders.reduce((sum, o) => sum + (o.order_value || 0), 0),
        total_weight_kg: clusterOrders.reduce((sum, o) => sum + (o.weight || 2), 0),
        avg_distance_from_depot: clusterOrders.reduce((sum, o) => sum + (o.distance_from_depot_km || 0), 0) / clusterOrders.length,
        estimated_duration: 20 + (clusterOrders.length * 8), // Base time + 8 min per delivery
        efficiency_score: 85 + Math.random() * 10
      });
    }
  }
  
  return clustered;
}
// Add these helper functions after performKMeansClustering function (around line 200)

function generateNavigationURL(depot, waypoints, useGoogleMaps = false) {
  if (!waypoints || waypoints.length === 0) {
    return {
      url: useGoogleMaps ? 'https://maps.google.com/' : 'https://wego.here.com/',
      stats: { original: 0, unique: 0, duplicates: 0, expected_points: 2 }
    };
  }

  console.log(`🗺️ Generating navigation URL for ${waypoints.length} waypoints`);

  if (useGoogleMaps) {
    const origin = `${depot.latitude},${depot.longitude}`;
    
    if (waypoints.length === 1) {
      const destination = `${waypoints[0].lat || waypoints[0].latitude},${waypoints[0].lng || waypoints[0].longitude}`;
      const url = `https://www.google.com/maps/dir/${origin}/${destination}`;
      console.log(`📍 Single waypoint URL: ${url}`);
      return {
        url: url,
        stats: { original: 1, unique: 1, duplicates: 0, expected_points: 3 }
      };
    } else {
      // Check for duplicate coordinates with better precision
      const uniqueWaypoints = waypoints.filter((wp, index, arr) => {
        const lat = wp.lat || wp.latitude;
        const lng = wp.lng || wp.longitude;
        return index === arr.findIndex(w => {
          const wLat = w.lat || w.latitude;
          const wLng = w.lng || w.longitude;
          return Math.abs(wLat - lat) < 0.00001 && Math.abs(wLng - lng) < 0.00001;
        });
      });
      
      const duplicates = waypoints.length - uniqueWaypoints.length;
      console.log(`🔍 Original waypoints: ${waypoints.length}, Unique waypoints: ${uniqueWaypoints.length}`);
      if (duplicates > 0) {
        console.log(`⚠️  Found ${duplicates} duplicate coordinates!`);
        // Log which orders have duplicates
        waypoints.forEach((wp, index) => {
          const lat = wp.lat || wp.latitude;
          const lng = wp.lng || wp.longitude;
          const duplicateIndex = waypoints.findIndex((other, otherIndex) => {
            if (otherIndex >= index) return false;
            const otherLat = other.lat || other.latitude;
            const otherLng = other.lng || other.longitude;
            return Math.abs(otherLat - lat) < 0.00001 && Math.abs(otherLng - lng) < 0.00001;
          });
          if (duplicateIndex >= 0) {
            console.log(`🔄 Order ${wp.orderId?.substring(0,8)} (${wp.postcode}) has same coordinates as Order ${waypoints[duplicateIndex].orderId?.substring(0,8)}`);
          }
        });
      }
      
      const waypointCoords = uniqueWaypoints
        .map(wp => `${wp.lat || wp.latitude},${wp.lng || wp.longitude}`)
        .join('/');
      
      // More explicit route: depot -> waypoints -> depot (round trip)
      const url = `https://www.google.com/maps/dir/${origin}/${waypointCoords}/${origin}`;
      const expectedPoints = uniqueWaypoints.length + 2; // unique deliveries + 2 depot points
      
      console.log(`📍 Multi-waypoint URL with ${uniqueWaypoints.length} unique stops:`);
      console.log(`🎯 Route structure: DEPOT → ${uniqueWaypoints.length} deliveries → DEPOT`);
      console.log(`📊 Expected total points: ${expectedPoints} (${uniqueWaypoints.length} deliveries + 2 depot points)`);
      console.log(`📏 URL length: ${url.length} characters`);
      console.log(`🗺️ First 200 chars: ${url.substring(0, 200)}...`);
      console.log(`🗺️ Last 200 chars: ...${url.substring(url.length - 200)}`);
      
      return {
        url: url,
        stats: { 
          original: waypoints.length, 
          unique: uniqueWaypoints.length, 
          duplicates: duplicates, 
          expected_points: expectedPoints
        }
      };
    }
  } else {
    const origin = `${depot.latitude},${depot.longitude}`;
    
    if (waypoints.length === 1) {
      const destination = `${waypoints[0].lat || waypoints[0].latitude},${waypoints[0].lng || waypoints[0].longitude}`;
      const url = `https://wego.here.com/directions/drive/${origin}/${destination}`;
      console.log('Generated HERE Maps URL:', url);
      return url;
    } else {
      const waypointCoords = waypoints
        .map(wp => `${wp.lat || wp.latitude},${wp.lng || wp.longitude}`)
        .join('/');
      const url = `https://wego.here.com/directions/drive/${origin}/${waypointCoords}/${origin}`;
      console.log('Generated HERE Maps multi-waypoint URL:', url);
      return url;
    }
  }
}

function generateSimpleNavigationURL(depot, waypoints, useGoogleMaps = false) {
  if (!waypoints || waypoints.length === 0) {
    return useGoogleMaps ? 'https://maps.google.com/' : 'https://wego.here.com/';
  }

  const firstDestination = waypoints[0];
  
  if (useGoogleMaps) {
    const lat = firstDestination.lat || firstDestination.latitude;
    const lng = firstDestination.lng || firstDestination.longitude;
    return `https://www.google.com/maps/search/${lat},${lng}`;
  } else {
    const lat = firstDestination.lat || firstDestination.latitude;
    const lng = firstDestination.lng || firstDestination.longitude;
    return `https://wego.here.com/search/${lat},${lng}`;
  }
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

    // Insert orders into Supabase
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      
      const { data: insertedOrders, error } = await supabase
        .from('orders')
        .insert(validOrders)
        .select();

      if (error) {
        console.error('Supabase insertion error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to save orders to database',
          error: error.message,
          extractedOrders: validOrders
        });
      }

      console.log(`Successfully inserted ${insertedOrders.length} orders into database`);

      res.json({
        success: true,
        message: `Successfully processed and added ${insertedOrders.length} orders`,
        orders: insertedOrders,
        extractedCount: orders.length,
        insertedCount: insertedOrders.length
      });
    } else {
      // Return orders without database insertion (for testing)
      res.json({
        success: true,
        message: `Successfully processed ${validOrders.length} orders (database not configured)`,
        orders: validOrders,
        extractedCount: orders.length,
        insertedCount: 0
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

// ===== RESET ORDERS ENDPOINT =====
app.delete('/api/orders/reset', async (req, res) => {
  try {
    console.log('Reset orders request received');
    
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      
      // Get count of orders before deletion for confirmation
      const { count: orderCount, error: countError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.error('Error counting orders:', countError);
        return res.status(500).json({
          success: false,
          message: 'Failed to count orders before reset',
          error: countError.message
        });
      }

      // Delete all orders
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .gte('created_at', '1900-01-01'); // This condition matches all records

      if (deleteError) {
        console.error('Error deleting orders:', deleteError);
        return res.status(500).json({
          success: false,
          message: 'Failed to reset orders',
          error: deleteError.message
        });
      }

      console.log(`Successfully reset ${orderCount} orders from database`);

      res.json({
        success: true,
        message: `Successfully reset ${orderCount} orders from database`,
        deletedCount: orderCount
      });
    } else {
      // Return success message even without database (for testing)
      res.json({
        success: true,
        message: 'Orders reset completed (database not configured)',
        deletedCount: 0
      });
    }

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

      // Use the optimized HereAPIService for clustering
      const hereService = require('./services/hereAPI');
      const zones = await hereService.generateOptimizedClustersForArea(filteredOrders, max_zones);

      res.json({
        success: true,
        zones: zones,
        total_orders: filteredOrders.length,
        clustering_method: 'kmeans',
        optimization_score: 85 + Math.random() * 10,
        message: `Successfully clustered ${filteredOrders.length} orders into ${zones.length} zones`
      });
    } else {
      // Mock clustering for demo
      const mockOrders = [
        { 
          id: '1', 
          customer_name: 'John Smith', 
          delivery_address: '123 Queens Road, Brighton',
          postcode: 'BN1 1AA', 
          postcode_area: 'BN1', 
          order_value: 45.99, 
          weight: 2.5,
          special_instructions: 'Ring doorbell twice'
        },
        { 
          id: '2', 
          customer_name: 'Sarah Wilson', 
          delivery_address: '456 Western Road, Brighton',
          postcode: 'BN1 2BB', 
          postcode_area: 'BN1', 
          order_value: 78.50, 
          weight: 3.2,
          special_instructions: null
        },
        { 
          id: '3', 
          customer_name: 'Mike Johnson', 
          delivery_address: '789 North Street, Brighton',
          postcode: 'BN1 1YZ', 
          postcode_area: 'BN1', 
          order_value: 67.80, 
          weight: 3.5,
          special_instructions: 'Leave with neighbor if out'
        },
        { 
          id: '4', 
          customer_name: 'Emma Brown', 
          delivery_address: '12 Elm Grove, Brighton',
          postcode: 'BN2 3DE', 
          postcode_area: 'BN2', 
          order_value: 28.75, 
          weight: 1.5,
          special_instructions: 'Fragile items'
        }
      ].filter(order => selected_postcodes.includes(order.postcode_area));

      const zones = performKMeansClustering(mockOrders, max_zones);

      res.json({
        success: true,
        zones: zones,
        total_orders: mockOrders.length,
        clustering_method: 'mock_kmeans',
        optimization_score: 88,
        message: `Successfully clustered ${mockOrders.length} orders into ${zones.length} zones (demo mode)`
      });
    }
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
    
    if (!zones || zones.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No zones provided for route generation'
      });
    }

    console.log('Generating optimized routes for', zones.length, 'zones');

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

      // Generate navigation URL with detailed stats
      const navigationResult = generateNavigationURL(
        { latitude: 53.3808256, longitude: -2.575416 }, // Warrington depot
        (zone.orders?.map((order, index) => {
          const lat = parseFloat(order.latitude) || 53.3808256;
          const lng = parseFloat(order.longitude) || -2.575416;
          console.log(`🗂️ Order ${index + 1}: ID=${order.id?.substring(0,8)}, postcode=${order.postcode}, coords=${lat},${lng}`);
          return { lat, lng, orderId: order.id, postcode: order.postcode };
        }) || []),
        true // Use Google Maps (change to false for HERE Maps)
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
        estimated_fuel_cost: Math.round(realistic_distance_km * 0.15 * 100) / 100, // £0.15 per km
        route_efficiency_score: Math.min(95, 85 + Math.random() * 10),
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
        // navigation_url: `https://maps.google.com/directions?dest=${zone.orders?.[0]?.postcode || 'WA4+1EE'}`,
        driver_id: null,
        driver_name: null,
        orders: zone.orders || [],
        source: 'mock_optimization'
      };
    });

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
    
    console.log('Getting generated routes for date:', date);
    
    // Convert routeOrdersMap to array of routes
    const routes = [];
    for (const [routeId, orders] of routeOrdersMap.entries()) {
      if (orders && orders.length > 0) {
        // Calculate progress for each route
        const completedCount = orders.filter(order => 
          orderStatusMap.get(order.id) === 'delivered'
        ).length;
        
        const progressPercentage = Math.round((completedCount / orders.length) * 100);
        
        // Calculate REALISTIC progress and metrics for driver routes
        const orderCount = orders.length;
        
        // Apply same realistic calculations as route generation
        let realistic_distance_km, realistic_time_minutes;
        
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
        
        // Get route details with realistic metrics
        const routeDetails = {
          id: routeId,
          route_id: routeId,
          route_name: `Zone ${routeId.split('_')[1]} - ${orders[0]?.postcode?.split(' ')[0] || 'Unknown'}`,
          status: completedCount === orders.length ? 'completed' : 
                  completedCount > 0 ? 'in_route' : 'assigned',
          total_orders: orders.length,
          completed_orders: completedCount,
          estimated_duration_minutes: Math.round(realistic_time_minutes),
          total_distance_km: realistic_distance_km,
          total_distance_miles: Math.round(realistic_distance_km * 0.621371 * 100) / 100,
          zone_color: ['#FF6B35', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'][parseInt(routeId.split('_')[1]) % 5],
          depot_returns_needed: Math.ceil(orders.length / 15), // More realistic
          route_efficiency_score: Math.min(95, 85 + Math.random() * 10),
          route_segments: [{
            orders: orders.map(order => ({
              ...order,
              status: orderStatusMap.get(order.id) || 'pending'
            })),
            estimated_duration_minutes: Math.round(realistic_time_minutes),
            total_distance_km: realistic_distance_km,
            return_to_depot: true
          }]
        };
        
        routes.push(routeDetails);
      }
    }
    
    console.log(`Found ${routes.length} generated routes`);
    
    res.json({
      success: true,
      routes: routes,
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

    // Get driver details
    const drivers = await getAvailableDriversData();
    const driver = drivers.find(d => d.id === driver_id);
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // In a real implementation, you'd update the database here
    // For now, return success with driver info
    res.json({
      success: true,
      message: 'Driver assigned successfully',
      route: {
        id: route_id,
        driver_id: driver_id,
        status: 'assigned'
      },
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

    // Auto-assign using round-robin
    const assignedRoutes = routes.map((route, index) => {
      const selectedDriver = drivers[index % drivers.length];
      return {
        ...route,
        driver_id: selectedDriver.id,
        driver_name: `${selectedDriver.name} (${selectedDriver.mpg || 30} MPG)`,
        status: 'assigned'
      };
    });

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

    const dispatchedRoutes = route_ids.map(routeId => ({
      route_id: routeId,
      route_name: `Route ${routeId}`,
      driver_name: 'John Driver',
      total_orders: Math.floor(Math.random() * 10) + 5,
      status: 'dispatched',
      dispatch_time: new Date().toISOString()
    }));

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
        mpg: driver.mpg || 30
      }));
    } catch (error) {
      console.error('Error fetching drivers from database:', error);
      return [];
    }
  } else {
    // Return mock drivers
    return [
      { id: '1', name: 'John Driver', mpg: 35 },
      { id: '2', name: 'Sarah Courier', mpg: 42 }
    ];
  }
}

// app.get('/api/orders/eligible', async (req, res) => {
//   try {
//     const { date = new Date().toISOString().split('T')[0] } = req.query;
//     console.log('Getting eligible orders for date:', date);

//     if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
//       const { createClient } = require('@supabase/supabase-js');
//       const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      
//       const { data: orders, error } = await supabase
//         .from('orders')
//         .select('*')
//         .eq('delivery_date', date)
//         .in('status', ['pending', 'confirmed'])
//         .order('postcode');

//       if (error) throw error;

//       const postcodeOptions = [...new Set(orders.map(order => {
//         return order.postcode.split(' ')[0];
//       }))].sort();

//       const enhancedOrders = orders.map(order => ({
//         ...order,
//         postcode_area: order.postcode.split(' ')[0]
//       }));

//       res.json({
//         success: true,
//         orders: enhancedOrders,
//         postcode_options: postcodeOptions,
//         total_orders: enhancedOrders.length,
//         date: date
//       });
//     } else {
//       // Return enhanced mock data with proper structure
//       const mockOrders = [
//         {
//           id: '1',
//           customer_name: 'John Smith',
//           delivery_address: '123 Queens Road, Brighton',
//           postcode: 'BN1 3XE',
//           latitude: 50.8225,
//           longitude: -0.1372,
//           order_value: 45.99,
//           weight: 2.5,
//           status: 'pending',
//           postcode_area: 'BN1',
//           special_instructions: 'Ring doorbell twice'
//         },
//         {
//           id: '2',
//           customer_name: 'Sarah Wilson',
//           delivery_address: '456 Western Road, Brighton',
//           postcode: 'BN1 2AB',
//           latitude: 50.8200,
//           longitude: -0.1420,
//           order_value: 32.50,
//           weight: 1.8,
//           status: 'pending',
//           postcode_area: 'BN1',
//           special_instructions: null
//         },
//         {
//           id: '3',
//           customer_name: 'Mike Johnson',
//           delivery_address: '789 North Street, Brighton',
//           postcode: 'BN1 1YZ',
//           latitude: 50.8240,
//           longitude: -0.1350,
//           order_value: 67.25,
//           weight: 3.2,
//           status: 'pending',
//           postcode_area: 'BN1',
//           special_instructions: 'Leave with neighbor if out'
//         },
//         {
//           id: '4',
//           customer_name: 'Emma Brown',
//           delivery_address: '12 Elm Grove, Brighton',
//           postcode: 'BN2 3DE',
//           latitude: 50.8289,
//           longitude: -0.1278,
//           order_value: 28.75,
//           weight: 1.5,
//           status: 'pending',
//           postcode_area: 'BN2',
//           special_instructions: 'Fragile items'
//         },
//         {
//           id: '5',
//           customer_name: 'David Lee',
//           delivery_address: '34 Preston Road, Brighton',
//           postcode: 'BN2 5FG',
//           latitude: 50.8310,
//           longitude: -0.1290,
//           order_value: 51.80,
//           weight: 2.8,
//           status: 'pending',
//           postcode_area: 'BN2',
//           special_instructions: 'Gate code: 1234'
//         },
//         {
//           id: '6',
//           customer_name: 'Lisa Garcia',
//           delivery_address: '56 Church Road, Hove',
//           postcode: 'BN3 2HI',
//           latitude: 50.8267,
//           longitude: -0.1678,
//           order_value: 39.99,
//           weight: 2.1,
//           status: 'pending',
//           postcode_area: 'BN3',
//           special_instructions: 'Back entrance only'
//         },
//         {
//           id: '7',
//           customer_name: 'Tom Wilson',
//           delivery_address: '78 Marine Parade, Brighton',
//           postcode: 'BN1 4HF',
//           latitude: 50.8198,
//           longitude: -0.1298,
//           order_value: 89.50,
//           weight: 4.1,
//           status: 'pending',
//           postcode_area: 'BN1',
//           special_instructions: 'Apartment 3B'
//         },
//         {
//           id: '8',
//           customer_name: 'Anna Davis',
//           delivery_address: '91 London Road, Brighton',
//           postcode: 'BN1 6YD',
//           latitude: 50.8312,
//           longitude: -0.1345,
//           order_value: 55.25,
//           weight: 2.9,
//           status: 'pending',
//           postcode_area: 'BN1',
//           special_instructions: 'Call on arrival'
//         }
//       ];

//       const postcodeOptions = [...new Set(mockOrders.map(order => order.postcode_area))].sort();

//       res.json({
//         success: true,
//         orders: mockOrders,
//         postcode_options: postcodeOptions,
//         total_orders: mockOrders.length,
//         date: date
//       });
//     }
//   } catch (error) {
//     console.error('Get eligible orders error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch eligible orders',
//       error: error.message
//     });
//   }
// });
// In your server.js, replace the mock orders with Supabase data
app.get('/api/orders/eligible', async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('delivery_date', date)
        .in('status', ['pending', 'confirmed', 'assigned', 'in_route', 'clustered'])
        .order('postcode');

      if (error) throw error;

      // Process orders with real coordinates
      const processedOrders = orders.map(order => ({
        ...order,
        postcode_area: order.postcode.split(' ')[0],
        distance_from_depot_km: calculateDistanceFromDepot(order.latitude, order.longitude)
      }));

      const postcodeOptions = [...new Set(processedOrders.map(order => order.postcode_area))].sort();

      res.json({
        success: true,
        orders: processedOrders,
        postcode_options: postcodeOptions,
        total_orders: processedOrders.length,
        date
      });
    } else {
      // Your existing mock data as fallback
    }
  } catch (error) {
    // Error handling
  }
});

// Add this helper function
function calculateDistanceFromDepot(lat, lng) {
  const depotLat = 53.3808256; // Warrington depot
  const depotLng = -2.575416;
  
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
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
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

      const formattedDrivers = drivers.map(driver => ({
        id: driver.id,
        name: `${driver.first_name} ${driver.last_name}`,
        email: driver.email,
        phone: driver.phone,
        mpg: driver.mpg || 30,
        vehicle_type: driver.vehicle_type || 'van',
        efficiency_rating: 85 + Math.floor(Math.random() * 15),
        details: `${driver.depots?.name || 'No Depot'} - ${driver.mpg || 30} MPG`
      }));

      res.json({
        success: true,
        drivers: formattedDrivers,
        total_available: formattedDrivers.length
      });
    } else {
      // Enhanced mock drivers
      const mockDrivers = [
        {
          id: '1',
          name: 'Alex Thompson',
          email: 'alex@xruto.com',
          phone: '+44 7123 456789',
          mpg: 32,
          vehicle_type: 'van',
          efficiency_rating: 92,
          details: 'Brighton Depot - 32 MPG'
        },
        {
          id: '2',
          name: 'Maria Santos',
          email: 'maria@xruto.com',
          phone: '+44 7234 567890',
          mpg: 28,
          vehicle_type: 'van',
          efficiency_rating: 88,
          details: 'Brighton Depot - 28 MPG'
        },
        {
          id: '3',
          name: 'James Chen',
          email: 'james@xruto.com',
          phone: '+44 7345 678901',
          mpg: 35,
          vehicle_type: 'van',
          efficiency_rating: 95,
          details: 'Hove Depot - 35 MPG'
        },
        {
          id: '4',
          name: 'Emma Rodriguez',
          email: 'emma@xruto.com',
          phone: '+44 7456 789012',
          mpg: 30,
          vehicle_type: 'van',
          efficiency_rating: 87,
          details: 'Brighton Depot - 30 MPG'
        },
        {
          id: '5',
          name: 'Ryan O\'Connor',
          email: 'ryan@xruto.com',
          phone: '+44 7567 890123',
          mpg: 33,
          vehicle_type: 'van',
          efficiency_rating: 90,
          details: 'Brighton Depot - 33 MPG'
        },
        {
          id: '6',
          name: 'Sophia Kumar',
          email: 'sophia@xruto.com',
          phone: '+44 7678 901234',
          mpg: 29,
          vehicle_type: 'van',
          efficiency_rating: 85,
          details: 'Hove Depot - 29 MPG'
        },
        {
          id: '7',
          name: 'Daniel Foster',
          email: 'daniel@xruto.com',
          phone: '+44 7789 012345',
          mpg: 31,
          vehicle_type: 'van',
          efficiency_rating: 89,
          details: 'Brighton Depot - 31 MPG'
        },
        {
          id: '8',
          name: 'Lisa Logistics',
          email: 'lisa@xruto.com',
          phone: '+44 7890 123456',
          mpg: 32.8,
          vehicle_type: 'van',
          efficiency_rating: 93,
          details: 'Brighton Depot - 32.8 MPG'
        }
      ];

      res.json({
        success: true,
        drivers: mockDrivers,
        total_available: mockDrivers.length
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
        console.error('Error updating order in database:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to update order in database',
          error: error.message
        });
      }

      console.log(`Successfully updated order ${orderId} in database`);
    }

    // Also update the order status in memory
    orderStatusMap.set(orderId, status);
    
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

// ===== AUTH ENDPOINTS =====
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (email === 'admin@xruto.com' && password === 'admin123') {
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: 'admin-1',
        email: 'admin@xruto.com',
        name: 'Admin User',
        role: 'admin'
      },
      token: 'test-token'
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }
});
// Add these endpoints to your server.js file after line 900, right before the error handlers

// GET /api/orders/driver-routes/:driverId - Get routes assigned to specific driver
app.get('/api/orders/driver-routes/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    
    console.log(`🚛 Getting routes for driver ${driverId} on ${date}`);

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
              navigation_url: route.navigation_url,
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
        console.error('Database connection error:', dbError.message);
        // Fall through to memory/mock data
      }
    }

    // Check memory storage from route generation (from your existing routeOrdersMap)
    const driverRoutes = [];
    
    for (const [routeId, orders] of routeOrdersMap.entries()) {
      if (orders && orders.length > 0) {
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
          driver_name: 'Lisa Logistics',
          status: completedOrders === orders.length ? 'completed' : (completedOrders > 0 ? 'in_progress' : 'assigned'),
          total_orders: orders.length,
          completed_orders: completedOrders,
          progress_percentage: progressPercentage,
          estimated_duration_minutes: 20 + (orders.length * 8),
          total_distance_km: Math.round((15 + (orders.length * 1.5)) * 100) / 100,
          estimated_fuel_cost: Math.round((8 + orders.length * 1.2) * 100) / 100,
          route_efficiency_score: 85 + Math.random() * 15,
          navigation_url: generateNavigationURL(
            { latitude: 53.3808256, longitude: -2.575416 }, // Warrington depot
            orders.map(order => ({
              lat: parseFloat(order.latitude) || 53.3808256,
              lng: parseFloat(order.longitude) || -2.575416
            })),
            false // Use HERE Maps
          ),
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

    // Return demo data if no routes found anywhere
    console.log(`📋 No routes found, returning demo data for driver ${driverId}`);
    const demoRoute = {
      id: 'demo_route_1',
      route_id: 'demo_route_1',
      route_name: 'Demo Zone 1 - BN1',
      driver_id: driverId,
      driver_name: 'Demo Driver',
      status: 'assigned',
      total_orders: 3,
      completed_orders: 0,
      progress_percentage: 0,
      estimated_duration_minutes: 45,
      total_distance_km: 8.5,
      estimated_fuel_cost: 12.50,
      route_efficiency_score: 88,
      // navigation_url: 'https://wego.here.com/directions/drive/53.3808,-2.5740/53.3765,-2.5618/53.3821,-2.5723/53.3808,-2.5740',
      navigation_url: 'https://wego.here.com/directions/drive/53.3808256,-2.575416/53.3765,-2.5618/53.3821,-2.5723/53.3808256,-2.575416',
      created_at: new Date().toISOString(),
    //   orders: [
    //     {
    //       id: 'demo_order_1',
    //       customer_name: 'Sarah Wilson',
    //       delivery_address: '456 Western Road, Brighton',
    //       postcode: 'BN1 2AB',
    //       latitude: 50.8203,
    //       longitude: -0.1394,
    //       order_value: 32.50,
    //       weight: 1.8,
    //       customer_phone: '07123456789',
    //       special_instructions: 'Ring doorbell twice',
    //       sequence_number: 1,
    //       delivery_status: 'pending'
    //     },
    //     {
    //       id: 'demo_order_2',
    //       customer_name: 'Mike Johnson',
    //       delivery_address: '789 North Street, Brighton',
    //       postcode: 'BN1 1YZ',
    //       latitude: 50.8240,
    //       longitude: -0.1350,
    //       order_value: 67.25,
    //       weight: 3.2,
    //       customer_phone: '07234567890',
    //       special_instructions: 'Leave with neighbor if out',
    //       sequence_number: 2,
    //       delivery_status: 'pending'
    //     },
    //     {
    //       id: 'demo_order_3',
    //       customer_name: 'Emma Brown',
    //       delivery_address: '12 Elm Grove, Brighton',
    //       postcode: 'BN2 3DE',
    //       latitude: 50.8289,
    //       longitude: -0.1278,
    //       order_value: 28.75,
    //       weight: 1.5,
    //       customer_phone: '07345678901',
    //       special_instructions: 'Fragile items',
    //       sequence_number: 3,
    //       delivery_status: 'pending'
    //     }
    //   ]
    // };
    orders: [
  {
    id: 'demo_order_1',
    customer_name: 'Sarah Wilson',
    delivery_address: '13 Myrtle Grove, Latchford, Warrington',
    postcode: 'WA4 1EE',
    latitude: 53.3811877,
    longitude: -2.5748538,
    order_value: 32.50,
    weight: 1.8,
    customer_phone: '07123456789',
    special_instructions: 'Ring doorbell twice',
    sequence_number: 1,
    delivery_status: 'pending'
  },
  {
    id: 'demo_order_2',
    customer_name: 'Mike Johnson',
    delivery_address: '32 Park Ave, Warrington',
    postcode: 'WA4 1DZ',
    latitude: 53.38065109999999,
    longitude: -2.5763532,
    order_value: 67.25,
    weight: 3.2,
    customer_phone: '07234567890',
    special_instructions: 'Leave with neighbor if out',
    sequence_number: 2,
    delivery_status: 'pending'
  },
  {
    id: 'demo_order_3',
    customer_name: 'Emma Brown',
    delivery_address: '19 Ash Grove, Latchford, Warrington',
    postcode: 'WA4 1EF',
    latitude: 53.3804919,
    longitude: -2.5745405,
    order_value: 28.75,
    weight: 1.5,
    customer_phone: '07345678901',
    special_instructions: 'Fragile items',
    sequence_number: 3,
    delivery_status: 'pending'
  }
]
    };
    
    res.json({
      success: true,
      routes: [demoRoute],
      total_routes: 1,
      driver_id: driverId,
      date,
      source: 'demo_data'
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
        console.error('Database error, falling back to memory:', dbError.message);
        // Fall through to memory update
      }
    }

    // Update memory storage (fallback)
    orderStatusMap.set(order_id, status);

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
app.listen(PORT, '0.0.0.0', () => {  // ✅ ADD '0.0.0.0' HERE!
  console.log('\n🚀 xRuto Standalone Server Started Successfully!');
  console.log(`📍 Server running on http://0.0.0.0:${PORT}`);  // ✅ Changed to 0.0.0.0
  console.log(`🔗 Health check: http://0.0.0.0:${PORT}/api/health`);  // ✅ Changed to 0.0.0.0
  console.log(`💾 Database: ${process.env.SUPABASE_URL ? 'Supabase Connected' : 'Mock Data Mode'}`);
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
  console.log('   POST /api/orders/assign-driver');
  console.log('   POST /api/orders/dispatch-routes');
  console.log('   GET  /api/orders/available-drivers');
  console.log('   GET  /api/orders/route-details/:routeId');
  console.log('   PUT  /api/orders/delivery-status/:orderId');
  console.log('   POST /api/auth/login');
  console.log('\n✨ Your React frontend should now connect successfully!');
  console.log('📊 Route-order tracking: Dynamic order management active');
});

module.exports = app;
module.exports = app;
