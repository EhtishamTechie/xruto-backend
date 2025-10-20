
const express = require('express');
const router = express.Router();

// Import the enhanced orders controller
let ordersController;
try {
  ordersController = require('../controllers/ordersController');
  console.log('✅ Enhanced Orders controller with HERE API loaded successfully');
} catch (error) {
  console.error('❌ Failed to load orders controller:', error.message);
  throw error;
}

// Validation middleware
const validateRequired = (fields) => {
  return (req, res, next) => {
    const missing = fields.filter(field => !req.body[field]);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`
      });
    }
    next();
  };
};

// ===== TAB 1: FILTER ORDERS ROUTES =====

// GET /api/orders/eligible - Get eligible orders for optimization
router.get('/eligible', ordersController.getEligibleOrders);

// POST /api/orders/generate-clusters - Generate clusters using HERE API
router.post('/generate-clusters', 
  validateRequired(['selected_postcodes']),
  ordersController.generateClusters
);

// ===== TAB 2: ROUTE REVIEW ROUTES =====

// POST /api/orders/generate-routes - Generate optimized routes from clusters
router.post('/generate-routes',
  validateRequired(['zones']),
  ordersController.generateRoutes
);

// GET /api/orders/available-drivers - Get available drivers with MPG info
router.get('/available-drivers', ordersController.getAvailableDrivers);

// POST /api/orders/assign-driver - Assign specific driver to route
router.post('/assign-driver',
  validateRequired(['route_id', 'driver_id']),
  ordersController.assignDriver
);

// POST /api/orders/auto-assign-drivers - Auto-assign drivers using load balancing
router.post('/auto-assign-drivers',
  validateRequired(['routes']),
  ordersController.autoAssignDrivers
);

// ===== TAB 3: ROUTE DISPATCH ROUTES =====

// POST /api/orders/dispatch-routes - Dispatch routes to drivers
router.post('/dispatch-routes',
  validateRequired(['route_ids']),
  ordersController.dispatchRoutes
);

// GET /api/orders/route-details/:route_id - Get detailed route information
router.get('/route-details/:route_id', ordersController.getRouteDetails);

// PUT /api/orders/delivery-status/:order_id - Update delivery status
router.put('/delivery-status/:order_id',
  validateRequired(['status']),
  ordersController.updateDeliveryStatus
);

// ===== HISTORY AND ANALYTICS ROUTES =====

// GET /api/orders/optimization-history - Get route optimization history
router.get('/optimization-history', ordersController.getOptimizationHistory);

// GET /api/orders/route-stats - Get route performance statistics
router.get('/route-stats', async (req, res) => {
  try {
    // This would typically come from your database
    const stats = {
      total_routes_today: 8,
      completed_routes: 3,
      in_progress_routes: 4,
      pending_routes: 1,
      total_deliveries: 45,
      completed_deliveries: 18,
      success_rate: 95.2,
      avg_delivery_time: 6.5,
      total_distance_miles: 156.8,
      estimated_fuel_cost: 48.75
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch route statistics',
      error: error.message
    });
  }
});

// ===== WOOCOMMERCE INTEGRATION ROUTES =====

// POST /api/orders/sync-woocommerce - Sync orders from WooCommerce
router.post('/sync-woocommerce', async (req, res) => {
  try {
    const { store_id, date_from, date_to } = req.body;
    
    // This would integrate with WooCommerce REST API
    // const wooOrders = await syncWooCommerceOrders(store_id, date_from, date_to);
    
    res.json({
      success: true,
      message: 'WooCommerce orders synced successfully',
      synced_orders: 12,
      eligible_for_delivery: 8
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to sync WooCommerce orders',
      error: error.message
    });
  }
});

// POST /api/orders/webhook/woocommerce - WooCommerce webhook handler
router.post('/webhook/woocommerce', async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-wc-webhook-signature'];
    // Implement signature verification logic here
    
    const order = req.body;
    
    // Process only home delivery orders
    if (order.shipping_lines && order.shipping_lines.some(line => 
        line.method_title.toLowerCase().includes('delivery')
    )) {
      // Save order to database for route optimization
      console.log('New delivery order received:', order.id);
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ===== DRIVER APP ROUTES =====

// GET /api/orders/driver-routes/:driver_id - Get routes assigned to specific driver
router.get('/driver-routes/:driver_id', async (req, res) => {
  try {
    const { driver_id } = req.params;
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    
    // Mock data for driver app
    const routes = [
      {
        route_id: 'route_1',
        route_name: 'Zone 1 - Warrington Central',
        status: 'dispatched',
        total_orders: 6,
        completed_orders: 2,
        progress_percentage: 33.3,
        navigation_url: 'https://wego.here.com/directions/drive/...',
        orders: [
          
          { id: '1', customer_name: 'John Smith', address: 'Milton Grove, Latchford, Warrington', status: 'delivered', sequence: 1 },
          { id: '2', customer_name: 'Sarah Wilson', address: 'Beech Grove, Warrington WA4 1EG', status: 'delivered', sequence: 2 },
          { id: '3', customer_name: 'Mike Johnson', address: 'Latchford, Warrington WA4 1HY', status: 'pending', sequence: 3 }

          
        ]
      }
    ];
    
    res.json({
      success: true,
      routes,
      driver_id,
      date
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch driver routes',
      error: error.message
    });
  }
});

// POST /api/orders/driver-update-status - Driver updates delivery status via mobile app
router.post('/driver-update-status', 
  validateRequired(['driver_id', 'order_id', 'status']),
  async (req, res) => {
    try {
      const { driver_id, order_id, status, location, notes } = req.body;
      
      // Verify driver is assigned to this order
      // Update order status and route progress
      // Send notifications to admin
      
      res.json({
        success: true,
        message: 'Status updated successfully',
        order_id,
        status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update delivery status',
        error: error.message
      });
    }
  }
);

// ===== TESTING AND DEBUGGING ROUTES =====

// GET /api/orders/test-here-api - Test HERE API connectivity
router.get('/test-here-api', async (req, res) => {
  try {
    const hereAPI = require('../services/hereAPI.JS');
    
    // Test geocoding
    const testAddress = 'Latchford, Warrington WA4 1HY, UK';
    const coords = await hereAPI.geocodeAddress(testAddress);
    
    res.json({
      success: true,
      message: 'HERE API is working correctly',
      test_results: {
        geocoding: {
          address: testAddress,
          coordinates: coords
        },
        api_key_status: process.env.HERE_API_KEY ? 'Configured' : 'Missing'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'HERE API test failed',
      error: error.message,
      api_key_status: process.env.HERE_API_KEY ? 'Configured' : 'Missing'
    });
  }
});

// GET /api/orders/test-clustering - Test clustering algorithm
router.get('/test-clustering', async (req, res) => {
  try {
    const hereAPI = require('../services/hereAPI');
    
    // Mock orders for testing (Warrington area)
    const testOrders = [
      { id: '1', customer_name: 'Test 1', postcode: 'WA4 1EE', latitude: 53.3808, longitude: -2.5740 },
      { id: '2', customer_name: 'Test 2', postcode: 'WA4 1EF', latitude: 53.3805, longitude: -2.5745 },
      { id: '3', customer_name: 'Test 3', postcode: 'WA4 1DZ', latitude: 53.3810, longitude: -2.5735 }
    ];
    
    const clusters = await hereAPI.performKMeansClustering(testOrders, 2);
    
    res.json({
      success: true,
      message: 'Clustering test completed',
      test_orders: testOrders.length,
      clusters_created: clusters.length,
      clusters
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Clustering test failed',
      error: error.message
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Orders route error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error in orders module',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

console.log('✅ Orders routes with HERE API integration configured successfully');

module.exports = router;