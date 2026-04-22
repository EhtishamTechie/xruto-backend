

// const axios = require('axios');

// class HereAPIService {
//   constructor() {
//     this.apiKey = process.env.HERE_API_KEY;
//     this.baseURL = 'https://router.hereapi.com/v8';
//     this.geocodeURL = 'https://geocode.search.hereapi.com/v1';
//     this.matrixURL = 'https://matrix.router.hereapi.com/v8';
    
//     // Optimization parameters
//     this.optimizationWeights = {
//       distance: 0.4,      // 40% weight for distance
//       time: 0.35,         // 35% weight for travel time
//       workload: 0.25      // 25% weight for workload balance
//     };
    
//     this.serviceTimeMinutes = 5;  // Minutes per stop for unloading
//     this.maxWorkingHours = 8;     // Maximum working hours per driver
//     this.maxStopsPerRoute = 25;   // Maximum stops per route
    
//     if (!this.apiKey) {
//       console.warn('⚠️ HERE API key not configured - using fallback methods');
//     } else {
//       console.log('✅ HERE API service initialized with key');
//     }
//   }

//   // Enhanced geocoding with better fallback system
//   async geocodeAddress(address, postcode = '') {
//     if (!this.apiKey) {
//       return this.getFallbackCoordinates(postcode);
//     }

//     try {
//       const query = postcode ? `${address}, ${postcode}, UK` : `${address}, UK`;
      
//       console.log(`🔍 Geocoding: ${query}`);
      
//       const response = await axios.get(`${this.geocodeURL}/geocode`, {
//         params: {
//           q: query,
//           apikey: this.apiKey,
//           limit: 1,
//           in: 'countryCode:GBR',
//           lang: 'en'
//         },
//         timeout: 10000
//       });

//       if (response.data.items && response.data.items.length > 0) {
//         const bestMatch = response.data.items[0];
//         const location = bestMatch.position;
        
//         console.log(`✅ Geocoded successfully: ${location.lat}, ${location.lng}`);
        
//         return {
//           lat: location.lat,
//           lng: location.lng,
//           formatted_address: bestMatch.address.label,
//           confidence: bestMatch.scoring?.queryScore || 0.8,
//           source: 'here_api'
//         };
//       }

//       console.warn('No geocoding results, using fallback');
//       return this.getFallbackCoordinates(postcode);
//     } catch (error) {
//       console.error('HERE Geocoding error:', error.message);
//       return this.getFallbackCoordinates(postcode);
//     }
//   }

//   // Comprehensive UK postcode coordinate mapping
//   getFallbackCoordinates(postcode) {
//     const postcodeMap = {
//         'WA4': { lat: 53.3808, lng: -2.5740, area: 'Warrington Central' },
//     'WA1': { lat: 53.3900, lng: -2.5970, area: 'Warrington Town' },
//     'WA2': { lat: 53.3950, lng: -2.6100, area: 'Warrington North' },
//     'WA3': { lat: 53.4100, lng: -2.5800, area: 'Warrington East' },
//     'WA5': { lat: 53.3650, lng: -2.5950, area: 'Warrington South' },
//       // Brighton & Hove postcodes (mapped to Warrington for local delivery)
//       // 'BN1': { lat: 53.3808, lng: -2.5740, area: 'Warrington Central' },
//       // 'BN2': { lat: 50.8289, lng: -0.1278, area: 'Brighton North' },
//       // 'BN3': { lat: 50.8267, lng: -0.1678, area: 'Hove' },
//       // 'BN4': { lat: 50.8456, lng: -0.1834, area: 'West Hove' },
//       // 'BN5': { lat: 50.8567, lng: -0.1456, area: 'Preston Park' },
//       // 'BN6': { lat: 50.8889, lng: -0.1423, area: 'Henfield' },
//       // 'BN7': { lat: 50.8741, lng: 0.0095, area: 'Lewes' },
//       // 'BN8': { lat: 50.8456, lng: 0.0567, area: 'Burgess Hill' },
//       // 'BN9': { lat: 50.8234, lng: 0.1123, area: 'Newhaven' },
//       // 'BN10': { lat: 50.7967, lng: -0.2634, area: 'Peacehaven' },
//       // 'BN11': { lat: 50.8103, lng: -0.3715, area: 'Worthing' },
//       // 'BN12': { lat: 50.8234, lng: -0.4123, area: 'Worthing West' },
//       // 'BN13': { lat: 50.8345, lng: -0.3456, area: 'Lancing' },
//       // 'BN14': { lat: 50.8456, lng: -0.3789, area: 'Worthing North' },
//       // 'BN15': { lat: 50.8567, lng: -0.4012, area: 'Steyning' },
//       // 'BN16': { lat: 50.8234, lng: -0.4567, area: 'Littlehampton' },
//       // 'BN17': { lat: 50.8123, lng: -0.4789, area: 'Littlehampton East' },
//       // 'BN18': { lat: 50.8345, lng: -0.4234, area: 'Arundel' },
//       // 'BN20': { lat: 50.7456, lng: 0.2567, area: 'Seaford' },
//       // 'BN21': { lat: 50.7687, lng: 0.2895, area: 'Eastbourne' },
//       // 'BN22': { lat: 50.7789, lng: 0.3123, area: 'Eastbourne East' },
//       // 'BN23': { lat: 50.7567, lng: 0.2678, area: 'Eastbourne Central' },
//       // 'BN24': { lat: 50.7345, lng: 0.2456, area: 'Pevensey' },
//       // 'BN25': { lat: 50.7234, lng: 0.2234, area: 'Seaford East' },
//       // 'BN26': { lat: 50.7123, lng: 0.1789, area: 'Polegate' },
//       // 'BN27': { lat: 50.7456, lng: 0.1567, area: 'Hailsham' },
      
//       // Other regional postcodes
//       // 'RH10': { lat: 51.1127, lng: -0.1905, area: 'Crawley' },
//       // 'RH11': { lat: 51.1234, lng: -0.2123, area: 'Crawley West' },
//       // 'RH12': { lat: 51.0567, lng: -0.2456, area: 'Horsham' },
//       // 'RH13': { lat: 51.0234, lng: -0.2789, area: 'Horsham South' },
//       // 'RH14': { lat: 51.0123, lng: -0.3123, area: 'Billingshurst' },
//       // 'RH15': { lat: 50.9789, lng: -0.1456, area: 'Burgess Hill' },
//       // 'RH16': { lat: 50.9567, lng: -0.1234, area: 'Haywards Heath' },
//       // 'RH17': { lat: 50.9345, lng: -0.0789, area: 'Haywards Heath East' },
//       // 'TN6': { lat: 51.1567, lng: 0.0123, area: 'Crowborough' },
//       // 'TN22': { lat: 50.9123, lng: 0.0456, area: 'Uckfield' }
//     };
//     const area = postcode ? postcode.substring(0, postcode.indexOf(' ')) || postcode.substring(0, 3) : 'WA4';
//     // const area = postcode ? postcode.substring(0, postcode.indexOf(' ')) || postcode.substring(0, 3) : 'BN1';
//     // const coords = postcodeMap[area] || postcodeMap['BN1'];
//     const coords = postcodeMap[area] || postcodeMap['WA4'];  // Change from 'BN1' to 'WA4'
    
//     // Add small random offset to avoid identical coordinates
//     const offset = 0.001;
//     return {
//       lat: coords.lat + (Math.random() - 0.5) * offset,
//       lng: coords.lng + (Math.random() - 0.5) * offset,
//       formatted_address: `${coords.area}, UK`,
//       confidence: 0.7,
//       source: 'fallback'
//     };
//   }

//   // Enhanced K-means clustering with workload balancing
//   async performKMeansClustering(orders, numberOfClusters = 5, maxIterations = 50) {
//     console.log(`🔄 Multi-objective K-means clustering: ${orders.length} orders → ${numberOfClusters} clusters`);

//     if (orders.length === 0) {
//       return [];
//     }

//     // Ensure we have coordinates for all orders
//     const validOrders = orders.filter(order => 
//       order.latitude && order.longitude && 
//       !isNaN(parseFloat(order.latitude)) && 
//       !isNaN(parseFloat(order.longitude))
//     );

//     if (validOrders.length === 0) {
//       console.warn('No valid coordinates found in orders');
//       return [];
//     }

//     // Calculate optimal cluster count considering workload constraints
//     const adjustedClusters = this.calculateOptimalClusterCount(validOrders, numberOfClusters);
//     console.log(`📊 Optimal cluster count: ${adjustedClusters} for ${validOrders.length} orders`);

//     // If we have fewer orders than clusters, create one cluster per order
//     if (validOrders.length <= adjustedClusters) {
//       return validOrders.map((order, index) => ({
//         zone_id: `zone_${index + 1}`,
//         zone_name: `Zone ${index + 1} - ${order.postcode}`,
//         orders: [order],
//         center: { lat: parseFloat(order.latitude), lng: parseFloat(order.longitude) },
//         color_hex: this.getZoneColor(index),
//         total_orders: 1,
//         workload_score: this.calculateWorkloadScore([order]),
//         avg_distance_from_depot: parseFloat(order.distance_from_depot_km) || 0,
//         estimated_duration: this.calculateTotalRouteTime([order]),
//         estimated_working_hours: this.calculateWorkingHours([order])
//       }));
//     }

//     try {
//       // Use enhanced K-means++ initialization with workload consideration
//       let centroids = this.initializeCentroidsWithWorkload(validOrders, adjustedClusters);
//       let clusters = [];
//       let previousCentroids = [];
//       let iterations = 0;
//       let converged = false;

//       console.log(`🎯 Starting multi-objective K-means iterations (max: ${maxIterations})`);

//       do {
//         previousCentroids = centroids.map(c => ({ ...c }));
        
//         // Assign orders to clusters using multi-objective scoring
//         clusters = this.assignOrdersToOptimalClusters(validOrders, centroids);
        
//         // Update centroids with workload consideration
//         centroids = this.updateCentroidsWithWorkload(clusters);
        
//         // Check for convergence
//         converged = this.hasConvergedMultiObjective(previousCentroids, centroids, 0.0005);
        
//         if (converged) {
//           console.log(`✅ Multi-objective K-means converged after ${iterations + 1} iterations`);
//           break;
//         }
        
//         iterations++;
//       } while (iterations < maxIterations);

//       if (!converged) {
//         console.log(`⚠️ K-means reached max iterations (${maxIterations})`);
//       }

//       // Perform post-processing workload balancing
//       clusters = this.balanceWorkloadAcrossClusters(clusters);

//       // Format clusters for API response
//       const formattedClusters = clusters
//         .filter(cluster => cluster.orders.length > 0)
//         .map((cluster, index) => {
//           const totalValue = cluster.orders.reduce((sum, order) => sum + (order.order_value || 0), 0);
//           const totalWeight = cluster.orders.reduce((sum, order) => sum + (order.weight || 2), 0);
          
//           return {
//             zone_id: `zone_${index + 1}`,
//             zone_name: `Zone ${index + 1} - ${this.getClusterPostcodes(cluster.orders)}`,
//             orders: cluster.orders,
//             center: cluster.centroid,
//             color_hex: this.getZoneColor(index),
//             total_orders: cluster.orders.length,
//             total_value: Math.round(totalValue * 100) / 100,
//             total_weight_kg: Math.round(totalWeight * 100) / 100,
//             workload_score: this.calculateWorkloadScore(cluster.orders),
//             avg_distance_from_depot: this.calculateAvgDistanceFromDepot(cluster.orders),
//             estimated_duration: this.calculateTotalRouteTime(cluster.orders),
//             estimated_working_hours: this.calculateWorkingHours(cluster.orders),
//             efficiency_score: this.calculateMultiObjectiveEfficiency(cluster.orders, cluster.centroid),
//             is_overloaded: this.isClusterOverloaded(cluster.orders)
//           };
//         });

