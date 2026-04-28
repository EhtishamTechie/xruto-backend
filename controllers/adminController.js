
// const { createClient } = require('@supabase/supabase-js');

// // Initialize Supabase client
// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseKey = process.env.SUPABASE_ANON_KEY;

// if (!supabaseUrl || !supabaseKey) {
//   console.error('❌ Missing Supabase configuration!');
//   process.exit(1);
// }

// const supabase = createClient(supabaseUrl, supabaseKey);

// const adminController = {
//   // Get admin settings
//   async getSettings(req, res) {
//     try {
//       const { data: settings, error } = await supabase
//         .from('settings')
//         .select('*')
//         .single();

//       if (error && error.code !== 'PGRST116') {
//         throw error;
//       }

//       const defaultSettings = {
//         drivers_today_count: 5,
//         include_admin_as_driver: false,
//         navigation_app_preference: 'here',
//         enable_stock_refill: false,
//         max_deliveries_per_route: 25,
//         max_routes_per_day: 10,
//         default_fuel_price: 1.45,
//         enable_help_tooltips: true,
//         auto_assign_routes: true,
//         route_optimization_method: 'distance',
//         customer_notifications: true,
//         driver_app_enabled: true,
//         woocommerce_integration_enabled: false,
//         sync_frequency_minutes: 15,
//         enable_real_time_tracking: false
//       };

//       res.json({
//         success: true,
//         settings: settings || defaultSettings
//       });
//     } catch (error) {
//       console.error('Get settings error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to fetch settings',
//         error: error.message
//       });
//     }
//   },

//   // Update admin settings
//   async updateSettings(req, res) {
//     try {
//       const settingsData = req.body;
//       console.log('Updating settings with:', settingsData);
      
//       const { data: existingSettings } = await supabase
//         .from('settings')
//         .select('id')
//         .single();

//       let result;
//       if (existingSettings) {
//         result = await supabase
//           .from('settings')
//           .update(settingsData)
//           .eq('id', existingSettings.id)
//           .select()
//           .single();
//       } else {
//         result = await supabase
//           .from('settings')
//           .insert(settingsData)
//           .select()
//           .single();
//       }

//       if (result.error) throw result.error;

//       res.json({
//         success: true,
//         message: 'Settings updated successfully',
//         settings: result.data
//       });
//     } catch (error) {
//       console.error('Update settings error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to update settings',
//         error: error.message
//       });
//     }
//   },

//   // Get all depots
//   async getDepots(req, res) {
//     try {
//       console.log('Getting depots...');
      
//       // Try to get from view first, fallback to table
//       let { data: depots, error } = await supabase
//         .from('depot_stats_view')
//         .select('*')
//         .eq('is_active', true);

//       if (error) {
//         console.log('View failed, trying table:', error.message);
//         // Fallback to direct table query
//         const result = await supabase
//           .from('depots')
//           .select('*')
//           .eq('is_active', true);
        
//         if (result.error) throw result.error;
//         depots = result.data;
//       }

//       const formattedDepots = (depots || []).map(depot => ({
//         id: depot.id,
//         name: depot.name,
//         address: depot.address,
//         city: depot.city || '',
//         postcode: depot.postcode || '',
//         latitude: depot.latitude,
//         longitude: depot.longitude,
//         capacity: depot.capacity || 500,
//         is_primary: depot.is_primary || false,
//         is_active: depot.is_active,
//         driver_count: depot.driver_count || 0,
//         available_drivers: depot.available_drivers || 0,
//         contact_phone: depot.contact_phone || '',
//         contact_email: depot.contact_email || ''
//       }));

//       console.log(`Found ${formattedDepots.length} depots`);

//       res.json({
//         success: true,
//         depots: formattedDepots
//       });
//     } catch (error) {
//       console.error('Get depots error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to fetch depots',
//         error: error.message
//       });
//     }
//   },

//   // Add new depot - FIXED VERSION
//   async addDepot(req, res) {
//     try {
//       console.log('Adding depot with data:', req.body);
      
//       const { name, address, city, postcode, capacity, contactPhone, contactEmail } = req.body;

//       // Validate required fields
//       if (!name || !address) {
//         return res.status(400).json({
//           success: false,
//           message: 'Name and address are required'
//         });
//       }

