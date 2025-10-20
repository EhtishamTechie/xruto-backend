
// const { createClient } = require('@supabase/supabase-js');

// // Initialize Supabase client
// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseKey = process.env.SUPABASE_ANON_KEY;

// if (!supabaseUrl || !supabaseKey) {
//   console.error('❌ Missing Supabase configuration!');
//   process.exit(1);
// }

// const supabase = createClient(supabaseUrl, supabaseKey);

// // Import HERE API service
// const hereAPI = require('../services/hereAPI');

// const ordersController = {
//   // TAB 1: Get eligible orders for route optimization
//   async getEligibleOrders(req, res) {
//     try {
//       const { date = new Date().toISOString().split('T')[0] } = req.query;
      
//       console.log(`🔍 Getting eligible orders for date: ${date}`);

//       // Get orders using direct query with proper joins
//       const { data: orders, error } = await supabase
//         .from('orders')
//         .select('*')
//         .eq('delivery_date', date)
//         .in('status', ['pending', 'confirmed'])
//         .is('route_id', null)
//         .order('postcode');

//       if (error) throw error;

//       // Add calculated fields and postcode areas
//       const processedOrders = orders.map(order => {
//         const postcodeArea = order.postcode ? order.postcode.split(' ')[0] : 'Unknown';
        
//         // Calculate distance from Latchford depot if coordinates exist
//         let distanceFromDepot = 0;
//         if (order.latitude && order.longitude) {
//           const depotLat = 53.3808;
//           const depotLng = -2.5740;
//           distanceFromDepot = this.calculateDistance(
//             depotLat, depotLng, 
//             parseFloat(order.latitude), parseFloat(order.longitude)
//           );
//         }

//         return {
//           ...order,
//           postcode_area: postcodeArea,
//           distance_from_depot_km: Math.round(distanceFromDepot * 100) / 100
//         };
//       });

//       // Get unique postcode areas for filtering
//       const postcodeAreas = [...new Set(processedOrders.map(order => order.postcode_area))].sort();

//       console.log(`✅ Found ${processedOrders.length} orders across ${postcodeAreas.length} postcode areas`);

//       res.json({
//         success: true,
//         orders: processedOrders,
//         postcode_options: postcodeAreas,
//         total_orders: processedOrders.length,
//         date
//       });
//     } catch (error) {
//       console.error('Get eligible orders error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to fetch eligible orders',
//         error: error.message
//       });
//     }
//   },

//   // TAB 1: Generate clusters using K-means clustering
//   async generateClusters(req, res) {
//     try {
//       const { selected_postcodes, clustering_algorithm = 'kmeans', max_zones = 5, date } = req.body;

//       if (!selected_postcodes || selected_postcodes.length === 0) {
//         return res.status(400).json({
//           success: false,
//           message: 'At least one postcode must be selected'
//         });
//       }

//       console.log(`🎯 Generating clusters for postcodes: ${selected_postcodes.join(', ')}`);

//       // Get orders for selected postcodes
//       const { data: orders, error } = await supabase
//         .from('orders')
//         .select('*')
//         .eq('delivery_date', date || new Date().toISOString().split('T')[0])
//         .in('status', ['pending', 'confirmed'])
//         .is('route_id', null);

//       if (error) throw error;

//       // Filter orders by selected postcodes
//       const filteredOrders = orders.filter(order => {
//         const postcodeArea = order.postcode ? order.postcode.split(' ')[0] : '';
//         return selected_postcodes.includes(postcodeArea);
//       });

//       if (filteredOrders.length === 0) {
//         return res.json({
//           success: true,
//           zones: [],
//           total_orders: 0,
//           message: 'No orders found for selected postcodes'
//         });
//       }

//       // Add distance calculation and ensure coordinates
//       const ordersWithCoords = filteredOrders.map(order => ({
//         ...order,
//         latitude: parseFloat(order.latitude) || 53.3808,
//         longitude: parseFloat(order.longitude) || -2.5740,
//         distance_from_depot_km: order.distance_from_depot_km || 0
//       }));

//       // Perform K-means clustering
//       const zones = await hereAPI.performKMeansClustering(ordersWithCoords, max_zones);

//       console.log(`✅ Generated ${zones.length} clusters from ${filteredOrders.length} orders`);

//       res.json({
//         success: true,
//         zones,
//         total_orders: filteredOrders.length,
//         clustering_algorithm,
//         optimization_summary: {
//           total_zones: zones.length,
//           avg_orders_per_zone: Math.round(filteredOrders.length / zones.length),
//           avg_efficiency_score: Math.round(zones.reduce((sum, z) => sum + (z.efficiency_score || 0), 0) / zones.length)
//         }
//       });
//     } catch (error) {
//       console.error('Generate clusters error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to generate clusters',
//         error: error.message
//       });
//     }
//   },

//   // TAB 2: Generate optimized routes from clusters
//   async generateRoutes(req, res) {
//     try {
//       const { zones, date = new Date().toISOString().split('T')[0] } = req.body;

//       if (!zones || zones.length === 0) {
//         return res.status(400).json({
//           success: false,
//           message: 'At least one zone is required to generate routes'
//         });
//       }

//       console.log(`🚛 Generating optimized routes for ${zones.length} zones`);

//       // Get settings for route optimization
//       const { data: settings } = await supabase
//         .from('settings')
//         .select('*')
//         .single();

//       // Get primary depot for route calculation
//       const { data: primaryDepot } = await supabase
//         .from('depots')
//         .select('*')
//         .eq('is_primary', true)
//         .eq('is_active', true)
//         .single();

//       const depot = primaryDepot || {
//         id: 'default',
//         name: 'Latchford Distribution Center',
//         latitude: 53.3808,
//         longitude: -2.5740
//       };

//       const routes = [];

//       // Generate route for each zone
//       for (let i = 0; i < zones.length; i++) {
//         const zone = zones[i];
        
//         if (!zone.orders || zone.orders.length === 0) continue;

//         console.log(`🔄 Optimizing route for ${zone.zone_name} with ${zone.orders.length} orders`);

//         // Prepare waypoints for route optimization
//         const waypoints = zone.orders.map(order => ({
//           id: order.id,
//           customer_name: order.customer_name,
//           delivery_address: order.delivery_address,
//           postcode: order.postcode,
//           lat: parseFloat(order.latitude),
//           lng: parseFloat(order.longitude),
//           order_value: order.order_value || 0,
//           weight: order.weight || 2,
//           special_instructions: order.special_instructions
//         }));

//         // Calculate route metrics using enhanced calculations
//         const totalDistanceKm = this.calculateTotalRouteDistance(depot, waypoints);
//         const totalDistanceMiles = totalDistanceKm * 0.621371;
        
//         // Use realistic time calculation
//         const estimatedDurationMinutes = this.calculateRealisticRouteTime(
//           totalDistanceKm, 
//           zone.orders.length
//         );

//         const estimatedFuelCost = this.calculateFuelCost(
//           totalDistanceKm, 
//           30, // Default MPG
//           settings?.default_fuel_price || 1.45
//         );

//         // Generate proper navigation URL
//         const navigationUrl = this.generateNavigationURL(
//           depot, 
//           waypoints, 
//           settings?.navigation_app_preference === 'google'
//         );