//       console.log(`✅ Generated ${formattedClusters.length} workload-balanced clusters`);
//       return formattedClusters;

//     } catch (error) {
//       console.error('Multi-objective K-means clustering error:', error);
//       throw error;
//     }
//   }

//   // Calculate optimal cluster count considering workload constraints
//   calculateOptimalClusterCount(orders, requestedClusters) {
//     const totalOrders = orders.length;
//     const idealOrdersPerCluster = Math.min(this.maxStopsPerRoute, Math.ceil(totalOrders / requestedClusters));
//     const minClusters = Math.ceil(totalOrders / this.maxStopsPerRoute);
    
//     // Ensure we don't exceed working hour limits
//     const avgServiceTime = this.serviceTimeMinutes;
//     const avgTravelTime = this.estimateAverageTravelTime(orders);
//     const totalTimePerOrder = avgServiceTime + avgTravelTime;
//     const maxOrdersPerWorkingDay = Math.floor((this.maxWorkingHours * 60) / totalTimePerOrder);
    
//     const workloadBasedClusters = Math.ceil(totalOrders / maxOrdersPerWorkingDay);
    
//     return Math.max(minClusters, Math.min(requestedClusters, workloadBasedClusters));
//   }

//   // Initialize centroids with workload consideration
//   initializeCentroidsWithWorkload(orders, k) {
//     const centroids = [];
//     const ordersCopy = [...orders];
    
//     // Choose first centroid from high-density area
//     const densityScores = orders.map(order => this.calculateDensityScore(order, orders));
//     const maxDensityIndex = densityScores.indexOf(Math.max(...densityScores));
    
//     centroids.push({
//       lat: parseFloat(orders[maxDensityIndex].latitude),
//       lng: parseFloat(orders[maxDensityIndex].longitude),
//       workloadCapacity: this.maxStopsPerRoute
//     });

//     // Choose remaining centroids considering both distance and workload distribution
//     for (let i = 1; i < k; i++) {
//       const scores = ordersCopy.map(order => {
//         const minDist = Math.min(...centroids.map(centroid =>
//           this.calculateHaversineDistance(
//             parseFloat(order.latitude), parseFloat(order.longitude),
//             centroid.lat, centroid.lng
//           )
//         ));
        
//         // Combine distance and workload factors
//         const densityScore = this.calculateDensityScore(order, ordersCopy);
//         return (minDist * minDist) + (densityScore * 0.1);
//       });

//       const totalScore = scores.reduce((sum, s) => sum + s, 0);
//       if (totalScore === 0) break;
      
//       const random = Math.random() * totalScore;
      
//       let cumulative = 0;
//       for (let j = 0; j < ordersCopy.length; j++) {
//         cumulative += scores[j];
//         if (cumulative >= random) {
//           centroids.push({
//             lat: parseFloat(ordersCopy[j].latitude),
//             lng: parseFloat(ordersCopy[j].longitude),
//             workloadCapacity: this.maxStopsPerRoute
//           });
//           break;
//         }
//       }
//     }

//     return centroids;
//   }

//   // Calculate density score for an order
//   calculateDensityScore(targetOrder, allOrders) {
//     const radius = 2; // 2km radius
//     const nearbyOrders = allOrders.filter(order => {
//       if (order === targetOrder) return false;
//       const distance = this.calculateHaversineDistance(
//         parseFloat(targetOrder.latitude), parseFloat(targetOrder.longitude),
//         parseFloat(order.latitude), parseFloat(order.longitude)
//       );
//       return distance <= radius;
//     });
    
//     return nearbyOrders.length;
//   }

//   // Assign orders to clusters using multi-objective scoring
//   assignOrdersToOptimalClusters(orders, centroids) {
//     const clusters = centroids.map(centroid => ({
//       centroid,
//       orders: [],
//       currentWorkload: 0
//     }));

//     // Sort orders by priority (distance from depot, urgency, etc.)
//     const sortedOrders = [...orders].sort((a, b) => {
//       const aDistance = parseFloat(a.distance_from_depot_km) || 0;
//       const bDistance = parseFloat(b.distance_from_depot_km) || 0;
//       return aDistance - bDistance; // Closer orders first
//     });

//     sortedOrders.forEach(order => {
//       let bestClusterIndex = 0;
//       let bestScore = Infinity;

//       clusters.forEach((cluster, index) => {
//         // Skip if cluster is at capacity
//         if (cluster.orders.length >= this.maxStopsPerRoute) {
//           return;
//         }

//         const distance = this.calculateHaversineDistance(
//           parseFloat(order.latitude), parseFloat(order.longitude),
//           cluster.centroid.lat, cluster.centroid.lng
//         );

//         // Calculate multi-objective score
//         const workloadScore = cluster.orders.length / this.maxStopsPerRoute;
//         const timeScore = this.estimateAdditionalTime(cluster.orders, order) / (this.maxWorkingHours * 60);
        
//         const combinedScore = 
//           (distance * this.optimizationWeights.distance) +
//           (workloadScore * this.optimizationWeights.workload) +
//           (timeScore * this.optimizationWeights.time);

//         if (combinedScore < bestScore) {
//           bestScore = combinedScore;
//           bestClusterIndex = index;
//         }
//       });

//       clusters[bestClusterIndex].orders.push(order);
//       clusters[bestClusterIndex].currentWorkload += this.calculateOrderWorkload(order);
//     });

//     return clusters;
//   }

//   // Update centroids considering workload distribution
//   updateCentroidsWithWorkload(clusters) {
//     return clusters.map(cluster => {
//       if (cluster.orders.length === 0) {
//         return cluster.centroid;
//       }

//       // Weight coordinates by order importance/urgency
//       let totalWeightedLat = 0;
//       let totalWeightedLng = 0;
//       let totalWeight = 0;

//       cluster.orders.forEach(order => {
//         const weight = this.calculateOrderWeight(order);
//         totalWeightedLat += parseFloat(order.latitude) * weight;
//         totalWeightedLng += parseFloat(order.longitude) * weight;
//         totalWeight += weight;
//       });

//       return {
//         lat: totalWeightedLat / totalWeight,
//         lng: totalWeightedLng / totalWeight,
//         workloadCapacity: this.maxStopsPerRoute
//       };
//     });
//   }

//   // Calculate order weight for centroid calculation
//   calculateOrderWeight(order) {
//     let weight = 1;
    
//     // Higher weight for urgent orders
//     if (order.priority === 'high' || order.is_urgent) {
//       weight *= 1.5;
//     }
    
//     // Higher weight for larger orders
//     const orderValue = parseFloat(order.order_value) || 0;
//     if (orderValue > 100) {
//       weight *= 1.2;
//     }
    
//     return weight;
//   }

//   // Check convergence for multi-objective optimization
//   hasConvergedMultiObjective(oldCentroids, newCentroids, threshold = 0.0005) {
//     for (let i = 0; i < oldCentroids.length; i++) {
//       const distance = this.calculateHaversineDistance(
//         oldCentroids[i].lat, oldCentroids[i].lng,
//         newCentroids[i].lat, newCentroids[i].lng
//       );
//       if (distance > threshold) {
//         return false;
//       }
//     }
//     return true;
//   }

//   // Balance workload across clusters post-clustering
//   balanceWorkloadAcrossClusters(clusters) {
//     let balanced = false;
//     let iterations = 0;
//     const maxBalancingIterations = 10;

//     while (!balanced && iterations < maxBalancingIterations) {
//       balanced = true;
      
//       // Find overloaded and underloaded clusters
//       const clusterWorkloads = clusters.map(cluster => ({
//         index: clusters.indexOf(cluster),
//         workload: cluster.orders.length,
//         cluster: cluster
//       }));

//       clusterWorkloads.sort((a, b) => b.workload - a.workload);
      
//       const overloaded = clusterWorkloads.filter(c => c.workload > this.maxStopsPerRoute);
//       const underloaded = clusterWorkloads.filter(c => c.workload < this.maxStopsPerRoute * 0.7);

//       if (overloaded.length > 0 && underloaded.length > 0) {
//         // Move orders from overloaded to underloaded clusters
//         const sourceCluster = overloaded[0].cluster;
//         const targetCluster = underloaded[0].cluster;
        
//         // Find the best order to move (closest to target cluster)
//         let bestOrderIndex = -1;
//         let bestDistance = Infinity;
        
//         sourceCluster.orders.forEach((order, index) => {
//           const distance = this.calculateHaversineDistance(
//             parseFloat(order.latitude), parseFloat(order.longitude),
//             targetCluster.centroid.lat, targetCluster.centroid.lng
//           );
          
//           if (distance < bestDistance) {
//             bestDistance = distance;
//             bestOrderIndex = index;
//           }
//         });

//         if (bestOrderIndex !== -1) {
//           const orderToMove = sourceCluster.orders.splice(bestOrderIndex, 1)[0];
//           targetCluster.orders.push(orderToMove);
//           balanced = false;
//         }
//       }
      
//       iterations++;
//     }

//     console.log(`Workload balancing completed after ${iterations} iterations`);
//     return clusters;
//   }

//   // Enhanced route optimization with multi-objective considerations
//   async optimizeRoute(depot, waypoints, settings = {}) {
//     if (!waypoints || waypoints.length === 0) {
//       return null;
//     }

//     console.log(`🚛 Multi-objective route optimization: ${waypoints.length} waypoints`);

//     // For single waypoint, create simple route
//     if (waypoints.length === 1) {
//       return this.createSimpleRoute(depot, waypoints[0], settings);
//     }

//     if (!this.apiKey) {
//       console.log('Using enhanced fallback route optimization');
//       return this.createEnhancedFallbackRoute(depot, waypoints, settings);
//     }

//     try {
//       // Use HERE Waypoint Sequence API with time optimization
//       const waypointParams = waypoints.map(wp => `${wp.lat},${wp.lng}`).join('!');
//       const origin = `${depot.lat},${depot.lng}`;
//       const destination = settings.returnToDepot !== false ? origin : `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;

//       console.log(`📡 Calling HERE API for multi-objective route optimization`);

//       const response = await axios.get(`${this.baseURL}/routes`, {
//         params: {
//           transportMode: 'car',
//           origin: origin,
//           destination: destination,
//           via: waypointParams,
//           optimize: 'time', // Optimize for time rather than just distance
//           return: 'summary,actions,instructions,polyline',
//           routingMode: 'fast',
//           trafficMode: 'enabled', // Consider traffic
//           apikey: this.apiKey
//         },
//         timeout: 30000
//       });

//       if (response.data.routes && response.data.routes.length > 0) {
//         const route = response.data.routes[0];
        
//         console.log(`✅ HERE API multi-objective route optimization successful`);
        
//         // Calculate totals from all sections including service time
//         const summary = route.sections.reduce((acc, section) => ({
//           length: acc.length + section.summary.length,
//           duration: acc.duration + section.summary.duration
//         }), { length: 0, duration: 0 });

//         // Add service time to duration
//         const totalServiceTime = waypoints.length * this.serviceTimeMinutes * 60; // Convert to seconds
//         const totalDuration = summary.duration + totalServiceTime;

//         // Parse optimized waypoint order from route sections
//         const optimizedWaypoints = this.parseOptimizedWaypointOrder(route, waypoints);