//       // Prepare depot data with safe defaults
//       const depotData = {
//         name: name.trim(),
//         address: address.trim(),
//         city: city ? city.trim() : null,
//         postcode: postcode ? postcode.trim() : null,
//         capacity: capacity ? parseInt(capacity) : 500,
//         contact_phone: contactPhone ? contactPhone.trim() : null,
//         contact_email: contactEmail ? contactEmail.trim() : null,
//         is_primary: false,
//         is_active: true
//       };

//       console.log('Inserting depot data:', depotData);

//       const { data: depot, error } = await supabase
//         .from('depots')
//         .insert(depotData)
//         .select()
//         .single();

//       if (error) {
//         console.error('Supabase insert error:', error);
//         throw error;
//       }

//       console.log('Depot added successfully:', depot);

//       res.status(201).json({
//         success: true,
//         message: 'Depot added successfully',
//         depot: {
//           ...depot,
//           driver_count: 0,
//           available_drivers: 0
//         }
//       });
//     } catch (error) {
//       console.error('Add depot error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to add depot',
//         error: error.message,
//         details: error.details || 'No additional details'
//       });
//     }
//   },

//   // Update depot
//   async updateDepot(req, res) {
//     try {
//       const { id } = req.params;
//       const updateData = req.body;
      
//       console.log('Updating depot:', id, 'with data:', updateData);

//       // Handle field name mapping
//       if (updateData.contactPhone !== undefined) {
//         updateData.contact_phone = updateData.contactPhone;
//         delete updateData.contactPhone;
//       }
//       if (updateData.contactEmail !== undefined) {
//         updateData.contact_email = updateData.contactEmail;
//         delete updateData.contactEmail;
//       }

//       // Convert numeric fields
//       if (updateData.capacity) updateData.capacity = parseInt(updateData.capacity);

//       const { data: depot, error } = await supabase
//         .from('depots')
//         .update(updateData)
//         .eq('id', id)
//         .select()
//         .single();

//       if (error) throw error;

//       res.json({
//         success: true,
//         message: 'Depot updated successfully',
//         depot
//       });
//     } catch (error) {
//       console.error('Update depot error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to update depot',
//         error: error.message
//       });
//     }
//   },

//   // Remove depot
//   async removeDepot(req, res) {
//     try {
//       const { id } = req.params;
//       console.log('Removing depot:', id);

//       // Check if depot has drivers
//       const { data: drivers } = await supabase
//         .from('drivers')
//         .select('id')
//         .eq('depot_id', id)
//         .eq('is_active', true);

//       if (drivers && drivers.length > 0) {
//         return res.status(400).json({
//           success: false,
//           message: `Cannot delete depot with ${drivers.length} active driver(s). Please reassign drivers first.`
//         });
//       }

//       const { error } = await supabase
//         .from('depots')
//         .update({ is_active: false })
//         .eq('id', id);

//       if (error) throw error;

//       res.json({
//         success: true,
//         message: 'Depot removed successfully'
//       });
//     } catch (error) {
//       console.error('Remove depot error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to remove depot',
//         error: error.message
//       });
//     }
//   },

//   // Get all drivers
//   async getDrivers(req, res) {
//     try {
//       console.log('Getting drivers...');
      
//       // Try view first, fallback to table
//       let { data: drivers, error } = await supabase
//         .from('active_drivers_view')
//         .select('*');

//       if (error) {
//         console.log('View failed, trying table:', error.message);
//         const result = await supabase
//           .from('drivers')
//           .select(`
//             *,
//             depots(name)
//           `)
//           .eq('is_active', true);
        
//         if (result.error) throw result.error;
//         drivers = result.data;
//       }

//       const formattedDrivers = (drivers || []).map(driver => ({
//         id: driver.id,
//         name: driver.name || `${driver.first_name || ''} ${driver.last_name || ''}`.trim(),
//         email: driver.email,
//         phone: driver.phone,
//         first_name: driver.first_name,
//         last_name: driver.last_name,
//         depot_id: driver.depot_id,
//         mpg: driver.mpg,
//         vehicle_type: driver.vehicle_type,
//         vehicle_capacity: driver.vehicle_capacity,
//         license_plate: driver.license_plate,
//         is_active: driver.is_active,
//         is_available_today: driver.is_available_today,
//         details: driver.details || `${driver.depots?.name || 'No Depot'}, ${driver.mpg || 30} MPG`
//       }));