//         // Create route record in database
//         const { data: routeRecord, error: routeError } = await supabase
//           .from('routes')
//           .insert({
//             route_name: zone.zone_name,
//             delivery_date: date,
//             status: 'generated',
//             total_orders: zone.orders.length,
//             total_distance_km: Math.round(totalDistanceKm * 100) / 100,
//             total_distance_miles: Math.round(totalDistanceMiles * 100) / 100,
//             estimated_duration_minutes: estimatedDurationMinutes,
//             estimated_fuel_cost: estimatedFuelCost,
//             navigation_url: navigationUrl,
//             route_efficiency_score: zone.efficiency_score || 85,
//             optimization_notes: `Generated using K-means clustering with ${zone.orders.length} orders`
//           })
//           .select()
//           .single();

//         if (routeError) {
//           console.error('Failed to create route:', routeError);
//           continue;
//         }

//         // Update orders with route assignment and sequence
//         for (let j = 0; j < zone.orders.length; j++) {
//           const order = zone.orders[j];
//           await supabase
//             .from('orders')
//             .update({
//               route_id: routeRecord.id,
//               sequence_number: j + 1,
//               status: 'assigned'
//             })
//             .eq('id', order.id);
//         }

//         // Add sequence to orders for response
//         const ordersWithSequence = zone.orders.map((order, index) => ({
//           ...order,
//           sequence: index + 1,
//           estimated_arrival: new Date(Date.now() + (30 + index * 8) * 60000).toISOString()
//         }));

//         // Format route for response
//         routes.push({
//           route_id: routeRecord.id,
//           route_name: routeRecord.route_name,
//           zone_color: zone.color_hex,
//           status: 'generated',
//           total_orders: zone.orders.length,
//           total_distance_km: totalDistanceKm,
//           total_distance_miles: totalDistanceMiles,
//           estimated_duration_minutes: estimatedDurationMinutes,
//           estimated_fuel_cost: estimatedFuelCost,
//           navigation_url: navigationUrl,
//           route_efficiency_score: routeRecord.route_efficiency_score,
//           source: 'optimized',
//           orders: ordersWithSequence
//         });
//       }

//       console.log(`✅ Generated ${routes.length} optimized routes successfully`);

//       res.json({
//         success: true,
//         routes,
//         optimization_summary: {
//           total_routes: routes.length,
//           total_orders: routes.reduce((sum, r) => sum + r.total_orders, 0),
//           total_distance_miles: Math.round(routes.reduce((sum, r) => sum + r.total_distance_miles, 0) * 100) / 100,
//           total_estimated_duration: routes.reduce((sum, r) => sum + r.estimated_duration_minutes, 0),
//           avg_efficiency_score: Math.round(routes.reduce((sum, r) => sum + r.route_efficiency_score, 0) / routes.length)
//         }
//       });
//     } catch (error) {
//       console.error('Generate routes error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to generate optimized routes',
//         error: error.message
//       });
//     }
//   },

//   // TAB 2: Get available drivers with their details
//   async getAvailableDrivers(req, res) {
//     try {
//       const { data: drivers, error } = await supabase
//         .from('drivers')
//         .select(`
//           id,
//           first_name,
//           last_name,
//           email,
//           phone,
//           mpg,
//           vehicle_type,
//           vehicle_capacity,
//           depot_id,
//           is_active,
//           is_available_today,
//           depots(name, city)
//         `)
//         .eq('is_active', true)
//         .eq('is_available_today', true)
//         .order('first_name');

//       if (error) throw error;

//       const formattedDrivers = drivers.map(driver => ({
//         id: driver.id,
//         name: `${driver.first_name} ${driver.last_name}`,
//         email: driver.email,
//         phone: driver.phone,
//         mpg: driver.mpg || 30,
//         vehicle_type: driver.vehicle_type,
//         vehicle_capacity: driver.vehicle_capacity,
//         depot_name: driver.depots?.name || 'No Depot',
//         details: `${driver.depots?.name || 'No Depot'} - ${driver.mpg || 30} MPG`
//       }));

//       res.json({
//         success: true,
//         drivers: formattedDrivers,
//         total_available: formattedDrivers.length
//       });
//     } catch (error) {
//       console.error('Get available drivers error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to fetch available drivers',
//         error: error.message
//       });
//     }
//   },

//   // TAB 2: Assign specific driver to a route
//   async assignDriver(req, res) {
//     try {
//       const { route_id, driver_id } = req.body;

//       if (!route_id || !driver_id) {
//         return res.status(400).json({
//           success: false,
//           message: 'Route ID and Driver ID are required'
//         });
//       }

//       // Get driver details
//       const { data: driver, error: driverError } = await supabase
//         .from('drivers')
//         .select('*')
//         .eq('id', driver_id)
//         .eq('is_active', true)
//         .single();

//       if (driverError || !driver) {
//         return res.status(404).json({
//           success: false,
//           message: 'Driver not found or not available'
//         });
//       }

//       // Get route details for fuel cost recalculation
//       const { data: route, error: routeError } = await supabase
//         .from('routes')
//         .select('*')
//         .eq('id', route_id)
//         .single();

//       if (routeError || !route) {
//         return res.status(404).json({
//           success: false,
//           message: 'Route not found'
//         });
//       }

//       // Recalculate fuel cost with driver's actual MPG
//       const updatedFuelCost = this.calculateFuelCost(
//         route.total_distance_km,
//         driver.mpg || 30,
//         1.45
//       );

//       // Update route with driver assignment
//       const { data: updatedRoute, error: updateError } = await supabase
//         .from('routes')
//         .update({
//           driver_id: driver_id,
//           status: 'assigned',
//           estimated_fuel_cost: updatedFuelCost,
//           updated_at: new Date().toISOString()
//         })
//         .eq('id', route_id)
//         .select()
//         .single();

//       if (updateError) throw updateError;

//       console.log(`✅ Assigned driver ${driver.first_name} ${driver.last_name} to route ${route.route_name}`);

//       res.json({
//         success: true,
//         message: 'Driver assigned successfully',
//         driver: {
//           id: driver.id,
//           name: `${driver.first_name} ${driver.last_name} (${driver.mpg} MPG)`,
//           mpg: driver.mpg
//         },
//         route: updatedRoute
//       });
//     } catch (error) {
//       console.error('Assign driver error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to assign driver',
//         error: error.message
//       });
//     }
//   },

//   // TAB 2: Auto-assign drivers using load balancing
//   async autoAssignDrivers(req, res) {
//     try {
//       const { routes, method = 'round_robin' } = req.body;

//       if (!routes || routes.length === 0) {
//         return res.status(400).json({
//           success: false,
//           message: 'Routes are required for auto-assignment'
//         });
//       }

//       // Get available drivers
//       const { data: drivers, error: driversError } = await supabase
//         .from('drivers')
//         .select('*')
//         .eq('is_active', true)
//         .eq('is_available_today', true)
//         .order('first_name');

//       if (driversError) throw driversError;

//       if (drivers.length === 0) {
//         return res.status(400).json({
//           success: false,
//           message: 'No available drivers found for auto-assignment'
//         });
//       }

//       console.log(`🔄 Auto-assigning ${routes.length} routes to ${drivers.length} drivers using ${method}`);

//       const assignedRoutes = [];
//       let driverIndex = 0;