//         return {
//           waypoints: optimizedWaypoints,
//           totalDistance: summary.length, // meters
//           totalDuration: totalDuration, // seconds including service time
//           travelDuration: summary.duration, // seconds travel only
//           serviceDuration: totalServiceTime, // seconds service only
//           optimizationScore: this.calculateMultiObjectiveOptimizationScore(route, waypoints.length),
//           workingHours: Math.round((totalDuration / 3600) * 100) / 100,
//           isWithinWorkingHours: (totalDuration / 3600) <= this.maxWorkingHours,
//           hereRouteId: route.id,
//           navigationUrl: this.generateNavigationUrl(depot, optimizedWaypoints, settings.useGoogleMaps),
//           polyline: route.sections[0]?.polyline,
//           source: 'here_api_enhanced'
//         };
//       }

//       console.warn('HERE API returned no routes, using enhanced fallback');
//       return this.createEnhancedFallbackRoute(depot, waypoints, settings);
//     } catch (error) {
//       console.error('HERE Route optimization error:', error.message);
//       return this.createEnhancedFallbackRoute(depot, waypoints, settings);
//     }
//   }

//   // Create enhanced fallback route with multi-objective optimization
//   createEnhancedFallbackRoute(depot, waypoints, settings) {
//     console.log('Using enhanced multi-objective fallback route optimization');
    
//     // Use multi-objective optimization algorithm
//     let optimizedOrder = this.multiObjectiveRouteOptimization(depot, [...waypoints]);
    
//     const travelDistance = this.calculateRouteDistance(depot, optimizedOrder);
//     const travelTime = this.estimateRouteTime(depot, optimizedOrder);
//     const serviceTime = waypoints.length * this.serviceTimeMinutes * 60; // seconds
//     const totalTime = travelTime + serviceTime;
    
//     const optimizedWaypoints = optimizedOrder.map((wp, index) => {
//       const estimatedArrival = new Date(Date.now() + this.calculateCumulativeTime(depot, optimizedOrder, index));
//       return {
//         ...wp,
//         sequence: index + 1,
//         estimatedArrival: estimatedArrival.toISOString(),
//         serviceTime: this.serviceTimeMinutes
//       };
//     });

//     return {
//       waypoints: optimizedWaypoints,
//       totalDistance: travelDistance * 1000, // Convert to meters
//       totalDuration: totalTime, // seconds
//       travelDuration: travelTime, // seconds
//       serviceDuration: serviceTime, // seconds
//       optimizationScore: this.calculateEnhancedOptimizationScore(optimizedOrder, depot),
//       workingHours: Math.round((totalTime / 3600) * 100) / 100,
//       isWithinWorkingHours: (totalTime / 3600) <= this.maxWorkingHours,
//       navigationUrl: this.generateNavigationUrl(depot, optimizedWaypoints, settings.useGoogleMaps),
//       source: 'enhanced_fallback'
//     };
//   }

//   // Multi-objective route optimization algorithm
//   multiObjectiveRouteOptimization(depot, waypoints) {
//     console.log('Running multi-objective route optimization');
    
//     // Start with nearest neighbor as base
//     let currentRoute = this.nearestNeighborOptimization(depot, [...waypoints]);
    
//     // Apply multiple optimization techniques
//     currentRoute = this.optimizeForTime(depot, currentRoute);
//     currentRoute = this.optimizeForWorkload(depot, currentRoute);
//     currentRoute = this.twoOptImprovement(depot, currentRoute);
    
//     // Final pass with multi-objective scoring
//     currentRoute = this.multiObjectiveLocalSearch(depot, currentRoute);
    
//     return currentRoute;
//   }

//   // Optimize route for time efficiency
//   optimizeForTime(depot, route) {
//     let improved = true;
//     let currentRoute = [...route];
//     let iterations = 0;
//     const maxIterations = 20;

//     while (improved && iterations < maxIterations) {
//       improved = false;
      
//       // Try swapping adjacent orders if it improves total time
//       for (let i = 0; i < currentRoute.length - 1; i++) {
//         const newRoute = [...currentRoute];
//         [newRoute[i], newRoute[i + 1]] = [newRoute[i + 1], newRoute[i]];
        
//         const currentTime = this.calculateTotalRouteTime([currentRoute[i], currentRoute[i + 1]]);
//         const newTime = this.calculateTotalRouteTime([newRoute[i], newRoute[i + 1]]);
        
//         if (newTime < currentTime) {
//           currentRoute = newRoute;
//           improved = true;
//         }
//       }
//       iterations++;
//     }

//     return currentRoute;
//   }

//   // Optimize route for workload balance
//   optimizeForWorkload(depot, route) {
//     // Sort by service complexity/time if available
//     return route.sort((a, b) => {
//       const aComplexity = this.calculateOrderComplexity(a);
//       const bComplexity = this.calculateOrderComplexity(b);
//       return aComplexity - bComplexity; // Simpler orders first
//     });
//   }

//   // Multi-objective local search
//   multiObjectiveLocalSearch(depot, route) {
//     let currentRoute = [...route];
//     let bestScore = this.calculateMultiObjectiveScore(depot, currentRoute);
//     let improved = true;
//     let iterations = 0;
//     const maxIterations = 50;

//     while (improved && iterations < maxIterations) {
//       improved = false;
      
//       // Try all possible swaps
//       for (let i = 0; i < currentRoute.length; i++) {
//         for (let j = i + 1; j < currentRoute.length; j++) {
//           const newRoute = [...currentRoute];
//           [newRoute[i], newRoute[j]] = [newRoute[j], newRoute[i]];
          
//           const newScore = this.calculateMultiObjectiveScore(depot, newRoute);
          
//           if (newScore < bestScore) {
//             currentRoute = newRoute;
//             bestScore = newScore;
//             improved = true;
//           }
//         }
//       }
//       iterations++;
//     }

//     console.log(`Multi-objective local search completed after ${iterations} iterations`);
//     return currentRoute;
//   }

//   // Calculate multi-objective score for route
//   calculateMultiObjectiveScore(depot, route) {
//     const distance = this.calculateRouteDistance(depot, route);
//     const time = this.calculateTotalRouteTime(route);
//     const workload = this.calculateRouteWorkload(route);
    
//     // Normalize scores (0-1 scale)
//     const normalizedDistance = Math.min(distance / 100, 1); // Normalize to 100km max
//     const normalizedTime = Math.min(time / (this.maxWorkingHours * 60), 1); // Normalize to max working hours
//     const normalizedWorkload = Math.min(workload / this.maxStopsPerRoute, 1); // Normalize to max stops
    
//     return (
//       normalizedDistance * this.optimizationWeights.distance +
//       normalizedTime * this.optimizationWeights.time +
//       normalizedWorkload * this.optimizationWeights.workload
//     );
//   }

//   // Calculate order complexity for workload optimization
//   calculateOrderComplexity(order) {
//     let complexity = 1;
    
//     // Increase complexity for heavy items
//     const weight = parseFloat(order.weight) || 2;
//     if (weight > 5) complexity += 0.5;
//     if (weight > 10) complexity += 0.5;
    
//     // Increase complexity for high-value orders (may require extra care)
//     const value = parseFloat(order.order_value) || 0;
//     if (value > 200) complexity += 0.3;
//     if (value > 500) complexity += 0.3;
    
//     // Increase complexity for fragile items
//     if (order.is_fragile || order.special_instructions) {
//       complexity += 0.4;
//     }
    
//     return complexity;
//   }

//   // Calculate workload score for a cluster
//   calculateWorkloadScore(orders) {
//     if (orders.length === 0) return 0;
    
//     const totalComplexity = orders.reduce((sum, order) => 
//       sum + this.calculateOrderComplexity(order), 0);
//     const totalTime = this.calculateTotalRouteTime(orders);
    
//     // Score based on time efficiency and complexity
//     const timeScore = Math.min(totalTime / (this.maxWorkingHours * 60), 1) * 50;
//     const complexityScore = Math.min(totalComplexity / orders.length, 2) * 25;
//     const countScore = Math.min(orders.length / this.maxStopsPerRoute, 1) * 25;
    
//     return Math.round(100 - (timeScore + complexityScore + countScore));
//   }

//   // Calculate total route time including service time
//   calculateTotalRouteTime(orders, depot = null) {
//     if (orders.length === 0) return 0;
    
//     // Travel time between stops (estimated)
//     const travelTime = orders.length > 1 ? 
//       this.estimateRouteTime(depot, orders) : 
//       (orders.length * 8 * 60); // 8 minutes average per stop
    
//     // Service time at each stop
//     const serviceTime = orders.reduce((total, order) => {
//       return total + (this.serviceTimeMinutes * this.calculateOrderComplexity(order));
//     }, 0) * 60; // Convert to seconds
    
//     return travelTime + serviceTime;
//   }

//   // Calculate working hours for a set of orders
//   calculateWorkingHours(orders) {
//     const totalSeconds = this.calculateTotalRouteTime(orders);
//     return Math.round((totalSeconds / 3600) * 100) / 100;
//   }

//   // Check if cluster is overloaded
//   isClusterOverloaded(orders) {
//     const workingHours = this.calculateWorkingHours(orders);
//     const stopCount = orders.length;
    
//     return workingHours > this.maxWorkingHours || 
//            stopCount > this.maxStopsPerRoute;
//   }

//   // Calculate route workload
//   calculateRouteWorkload(route) {
//     return route.reduce((total, order) => {
//       return total + this.calculateOrderComplexity(order);
//     }, 0);
//   }

//   // Calculate order workload
//   calculateOrderWorkload(order) {
//     return this.calculateOrderComplexity(order);
//   }

//   // Estimate additional time when adding an order to a cluster
//   estimateAdditionalTime(existingOrders, newOrder) {
//     const serviceTime = this.serviceTimeMinutes * this.calculateOrderComplexity(newOrder);
//     const travelTimeIncrease = existingOrders.length > 0 ? 5 : 15; // 5 min between stops, 15 min from depot
    
//     return (serviceTime + travelTimeIncrease) * 60; // Convert to seconds
//   }

//   // Estimate average travel time for orders
//   estimateAverageTravelTime(orders) {
//     if (orders.length <= 1) return 10; // 10 minutes if single order
    
//     // Estimate based on density and spread
//     const distances = [];
//     for (let i = 0; i < Math.min(orders.length, 10); i++) {
//       for (let j = i + 1; j < Math.min(orders.length, 10); j++) {
//         distances.push(this.calculateHaversineDistance(
//           parseFloat(orders[i].latitude), parseFloat(orders[i].longitude),
//           parseFloat(orders[j].latitude), parseFloat(orders[j].longitude)
//         ));
//       }
//     }
    
//     const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
//     return Math.max(3, Math.min(15, avgDistance * 2)); // 3-15 minutes based on distance
//   }

//   // Estimate route time
//   estimateRouteTime(depot, route) {
//     if (!depot || route.length === 0) {
//       return route.length * 8 * 60; // 8 minutes average per stop
//     }
    
//     let totalTime = 0;
//     let currentPoint = depot;
    
//     route.forEach(waypoint => {
//       const distance = this.calculateHaversineDistance(
//         currentPoint.lat, currentPoint.lng,
//         parseFloat(waypoint.latitude), parseFloat(waypoint.longitude)
//       );
      
//       // Estimate travel time: 30 km/h average in urban areas
//       totalTime += (distance / 30) * 3600; // Convert to seconds
//       currentPoint = { 
//         lat: parseFloat(waypoint.latitude), 
//         lng: parseFloat(waypoint.longitude) 
//       };
//     });
    
//     // Add return to depot
//     const returnDistance = this.calculateHaversineDistance(
//       currentPoint.lat, currentPoint.lng,
//       depot.lat, depot.lng
//     );
//     totalTime += (returnDistance / 30) * 3600;
    