//       console.log(`Found ${formattedDrivers.length} drivers`);

//       res.json({
//         success: true,
//         drivers: formattedDrivers
//       });
//     } catch (error) {
//       console.error('Get drivers error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to fetch drivers',
//         error: error.message
//       });
//     }
//   },

//   // Add new driver - FIXED VERSION
//   async addDriver(req, res) {
//     try {
//       console.log('Adding driver with data:', req.body);
      
//       const { firstName, lastName, email, phone, depotId, mpg, vehicleType, vehicleCapacity, licensePlate } = req.body;

//       // Validate required fields
//       if (!firstName || !lastName || !email) {
//         return res.status(400).json({
//           success: false,
//           message: 'First name, last name, and email are required'
//         });
//       }

//       // Check if email already exists
//       const { data: existingDriver } = await supabase
//         .from('drivers')
//         .select('id')
//         .eq('email', email)
//         .eq('is_active', true)
//         .single();

//       if (existingDriver) {
//         return res.status(400).json({
//           success: false,
//           message: 'Driver with this email already exists'
//         });
//       }

//       // Prepare driver data
//       const driverData = {
//         name: `${firstName.trim()} ${lastName.trim()}`,
//         first_name: firstName.trim(),
//         last_name: lastName.trim(),
//         email: email.trim(),
//         phone: phone ? phone.trim() : null,
//         depot_id: depotId || null,
//         mpg: mpg ? parseFloat(mpg) : 30.0,
//         vehicle_type: vehicleType || 'van',
//         vehicle_capacity: vehicleCapacity ? parseInt(vehicleCapacity) : 50,
//         license_plate: licensePlate ? licensePlate.trim() : null,
//         is_active: true,
//         is_available_today: true
//       };

//       console.log('Inserting driver data:', driverData);

//       const { data: driver, error } = await supabase
//         .from('drivers')
//         .insert(driverData)
//         .select(`
//           *,
//           depots(name)
//         `)
//         .single();

//       if (error) {
//         console.error('Supabase insert error:', error);
//         throw error;
//       }

//       console.log('Driver added successfully:', driver);

//       const formattedDriver = {
//         id: driver.id,
//         name: driver.name,
//         details: `${driver.depots?.name || 'No Depot'}, ${driver.mpg || 30} MPG`,
//         email: driver.email,
//         phone: driver.phone,
//         first_name: driver.first_name,
//         last_name: driver.last_name,
//         depot_id: driver.depot_id,
//         mpg: driver.mpg,
//         vehicle_type: driver.vehicle_type,
//         vehicle_capacity: driver.vehicle_capacity,
//         license_plate: driver.license_plate,
//         is_active: driver.is_active,
//         is_available_today: driver.is_available_today
//       };

//       res.status(201).json({
//         success: true,
//         message: 'Driver added successfully',
//         driver: formattedDriver
//       });
//     } catch (error) {
//       console.error('Add driver error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to add driver',
//         error: error.message,
//         details: error.details || 'No additional details'
//       });
//     }
//   },

//   // Update driver
//   async updateDriver(req, res) {
//     try {
//       const { id } = req.params;
//       const { firstName, lastName, email, phone, depotId, mpg, vehicleType, vehicleCapacity, licensePlate, isAvailableToday } = req.body;
      
//       console.log('Updating driver:', id, 'with data:', req.body);

//       const updates = {};
      
//       if (email !== undefined) updates.email = email;
//       if (phone !== undefined) updates.phone = phone;
//       if (depotId !== undefined) updates.depot_id = depotId;
//       if (mpg !== undefined) updates.mpg = mpg ? parseFloat(mpg) : null;
//       if (vehicleType !== undefined) updates.vehicle_type = vehicleType;
//       if (vehicleCapacity !== undefined) updates.vehicle_capacity = vehicleCapacity ? parseInt(vehicleCapacity) : null;
//       if (licensePlate !== undefined) updates.license_plate = licensePlate;
//       if (isAvailableToday !== undefined) updates.is_available_today = isAvailableToday;

//       // Handle name updates
//       if (firstName !== undefined || lastName !== undefined) {
//         const fullName = `${firstName || ''} ${lastName || ''}`.trim();
//         updates.name = fullName;
//         if (firstName !== undefined) updates.first_name = firstName;
//         if (lastName !== undefined) updates.last_name = lastName;
//       }