//       for (const route of routes) {
//         if (route.driver_id) {
//           assignedRoutes.push(route);
//           continue;
//         }

//         const selectedDriver = drivers[driverIndex % drivers.length];
        
//         // Get route details for fuel cost calculation
//         const { data: routeData } = await supabase
//           .from('routes')
//           .select('*')
//           .eq('id', route.route_id)
//           .single();

//         if (routeData) {
//           const updatedFuelCost = this.calculateFuelCost(
//             routeData.total_distance_km || route.total_distance_km || 0,
//             selectedDriver.mpg || 30,
//             1.45
//           );

//           await supabase
//             .from('routes')
//             .update({
//               driver_id: selectedDriver.id,
//               status: 'assigned',
//               estimated_fuel_cost: updatedFuelCost,
//               updated_at: new Date().toISOString()
//             })
//             .eq('id', route.route_id);

//           assignedRoutes.push({
//             ...route,
//             driver_id: selectedDriver.id,
//             driver_name: `${selectedDriver.first_name} ${selectedDriver.last_name} (${selectedDriver.mpg} MPG)`,
//             status: 'assigned',
//             estimated_fuel_cost: updatedFuelCost
//           });
//         } else {
//           assignedRoutes.push(route);
//         }

//         driverIndex++;
//       }

//       console.log(`✅ Auto-assigned drivers to ${assignedRoutes.length} routes`);

//       res.json({
//         success: true,
//         routes: assignedRoutes,
//         assignment_method: method,
//         assigned_count: assignedRoutes.filter(r => r.driver_id).length,
//         message: `Successfully auto-assigned drivers using ${method} method`
//       });
//     } catch (error) {
//       console.error('Auto-assign drivers error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to auto-assign drivers',
//         error: error.message
//       });
//     }
//   },

//   // TAB 3: Dispatch routes to drivers
//   async dispatchRoutes(req, res) {
//     try {
//       const { route_ids } = req.body;

//       if (!route_ids || route_ids.length === 0) {
//         return res.status(400).json({
//           success: false,
//           message: 'Route IDs are required for dispatch'
//         });
//       }

//       console.log(`📱 Dispatching ${route_ids.length} routes to drivers`);

//       const { data: dispatchedRoutes, error } = await supabase
//         .from('routes')
//         .update({
//           status: 'dispatched',
//           actual_start_time: new Date().toISOString(),
//           updated_at: new Date().toISOString()
//         })
//         .in('id', route_ids)
//         .select();

//       if (error) throw error;

//       console.log(`✅ Successfully dispatched ${dispatchedRoutes.length} routes`);

//       res.json({
//         success: true,
//         dispatched_routes: dispatchedRoutes.length,
//         routes: dispatchedRoutes,
//         message: `Successfully dispatched ${dispatchedRoutes.length} routes to drivers`
//       });
//     } catch (error) {
//       console.error('Dispatch routes error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to dispatch routes',
//         error: error.message
//       });
//     }
//   },

//   // TAB 3: Get detailed route information with orders
//   async getRouteDetails(req, res) {
//     try {
//       const { route_id } = req.params;

//       const { data: route, error: routeError } = await supabase
//         .from('routes')
//         .select(`
//           *,
//           drivers(first_name, last_name, phone, email)
//         `)
//         .eq('id', route_id)
//         .single();

//       if (routeError) throw routeError;

//       const { data: orders, error: ordersError } = await supabase
//         .from('orders')
//         .select('*')
//         .eq('route_id', route_id)
//         .order('sequence_number');

//       if (ordersError) throw ordersError;

//       res.json({
//         success: true,
//         route,
//         orders: orders.map((order, index) => ({
//           ...order,
//           estimated_arrival: new Date(Date.now() + (30 + index * 8) * 60000).toISOString()
//         }))
//       });
//     } catch (error) {
//       console.error('Get route details error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to fetch route details',
//         error: error.message
//       });
//     }
//   },

//   // TAB 3: Update delivery status for order
//   async updateDeliveryStatus(req, res) {
//     try {
//       const { order_id } = req.params;
//       const { status, notes, delivered_at } = req.body;

//       const validStatuses = ['pending', 'in_transit', 'delivered', 'failed', 'returned'];
//       if (!validStatuses.includes(status)) {
//         return res.status(400).json({
//           success: false,
//           message: `Status must be one of: ${validStatuses.join(', ')}`
//         });
//       }

//       const updateData = {
//         delivery_status: status,
//         updated_at: new Date().toISOString()
//       };

//       if (status === 'delivered' && delivered_at) {
//         updateData.delivered_at = delivered_at;
//       }

//       if (notes) {
//         updateData.delivery_notes = notes;
//       }

//       const { data: order, error } = await supabase
//         .from('orders')
//         .update(updateData)
//         .eq('id', order_id)
//         .select('route_id')
//         .single();

//       if (error) throw error;

//       let routeProgress = null;
//       if (order.route_id) {
//         const { data: routeData } = await supabase
//           .from('routes')
//           .select('progress_percentage, delivered_count, total_orders')
//           .eq('id', order.route_id)
//           .single();

//         if (routeData) {
//           routeProgress = {
//             completed: routeData.delivered_count,
//             total: routeData.total_orders,
//             percentage: routeData.progress_percentage
//           };
//         }
//       }

//       res.json({
//         success: true,
//         message: `Order marked as ${status}`,
//         order_id,
//         status,
//         route_progress: routeProgress
//       });
//     } catch (error) {
//       console.error('Update delivery status error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to update delivery status',
//         error: error.message
//       });
//     }
//   },

//   // Get route optimization history
//   async getOptimizationHistory(req, res) {
//     try {
//       const { data: history, error } = await supabase
//         .from('routes')
//         .select(`
//           id,
//           route_name,
//           delivery_date,
//           status,
//           total_orders,
//           total_distance_miles,
//           estimated_duration_minutes,
//           route_efficiency_score,
//           created_at,
//           drivers(first_name, last_name)
//         `)
//         .order('created_at', { ascending: false })
//         .limit(50);

//       if (error) throw error;

//       res.json({
//         success: true,
//         history: history.map(route => ({
//           ...route,
//           driver_name: route.drivers ? 
//             `${route.drivers.first_name} ${route.drivers.last_name}` : 
//             'Unassigned'
//         }))
//       });
//     } catch (error) {
//       console.error('Get optimization history error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to fetch optimization history',
//         error: error.message
//       });
//     }
//   },

//   // Helper functions
//   calculateDistance(lat1, lng1, lat2, lng2) {
//     const R = 6371;
//     const dLat = this.toRadians(lat2 - lat1);
//     const dLng = this.toRadians(lng2 - lng1);
//     const a = 
//       Math.sin(dLat/2) * Math.sin(dLat/2) +
//       Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
//       Math.sin(dLng/2) * Math.sin(dLng/2);
//     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
//     return R * c * 1.3; // Apply road factor
//   },

//   toRadians(degrees) {
//     return degrees * (Math.PI/180);
//   },

//   calculateTotalRouteDistance(depot, waypoints) {
//     let totalDistance = 0;
//     let currentPoint = depot;

//     waypoints.forEach(waypoint => {
//       totalDistance += this.calculateDistance(
//         currentPoint.latitude, currentPoint.longitude,
//         waypoint.lat, waypoint.lng
//       );
//       currentPoint = { latitude: waypoint.lat, longitude: waypoint.lng };
//     });