//     return totalTime;
//   }

//   // Calculate cumulative time to reach a specific waypoint
//   calculateCumulativeTime(depot, route, waypointIndex) {
//     let cumulativeTime = 0;
//     let currentPoint = depot;
    
//     for (let i = 0; i <= waypointIndex; i++) {
//       const distance = this.calculateHaversineDistance(
//         currentPoint.lat, currentPoint.lng,
//         parseFloat(route[i].latitude), parseFloat(route[i].longitude)
//       );
      
//       // Travel time
//       cumulativeTime += (distance / 30) * 3600 * 1000; // Convert to milliseconds
      
//       // Service time
//       if (i === waypointIndex) {
//         cumulativeTime += this.serviceTimeMinutes * 60 * 1000; // Convert to milliseconds
//       }
      
//       currentPoint = { 
//         lat: parseFloat(route[i].latitude), 
//         lng: parseFloat(route[i].longitude) 
//       };
//     }
    
//     return cumulativeTime;
//   }

//   // Create simple route for single waypoint
//   createSimpleRoute(depot, waypoint, settings) {
//     const distance = this.calculateHaversineDistance(
//       depot.lat, depot.lng,
//       waypoint.lat, waypoint.lng
//     ) * 2; // Round trip

//     const travelTime = (distance / 30) * 3600; // 30 km/h average
//     const serviceTime = this.serviceTimeMinutes * 60; // Convert to seconds
//     const totalTime = travelTime + serviceTime;

//     return {
//       waypoints: [{
//         ...waypoint,
//         sequence: 1,
//         estimatedArrival: new Date(Date.now() + (travelTime * 1000)).toISOString(),
//         serviceTime: this.serviceTimeMinutes
//       }],
//       totalDistance: distance * 1000, // Convert to meters
//       totalDuration: totalTime,
//       travelDuration: travelTime,
//       serviceDuration: serviceTime,
//       optimizationScore: 90,
//       workingHours: Math.round((totalTime / 3600) * 100) / 100,
//       isWithinWorkingHours: (totalTime / 3600) <= this.maxWorkingHours,
//       navigationUrl: this.generateNavigationUrl(depot, [waypoint], settings.useGoogleMaps),
//       source: 'simple_route'
//     };
//   }

//   // Enhanced 2-opt improvement algorithm
//   twoOptImprovement(depot, route) {
//     let improved = true;
//     let currentRoute = [...route];
//     let iterations = 0;
//     const maxIterations = 100;

//     while (improved && iterations < maxIterations) {
//       improved = false;
      
//       for (let i = 1; i < currentRoute.length - 1; i++) {
//         for (let j = i + 1; j < currentRoute.length; j++) {
//           const newRoute = this.twoOptSwap(currentRoute, i, j);
          
//           // Use multi-objective scoring instead of just distance
//           const currentScore = this.calculateMultiObjectiveScore(depot, currentRoute);
//           const newScore = this.calculateMultiObjectiveScore(depot, newRoute);
          
//           if (newScore < currentScore) {
//             currentRoute = newRoute;
//             improved = true;
//           }
//         }
//       }
//       iterations++;
//     }

//     console.log(`Enhanced 2-opt completed after ${iterations} iterations`);
//     return currentRoute;
//   }

//   // 2-opt swap operation
//   twoOptSwap(route, i, j) {
//     const newRoute = [...route];
//     // Reverse the order of elements between i and j
//     while (i < j) {
//       [newRoute[i], newRoute[j]] = [newRoute[j], newRoute[i]];
//       i++;
//       j--;
//     }
//     return newRoute;
//   }

//   // Nearest neighbor optimization algorithm
//   nearestNeighborOptimization(depot, waypoints) {
//     const unvisited = [...waypoints];
//     const route = [];
//     let currentPoint = depot;

//     while (unvisited.length > 0) {
//       let nearestIndex = 0;
//       let nearestScore = this.calculatePointScore(currentPoint, unvisited[0]);

//       for (let i = 1; i < unvisited.length; i++) {
//         const score = this.calculatePointScore(currentPoint, unvisited[i]);

//         if (score < nearestScore) {
//           nearestScore = score;
//           nearestIndex = i;
//         }
//       }

//       const nearestPoint = unvisited.splice(nearestIndex, 1)[0];
//       route.push(nearestPoint);
//       currentPoint = { 
//         lat: parseFloat(nearestPoint.latitude), 
//         lng: parseFloat(nearestPoint.longitude) 
//       };
//     }

//     return route;
//   }

//   // Calculate point score considering distance, time, and complexity
//   calculatePointScore(currentPoint, targetPoint) {
//     const distance = this.calculateHaversineDistance(
//       currentPoint.lat, currentPoint.lng,
//       parseFloat(targetPoint.latitude), parseFloat(targetPoint.longitude)
//     );
    
//     const complexity = this.calculateOrderComplexity(targetPoint);
//     const urgency = targetPoint.priority === 'high' ? 0.5 : 1;
    
//     return distance * complexity * urgency;
//   }

//   // Calculate route distance
//   calculateRouteDistance(depot, waypoints) {
//     let totalDistance = 0;
//     let currentPoint = depot;

//     waypoints.forEach(waypoint => {
//       totalDistance += this.calculateHaversineDistance(
//         currentPoint.lat, currentPoint.lng,
//         parseFloat(waypoint.latitude), parseFloat(waypoint.longitude)
//       );
//       currentPoint = { 
//         lat: parseFloat(waypoint.latitude), 
//         lng: parseFloat(waypoint.longitude) 
//       };
//     });

//     // Add return to depot
//     totalDistance += this.calculateHaversineDistance(
//       currentPoint.lat, currentPoint.lng,
//       depot.lat, depot.lng
//     );

//     return totalDistance;
//   }

//   // Parse optimized waypoint order from HERE API response
//   parseOptimizedWaypointOrder(route, originalWaypoints) {
//     // For now, return original order with sequence numbers and timing
//     return originalWaypoints.map((wp, index) => {
//       const estimatedArrival = new Date(Date.now() + (index + 1) * 10 * 60000);
//       return {
//         ...wp,
//         sequence: index + 1,
//         estimatedArrival: estimatedArrival.toISOString(),
//         serviceTime: this.serviceTimeMinutes
//       };
//     });
//   }

//   // Generate navigation URL for drivers
//   generateNavigationUrl(depot, waypoints, useGoogleMaps = false) {
//     if (!waypoints || waypoints.length === 0) {
//       return useGoogleMaps ? 'https://maps.google.com/' : 'https://wego.here.com/';
//     }

//     if (useGoogleMaps) {
//       const waypointStr = waypoints
//         .map(wp => `${wp.lat},${wp.lng}`)
//         .join('|');
      
//       return `https://www.google.com/maps/dir/${depot.lat},${depot.lng}/${waypointStr}/${depot.lat},${depot.lng}`;
//     } else {
//       // HERE Maps URL format
//       const origin = `${depot.lat},${depot.lng}`;
//       const destination = `${depot.lat},${depot.lng}`;
//       const via = waypoints.map(wp => `${wp.lat},${wp.lng}`).join(',');
      
//       return `https://wego.here.com/?map=${origin},15,normal&route=${origin},${via},${destination}`;
//     }
//   }

//   // Calculate multi-objective optimization score
//   calculateMultiObjectiveOptimizationScore(route, waypointCount) {
//     const baseScore = 70;
//     const complexityBonus = Math.min(waypointCount * 2, 20);
    
//     // Consider total time including service time
//     const totalTime = route.sections ? 
//       route.sections.reduce((sum, section) => sum + section.summary.duration, 0) + 
//       (waypointCount * this.serviceTimeMinutes * 60) : 0;
    
//     const timePenalty = totalTime > (this.maxWorkingHours * 3600) ? 15 : 0;
//     const workloadPenalty = waypointCount > this.maxStopsPerRoute ? 10 : 0;
    
//     return Math.min(95, Math.max(60, baseScore + complexityBonus - timePenalty - workloadPenalty));
//   }

//   // Calculate enhanced optimization score
//   calculateEnhancedOptimizationScore(route, depot) {
//     const distance = this.calculateRouteDistance(depot, route);
//     const time = this.calculateTotalRouteTime(route, depot);
//     const workload = this.calculateRouteWorkload(route);
    
//     // Score components (higher is better)
//     const distanceScore = Math.max(0, 100 - (distance * 2)); // Penalty for long routes
//     const timeScore = Math.max(0, 100 - ((time / 3600) / this.maxWorkingHours * 100)); // Penalty for long times
//     const workloadScore = Math.max(0, 100 - (workload / this.maxStopsPerRoute * 100)); // Penalty for high workload
    
//     // Weighted average
//     return Math.round(
//       distanceScore * this.optimizationWeights.distance +
//       timeScore * this.optimizationWeights.time +
//       workloadScore * this.optimizationWeights.workload
//     );
//   }

//   // Calculate multi-objective efficiency for clusters
//   calculateMultiObjectiveEfficiency(orders, centroid) {
//     if (orders.length <= 1) return 95;
    
//     // Calculate geographic efficiency (compactness)
//     const distances = orders.map(order => 
//       this.calculateHaversineDistance(
//         parseFloat(order.latitude), parseFloat(order.longitude),
//         centroid.lat, centroid.lng
//       )
//     );
    
//     const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
//     const maxDistance = Math.max(...distances);
//     const compactnessPenalty = (maxDistance - avgDistance) * 8;
    
//     // Calculate workload efficiency
//     const totalWorkload = orders.reduce((sum, order) => 
//       sum + this.calculateOrderComplexity(order), 0);
//     const avgWorkload = totalWorkload / orders.length;
//     const workloadPenalty = Math.max(0, (avgWorkload - 1.5) * 10);
    
//     // Calculate time efficiency
//     const totalTime = this.calculateTotalRouteTime(orders);
//     const timeEfficiencyPenalty = totalTime > (this.maxWorkingHours * 3600) ? 20 : 0;
    
//     return Math.max(60, 95 - compactnessPenalty - workloadPenalty - timeEfficiencyPenalty);
//   }

//   // Haversine distance calculation
//   calculateHaversineDistance(lat1, lng1, lat2, lng2) {
//     const R = 6371; // Earth's radius in kilometers
//     const dLat = this.toRadians(lat2 - lat1);
//     const dLng = this.toRadians(lng2 - lng1);
//     const a = 
//       Math.sin(dLat/2) * Math.sin(dLat/2) +
//       Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
//       Math.sin(dLng/2) * Math.sin(dLng/2);
//     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
//     return R * c;
//   }

//   toRadians(degrees) {
//     return degrees * (Math.PI/180);
//   }

//   // Helper methods
//   getClusterPostcodes(orders) {
//     const postcodes = [...new Set(orders.map(o => o.postcode.split(' ')[0]))];
//     return postcodes.slice(0, 2).join(', ') + (postcodes.length > 2 ? '...' : '');
//   }

//   calculateAvgDistanceFromDepot(orders) {
//     if (orders.length === 0) return 0;
//     const totalDistance = orders.reduce((sum, order) => 
//       sum + (parseFloat(order.distance_from_depot_km) || 0), 0);
//     return Math.round((totalDistance / orders.length) * 100) / 100;
//   }

//   getZoneColor(index) {
//     const colors = [
//       '#FF6B35', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
//       '#DDA0DD', '#98D8C8', '#FF8A80', '#81C784', '#64B5F6',
//       '#FFB74D', '#A1C4FD', '#C2E9FB', '#F093FB', '#F5576C'
//     ];
//     return colors[index % colors.length];
//   }