//       const { data: driver, error } = await supabase
//         .from('drivers')
//         .update(updates)
//         .eq('id', id)
//         .select(`
//           *,
//           depots(name)
//         `)
//         .single();

//       if (error) throw error;

//       const formattedDriver = {
//         id: driver.id,
//         name: driver.name,
//         details: `${driver.depots?.name || 'No Depot'}, ${driver.mpg || 30} MPG`,
//         email: driver.email,
//         phone: driver.phone,
//         first_name: driver.first_name,
//         last_name: driver.last_name,
//         depot_id: driver.depot_id,
//         mpg: driver.mpg,
//         vehicle_type: driver.vehicle_type,
//         vehicle_capacity: driver.vehicle_capacity,
//         license_plate: driver.license_plate,
//         is_active: driver.is_active,
//         is_available_today: driver.is_available_today
//       };

//       res.json({
//         success: true,
//         message: 'Driver updated successfully',
//         driver: formattedDriver
//       });
//     } catch (error) {
//       console.error('Update driver error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to update driver',
//         error: error.message
//       });
//     }
//   },

//   // Remove driver
//   async removeDriver(req, res) {
//     try {
//       const { id } = req.params;
//       console.log('Removing driver:', id);

//       // Check if driver has active routes
//       const { data: routes } = await supabase
//         .from('routes')
//         .select('id')
//         .eq('driver_id', id)
//         .in('status', ['planned', 'assigned', 'in_progress']);

//       if (routes && routes.length > 0) {
//         return res.status(400).json({
//           success: false,
//           message: `Cannot remove driver with ${routes.length} active route(s). Please complete or reassign routes first.`
//         });
//       }

//       const { error } = await supabase
//         .from('drivers')
//         .update({ 
//           is_active: false,
//           is_available_today: false
//         })
//         .eq('id', id);

//       if (error) throw error;

//       res.json({
//         success: true,
//         message: 'Driver removed successfully'
//       });
//     } catch (error) {
//       console.error('Remove driver error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to remove driver',
//         error: error.message
//       });
//     }
//   },

//   // Toggle driver status
//   async toggleDriverStatus(req, res) {
//     try {
//       const { id } = req.params;
//       const { is_active } = req.body;

//       const { data: driver, error } = await supabase
//         .from('drivers')
//         .update({ 
//           is_active,
//           is_available_today: is_active
//         })
//         .eq('id', id)
//         .select()
//         .single();

//       if (error) throw error;

//       res.json({
//         success: true,
//         message: `Driver ${is_active ? 'activated' : 'deactivated'} successfully`,
//         driver
//       });
//     } catch (error) {
//       console.error('Toggle driver status error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to toggle driver status',
//         error: error.message
//       });
//     }
//   },

//   // System health check
//   async getSystemHealth(req, res) {
//     try {
//       const [settingsCount, depotsCount, driversCount] = await Promise.all([
//         supabase.from('settings').select('*', { count: 'exact' }),
//         supabase.from('depots').select('*', { count: 'exact' }).eq('is_active', true),
//         supabase.from('drivers').select('*', { count: 'exact' }).eq('is_active', true)
//       ]);

//       const health = {
//         status: 'healthy',
//         timestamp: new Date(),
//         database: {
//           connected: true,
//           settings_configured: (settingsCount.count || 0) > 0,
//           active_depots: depotsCount.count || 0,
//           active_drivers: driversCount.count || 0
//         },
//         services: {
//           supabase: 'connected',
//           routes_engine: 'ready',
//           notifications: 'ready'
//         }
//       };

//       res.json({
//         success: true,
//         health
//       });
//     } catch (error) {
//       console.error('System health check error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to check system health',
//         error: error.message
//       });
//     }
//   }
// };

// module.exports = adminController;

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Extract latitude & longitude from a Google Maps URL or plain "lat,lng" string.
 * Mirrors the frontend parseLatLngFromGoogleMapsText utility.
 */