//     // Return to depot
//     totalDistance += this.calculateDistance(
//       currentPoint.latitude, currentPoint.longitude,
//       depot.latitude, depot.longitude
//     );

//     return totalDistance;
//   },

//   calculateRealisticRouteTime(distanceKm, orderCount) {
//     const avgSpeedKmh = 25; // Urban driving
//     const travelTimeMinutes = (distanceKm / avgSpeedKmh) * 60;
//     const deliveryTimePerStop = 6;
//     const totalDeliveryTime = orderCount * deliveryTimePerStop;
//     const timeBetweenStops = Math.max(0, orderCount - 1) * 3;
//     const depotTime = 15;
    
//     return Math.round(travelTimeMinutes + totalDeliveryTime + timeBetweenStops + depotTime);
//   },

//   calculateFuelCost(distanceKm, mpg, fuelPricePerLitre = 1.45) {
//     const distanceInMiles = distanceKm * 0.621371;
//     const gallonsUsed = distanceInMiles / mpg;
//     const litresUsed = gallonsUsed * 4.546;
//     return Math.round(litresUsed * fuelPricePerLitre * 100) / 100;
//   },

//   generateNavigationURL(depot, waypoints, useGoogleMaps = false) {
//     if (!waypoints || waypoints.length === 0) {
//       return useGoogleMaps ? 'https://maps.google.com/' : 'https://wego.here.com/';
//     }

//     if (useGoogleMaps) {
//       // Fixed Google Maps URL format
//       const origin = `${depot.latitude},${depot.longitude}`;
//       const destination = `${depot.latitude},${depot.longitude}`;
      
//       if (waypoints.length === 1) {
//         const waypoint = waypoints[0];
//         return `https://www.google.com/maps/dir/${origin}/${waypoint.lat},${waypoint.lng}/${destination}`;
//       } else {
//         const waypointStr = waypoints
//           .slice(0, 8) // Google Maps has limit of ~8 waypoints
//           .map(wp => `${wp.lat},${wp.lng}`)
//           .join('/');
//         return `https://www.google.com/maps/dir/${origin}/${waypointStr}/${destination}`;
//       }
//     } else {
//       // HERE Maps URL format
//       const origin = `${depot.latitude},${depot.longitude}`;
//       const destination = `${depot.latitude},${depot.longitude}`;
//       const via = waypoints.map(wp => `${wp.lat},${wp.lng}`).join(',');
      
//       return `https://wego.here.com/?map=${origin},15,normal&route=${origin},${via},${destination}`;
//     }
//   }
// };

// module.exports = ordersController;
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Import HERE API service
const hereAPI = require('../services/hereAPI');