//   // Calculate fuel costs based on distance and MPG
//   calculateFuelCost(distanceInKm, mpg, fuelPricePerLitre = 1.45) {
//     const distanceInMiles = distanceInKm * 0.621371;
//     const gallonsUsed = distanceInMiles / mpg;
//     const litresUsed = gallonsUsed * 4.546; // Convert gallons to litres
//     return Math.round(litresUsed * fuelPricePerLitre * 100) / 100;
//   }

//   // Convert meters to miles
//   metersToMiles(meters) {
//     return Math.round((meters * 0.000621371) * 100) / 100;
//   }

//   // Convert meters to kilometers
//   metersToKm(meters) {
//     return Math.round((meters / 1000) * 100) / 100;
//   }

//   // Convert seconds to minutes
//   secondsToMinutes(seconds) {
//     return Math.round(seconds / 60);
//   }

//   // API connection test with enhanced features
//   async testConnection() {
//     console.log('Testing enhanced HERE API connection...');
    
//     try {
//       if (!this.apiKey) {
//         console.log('HERE API key not configured - using enhanced fallback methods');
//         return {
//           status: 'enhanced_fallback',
//           geocoding: false,
//           routing: false,
//           api_key_valid: false,
//           multi_objective_optimization: true,
//           workload_balancing: true
//         };
//       }

//       // Test geocoding
//       // NEW:
//       const geocodeTest = await this.geocodeAddress('Warrington', 'WA4 1AB');
//       console.log('Geocoding test result:', geocodeTest.source);
      
//       // Test enhanced routing with multiple waypoints
//       const testWaypoints = [
//         { id: 'test1', lat: 53.3289, lng: -2.5278, weight: 3, order_value: 150 },
//         { id: 'test2', lat: 53.3356, lng: -2.5423, weight: 2, order_value: 75 }
//       ];
      
//       const routeTest = await this.optimizeRoute(
//         { lat: 53.3808, lng: -2.5740 },
//         testWaypoints
//       );
//       console.log('Enhanced routing test result:', routeTest?.source || 'fallback');
      
//       return {
//         status: 'enhanced_connected',
//         geocoding: geocodeTest.source === 'here_api',
//         routing: routeTest?.source?.includes('here_api'),
//         api_key_valid: true,
//         multi_objective_optimization: true,
//         workload_balancing: true,
//         service_time_minutes: this.serviceTimeMinutes,
//         max_working_hours: this.maxWorkingHours,
//         max_stops_per_route: this.maxStopsPerRoute
//       };
//     } catch (error) {
//       console.error('Enhanced HERE API test failed:', error.message);
//       return {
//         status: 'error',
//         geocoding: false,
//         routing: false,
//         api_key_valid: false,
//         multi_objective_optimization: true,
//         workload_balancing: true,
//         error: error.message
//       };
//     }
//   }
// }

// module.exports = new HereAPIService();
const axios = require('axios');

class HereAPIService {
  constructor() {
    this.apiKey = process.env.HERE_API_KEY;
    this.baseURL = 'https://router.hereapi.com/v8';
    this.geocodeURL = 'https://geocode.search.hereapi.com/v1';
    this.matrixURL = 'https://matrix.router.hereapi.com/v8';
    
    // Optimization parameters
    this.optimizationWeights = {
      distance: 0.4,
      time: 0.35,
      workload: 0.25
    };
    
    this.serviceTimeMinutes = 6;  // Minutes per stop for delivery
    this.maxWorkingHours = 8;
    this.maxStopsPerRoute = 25;
    this.minOrdersBeforeReturn = 8;  // NEW: Minimum orders before returning to depot
    this.depotReturnThreshold = 0.7; // NEW: Return when 70% capacity reached
    
    if (!this.apiKey) {
      console.warn('⚠️ HERE API key not configured - using fallback methods');
    } else {
      console.log('✅ HERE API service initialized');
    }
  }

  // Enhanced geocoding with better fallback
  async geocodeAddress(address, postcode = '') {
    if (!this.apiKey) {
      return this.getFallbackCoordinates(postcode);
    }

    try {
      const query = postcode ? `${address}, ${postcode}, UK` : `${address}, UK`;
      console.log(`🔍 Geocoding: ${query}`);
      
      const response = await axios.get(`${this.geocodeURL}/geocode`, {
        params: {
          q: query,
          apikey: this.apiKey,
          limit: 1,
          in: 'countryCode:GBR',
          lang: 'en'
        },
        timeout: 10000
      });

      if (response.data.items && response.data.items.length > 0) {
        const bestMatch = response.data.items[0];
        const location = bestMatch.position;
        
        console.log(`✅ Geocoded successfully: ${location.lat}, ${location.lng}`);
        
        return {
          lat: location.lat,
          lng: location.lng,
          formatted_address: bestMatch.address.label,
          confidence: bestMatch.scoring?.queryScore || 0.8,
          source: 'here_api'
        };
      }

      console.warn('No geocoding results, using fallback');
      return this.getFallbackCoordinates(postcode);
    } catch (error) {
      console.error('HERE Geocoding error:', error.message);
      return this.getFallbackCoordinates(postcode);
    }
  }

  // Comprehensive UK postcode coordinate mapping
  getFallbackCoordinates(postcode) {
    const postcodeMap = {
      'WA4': { lat: 53.3808, lng: -2.5740, area: 'Warrington Central' },
      'WA1': { lat: 53.3900, lng: -2.5970, area: 'Warrington Town' },
      'WA2': { lat: 53.3950, lng: -2.6100, area: 'Warrington North' },
      'WA3': { lat: 53.4100, lng: -2.5800, area: 'Warrington East' },
      'WA5': { lat: 53.3650, lng: -2.5950, area: 'Warrington South' },
    };
    
    const area = postcode ? postcode.substring(0, postcode.indexOf(' ')) || postcode.substring(0, 3) : 'WA4';
    const coords = postcodeMap[area] || postcodeMap['WA4'];
    
    const offset = 0.001;
    return {
      lat: coords.lat + (Math.random() - 0.5) * offset,
      lng: coords.lng + (Math.random() - 0.5) * offset,
      formatted_address: `${coords.area}, UK`,
      confidence: 0.7,
      source: 'fallback'
    };
  }

  // NEW: Calculate if driver should return to depot
  shouldReturnToDepot(currentOrderCount, totalCapacity, distanceFromDepot) {
    // Return if minimum orders threshold is met
    if (currentOrderCount >= this.minOrdersBeforeReturn) {
      // Check if capacity threshold reached
      const capacityRatio = currentOrderCount / totalCapacity;
      if (capacityRatio >= this.depotReturnThreshold) {
        return true;
      }
      
      // Check if far from depot and has significant orders
      if (distanceFromDepot > 15 && currentOrderCount >= this.minOrdersBeforeReturn) {
        return true;
      }
    }
    
    return false;
  }

  // NEW: Enhanced route with depot returns
  async createRouteWithDepotReturns(depot, orders, driverCapacity = 25) {
    console.log(`🔄 Creating route with depot return logic for ${orders.length} orders`);
    
    const segments = [];
    let currentSegment = [];
    let totalDistanceFromDepot = 0;
    
    // Sort orders by distance from depot for efficient routing
    const sortedOrders = [...orders].sort((a, b) => {
      const distA = this.calculateHaversineDistance(
        depot.lat, depot.lng,
        parseFloat(a.latitude), parseFloat(a.longitude)
      );
      const distB = this.calculateHaversineDistance(
        depot.lat, depot.lng,
        parseFloat(b.latitude), parseFloat(b.longitude)
      );
      return distA - distB;
    });

    for (let i = 0; i < sortedOrders.length; i++) {
      const order = sortedOrders[i];
      currentSegment.push(order);
      
      // Calculate distance from depot for current position
      const distFromDepot = this.calculateHaversineDistance(
        depot.lat, depot.lng,
        parseFloat(order.latitude), parseFloat(order.longitude)
      );
      
      totalDistanceFromDepot = distFromDepot;
      
      // Check if should return to depot
      if (this.shouldReturnToDepot(currentSegment.length, driverCapacity, totalDistanceFromDepot)) {
        console.log(`📍 Depot return point: ${currentSegment.length} orders, ${totalDistanceFromDepot.toFixed(2)}km from depot`);
        segments.push({
          orders: [...currentSegment],
          returnToDepot: true,
          distanceFromDepot: totalDistanceFromDepot
        });
        currentSegment = [];
        totalDistanceFromDepot = 0;
      }
    }

    // Add remaining orders
    if (currentSegment.length > 0) {
      segments.push({
        orders: currentSegment,
        returnToDepot: true, // Always return at end
        distanceFromDepot: totalDistanceFromDepot
      });
    }

    console.log(`✅ Created ${segments.length} route segments with depot returns`);
    return segments;
  }

  // OPTIMIZED: Fast K-means clustering with depot return logic
  async performKMeansClustering(orders, numberOfClusters = 5, maxIterations = 30) {
    const startTime = Date.now();
    console.log(`� OPTIMIZED K-means clustering: ${orders.length} orders → ${numberOfClusters} clusters`);

    if (orders.length === 0) return [];

    // Quick validation filter
    const validOrders = orders.filter(order => 
      order.latitude && order.longitude && 
      !isNaN(parseFloat(order.latitude)) && 
      !isNaN(parseFloat(order.longitude))
    );

    if (validOrders.length === 0) {
      console.warn('No valid coordinates found in orders');
      return [];
    }

    // Pre-group by postcode for better performance (but don't limit clusters to postcodes)
    const postcodeGroups = this.groupOrdersByPostcode(validOrders);
    console.log(`📊 Processing ${Object.keys(postcodeGroups).length} postcode areas with ${validOrders.length} orders`);
    
    // FIXED: Don't limit clusters to postcode count - allow geographic clustering within postcodes
    const adjustedClusters = Math.min(numberOfClusters, Math.max(1, Math.ceil(validOrders.length / 8)));
    console.log(`🎯 Creating ${adjustedClusters} clusters from ${numberOfClusters} requested (${validOrders.length} orders, ~8 orders per cluster)`);

    // Handle very small datasets (less than 3 orders) - create individual clusters
    if (validOrders.length < 3) {
      console.log(`⚡ Very small dataset (${validOrders.length} orders) - creating individual clusters`);
      return this.createSimpleClusters(validOrders);
    }

    try {
      // FIXED: Use deterministic initialization for consistent results
      let centroids = this.initializeCentroidsDeterministic(validOrders, adjustedClusters);
      let assignments = new Array(validOrders.length);
      let previousCentroids = null;
      let iterations = 0;

      console.log(`⚡ Starting optimized K-means iterations (max: ${maxIterations})`);

      // OPTIMIZED: Reduced iterations with early convergence
      while (iterations < maxIterations) {
        // Fast assignment using squared distances (avoid sqrt)
        for (let i = 0; i < validOrders.length; i++) {
          let minDistance = Infinity;
          let closestCentroid = 0;

          for (let j = 0; j < adjustedClusters; j++) {
            const distance = this.fastSquaredDistance(validOrders[i], centroids[j]);
            if (distance < minDistance) {
              minDistance = distance;
              closestCentroid = j;
            }
          }
          assignments[i] = closestCentroid;
        }

        // Store previous centroids for convergence check
        previousCentroids = centroids.map(c => ({ ...c }));

        // Update centroids efficiently
        const newCentroids = this.updateCentroidsOptimized(validOrders, assignments, adjustedClusters);
        
        // Check for convergence with larger tolerance for speed
        if (this.hasConvergedFast(centroids, previousCentroids, 0.001)) {
          console.log(`✅ Clustering converged after ${iterations + 1} iterations`);
          break;
        }

        centroids = newCentroids;
        iterations++;
      }

      // Create clusters from assignments
      const clusters = this.createClustersFromAssignments(validOrders, assignments, centroids, adjustedClusters);

      // OPTIMIZED: Fast route calculations with depot returns
      const formattedClusters = await this.formatClustersWithDepotReturns(clusters);

      const processingTime = Date.now() - startTime;
      console.log(`✅ OPTIMIZED clustering completed in ${processingTime}ms - Generated ${formattedClusters.length} clusters`);
      
      return formattedClusters;

    } catch (error) {
      console.error('Optimized K-means clustering error:', error);
      throw error;
    }
  }