function parseLatLngFromUrl(input) {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;
  const validate = (a, b) => {
    const lat = parseFloat(a), lng = parseFloat(b);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    if (Math.abs(lat) < 1e-9 && Math.abs(lng) < 1e-9) return null;
    return { latitude: lat, longitude: lng };
  };
  // Plain "lat,lng"
  let m = s.replace(/\s/g, '').match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
  if (m) { const r = validate(m[1], m[2]); if (r) return r; }
  // /@lat,lng
  m = s.match(/@(-?\d+\.?\d*),(-?\d+\.?\d+)/);
  if (m) { const r = validate(m[1], m[2]); if (r) return r; }
  // !3d…!4d…
  m = s.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/i);
  if (m) { const r = validate(m[1], m[2]); if (r) return r; }
  // ?q=lat,lng or &q=lat,lng
  m = s.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)\b/);
  if (m) { const r = validate(m[1], m[2]); if (r) return r; }
  // ?ll=lat,lng
  m = s.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)\b/);
  if (m) { const r = validate(m[1], m[2]); if (r) return r; }
  return null;
}

const adminController = {
  // Get admin settings
  async getSettings(req, res) {
    try {
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
    } catch (error) {
      console.error('Get settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch settings',
        error: error.message
      });
    }
  },

  // Update admin settings
  async updateSettings(req, res) {
    try {
      const settingsData = req.body;
      console.log('Updating settings with:', settingsData);
      
      const { data: existingSettings } = await supabase
        .from('settings')
        .select('id')
        .single();

      let result;
      if (existingSettings) {
        result = await supabase
          .from('settings')
          .update({
            ...settingsData,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSettings.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('settings')
          .insert(settingsData)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      res.json({
        success: true,
        message: 'Settings updated successfully',
        settings: result.data
      });
    } catch (error) {
      console.error('Update settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update settings',
        error: error.message
      });
    }
  },

  // Get all depots with driver counts
  async getDepots(req, res) {
    try {
      console.log('Getting depots with driver statistics...');
      
      // Get depots with driver counts using a proper JOIN
      const { data: depots, error } = await supabase
        .from('depots')
        .select(`
          *,
          drivers!depot_id(
            id,
            is_active,
            is_available_today
          )
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

      console.log(`Found ${formattedDepots.length} active depots`);

      res.json({
        success: true,
        depots: formattedDepots
      });
    } catch (error) {
      console.error('Get depots error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch depots',
        error: error.message
      });
    }
  },

  // Add new depot
  async addDepot(req, res) {
    try {
      console.log('Adding depot with data:', req.body);
      
      const { name, address, city, postcode, capacity, contactPhone, contactEmail, latitude, longitude, googleMapsUrl } = req.body;

      // Validate required fields
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Depot name is required'
        });
      }

      // Resolve coordinates: explicit lat/lng → parsed from googleMapsUrl → geocode via HERE
      let finalLat = latitude && String(latitude).trim() !== '' ? parseFloat(latitude) : null;
      let finalLng = longitude && String(longitude).trim() !== '' ? parseFloat(longitude) : null;

      // Safety net: extract from Google Maps URL if lat/lng not directly provided
      if ((!finalLat || !finalLng) && googleMapsUrl) {
        const coords = parseLatLngFromUrl(googleMapsUrl);
        if (coords) {
          finalLat = coords.latitude;
          finalLng = coords.longitude;
          console.log(`[addDepot] Extracted coords from Google Maps URL: ${finalLat}, ${finalLng}`);
        }
      }

      // Last resort: try geocoding via HERE API (only works if HERE_API_KEY is set)
      if (!finalLat || !finalLng) {
        try {
          const hereAPI = require('../services/hereAPI');
          const coords = await hereAPI.geocode(address || '', postcode || '');
          if (coords && coords.lat && coords.lng) {
            finalLat = coords.lat;
            finalLng = coords.lng;
            console.log(`[addDepot] Geocoded coords: ${finalLat}, ${finalLng}`);
          }
        } catch (geocodeError) {
          console.warn('[addDepot] Geocoding failed:', geocodeError.message);
        }
      }

      // If still no valid coordinates, store as null (not a fake fallback)
      if (!finalLat || !finalLng || !isFinite(finalLat) || !isFinite(finalLng)) {
        finalLat = null;
        finalLng = null;
        console.warn(`[addDepot] No valid coordinates for depot "${name}" — routes will not use this depot until coords are set via edit.`);
      }

      // Prepare depot data
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

      console.log('Inserting depot data:', depotData);

      const { data: depot, error } = await supabase
        .from('depots')
        .insert(depotData)
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }

      console.log('Depot added successfully:', depot);

      res.status(201).json({
        success: true,
        message: 'Depot added successfully',
        depot: {
          ...depot,
          driver_count: 0,
          available_drivers: 0
        }
      });
    } catch (error) {
      console.error('Add depot error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add depot',
        error: error.message,
        details: error.details || 'No additional details'
      });
    }
  },

  // Update depot
  async updateDepot(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      console.log('Updating depot:', id, 'with data:', updateData);

      // Handle field name mapping
      if (updateData.contactPhone !== undefined) {
        updateData.contact_phone = updateData.contactPhone;
        delete updateData.contactPhone;
      }
      if (updateData.contactEmail !== undefined) {
        updateData.contact_email = updateData.contactEmail;
        delete updateData.contactEmail;
      }

      // Safety net: extract coords from googleMapsUrl if lat/lng not explicitly provided
      if (updateData.googleMapsUrl && (!updateData.latitude || !updateData.longitude)) {
        const coords = parseLatLngFromUrl(updateData.googleMapsUrl);
        if (coords) {
          updateData.latitude = coords.latitude;
          updateData.longitude = coords.longitude;
          console.log(`[updateDepot] Extracted coords from Google Maps URL: ${coords.latitude}, ${coords.longitude}`);
        }
      }
      delete updateData.googleMapsUrl; // not a DB column

      // Convert numeric fields
      if (updateData.capacity) updateData.capacity = parseInt(updateData.capacity);
      if (updateData.latitude != null) updateData.latitude = parseFloat(updateData.latitude);
      if (updateData.longitude != null) updateData.longitude = parseFloat(updateData.longitude);

      // Add updated timestamp
      updateData.updated_at = new Date().toISOString();

      const { data: depot, error } = await supabase
        .from('depots')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.json({
        success: true,
        message: 'Depot updated successfully',
        depot
      });
    } catch (error) {
      console.error('Update depot error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update depot',
        error: error.message
      });
    }
  },

  // Remove depot
  async removeDepot(req, res) {
    try {
      const { id } = req.params;
      console.log('Removing depot:', id);

      // Check if depot has drivers
      const { data: drivers } = await supabase
        .from('drivers')
        .select('id')
        .eq('depot_id', id)
        .eq('is_active', true);

      if (drivers && drivers.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete depot with ${drivers.length} active driver(s). Please reassign drivers first.`
        });
      }

      const { error } = await supabase
        .from('depots')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      res.json({
        success: true,
        message: 'Depot removed successfully'
      });
    } catch (error) {
      console.error('Remove depot error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove depot',
        error: error.message
      });
    }
  },

  // Get all drivers with depot information
  async getDrivers(req, res) {
    try {
      console.log('Getting drivers with depot information...');
      
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

      console.log(`Found ${formattedDrivers.length} active drivers`);

      res.json({
        success: true,
        drivers: formattedDrivers
      });
    } catch (error) {
      console.error('Get drivers error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch drivers',
        error: error.message
      });
    }
  },

  // Add new driver
  async addDriver(req, res) {
    try {
      console.log('Adding driver with data:', req.body);
      
      const { firstName, lastName, email, phone, depotId, mpg, vehicleType, vehicleCapacity, licensePlate } = req.body;

      // Validate required fields
      if (!firstName || !lastName || !email) {
        return res.status(400).json({
          success: false,
          message: 'First name, last name, and email are required'
        });
      }

      // Check if email already exists
      const { data: existingDriver } = await supabase
        .from('drivers')
        .select('id')
        .eq('email', email)
        .eq('is_active', true)
        .single();

      if (existingDriver) {
        return res.status(400).json({
          success: false,
          message: 'Driver with this email already exists'
        });
      }

      // Prepare driver data
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

      console.log('Inserting driver data:', driverData);

      const { data: driver, error } = await supabase
        .from('drivers')
        .insert(driverData)
        .select(`
          *,
          depots(name)
        `)
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }

      console.log('Driver added successfully:', driver);

      const formattedDriver = {
        id: driver.id,
        name: `${driver.first_name} ${driver.last_name}`,
        details: `${driver.depots?.name || 'No Depot'}, ${driver.mpg || 30} MPG`,
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
        is_available_today: driver.is_available_today
      };

      res.status(201).json({
        success: true,
        message: 'Driver added successfully',
        driver: formattedDriver
      });
    } catch (error) {
      console.error('Add driver error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add driver',
        error: error.message,
        details: error.details || 'No additional details'
      });
    }
  },

  // Update driver
  async updateDriver(req, res) {
    try {
      const { id } = req.params;
      const { firstName, lastName, email, phone, depotId, mpg, vehicleType, vehicleCapacity, licensePlate, isAvailableToday } = req.body;
      
      console.log('Updating driver:', id, 'with data:', req.body);

      const updates = {};
      
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (depotId !== undefined) updates.depot_id = depotId;
      if (mpg !== undefined) updates.mpg = mpg ? parseFloat(mpg) : null;
      if (vehicleType !== undefined) updates.vehicle_type = vehicleType;
      if (vehicleCapacity !== undefined) updates.vehicle_capacity = vehicleCapacity ? parseInt(vehicleCapacity) : null;
      if (licensePlate !== undefined) updates.license_plate = licensePlate;
      if (isAvailableToday !== undefined) updates.is_available_today = isAvailableToday;

      // Handle name updates
      if (firstName !== undefined) updates.first_name = firstName;
      if (lastName !== undefined) updates.last_name = lastName;

      // Add updated timestamp
      updates.updated_at = new Date().toISOString();

      const { data: driver, error } = await supabase
        .from('drivers')
        .update(updates)
        .eq('id', id)
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
        is_available_today: driver.is_available_today
      };

      res.json({
        success: true,
        message: 'Driver updated successfully',
        driver: formattedDriver
      });
    } catch (error) {
      console.error('Update driver error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update driver',
        error: error.message
      });
    }
  },

  // Remove driver
  async removeDriver(req, res) {
    try {
      const { id } = req.params;
      console.log('Removing driver:', id);

      // Check if driver has active routes
      const { data: routes } = await supabase
        .from('routes')
        .select('id')
        .eq('driver_id', id)
        .in('status', ['planned', 'assigned', 'in_progress', 'dispatched']);

      if (routes && routes.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot remove driver with ${routes.length} active route(s). Please complete or reassign routes first.`
        });
      }

      const { error } = await supabase
        .from('drivers')
        .update({ 
          is_active: false,
          is_available_today: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      res.json({
        success: true,
        message: 'Driver removed successfully'
      });
    } catch (error) {
      console.error('Remove driver error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove driver',
        error: error.message
      });
    }
  },

  // Toggle driver status
  async toggleDriverStatus(req, res) {
    try {
      const { id } = req.params;
      const { is_active } = req.body;

      const { data: driver, error } = await supabase
        .from('drivers')
        .update({ 
          is_active,
          is_available_today: is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.json({
        success: true,
        message: `Driver ${is_active ? 'activated' : 'deactivated'} successfully`,
        driver
      });
    } catch (error) {
      console.error('Toggle driver status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle driver status',
        error: error.message
      });
    }
  },

  // System health check
  async getSystemHealth(req, res) {
    try {
      const [settingsCount, depotsCount, driversCount, ordersCount] = await Promise.all([
        supabase.from('settings').select('*', { count: 'exact' }),
        supabase.from('depots').select('*', { count: 'exact' }).eq('is_active', true),
        supabase.from('drivers').select('*', { count: 'exact' }).eq('is_active', true),
        supabase.from('orders').select('*', { count: 'exact' }).eq('delivery_date', new Date().toISOString().split('T')[0])
      ]);

      const health = {
        status: 'healthy',
        timestamp: new Date(),
        database: {
          connected: true,
          settings_configured: (settingsCount.count || 0) > 0,
          active_depots: depotsCount.count || 0,
          active_drivers: driversCount.count || 0,
          todays_orders: ordersCount.count || 0
        },
        services: {
          supabase: 'connected',
          routes_engine: 'ready',
          here_api: process.env.HERE_API_KEY ? 'configured' : 'missing',
          notifications: 'ready'
        }
      };

      res.json({
        success: true,
        health
      });
    } catch (error) {
      console.error('System health check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check system health',
        error: error.message
      });
    }
  }
};

module.exports = adminController;