const ordersController = {
  // TAB 1: Get eligible orders for route optimization
  async getEligibleOrders(req, res) {
    try {
      const { date = new Date().toISOString().split('T')[0] } = req.query;
      
      console.log(`🔍 Getting eligible orders for date: ${date}`);

      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('delivery_date', date)
        .in('status', ['pending', 'confirmed'])
        .is('route_id', null)
        .order('postcode');

      if (error) throw error;

      // Add calculated fields with accurate distances
      const processedOrders = orders.map(order => {
        const postcodeArea = order.postcode ? order.postcode.split(' ')[0] : 'Unknown';
        
        // Calculate accurate distance from Warrington depot
        let distanceFromDepot = 0;
        if (order.latitude && order.longitude) {
          const depotLat = 53.3808256;
          const depotLng = -2.575416;
          distanceFromDepot = this.calculateDistance(
            depotLat, depotLng, 
            parseFloat(order.latitude), parseFloat(order.longitude)
          );
        }

        return {
          ...order,
          postcode_area: postcodeArea,
          distance_from_depot_km: Math.round(distanceFromDepot * 100) / 100
        };
      });

      const postcodeAreas = [...new Set(processedOrders.map(order => order.postcode_area))].sort();

      console.log(`✅ Found ${processedOrders.length} orders across ${postcodeAreas.length} postcode areas`);

      res.json({
        success: true,
        orders: processedOrders,
        postcode_options: postcodeAreas,
        total_orders: processedOrders.length,
        date
      });
    } catch (error) {
      console.error('Get eligible orders error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch eligible orders',
        error: error.message
      });
    }
  },

  // TAB 1: OPTIMIZED Generate clusters with enhanced algorithm
  async generateClusters(req, res) {
    const startTime = Date.now();
    
    try {
      const { selected_postcodes, clustering_algorithm = 'kmeans', max_zones = 5, date } = req.body;

      if (!selected_postcodes || selected_postcodes.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one postcode must be selected'
        });
      }

      console.log(`🚀 OPTIMIZED clustering for postcodes: ${selected_postcodes.join(', ')}`);

      // OPTIMIZATION: Get orders in parallel with proper indexing
      const [{ data: orders, error }, availableDrivers] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .eq('delivery_date', date || new Date().toISOString().split('T')[0])
          .in('status', ['pending', 'confirmed'])
          .is('route_id', null),
        this.getAvailableDriverCount()
      ]);

      if (error) throw error;

      // OPTIMIZATION: Pre-filter and batch process orders
      const filteredOrders = this.preprocessOrdersForClustering(orders, selected_postcodes);

      if (filteredOrders.length === 0) {
        return res.json({
          success: true,
          zones: [],
          total_orders: 0,
          message: 'No orders found for selected postcodes',
          processingTime: Date.now() - startTime
        });
      }

      // OPTIMIZATION: Adaptive cluster count based on drivers and orders
      const adaptiveZones = Math.min(
        max_zones,
        Math.ceil(filteredOrders.length / 15), // 15 orders per zone max
        availableDrivers || max_zones
      );

      console.log(`📊 OPTIMIZED clustering: ${filteredOrders.length} orders → ${adaptiveZones} zones`);

      // OPTIMIZATION: Use fast clustering algorithm
      const zones = await hereAPI.performKMeansClustering(filteredOrders, adaptiveZones, 25); // Reduced iterations

      const processingTime = Date.now() - startTime;
      console.log(`✅ OPTIMIZED clustering completed in ${processingTime}ms`);

      res.json({
        success: true,
        zones,
        total_orders: filteredOrders.length,
        clustering_algorithm,
        processingTime,
        optimization_summary: {
          total_zones: zones.length,
          avg_orders_per_zone: Math.round(filteredOrders.length / zones.length),
          avg_route_distance: Math.round(zones.reduce((sum, z) => sum + (z.route_distance_km || 0), 0) / zones.length * 100) / 100,
          avg_duration_minutes: Math.round(zones.reduce((sum, z) => sum + (z.estimated_duration || 0), 0) / zones.length),
          total_depot_returns: zones.reduce((sum, z) => sum + (z.depot_returns_needed || 0), 0),
          efficiency_score: Math.round(zones.reduce((sum, z) => sum + (z.efficiency_score || 0), 0) / zones.length * 100) / 100
        }
      });
    } catch (error) {
      console.error('❌ OPTIMIZED clustering error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate clusters',
        error: error.message,
        processingTime: Date.now() - startTime
      });
    }
  },

  // OPTIMIZATION: Preprocess orders for better clustering performance
  preprocessOrdersForClustering(orders, selectedPostcodes) {
    const depotLat = 53.3808256;
    const depotLng = -2.575416;
    
    return orders.filter(order => {
      const postcodeArea = order.postcode ? order.postcode.split(' ')[0] : '';
      return selectedPostcodes.includes(postcodeArea) && 
             order.latitude && 
             order.longitude;
    }).map(order => {
      const lat = parseFloat(order.latitude);
      const lng = parseFloat(order.longitude);
      
      // Fast distance calculation using approximation
      const distanceFromDepot = this.calculateFastDistance(
        depotLat, depotLng, lat, lng
      );
      
      return {
        ...order,
        latitude: lat,
        longitude: lng,
        distance_from_depot_km: Math.round(distanceFromDepot * 100) / 100,
        postcode_area: order.postcode ? order.postcode.split(' ')[0] : 'Unknown'
      };
    });
  },

  // OPTIMIZATION: Fast distance calculation for preprocessing
  calculateFastDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    // Simplified calculation for speed
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  },

  // OPTIMIZATION: Get available driver count efficiently
  async getAvailableDriverCount() {
    try {
      const { count } = await supabase
        .from('drivers')
        .select('*', { count: 'exact', head: true })
        .eq('is_available_today', true);
      return count || 5;
    } catch (error) {
      console.warn('Could not get driver count, using default:', error.message);
    }
  },

  // TAB 2: OPTIMIZED Generate routes with depot return logic
  async generateRoutes(req, res) {
    const startTime = Date.now();
    
    try {
      const { zones, date = new Date().toISOString().split('T')[0] } = req.body;

      if (!zones || zones.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one zone is required to generate routes'
        });
      }

      console.log(`🚀 OPTIMIZED route generation for ${zones.length} zones with depot returns`);

      // Get settings and depot in parallel
      const [{ data: settings }, { data: primaryDepot }] = await Promise.all([
        supabase.from('settings').select('*').single(),
        supabase.from('depots').select('*').eq('is_primary', true).eq('is_active', true).single()
      ]);

      const depot = primaryDepot || {
        id: 'default',
        name: 'Warrington Distribution Center',
        latitude: 53.3808256,
        longitude: -2.575416
      };

      const routes = [];
      const maxOrdersPerTrip = settings?.max_deliveries_per_route || 20;

      // Process zones in parallel for better performance
      const routePromises = zones.map(async (zone, index) => {
        if (!zone.orders || zone.orders.length === 0) return null;

        console.log(`⚡ Processing route ${index + 1}/${zones.length}: ${zone.zone_name} (${zone.orders.length} orders)`);

        // OPTIMIZATION: Use pre-calculated route segments from clustering
        const routeSegments = zone.route_segments || this.createFastRouteSegments(zone.orders, maxOrdersPerTrip);
        
        // Fast route calculations
        const totalDistanceKm = zone.route_distance_km || this.calculateFastTotalDistance(depot, zone.orders);
        const estimatedDurationMinutes = zone.estimated_duration || this.calculateFastDuration(totalDistanceKm, zone.orders.length);
        const estimatedFuelCost = this.calculateFuelCost(totalDistanceKm, 30, settings?.default_fuel_price || 1.45);

        // Generate navigation URL
        const navigationUrl = this.generateOptimizedNavigationURL(depot, zone.orders, settings?.navigation_app_preference === 'google');

        return {
          route_name: zone.zone_name,
          delivery_date: date,
          status: 'generated',
          total_orders: zone.orders.length,
          total_distance_km: totalDistanceKm,
          total_distance_miles: Math.round(totalDistanceKm * 0.621371 * 100) / 100,
          estimated_duration_minutes: estimatedDurationMinutes,
          estimated_fuel_cost: estimatedFuelCost,
          depot_returns_needed: routeSegments.length,
          route_segments: routeSegments,
          orders: zone.orders,
          optimization_notes: `OPTIMIZED route with ${routeSegments.length} depot return(s) - Generated in under 1 second`,
          navigation_url: navigationUrl,
          efficiency_score: zone.efficiency_score || 0.8
        };
      });

      // Wait for all routes to be processed
      const routeResults = await Promise.all(routePromises);
      const validRoutes = routeResults.filter(route => route !== null);

      // Batch insert routes to database
      if (validRoutes.length > 0) {
        const { data: insertedRoutes, error: insertError } = await supabase
          .from('routes')
          .insert(validRoutes.map(route => ({
            route_name: route.route_name,
            delivery_date: route.delivery_date,
            status: route.status,
            total_orders: route.total_orders,
            total_distance_km: route.total_distance_km,
            estimated_duration_minutes: route.estimated_duration_minutes,
            estimated_fuel_cost: route.estimated_fuel_cost,
            optimization_notes: route.optimization_notes
          })))
          .select();

        if (insertError) throw insertError;

        // Update routes with database IDs
        validRoutes.forEach((route, index) => {
          route.id = insertedRoutes[index]?.id;
        });
      }

      const processingTime = Date.now() - startTime;
      console.log(`✅ OPTIMIZED route generation completed in ${processingTime}ms`);

      res.json({
        success: true,
        routes: validRoutes,
        total_routes: validRoutes.length,
        total_orders: validRoutes.reduce((sum, route) => sum + route.total_orders, 0),
        total_distance_km: Math.round(validRoutes.reduce((sum, route) => sum + route.total_distance_km, 0) * 100) / 100,
        total_duration_hours: Math.round(validRoutes.reduce((sum, route) => sum + route.estimated_duration_minutes, 0) / 60 * 100) / 100,
        total_depot_returns: validRoutes.reduce((sum, route) => sum + route.depot_returns_needed, 0),
        processingTime,
        optimization_summary: {
          avg_orders_per_route: Math.round(validRoutes.reduce((sum, route) => sum + route.total_orders, 0) / validRoutes.length),
          avg_duration_minutes: Math.round(validRoutes.reduce((sum, route) => sum + route.estimated_duration_minutes, 0) / validRoutes.length),
          avg_efficiency_score: Math.round(validRoutes.reduce((sum, route) => sum + (route.efficiency_score || 0), 0) / validRoutes.length * 100) / 100
        }
      });

    } catch (error) {
      console.error('❌ OPTIMIZED route generation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate routes',
        error: error.message,
        processingTime: Date.now() - startTime
      });
    }
  },

  // OPTIMIZATION: Fast route segment creation for depot returns
  createFastRouteSegments(orders, maxOrdersPerTrip) {
    const segments = [];
    let currentSegment = [];
    
    for (let i = 0; i < orders.length; i++) {
      currentSegment.push(orders[i]);
      
      if (currentSegment.length >= maxOrdersPerTrip || i === orders.length - 1) {
        segments.push({
          segment_id: segments.length + 1,
          orders: [...currentSegment],
          distance_km: this.calculateSegmentDistance(currentSegment),
          duration_minutes: this.calculateSegmentDuration(currentSegment),
          return_to_depot: true
        });
        currentSegment = [];
      }
    }
    
    return segments;
  },

  // OPTIMIZATION: Fast segment distance calculation
  calculateSegmentDistance(orders) {
    if (orders.length === 0) return 0;
    const avgDistance = orders.reduce((sum, order) => sum + (order.distance_from_depot_km || 5), 0) / orders.length;
    return Math.round((avgDistance * 2 + (orders.length - 1) * 2) * 100) / 100; // Round trip + inter-order
  },

  // OPTIMIZATION: Fast segment duration calculation
  calculateSegmentDuration(orders) {
    const distance = this.calculateSegmentDistance(orders);
    const drivingTime = (distance / 30) * 60; // 30 km/h average
    const serviceTime = orders.length * 8; // 8 minutes per delivery
    return Math.round(drivingTime + serviceTime + 15); // +15 for depot time
  },

  // OPTIMIZATION: Fast total distance calculation
  calculateFastTotalDistance(depot, orders) {
    if (orders.length === 0) return 0;
    const avgDistance = orders.reduce((sum, order) => sum + (order.distance_from_depot_km || 5), 0) / orders.length;
    return Math.round((avgDistance * 2 + orders.length * 1.5) * 100) / 100;
  },

  // OPTIMIZATION: Fast duration calculation
  calculateFastDuration(distanceKm, orderCount) {
    const drivingTime = (distanceKm / 30) * 60; // 30 km/h average with stops
    const serviceTime = orderCount * 8; // 8 minutes per delivery
    const depotTime = 20; // loading/unloading
    return Math.round(drivingTime + serviceTime + depotTime);
  },

  // OPTIMIZATION: Optimized navigation URL generation
  generateOptimizedNavigationURL(depot, orders, useGoogle = false) {
    // Limit waypoints for URL length constraints
    const maxWaypoints = useGoogle ? 10 : 25;
    const limitedOrders = orders.slice(0, maxWaypoints);
    
    if (useGoogle) {
      const origin = `${depot.latitude},${depot.longitude}`;
      const waypoints = limitedOrders.map(order => `${order.latitude},${order.longitude}`).join('|');
      return `https://www.google.com/maps/dir/${origin}/${waypoints}/${origin}`;
    } else {
      const waypoints = limitedOrders.map(order => `${order.latitude},${order.longitude}`).join(',');
      return `https://wego.here.com/directions/mix/${depot.latitude},${depot.longitude}/${waypoints}/${depot.latitude},${depot.longitude}`;
    }
  },

  // // TAB 2: Generate optimized routes with depot return logic
  // async generateRoutes(req, res) {
  //   try {
  //     const { zones, date = new Date().toISOString().split('T')[0] } = req.body;

  //     if (!zones || zones.length === 0) {
  //       return res.status(400).json({
  //         success: false,
  //         message: 'At least one zone is required to generate routes'
  //       });
  //     }

  //     console.log(`🚛 Generating optimized routes with depot returns for ${zones.length} zones`);

  //     const { data: settings } = await supabase
  //       .from('settings')
  //       .select('*')
  //       .single();

  //     const { data: primaryDepot } = await supabase
  //       .from('depots')
  //       .select('*')
  //       .eq('is_primary', true)
  //       .eq('is_active', true)
  //       .single();

  //     const depot = primaryDepot || {
  //       id: 'default',
  //       name: 'Warrington Distribution Center',
  //       latitude: 53.3808256,
  //       longitude: -2.575416
  //     };

  //     const routes = [];

  //     // Generate route for each zone with depot return logic
  //     for (let i = 0; i < zones.length; i++) {
  //       const zone = zones[i];
        
  //       if (!zone.orders || zone.orders.length === 0) continue;

  //       console.log(`🔄 Optimizing route ${i + 1}/${zones.length}: ${zone.zone_name} with ${zone.orders.length} orders`);

  //       // Calculate route segments with depot returns
  //       const routeSegments = await hereAPI.createRouteWithDepotReturns(
  //         depot,
  //         zone.orders,
  //         settings?.max_deliveries_per_route || 25
  //       );

  //       console.log(`📍 Route will have ${routeSegments.length} segment(s) with depot returns`);

  //       // Prepare waypoints for route optimization
  //       const waypoints = zone.orders.map(order => ({
  //         id: order.id,
  //         customer_name: order.customer_name,
  //         delivery_address: order.delivery_address,
  //         postcode: order.postcode,
  //         lat: parseFloat(order.latitude),
  //         lng: parseFloat(order.longitude),
  //         order_value: order.order_value || 0,
  //         weight: order.weight || 2,
  //         special_instructions: order.special_instructions
  //       }));

  //       // Calculate accurate route metrics
  //       const totalDistanceKm = hereAPI.calculateOptimizedRouteDistance(depot, waypoints);
  //       const totalDistanceMiles = totalDistanceKm * 0.621371;
        
  //       // Use realistic time calculation
  //       const estimatedDurationMinutes = hereAPI.calculateRealisticRouteTime(
  //         totalDistanceKm, 
  //         zone.orders.length
  //       );

  //       const estimatedFuelCost = this.calculateFuelCost(
  //         totalDistanceKm, 
  //         30,
  //         settings?.default_fuel_price || 1.45
  //       );

  //       // Generate navigation URL
  //       const useGoogleMaps = settings?.navigation_app_preference === 'google';
  //       const navigationUrl = this.generateNavigationURL(depot, waypoints, useGoogleMaps);

  //       // Create route record in database
  //       const { data: routeRecord, error: routeError } = await supabase
  //         .from('routes')
  //         .insert({
  //           route_name: zone.zone_name,
  //           delivery_date: date,
  //           status: 'generated',
  //           total_orders: zone.orders.length,
  //           total_distance_km: Math.round(totalDistanceKm * 100) / 100,
  //           total_distance_miles: Math.round(totalDistanceMiles * 100) / 100,
  //           estimated_duration_minutes: estimatedDurationMinutes,
  //           estimated_fuel_cost: estimatedFuelCost,
  //           navigation_url: navigationUrl,
  //           route_efficiency_score: zone.efficiency_score || 85,
  //           depot_returns_count: routeSegments.length,
  //           optimization_notes: `Enhanced routing with ${routeSegments.length} depot return(s), ${zone.orders.length} orders, realistic time: ${estimatedDurationMinutes}min`
  //         })
  //         .select()
  //         .single();

  //       if (routeError) {
  //         console.error('Failed to create route:', routeError);
  //         continue;
  //       }

  //       // Update orders with route assignment and sequence
  //       for (let j = 0; j < zone.orders.length; j++) {
  //         const order = zone.orders[j];
  //         await supabase
  //           .from('orders')
  //           .update({
  //             route_id: routeRecord.id,
  //             sequence_number: j + 1,
  //             status: 'assigned'
  //           })
  //           .eq('id', order.id);
  //       }

  //       // Add sequence and timing to orders
  //       const ordersWithSequence = zone.orders.map((order, index) => ({
  //         ...order,
  //         sequence: index + 1,
  //         estimated_arrival: new Date(Date.now() + (30 + index * 8) * 60000).toISOString()
  //       }));

  //       routes.push({
  //         route_id: routeRecord.id,
  //         route_name: routeRecord.route_name,
  //         zone_color: zone.color_hex,
  //         status: 'generated',
  //         total_orders: zone.orders.length,
  //         total_distance_km: totalDistanceKm,
  //         total_distance_miles: totalDistanceMiles,
  //         estimated_duration_minutes: estimatedDurationMinutes,
  //         estimated_fuel_cost: estimatedFuelCost,
  //         navigation_url: navigationUrl,
  //         route_efficiency_score: routeRecord.route_efficiency_score,
  //         depot_returns_count: routeSegments.length,
  //         source: 'optimized_with_returns',
  //         orders: ordersWithSequence
  //       });

  //       console.log(`✅ Route ${i + 1} created: ${totalDistanceKm.toFixed(2)}km, ${estimatedDurationMinutes}min, ${routeSegments.length} depot return(s)`);
  //     }

  //     console.log(`✅ Generated ${routes.length} optimized routes with depot return logic`);

  //     res.json({
  //       success: true,
  //       routes,
  //       optimization_summary: {
  //         total_routes: routes.length,
  //         total_orders: routes.reduce((sum, r) => sum + r.total_orders, 0),
  //         total_distance_km: Math.round(routes.reduce((sum, r) => sum + r.total_distance_km, 0) * 100) / 100,
  //         total_distance_miles: Math.round(routes.reduce((sum, r) => sum + r.total_distance_miles, 0) * 100) / 100,
  //         total_estimated_duration: routes.reduce((sum, r) => sum + r.estimated_duration_minutes, 0),
  //         total_depot_returns: routes.reduce((sum, r) => sum + r.depot_returns_count, 0),
  //         avg_efficiency_score: Math.round(routes.reduce((sum, r) => sum + r.route_efficiency_score, 0) / routes.length)
  //       }
  //     });
  //   } catch (error) {
  //     console.error('Generate routes error:', error);
  //     res.status(500).json({
  //       success: false,
  //       message: 'Failed to generate optimized routes',
  //       error: error.message
  //     });
  //   }
  // },

  // Helper: Calculate distance with road factor
  // calculateDistance(lat1, lng1, lat2, lng2) {
  //   const R = 6371;
  //   const dLat = this.toRadians(lat2 - lat1);
  //   const dLng = this.toRadians(lng2 - lng1);
  //   const a = 
  //     Math.sin(dLat/2) * Math.sin(dLat/2) +
  //     Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
  //     Math.sin(dLng/2) * Math.sin(dLng/2);
  //   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  //   return R * c * 1.3; // Road factor applied
  // },

  // toRadians(degrees) {
  //   return degrees * (Math.PI/180);
  // },

  // calculateFuelCost(distanceKm, mpg, fuelPricePerLitre = 1.45) {
  //   const distanceInMiles = distanceKm * 0.621371;
  //   const gallonsUsed = distanceInMiles / mpg;
  //   const litresUsed = gallonsUsed * 4.546;
  //   return Math.round(litresUsed * fuelPricePerLitre * 100) / 100;
  // },

  // generateNavigationURL(depot, waypoints, useGoogleMaps = false) {
  //   if (!waypoints || waypoints.length === 0) {
  //     return useGoogleMaps ? 'https://maps.google.com/' : 'https://wego.here.com/';
  //   }

  //   const origin = `${depot.latitude},${depot.longitude}`;
  //   const destination = `${depot.latitude},${depot.longitude}`;

  //   if (useGoogleMaps) {
  //     if (waypoints.length === 1) {
  //       const wp = waypoints[0];
  //       return `https://www.google.com/maps/dir/${origin}/${wp.lat},${wp.lng}/${destination}`;
  //     }
      
  //     const waypointStr = waypoints
  //       .slice(0, 8)
  //       .map(wp => `${wp.lat},${wp.lng}`)
  //       .join('/');
  //     return `https://www.google.com/maps/dir/${origin}/${waypointStr}/${destination}`;
  //   } else {
  //     if (waypoints.length === 1) {
  //       const wp = waypoints[0];
  //       return `https://wego.here.com/directions/drive/${origin}/${wp.lat},${wp.lng}/${destination}`;
  //     }
      
  //     const waypointStr = waypoints
  //       .map(wp => `${wp.lat},${wp.lng}`)
  //       .join('/');
  //     return `https://wego.here.com/directions/drive/${origin}/${waypointStr}/${destination}`;
  //   }
  // }
  // ADD THIS TO YOUR ordersController.js - REPLACE generateRoutes function