  // FIXED: Consistent route distance calculation
  calculateOptimizedRouteDistance(depot, orders) {
    if (orders.length === 0) return 0;
    
    // Sort orders by distance from depot for deterministic results
    const sortedOrders = [...orders].sort((a, b) => {
      const distA = this.calculateHaversineDistance(
        depot.lat, depot.lng,
        parseFloat(a.latitude), parseFloat(a.longitude)
      );
      const distB = this.calculateHaversineDistance(
        depot.lat, depot.lng,
        parseFloat(b.latitude), parseFloat(b.longitude)
      );
      return distA - distB;
    });
    
    // Calculate consistent route distance
    let totalDistance = 0;
    
    // Distance from depot to first order
    totalDistance += this.calculateHaversineDistance(
      depot.lat, depot.lng,
      parseFloat(sortedOrders[0].latitude), parseFloat(sortedOrders[0].longitude)
    );
    
    // Distance between consecutive orders
    for (let i = 0; i < sortedOrders.length - 1; i++) {
      const dist = this.calculateHaversineDistance(
        parseFloat(sortedOrders[i].latitude), parseFloat(sortedOrders[i].longitude),
        parseFloat(sortedOrders[i + 1].latitude), parseFloat(sortedOrders[i + 1].longitude)
      );
      totalDistance += dist;
    }
    
    // Distance from last order back to depot
    const lastOrder = sortedOrders[sortedOrders.length - 1];
    totalDistance += this.calculateHaversineDistance(
      parseFloat(lastOrder.latitude), parseFloat(lastOrder.longitude),
      depot.lat, depot.lng
    );
    
    // Apply consistent road factor
    const roadFactor = 1.25; // 25% extra for actual roads vs straight line
    const finalDistance = Math.round(totalDistance * roadFactor * 100) / 100;
    
    console.log(`📏 CONSISTENT route distance: ${orders.length} orders = ${finalDistance}km`);
    return finalDistance;
  }

  // FIXED: Realistic and consistent route time calculation
  calculateRealisticRouteTime(distanceKm, orderCount) {
    if (!distanceKm || !orderCount) return 60; // Minimum 1 hour
    
    // Fixed speed calculations for consistency
    const avgUrbanSpeed = 25; // km/h in city areas
    const avgRuralSpeed = 40; // km/h on main roads
    
    // Determine urban vs rural ratio based on distance
    const urbanRatio = distanceKm < 15 ? 0.7 : 0.4;
    const ruralRatio = 1 - urbanRatio;
    
    const urbanDistance = distanceKm * urbanRatio;
    const ruralDistance = distanceKm * ruralRatio;
    
    // Calculate driving time
    const urbanDrivingTime = (urbanDistance / avgUrbanSpeed) * 60; // minutes
    const ruralDrivingTime = (ruralDistance / avgRuralSpeed) * 60; // minutes
    const totalDrivingTime = urbanDrivingTime + ruralDrivingTime;
    
    // Service time per delivery (consistent across all routes)
    const serviceTimePerOrder = 7; // 7 minutes per delivery
    const totalServiceTime = orderCount * serviceTimePerOrder;
    
    // Fixed overhead times
    const depotLoadingTime = 20; // 20 minutes for loading at depot
    const navigationOverhead = Math.max(0, orderCount - 1) * 1.5; // 1.5 min between stops
    
    // Traffic/delay buffer (10% of driving time)
    const trafficBuffer = totalDrivingTime * 0.1;
    
    const totalTime = Math.round(
      totalDrivingTime + totalServiceTime + depotLoadingTime + navigationOverhead + trafficBuffer
    );
    
    // Ensure minimum realistic time (at least 5 minutes per order)
    const minimumTime = Math.max(30, orderCount * 5);
    const finalTime = Math.max(totalTime, minimumTime);
    
    console.log(`⏱️ CONSISTENT route time: ${distanceKm}km, ${orderCount} orders = ${finalTime} minutes`);
    console.log(`   Driving: ${Math.round(totalDrivingTime)}min | Service: ${totalServiceTime}min | Overhead: ${Math.round(depotLoadingTime + navigationOverhead + trafficBuffer)}min`);
    
    return finalTime;
  }

  // Calculate optimal cluster count
  calculateOptimalClusterCount(orders, requestedClusters) {
    const totalOrders = orders.length;
    const idealOrdersPerCluster = Math.min(this.maxStopsPerRoute, Math.ceil(totalOrders / requestedClusters));
    const minClusters = Math.ceil(totalOrders / this.maxStopsPerRoute);
    
    const avgServiceTime = this.serviceTimeMinutes;
    const avgTravelTime = this.estimateAverageTravelTime(orders);
    const totalTimePerOrder = avgServiceTime + avgTravelTime;
    const maxOrdersPerWorkingDay = Math.floor((this.maxWorkingHours * 60) / totalTimePerOrder);
    
    const workloadBasedClusters = Math.ceil(totalOrders / maxOrdersPerWorkingDay);
    
    return Math.max(minClusters, Math.min(requestedClusters, workloadBasedClusters));
  }

  // Initialize centroids with workload consideration
  initializeCentroidsWithWorkload(orders, k) {
    const centroids = [];
    const ordersCopy = [...orders];
    
    const densityScores = orders.map(order => this.calculateDensityScore(order, orders));
    const maxDensityIndex = densityScores.indexOf(Math.max(...densityScores));
    
    centroids.push({
      lat: parseFloat(orders[maxDensityIndex].latitude),
      lng: parseFloat(orders[maxDensityIndex].longitude),
      workloadCapacity: this.maxStopsPerRoute
    });

    for (let i = 1; i < k; i++) {
      const scores = ordersCopy.map(order => {
        const minDist = Math.min(...centroids.map(centroid =>
          this.calculateHaversineDistance(
            parseFloat(order.latitude), parseFloat(order.longitude),
            centroid.lat, centroid.lng
          )
        ));
        
        const densityScore = this.calculateDensityScore(order, ordersCopy);
        return (minDist * minDist) + (densityScore * 0.1);
      });

      const totalScore = scores.reduce((sum, s) => sum + s, 0);
      if (totalScore === 0) break;
      
      const random = Math.random() * totalScore;
      let cumulative = 0;
      
      for (let j = 0; j < ordersCopy.length; j++) {
        cumulative += scores[j];
        if (cumulative >= random) {
          centroids.push({
            lat: parseFloat(ordersCopy[j].latitude),
            lng: parseFloat(ordersCopy[j].longitude),
            workloadCapacity: this.maxStopsPerRoute
          });
          break;
        }
      }
    }

    return centroids;
  }

  calculateDensityScore(targetOrder, allOrders) {
    const radius = 2;
    const nearbyOrders = allOrders.filter(order => {
      if (order === targetOrder) return false;
      const distance = this.calculateHaversineDistance(
        parseFloat(targetOrder.latitude), parseFloat(targetOrder.longitude),
        parseFloat(order.latitude), parseFloat(order.longitude)
      );
      return distance <= radius;
    });
    
    return nearbyOrders.length;
  }

  assignOrdersToOptimalClusters(orders, centroids) {
    const clusters = centroids.map(centroid => ({
      centroid,
      orders: [],
      currentWorkload: 0
    }));

    const sortedOrders = [...orders].sort((a, b) => {
      const aDistance = parseFloat(a.distance_from_depot_km) || 0;
      const bDistance = parseFloat(b.distance_from_depot_km) || 0;
      return aDistance - bDistance;
    });

    sortedOrders.forEach(order => {
      let bestClusterIndex = 0;
      let bestScore = Infinity;

      clusters.forEach((cluster, index) => {
        if (cluster.orders.length >= this.maxStopsPerRoute) return;

        const distance = this.calculateHaversineDistance(
          parseFloat(order.latitude), parseFloat(order.longitude),
          cluster.centroid.lat, cluster.centroid.lng
        );

        const workloadScore = cluster.orders.length / this.maxStopsPerRoute;
        const timeScore = this.estimateAdditionalTime(cluster.orders, order) / (this.maxWorkingHours * 60);
        
        const combinedScore = 
          (distance * this.optimizationWeights.distance) +
          (workloadScore * this.optimizationWeights.workload) +
          (timeScore * this.optimizationWeights.time);

        if (combinedScore < bestScore) {
          bestScore = combinedScore;
          bestClusterIndex = index;
        }
      });

      clusters[bestClusterIndex].orders.push(order);
      clusters[bestClusterIndex].currentWorkload += this.calculateOrderWorkload(order);
    });

    return clusters;
  }

  updateCentroidsWithWorkload(clusters) {
    return clusters.map(cluster => {
      if (cluster.orders.length === 0) return cluster.centroid;

      let totalWeightedLat = 0;
      let totalWeightedLng = 0;
      let totalWeight = 0;

      cluster.orders.forEach(order => {
        const weight = this.calculateOrderWeight(order);
        totalWeightedLat += parseFloat(order.latitude) * weight;
        totalWeightedLng += parseFloat(order.longitude) * weight;
        totalWeight += weight;
      });

      return {
        lat: totalWeightedLat / totalWeight,
        lng: totalWeightedLng / totalWeight,
        workloadCapacity: this.maxStopsPerRoute
      };
    });
  }

  calculateOrderWeight(order) {
    let weight = 1;
    
    if (order.priority === 'high' || order.is_urgent) {
      weight *= 1.5;
    }
    
    const orderValue = parseFloat(order.order_value) || 0;
    if (orderValue > 100) {
      weight *= 1.2;
    }
    
    return weight;
  }

  hasConvergedMultiObjective(oldCentroids, newCentroids, threshold = 0.0005) {
    for (let i = 0; i < oldCentroids.length; i++) {
      const distance = this.calculateHaversineDistance(
        oldCentroids[i].lat, oldCentroids[i].lng,
        newCentroids[i].lat, newCentroids[i].lng
      );
      if (distance > threshold) return false;
    }
    return true;
  }

  balanceWorkloadAcrossClusters(clusters) {
    let balanced = false;
    let iterations = 0;
    const maxBalancingIterations = 10;

    while (!balanced && iterations < maxBalancingIterations) {
      balanced = true;
      
      const clusterWorkloads = clusters.map(cluster => ({
        index: clusters.indexOf(cluster),
        workload: cluster.orders.length,
        cluster: cluster
      }));

      clusterWorkloads.sort((a, b) => b.workload - a.workload);
      
      const overloaded = clusterWorkloads.filter(c => c.workload > this.maxStopsPerRoute);
      const underloaded = clusterWorkloads.filter(c => c.workload < this.maxStopsPerRoute * 0.7);

      if (overloaded.length > 0 && underloaded.length > 0) {
        const sourceCluster = overloaded[0].cluster;
        const targetCluster = underloaded[0].cluster;
        
        let bestOrderIndex = -1;
        let bestDistance = Infinity;
        
        sourceCluster.orders.forEach((order, index) => {
          const distance = this.calculateHaversineDistance(
            parseFloat(order.latitude), parseFloat(order.longitude),
            targetCluster.centroid.lat, targetCluster.centroid.lng
          );
          
          if (distance < bestDistance) {
            bestDistance = distance;
            bestOrderIndex = index;
          }
        });

        if (bestOrderIndex !== -1) {
          const orderToMove = sourceCluster.orders.splice(bestOrderIndex, 1)[0];
          targetCluster.orders.push(orderToMove);
          balanced = false;
        }
      }
      
      iterations++;
    }

    console.log(`Workload balancing completed after ${iterations} iterations`);
    return clusters;
  }

