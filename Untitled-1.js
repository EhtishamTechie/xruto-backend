// const express = require('express');
// const router = express.Router();

// // Import enhanced controller
// let ordersController;
// try {
//   ordersController = require('../controllers/ordersController');
//   console.log('✅ Enhanced Orders controller loaded successfully');
//   console.log('Available methods:', Object.keys(ordersController));
// } catch (error) {
//   console.error('❌ Failed to load orders controller:', error.message);
//   throw error;
// }

// // Validation middleware
// const validateRequired = (fields) => {
//   return (req, res, next) => {
//     const missing = fields.filter(field => !req.body[field]);
//     if (missing.length > 0) {
//       return res.status(400).json({
//         success: false,
//         message: `Missing required fields: ${missing.join(', ')}`
//       });
//     }
//     next();
//   };
// };

// const validateUUID = (req, res, next) => {
//   const { routeId, orderId, id } = req.params;
//   const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
//   const invalidIds = [];
//   if (routeId && !uuidRegex.test(routeId)) invalidIds.push('routeId');
//   if (orderId && !uuidRegex.test(orderId)) invalidIds.push('orderId');
//   if (id && !uuidRegex.test(id)) invalidIds.push('id');
  
//   if (invalidIds.length > 0) {
//     return res.status(400).json({
//       success: false,
//       message: `Invalid UUID format for: ${invalidIds.join(', ')}`
//     });
//   }
//   next();
// };

// const validateDate = (req, res, next) => {
//   const { delivery_date } = req.query;
//   if (delivery_date && isNaN(Date.parse(delivery_date))) {
//     return res.status(400).json({
//       success: false,
//       message: 'Invalid delivery_date format. Use YYYY-MM-DD'
//     });
//   }
//   next();
// };

// // Basic order management routes
// router.get('/', validateDate, ordersController.getOrders);
// router.get('/stats', validateDate, ordersController.getOrderStats);
// router.get('/postcodes', validateDate, ordersController.getPostcodes);

// // Core clustering and optimization routes
// router.post('/clusters', 
//   validateRequired(['postcodes', 'delivery_date']),
//   validateDate,
//   ordersController.generateClusters
// );

// // Enhanced route management
// router.post('/routes',
//   validateRequired(['clusters', 'delivery_date']),
//   validateDate,
//   ordersController.createRoutes
// );

// router.get('/routes', validateDate, ordersController.getRouteProgress);

// // ADD THESE MISSING ROUTE HANDLERS
// router.get('/routes/:routeId', validateUUID, (req, res) => {
//   // For now, return the route from getRouteProgress but filtered
//   ordersController.getRouteProgress(req, res);
// });

// router.put('/routes/:routeId', validateUUID, (req, res) => {
//   res.json({
//     success: true,
//     message: 'Route update functionality coming soon'
//   });
// });

// router.delete('/routes/:routeId', validateUUID, (req, res) => {
//   res.json({
//     success: true,
//     message: 'Route delete functionality coming soon'
//   });
// });

// // Route progress and tracking
// router.get('/routes/progress', validateDate, ordersController.getRouteProgress);

// // Dispatch functionality  
// router.post('/routes/dispatch',
//   validateRequired(['route_ids']),
//   ordersController.dispatchRoutes
// );

// router.post('/routes/:routeId/dispatch', validateUUID, (req, res) => {
//   // Single route dispatch - call dispatchRoutes with single route
//   req.body.route_ids = [req.params.routeId];
//   ordersController.dispatchRoutes(req, res);
// });

// // Route orders management
// router.get('/routes/:routeId/orders', 
//   validateUUID, 
//   ordersController.getRouteOrders
// );

// router.post('/routes/:routeId/orders', validateUUID, (req, res) => {
//   res.json({
//     success: true,
//     message: 'Add order to route functionality coming soon'
//   });
// });

// router.delete('/routes/:routeId/orders/:orderId', validateUUID, (req, res) => {
//   res.json({
//     success: true,
//     message: 'Remove order from route functionality coming soon'
//   });
// });

// router.put('/routes/:routeId/orders/reorder', validateUUID, (req, res) => {
//   res.json({
//     success: true,
//     message: 'Reorder route orders functionality coming soon'
//   });
// });

// // Delivery status management
// router.patch('/routes/:routeId/orders/:orderId/status',
//   validateUUID,
//   validateRequired(['status']),
//   ordersController.updateDeliveryStatus
// );

// router.patch('/routes/:routeId/orders/bulk-status', validateUUID, (req, res) => {
//   res.json({
//     success: true,
//     message: 'Bulk update delivery status functionality coming soon'
//   });
// });

// // Navigation and mapping
// router.get('/routes/:routeId/navigation', validateUUID, (req, res) => {
//   res.json({
//     success: true,
//     message: 'Route navigation functionality coming soon'
//   });
// });

// router.put('/routes/:routeId/navigation', validateUUID, (req, res) => {
//   res.json({
//     success: true,
//     message: 'Update route navigation functionality coming soon'
//   });
// });

// router.get('/routes/:routeId/traffic', validateUUID, (req, res) => {
//   res.json({
//     success: true,
//     message: 'Traffic info functionality coming soon'
//   });
// });

// router.post('/routes/:routeId/optimize', validateUUID, (req, res) => {
//   res.json({
//     success: true,
//     message: 'Route optimization functionality coming soon'
//   });
// });

// // Database management
// router.post('/reset-database', validateDate, ordersController.resetOrdersDatabase);

// router.post('/backup', validateDate, (req, res) => {
//   res.json({
//     success: true,
//     message: 'Backup functionality coming soon'
//   });
// });

// router.post('/restore', validateRequired(['backup_id']), (req, res) => {
//   res.json({
//     success: true,
//     message: 'Restore functionality coming soon'
//   });
// });

// // Analytics and reporting
// router.get('/analytics', validateDate, (req, res) => {
//   res.json({
//     success: true,
//     message: 'Analytics functionality coming soon'
//   });
// });

// router.get('/metrics', validateDate, (req, res) => {
//   res.json({
//     success: true,
//     message: 'Metrics functionality coming soon'
//   });
// });

// router.get('/performance', validateDate, (req, res) => {
//   res.json({
//     success: true,
//     message: 'Performance metrics functionality coming soon'
//   });
// });

// // Customer communication
// router.post('/:orderId/notify', validateUUID, (req, res) => {
//   res.json({
//     success: true,
//     message: 'Customer notification functionality coming soon'
//   });
// });

// router.post('/:orderId/delivery-update', validateUUID, (req, res) => {
//   res.json({
//     success: true,
//     message: 'Delivery update functionality coming soon'
//   });
// });

// // Error handling middleware
// router.use((error, req, res, next) => {
//   console.error('Orders route error:', error);
//   res.status(500).json({
//     success: false,
//     message: 'Internal server error in orders module',
//     error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
//   });
// });

// console.log('✅ Enhanced Orders routes configured successfully');

// module.exports = router;
const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');

// Basic routes that your frontend needs
router.get('/stats', ordersController.getOrderStats);
router.get('/postcodes', ordersController.getPostcodes);
router.post('/clusters', ordersController.generateClusters);
router.post('/reset-database', ordersController.resetOrdersDatabase);

module.exports = router;