async generateRoutes(req, res) {
  try {
    const { zones, date = new Date().toISOString().split('T')[0] } = req.body;

    if (!zones || zones.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one zone is required to generate routes'
      });
    }

    console.log(`🚛 Generating optimized routes for ${zones.length} zones`);

    // Get settings
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .single();

    const { data: primaryDepot } = await supabase
      .from('depots')
      .select('*')
      .eq('is_primary', true)
      .eq('is_active', true)
      .single();

    const depot = primaryDepot || {
      id: 'default',
      name: 'Warrington Distribution Center',
      latitude: 53.3808256,
      longitude: -2.575416
    };

    const routes = [];
    const minOrdersBeforeReturn = 8; // CRITICAL: Define here

    // Generate route for each zone
    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i];
      
      if (!zone.orders || zone.orders.length === 0) continue;

      console.log(`🔄 Processing zone ${i + 1}: ${zone.zone_name} with ${zone.orders.length} orders`);

      // CRITICAL FIX 1: Calculate depot returns
      const depotReturnsNeeded = Math.ceil(zone.orders.length / minOrdersBeforeReturn);
      console.log(`📍 Zone will need ${depotReturnsNeeded} depot return(s)`);

      // CRITICAL FIX 2: Calculate actual route distance
      let totalDistanceKm = 0;
      
      // Distance from depot to first order
      if (zone.orders[0]) {
        totalDistanceKm += this.calculateDistance(
          depot.latitude, depot.longitude,
          parseFloat(zone.orders[0].latitude) || depot.latitude,
          parseFloat(zone.orders[0].longitude) || depot.longitude
        );
      }

      // Distance between consecutive orders
      for (let j = 0; j < zone.orders.length - 1; j++) {
        const order1 = zone.orders[j];
        const order2 = zone.orders[j + 1];
        
        totalDistanceKm += this.calculateDistance(
          parseFloat(order1.latitude) || depot.latitude,
          parseFloat(order1.longitude) || depot.longitude,
          parseFloat(order2.latitude) || depot.latitude,
          parseFloat(order2.longitude) || depot.longitude
        );
      }

      // Distance from last order back to depot (first return)
      if (zone.orders.length > 0) {
        const lastOrder = zone.orders[zone.orders.length - 1];
        totalDistanceKm += this.calculateDistance(
          parseFloat(lastOrder.latitude) || depot.latitude,
          parseFloat(lastOrder.longitude) || depot.longitude,
          depot.latitude, depot.longitude
        );
      }

      // Add extra distance for additional depot returns
      if (depotReturnsNeeded > 1) {
        // Estimate extra distance for mid-route returns
        const avgOrderDistance = totalDistanceKm / (zone.orders.length + 1);
        totalDistanceKm += avgOrderDistance * (depotReturnsNeeded - 1) * 2; // Round trip per return
      }

      const totalDistanceMiles = totalDistanceKm * 0.621371;

      // CRITICAL FIX 3: Calculate realistic time
      const urbanSpeedKmh = 25;
      const ruralSpeedKmh = 45;
      const serviceTimeMinutes = 6;
      
      // Determine urban/rural split based on distance
      const urbanRatio = totalDistanceKm < 20 ? 0.7 : 0.3;
      const ruralRatio = 1 - urbanRatio;
      
      const urbanDistance = totalDistanceKm * urbanRatio;
      const ruralDistance = totalDistanceKm * ruralRatio;
      
      // Calculate travel time
      const urbanTime = (urbanDistance / urbanSpeedKmh) * 60;
      const ruralTime = (ruralDistance / ruralSpeedKmh) * 60;
      const travelTimeMinutes = urbanTime + ruralTime;
      
      // Service time
      const totalServiceTime = zone.orders.length * serviceTimeMinutes;
      
      // Time between stops
      const timeBetweenStops = Math.max(0, zone.orders.length - 1) * 2;
      
      // Depot time (loading/unloading per return)
      const depotTime = 15 * depotReturnsNeeded;
      
      // Buffer (10%)
      const buffer = (travelTimeMinutes + totalServiceTime) * 0.1;
      
      const estimatedDurationMinutes = Math.round(
        travelTimeMinutes + totalServiceTime + timeBetweenStops + depotTime + buffer
      );

      console.log(`📊 Zone ${i + 1} Metrics:
        Distance: ${totalDistanceKm.toFixed(2)}km
        Duration: ${estimatedDurationMinutes}min
        Depot Returns: ${depotReturnsNeeded}
        Travel: ${Math.round(travelTimeMinutes)}min
        Service: ${totalServiceTime}min
        Other: ${Math.round(timeBetweenStops + depotTime + buffer)}min
      `);

      // Calculate fuel cost
      const estimatedFuelCost = this.calculateFuelCost(
        totalDistanceKm,
        30,
        settings?.default_fuel_price || 1.45
      );

      // Generate navigation URL
      const waypoints = zone.orders.map(order => ({
        id: order.id,
        customer_name: order.customer_name,
        delivery_address: order.delivery_address,
        postcode: order.postcode,
        lat: parseFloat(order.latitude),
        lng: parseFloat(order.longitude),
        order_value: order.order_value || 0,
        weight: order.weight || 2,
        special_instructions: order.special_instructions
      }));

      const useGoogleMaps = settings?.navigation_app_preference === 'google';
      const navigationUrl = this.generateNavigationURL(depot, waypoints, useGoogleMaps);

      // Create route record in database
      const { data: routeRecord, error: routeError } = await supabase
        .from('routes')
        .insert({
          route_name: zone.zone_name,
          delivery_date: date,
          status: 'generated',
          total_orders: zone.orders.length,
          total_distance_km: Math.round(totalDistanceKm * 100) / 100,
          total_distance_miles: Math.round(totalDistanceMiles * 100) / 100,
          estimated_duration_minutes: estimatedDurationMinutes,
          estimated_fuel_cost: estimatedFuelCost,
          navigation_url: navigationUrl,
          route_efficiency_score: zone.efficiency_score || 85,
          depot_returns_count: depotReturnsNeeded,
          optimization_notes: `Realistic routing: ${totalDistanceKm.toFixed(1)}km, ${estimatedDurationMinutes}min, ${depotReturnsNeeded} depot return(s)`
        })
        .select()
        .single();

      if (routeError) {
        console.error('Failed to create route:', routeError);
        continue;
      }

      // Update orders with route assignment
      for (let j = 0; j < zone.orders.length; j++) {
        const order = zone.orders[j];
        await supabase
          .from('orders')
          .update({
            route_id: routeRecord.id,
            sequence_number: j + 1,
            status: 'assigned'
          })
          .eq('id', order.id);
      }

      // Add to routes array
      routes.push({
        route_id: routeRecord.id,
        route_name: routeRecord.route_name,
        zone_color: zone.color_hex,
        status: 'generated',
        total_orders: zone.orders.length,
        total_distance_km: totalDistanceKm,
        total_distance_miles: totalDistanceMiles,
        estimated_duration_minutes: estimatedDurationMinutes,
        estimated_fuel_cost: estimatedFuelCost,
        navigation_url: navigationUrl,
        route_efficiency_score: routeRecord.route_efficiency_score,
        depot_returns_count: depotReturnsNeeded,
        source: 'optimized_realistic',
        orders: zone.orders.map((order, index) => ({
          ...order,
          sequence: index + 1,
          estimated_arrival: new Date(Date.now() + (30 + index * 8) * 60000).toISOString()
        }))
      });

      console.log(`✅ Route ${i + 1} created successfully`);
    }

    console.log(`\n✅ Generated ${routes.length} routes with realistic calculations\n`);

    res.json({
      success: true,
      routes,
      optimization_summary: {
        total_routes: routes.length,
        total_orders: routes.reduce((sum, r) => sum + r.total_orders, 0),
        total_distance_km: Math.round(routes.reduce((sum, r) => sum + r.total_distance_km, 0) * 100) / 100,
        total_distance_miles: Math.round(routes.reduce((sum, r) => sum + r.total_distance_miles, 0) * 100) / 100,
        total_estimated_duration: routes.reduce((sum, r) => sum + r.estimated_duration_minutes, 0),
        total_depot_returns: routes.reduce((sum, r) => sum + r.depot_returns_count, 0),
        avg_efficiency_score: Math.round(routes.reduce((sum, r) => sum + r.route_efficiency_score, 0) / routes.length),
        avg_distance_per_route: Math.round(routes.reduce((sum, r) => sum + r.total_distance_km, 0) / routes.length * 100) / 100,
        avg_duration_per_route: Math.round(routes.reduce((sum, r) => sum + r.estimated_duration_minutes, 0) / routes.length)
      }
    });
  } catch (error) {
    console.error('Generate routes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate optimized routes',
      error: error.message
    });
  }
},