  calculateWorkloadScore(orders) {
    if (orders.length === 0) return 0;
    
    const totalComplexity = orders.reduce((sum, order) => 
      sum + this.calculateOrderComplexity(order), 0);
    const totalTime = this.calculateTotalRouteTime(orders);
    
    const timeScore = Math.min(totalTime / (this.maxWorkingHours * 60), 1) * 50;
    const complexityScore = Math.min(totalComplexity / orders.length, 2) * 25;
    const countScore = Math.min(orders.length / this.maxStopsPerRoute, 1) * 25;
    
    return Math.round(100 - (timeScore + complexityScore + countScore));
  }

  calculateTotalRouteTime(orders, depot = null) {
    if (orders.length === 0) return 0;
    
    const travelTime = orders.length > 1 ? 
      this.estimateRouteTime(depot, orders) : 
      (orders.length * 8 * 60);
    
    const serviceTime = orders.reduce((total, order) => {
      return total + (this.serviceTimeMinutes * this.calculateOrderComplexity(order));
    }, 0) * 60;
    
    return travelTime + serviceTime;
  }

  calculateWorkingHours(orders) {
    const totalSeconds = this.calculateTotalRouteTime(orders);
    return Math.round((totalSeconds / 3600) * 100) / 100;
  }

  isClusterOverloaded(orders) {
    const workingHours = this.calculateWorkingHours(orders);
    const stopCount = orders.length;
    
    return workingHours > this.maxWorkingHours || 
           stopCount > this.maxStopsPerRoute;
  }

  calculateOrderComplexity(order) {
    let complexity = 1;
    
    const weight = parseFloat(order.weight) || 2;
    if (weight > 5) complexity += 0.5;
    if (weight > 10) complexity += 0.5;
    
    const value = parseFloat(order.order_value) || 0;
    if (value > 200) complexity += 0.3;
    if (value > 500) complexity += 0.3;
    
    if (order.is_fragile || order.special_instructions) {
      complexity += 0.4;
    }
    
    return complexity;
  }

  calculateRouteWorkload(route) {
    return route.reduce((total, order) => {
      return total + this.calculateOrderComplexity(order);
    }, 0);
  }

  calculateOrderWorkload(order) {
    return this.calculateOrderComplexity(order);
  }

  estimateAdditionalTime(existingOrders, newOrder) {
    const serviceTime = this.serviceTimeMinutes * this.calculateOrderComplexity(newOrder);
    const travelTimeIncrease = existingOrders.length > 0 ? 5 : 15;
    
    return (serviceTime + travelTimeIncrease) * 60;
  }

  estimateAverageTravelTime(orders) {
    if (orders.length <= 1) return 10;
    
    const distances = [];
    for (let i = 0; i < Math.min(orders.length, 10); i++) {
      for (let j = i + 1; j < Math.min(orders.length, 10); j++) {
        distances.push(this.calculateHaversineDistance(
          parseFloat(orders[i].latitude), parseFloat(orders[i].longitude),
          parseFloat(orders[j].latitude), parseFloat(orders[j].longitude)
        ));
      }
    }
    
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    return Math.max(3, Math.min(15, avgDistance * 2));
  }

  estimateRouteTime(depot, route) {
    if (!depot || route.length === 0) {
      return route.length * 8 * 60;
    }
    
    let totalTime = 0;
    let currentPoint = depot;
    
    route.forEach(waypoint => {
      const distance = this.calculateHaversineDistance(
        currentPoint.lat, currentPoint.lng,
        parseFloat(waypoint.latitude), parseFloat(waypoint.longitude)
      );
      
      totalTime += (distance / 30) * 3600;
      currentPoint = { 
        lat: parseFloat(waypoint.latitude), 
        lng: parseFloat(waypoint.longitude) 
      };
    });
    
    const returnDistance = this.calculateHaversineDistance(
      currentPoint.lat, currentPoint.lng,
      depot.lat, depot.lng
    );
    totalTime += (returnDistance / 30) * 3600;
    
    return totalTime;
  }

  nearestNeighborOptimization(depot, waypoints) {
    const unvisited = [...waypoints];
    const route = [];
    let currentPoint = depot;

    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let nearestScore = this.calculatePointScore(currentPoint, unvisited[0]);

      for (let i = 1; i < unvisited.length; i++) {
        const score = this.calculatePointScore(currentPoint, unvisited[i]);
        if (score < nearestScore) {
          nearestScore = score;
          nearestIndex = i;
        }
      }

      const nearestPoint = unvisited.splice(nearestIndex, 1)[0];
      route.push(nearestPoint);
      currentPoint = { 
        lat: parseFloat(nearestPoint.latitude), 
        lng: parseFloat(nearestPoint.longitude) 
      };
    }