// ADD THESE HELPER FUNCTIONS if not already present
calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = this.toRadians(lat2 - lat1);
  const dLng = this.toRadians(lng2 - lng1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 1.3; // Apply road factor
},

toRadians(degrees) {
  return degrees * (Math.PI/180);
},

calculateFuelCost(distanceKm, mpg, fuelPricePerLitre = 1.45) {
  const distanceInMiles = distanceKm * 0.621371;
  const gallonsUsed = distanceInMiles / mpg;
  const litresUsed = gallonsUsed * 4.546;
  return Math.round(litresUsed * fuelPricePerLitre * 100) / 100;
},

generateNavigationURL(depot, waypoints, useGoogleMaps = false) {
  if (!waypoints || waypoints.length === 0) {
    return useGoogleMaps ? 'https://maps.google.com/' : 'https://wego.here.com/';
  }

  const origin = `${depot.latitude},${depot.longitude}`;
  const destination = `${depot.latitude},${depot.longitude}`;

  if (useGoogleMaps) {
    if (waypoints.length === 1) {
      const wp = waypoints[0];
      return `https://www.google.com/maps/dir/${origin}/${wp.lat},${wp.lng}/${destination}`;
    }
    
    const waypointStr = waypoints
      .slice(0, 8) // Google Maps limit
      .map(wp => `${wp.lat},${wp.lng}`)
      .join('/');
    return `https://www.google.com/maps/dir/${origin}/${waypointStr}/${destination}`;
  } else {
    if (waypoints.length === 1) {
      const wp = waypoints[0];
      return `https://wego.here.com/directions/drive/${origin}/${wp.lat},${wp.lng}/${destination}`;
    }
    
    const waypointStr = waypoints
      .map(wp => `${wp.lat},${wp.lng}`)
      .join('/');
    return `https://wego.here.com/directions/drive/${origin}/${waypointStr}/${destination}`;
  }
}
};

module.exports = ordersController;