    return route;
  }

  calculatePointScore(currentPoint, targetPoint) {
    const distance = this.calculateHaversineDistance(
      currentPoint.lat, currentPoint.lng,
      parseFloat(targetPoint.latitude), parseFloat(targetPoint.longitude)
    );
    
    const complexity = this.calculateOrderComplexity(targetPoint);
    const urgency = targetPoint.priority === 'high' ? 0.5 : 1;
    
    return distance * complexity * urgency;
  }

  calculateMultiObjectiveEfficiency(orders, centroid) {
    if (orders.length <= 1) return 95;
    
    const distances = orders.map(order => 
      this.calculateHaversineDistance(
        parseFloat(order.latitude), parseFloat(order.longitude),
        centroid.lat, centroid.lng
      )
    );
    
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const maxDistance = Math.max(...distances);
    const compactnessPenalty = (maxDistance - avgDistance) * 8;
    
    const totalWorkload = orders.reduce((sum, order) => 
      sum + this.calculateOrderComplexity(order), 0);
    const avgWorkload = totalWorkload / orders.length;
    const workloadPenalty = Math.max(0, (avgWorkload - 1.5) * 10);
    
    const totalTime = this.calculateTotalRouteTime(orders);
    const timeEfficiencyPenalty = totalTime > (this.maxWorkingHours * 3600) ? 20 : 0;
    
    return Math.max(60, 95 - compactnessPenalty - workloadPenalty - timeEfficiencyPenalty);
  }

  calculateHaversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI/180);
  }

  getClusterPostcodes(orders) {
    const postcodes = [...new Set(orders.map(o => o.postcode.split(' ')[0]))];
    return postcodes.slice(0, 2).join(', ') + (postcodes.length > 2 ? '...' : '');
  }

  calculateAvgDistanceFromDepot(orders) {
    if (orders.length === 0) return 0;
    const totalDistance = orders.reduce((sum, order) => 
      sum + (parseFloat(order.distance_from_depot_km) || 0), 0);
    return Math.round((totalDistance / orders.length) * 100) / 100;
  }

  getZoneColor(index) {
    const colors = [
      '#FF6B35', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
      '#DDA0DD', '#98D8C8', '#FF8A80', '#81C784', '#64B5F6',
      '#FFB74D', '#A1C4FD', '#C2E9FB', '#F093FB', '#F5576C'
    ];
    return colors[index % colors.length];
  }

  calculateFuelCost(distanceInKm, mpg, fuelPricePerLitre = 1.45) {
    const distanceInMiles = distanceInKm * 0.621371;
    const gallonsUsed = distanceInMiles / mpg;
    const litresUsed = gallonsUsed * 4.546;
    return Math.round(litresUsed * fuelPricePerLitre * 100) / 100;
  }

  metersToMiles(meters) {
    return Math.round((meters * 0.000621371) * 100) / 100;
  }

  metersToKm(meters) {
    return Math.round((meters / 1000) * 100) / 100;
  }

  secondsToMinutes(seconds) {
    return Math.round(seconds / 60);
  }

  async testConnection() {
    console.log('Testing enhanced HERE API connection...');
    
    try {
      if (!this.apiKey) {
        console.log('HERE API key not configured - using enhanced fallback methods');
        return {
          status: 'enhanced_fallback',
          geocoding: false,
          routing: false,
          api_key_valid: false,
          multi_objective_optimization: true,
          workload_balancing: true,
          depot_return_logic: true,
          realistic_time_calculation: true
        };
      }

      const geocodeTest = await this.geocodeAddress('Warrington', 'WA4 1AB');
      console.log('Geocoding test result:', geocodeTest.source);
      
      const testWaypoints = [
        { id: 'test1', lat: 53.3289, lng: -2.5278, weight: 3, order_value: 150 },
        { id: 'test2', lat: 53.3356, lng: -2.5423, weight: 2, order_value: 75 }
      ];
      
      return {
        status: 'enhanced_connected',
        geocoding: geocodeTest.source === 'here_api',
        routing: true,
        api_key_valid: true,
        multi_objective_optimization: true,
        workload_balancing: true,
        depot_return_logic: true,
        realistic_time_calculation: true,
        service_time_minutes: this.serviceTimeMinutes,
        max_working_hours: this.maxWorkingHours,
        max_stops_per_route: this.maxStopsPerRoute,
        min_orders_before_return: this.minOrdersBeforeReturn
      };
    } catch (error) {
      console.error('Enhanced HERE API test failed:', error.message);
      return {
        status: 'error',
        geocoding: false,
        routing: false,
        api_key_valid: false,
        multi_objective_optimization: true,
        workload_balancing: true,
        depot_return_logic: true,
        realistic_time_calculation: true,
        error: error.message
      };
    }
  }

  // ============ OPTIMIZATION HELPER METHODS ============

  // OPTIMIZATION: Group orders by postcode for pre-clustering
  groupOrdersByPostcode(orders) {
    return orders.reduce((groups, order) => {
      const postcodePrefix = order.postcode ? order.postcode.substring(0, 4) : 'UNKNOWN';
      if (!groups[postcodePrefix]) {
        groups[postcodePrefix] = [];
      }
      groups[postcodePrefix].push(order);
      return groups;
    }, {});
  }

  // OPTIMIZATION: K-means++ initialization for better convergence
  initializeCentroidsKMeansPlusPlus(orders, k) {
    const centroids = [];
    
    // Choose first centroid randomly
    const firstIndex = Math.floor(Math.random() * orders.length);
    centroids.push({
      lat: parseFloat(orders[firstIndex].latitude),
      lng: parseFloat(orders[firstIndex].longitude)
    });

    // Choose remaining centroids using K-means++
    for (let i = 1; i < k; i++) {
      const distances = orders.map(order => {
        return Math.min(...centroids.map(centroid => 
          this.fastSquaredDistance(order, centroid)
        ));
      });

      const totalDistance = distances.reduce((sum, d) => sum + d, 0);
      if (totalDistance === 0) break;
      
      const random = Math.random() * totalDistance;
      
      let cumulative = 0;
      for (let j = 0; j < orders.length; j++) {
        cumulative += distances[j];
        if (cumulative >= random) {
          centroids.push({
            lat: parseFloat(orders[j].latitude),
            lng: parseFloat(orders[j].longitude)
          });
          break;
        }
      }
    }

    return centroids;
  }

  // FIXED: Deterministic centroid initialization for consistent results
  initializeCentroidsDeterministic(orders, k) {
    const centroids = [];
    
    // Use deterministic spacing instead of random selection
    const step = Math.floor(orders.length / k);
    
    for (let i = 0; i < k; i++) {
      const index = Math.min(i * step, orders.length - 1);
      centroids.push({
        lat: parseFloat(orders[index].latitude),
        lng: parseFloat(orders[index].longitude)
      });
    }

    return centroids;
  }

  // OPTIMIZATION: Fast squared distance calculation (avoid sqrt)
  fastSquaredDistance(point1, point2) {
    const lat1 = parseFloat(point1.latitude) || parseFloat(point1.lat);
    const lng1 = parseFloat(point1.longitude) || parseFloat(point1.lng);
    const lat2 = parseFloat(point2.lat);
    const lng2 = parseFloat(point2.lng);
    
    const dx = lat1 - lat2;
    const dy = lng1 - lng2;
    return dx * dx + dy * dy;
  }

  // OPTIMIZATION: Fast centroid update
  updateCentroidsOptimized(orders, assignments, k) {
    const newCentroids = new Array(k).fill(null).map(() => ({
      lat: 0,
      lng: 0,
      count: 0
    }));

    // Sum up positions for each cluster
    for (let i = 0; i < orders.length; i++) {
      const cluster = assignments[i];
      newCentroids[cluster].lat += parseFloat(orders[i].latitude);
      newCentroids[cluster].lng += parseFloat(orders[i].longitude);
      newCentroids[cluster].count++;
    }

    // Calculate averages
    return newCentroids.map(centroid => {
      if (centroid.count > 0) {
        return {
          lat: centroid.lat / centroid.count,
          lng: centroid.lng / centroid.count
        };
      }
      return { lat: 53.3808, lng: -2.5740 }; // Default to depot
    });
  }

  // OPTIMIZATION: Fast convergence check
  hasConvergedFast(centroids, previousCentroids, tolerance = 0.001) {
    if (!previousCentroids) return false;
    
    for (let i = 0; i < centroids.length; i++) {
      const distance = this.fastSquaredDistance(
        { lat: centroids[i].lat, lng: centroids[i].lng },
        { lat: previousCentroids[i].lat, lng: previousCentroids[i].lng }
      );
      if (distance > tolerance) return false;
    }
    return true;
  }

  // OPTIMIZATION: Create clusters from assignments
  createClustersFromAssignments(orders, assignments, centroids, k) {
    const clusters = new Array(k).fill(null).map((_, index) => ({
      orders: [],
      centroid: centroids[index]
    }));

    for (let i = 0; i < orders.length; i++) {
      const clusterIndex = assignments[i];
      clusters[clusterIndex].orders.push(orders[i]);
    }

    return clusters.filter(cluster => cluster.orders.length > 0);
  }

  // OPTIMIZATION: Create simple clusters for small datasets
  createSimpleClusters(orders) {
    return orders.map((order, index) => ({
      zone_id: `zone_${index + 1}`,
      zone_name: `Zone ${index + 1} - ${order.postcode}`,
      orders: [order],
      center: { lat: parseFloat(order.latitude), lng: parseFloat(order.longitude) },
      color_hex: this.getZoneColor(index),
      total_orders: 1,
      total_value: order.order_value || 0,
      total_weight_kg: order.weight || 2,
      workload_score: this.calculateWorkloadScore([order]),
      avg_distance_from_depot: parseFloat(order.distance_from_depot_km) || 0,
      estimated_duration: this.calculateFastRouteTime(order.distance_from_depot_km || 5, 1),
      route_distance_km: (order.distance_from_depot_km || 5) * 2, // Round trip
      estimated_working_hours: Math.ceil(this.calculateFastRouteTime(order.distance_from_depot_km || 5, 1) / 60),
      efficiency_score: 0.8,
      is_overloaded: false,
      depot_returns_needed: 1,
      route_segments: [{
        segment_id: 1,
        orders: [order],
        distance_km: (order.distance_from_depot_km || 5) * 2,
        duration_minutes: this.calculateFastRouteTime(order.distance_from_depot_km || 5, 1),
        return_to_depot: true
      }]
    }));
  }

  // OPTIMIZATION: Fast format clusters with depot returns
  async formatClustersWithDepotReturns(clusters) {
    const depot = { lat: 53.3808256, lng: -2.575416 };
    const maxOrdersPerSegment = 20; // Driver vehicle capacity

    return clusters.map((cluster, index) => {
      const totalValue = cluster.orders.reduce((sum, order) => sum + (order.order_value || 0), 0);
      const totalWeight = cluster.orders.reduce((sum, order) => sum + (order.weight || 2), 0);
      
      // FAST: Approximate route distance calculation
      const routeDistance = this.calculateFastRouteDistance(depot, cluster.orders);
      const routeTime = this.calculateFastRouteTime(routeDistance, cluster.orders.length);
      
      // Calculate depot return segments efficiently
      const routeSegments = this.createFastRouteSegments(cluster.orders, maxOrdersPerSegment);
      
      return {
        zone_id: `zone_${index + 1}`,
        zone_name: `Zone ${index + 1} - ${this.getClusterPostcodes(cluster.orders)}`,
        orders: cluster.orders,
        center: cluster.centroid,
        color_hex: this.getZoneColor(index),
        total_orders: cluster.orders.length,
        total_value: Math.round(totalValue * 100) / 100,
        total_weight_kg: Math.round(totalWeight * 100) / 100,
        workload_score: this.calculateWorkloadScore(cluster.orders),
        avg_distance_from_depot: this.calculateAvgDistanceFromDepot(cluster.orders),
        estimated_duration: routeTime,
        route_distance_km: routeDistance,
        estimated_working_hours: Math.ceil(routeTime / 60),
        efficiency_score: this.calculateEfficiencyScore(cluster.orders, routeDistance),
        is_overloaded: cluster.orders.length > maxOrdersPerSegment * 2,
        depot_returns_needed: routeSegments.length,
        route_segments: routeSegments
      };
    });
  }

  // FIXED: Consistent fast route distance calculation
  calculateFastRouteDistance(depot, orders) {
    if (orders.length === 0) return 0;
    
    // Sort orders by distance for consistency (same as main function)
    const sortedOrders = [...orders].sort((a, b) => {
      const distA = parseFloat(a.distance_from_depot_km) || 5;
      const distB = parseFloat(b.distance_from_depot_km) || 5;
      return distA - distB;
    });
    
    // Use average distance with consistent calculation
    const avgDistanceFromDepot = sortedOrders.reduce((sum, order) => 
      sum + (parseFloat(order.distance_from_depot_km) || 5), 0
    ) / sortedOrders.length;
    
    // Apply same logic as main function but simplified
    const routeDistance = (avgDistanceFromDepot * 2) + (sortedOrders.length > 1 ? avgDistanceFromDepot * 0.25 * (sortedOrders.length - 1) : 0);
    const roadFactor = 1.25; // Same as main function
    
    return Math.round(routeDistance * roadFactor * 100) / 100;
  }

  // FIXED: Consistent fast route time calculation  
  calculateFastRouteTime(distanceKm, orderCount) {
    if (!distanceKm || !orderCount) return 60; // Minimum 1 hour
    
    // Use same constants as main function
    const avgSpeed = 27.5; // Average of urban (25) and rural (30) speeds
    const serviceTimePerOrder = 7; // Same as main function
    const depotTime = 20; // Same as main function
    
    const drivingTime = (distanceKm / avgSpeed) * 60; // minutes
    const serviceTime = orderCount * serviceTimePerOrder;
    const overhead = (orderCount - 1) * 1.5; // Navigation between stops
    const buffer = drivingTime * 0.1; // Traffic buffer
    
    const totalTime = Math.round(drivingTime + serviceTime + depotTime + overhead + buffer);
    
    // Same minimum logic as main function
    const minimumTime = Math.max(30, orderCount * 5);
    return Math.max(totalTime, minimumTime);
  }

  // OPTIMIZATION: Fast route segments creation with depot returns
  createFastRouteSegments(orders, maxOrdersPerSegment) {
    const segments = [];
    let currentSegment = [];
    
    for (let i = 0; i < orders.length; i++) {
      currentSegment.push(orders[i]);
      
      // Create segment when capacity reached or at end
      if (currentSegment.length >= maxOrdersPerSegment || i === orders.length - 1) {
        const segmentDistance = this.calculateFastRouteDistance(
          { lat: 53.3808256, lng: -2.575416 }, 
          currentSegment
        );
        
        segments.push({
          segment_id: segments.length + 1,
          orders: [...currentSegment],
          distance_km: segmentDistance,
          duration_minutes: this.calculateFastRouteTime(segmentDistance, currentSegment.length),
          return_to_depot: true,
          capacity_utilization: Math.round((currentSegment.length / maxOrdersPerSegment) * 100)
        });
        
        currentSegment = [];
      }
    }
    
    return segments;
  }

  // OPTIMIZATION: Fast efficiency calculation
  calculateEfficiencyScore(orders, routeDistance) {
    if (orders.length === 0 || routeDistance === 0) return 0;
    
    const ordersPerKm = orders.length / routeDistance;
    const maxEfficiency = 2; // 2 orders per km is very efficient
    
    return Math.min(ordersPerKm / maxEfficiency, 1.0);
  }

  // MAIN METHOD: Generate optimized clusters for area (called by API endpoint)
  async generateOptimizedClustersForArea(orders, maxZones = 5) {
    console.log(`🚀 GENERATING OPTIMIZED CLUSTERS: ${orders.length} orders → ${maxZones} zones`);
    
    if (orders.length === 0) return [];

    // Default depot (Warrington)
    const depot = { lat: 53.3808256, lng: -2.575416 };
    
    try {
      // Step 1: Use the optimized clustering algorithm
      console.log(`🔧 Calling performKMeansClustering with ${orders.length} orders and ${maxZones} clusters`);
      const clusters = await this.performKMeansClustering(orders, maxZones);
      console.log(`📊 K-means returned ${clusters.length} clusters`);
      
      // Step 2: Convert to the expected API format
      const colors = ['#FF6B35', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
      
      const formattedZones = clusters.map((cluster, index) => {
        // Calculate realistic distances and durations using our optimized methods
        const distance = this.calculateOptimizedRouteDistance(depot, cluster.orders);
        const duration = this.calculateRealisticRouteTime(distance, cluster.orders.length);
        
        // Calculate actual efficiency based on deterministic metrics
        const efficiency = this.calculateEfficiencyScore(cluster.orders, distance);
        const efficiencyScore = Math.round(60 + (efficiency * 35)); // 60-95% range
        
        // DEBUG: Log order count discrepancies
        console.log(`🔍 Zone ${index + 1}: cluster.orders.length = ${cluster.orders.length}, total_orders will be = ${cluster.orders.length}`);
        
        return {
          zone_id: `zone_${index + 1}`,
          zone_name: `Zone ${index + 1} - ${cluster.orders[0]?.postcode?.split(' ')[0] || 'Mixed'}`,
          orders: cluster.orders,
          color_hex: colors[index % colors.length],
          total_orders: cluster.orders.length,
          total_value: cluster.orders.reduce((sum, o) => sum + (o.order_value || 0), 0),
          total_weight_kg: cluster.orders.reduce((sum, o) => sum + (o.weight || 2), 0),
          avg_distance_from_depot: Math.round(distance * 100) / 100,
          estimated_duration: duration, // Now uses realistic calculation
          efficiency_score: efficiencyScore // Now deterministic, not random
        };
      });

      console.log(`✅ OPTIMIZED CLUSTERS GENERATED: ${formattedZones.length} zones with consistent metrics`);
      return formattedZones;
      
    } catch (error) {
      console.error('Error generating optimized clusters:', error);
      throw error;
    }
  }

}

module.exports = new HereAPIService();