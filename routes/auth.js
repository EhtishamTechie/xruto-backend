

// const express = require('express');
// const router = express.Router();

// // Import the auth controller
// let authController;
// try {
//   authController = require('../controllers/authController');
//   console.log('✅ Auth controller loaded successfully');
// } catch (error) {
//   console.error('❌ Failed to load auth controller:', error.message);
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

// // ===== AUTHENTICATION ROUTES =====

// // POST /api/auth/login - User login
// router.post('/login', 
//   validateRequired(['email', 'password']),
//   authController.login
// );

// // POST /api/auth/register - User registration
// router.post('/register',
//   validateRequired(['name', 'email', 'password']),
//   authController.register
// );

// // POST /api/auth/logout - User logout
// router.post('/logout', authController.logout);

// // GET /api/auth/me - Get current user
// router.get('/me', authController.getCurrentUser);

// // ===== ADDITIONAL AUTH ROUTES =====

// // POST /api/auth/refresh - Refresh token (placeholder)
// router.post('/refresh', (req, res) => {
//   res.json({
//     success: true,
//     message: 'Token refreshed successfully',
//     token: 'dev-refreshed-token-123'
//   });
// });

// // POST /api/auth/reset-password - Password reset (placeholder)
// router.post('/reset-password', (req, res) => {
//   const { email } = req.body;
  
//   if (!email) {
//     return res.status(400).json({
//       success: false,
//       message: 'Email is required'
//     });
//   }

//   res.json({
//     success: true,
//     message: 'Password reset email sent (development mode)'
//   });
// });

// // PUT /api/auth/change-password - Change password (placeholder)
// router.put('/change-password', (req, res) => {
//   const { currentPassword, newPassword } = req.body;
  
//   if (!currentPassword || !newPassword) {
//     return res.status(400).json({
//       success: false,
//       message: 'Current password and new password are required'
//     });
//   }

//   res.json({
//     success: true,
//     message: 'Password changed successfully'
//   });
// });

// // ===== TESTING ROUTE =====

// // GET /api/auth/test - Test auth routes
// router.get('/test', (req, res) => {
//   res.json({
//     success: true,
//     message: 'Auth routes are working correctly',
//     timestamp: new Date().toISOString(),
//     available_endpoints: {
//       login: 'POST /api/auth/login',
//       register: 'POST /api/auth/register',
//       logout: 'POST /api/auth/logout',
//       currentUser: 'GET /api/auth/me',
//       refresh: 'POST /api/auth/refresh',
//       resetPassword: 'POST /api/auth/reset-password',
//       changePassword: 'PUT /api/auth/change-password'
//     },
//     dev_credentials: {
//       email: 'admin@xruto.com',
//       password: 'admin123'
//     }
//   });
// });

// // Error handling middleware for auth routes
// router.use((error, req, res, next) => {
//   console.error('Auth route error:', error);
//   res.status(500).json({
//     success: false,
//     message: 'Internal server error in auth module',
//     error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
//   });
// });

// console.log('✅ Auth routes configured successfully');

// module.exports = router;
const express = require('express');
const router = express.Router();

// Import the auth controller
let authController;
try {
  authController = require('../controllers/authController');
  console.log('✅ Auth controller loaded successfully');
} catch (error) {
  console.error('❌ Failed to load auth controller:', error.message);
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

// ===== AUTHENTICATION ROUTES =====

// POST /api/auth/login - User login
router.post('/login', 
  validateRequired(['email', 'password']),
  authController.login
);

// POST /api/auth/register - User registration  
router.post('/register',
  validateRequired(['name', 'email', 'password']),
  authController.register
);

// POST /api/auth/logout - User logout
router.post('/logout', authController.logout);

// GET /api/auth/me - Get current user
router.get('/me', authController.getCurrentUser);

// POST /api/auth/refresh - Refresh token
router.post('/refresh', authController.refreshToken);

// POST /api/auth/reset-password - Password reset
router.post('/reset-password', authController.resetPassword);

// PUT /api/auth/change-password - Change password
router.put('/change-password', 
  authController.verifyToken,
  authController.changePassword
);

// ===== ADMIN ROUTES =====

// GET /api/auth/admin/users - Get all users (admin only)
router.get('/admin/users', 
  authController.verifyToken,
  authController.requireRole(['admin']),
  async (req, res) => {
    try {
      // Mock user data for admin
      const users = [
        {
          id: 'admin-1',
          name: 'Admin User',
          email: 'admin@xruto.com',
          role: 'admin',
          status: 'active',
          last_login: new Date().toISOString()
        },
        {
          id: 'driver-1', 
          name: 'Driver User',
          email: 'driver@xruto.com',
          role: 'driver',
          status: 'active',
          last_login: new Date(Date.now() - 3600000).toISOString()
        }
      ];

      res.json({
        success: true,
        users,
        total: users.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users',
        error: error.message
      });
    }
  }
);

// POST /api/auth/admin/create-user - Create new user (admin only)
router.post('/admin/create-user',
  authController.verifyToken,
  authController.requireRole(['admin']),
  validateRequired(['name', 'email', 'password', 'role']),
  async (req, res) => {
    try {
      const { name, email, password, role } = req.body;
      
      // Validate role
      const validRoles = ['admin', 'driver', 'user'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Must be one of: ' + validRoles.join(', ')
        });
      }

      // Mock user creation
      const newUser = {
        id: `${role}-${Date.now()}`,
        name,
        email,
        role,
        status: 'active',
        created_at: new Date().toISOString()
      };

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        user: newUser
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create user',
        error: error.message
      });
    }
  }
);

// ===== DRIVER SPECIFIC ROUTES =====

// POST /api/auth/driver/status - Update driver status
router.post('/driver/status',
  authController.verifyToken,
  authController.requireRole(['driver']),
  async (req, res) => {
    try {
      const { status, location } = req.body;
      const driverId = req.user.id;

      // Valid driver statuses
      const validStatuses = ['available', 'busy', 'offline', 'on_route'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
        });
      }

      res.json({
        success: true,
        message: 'Driver status updated successfully',
        driver_id: driverId,
        status: status || 'available',
        location: location || null,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update driver status',
        error: error.message
      });
    }
  }
);

// GET /api/auth/driver/profile - Get driver profile
router.get('/driver/profile',
  authController.verifyToken,
  authController.requireRole(['driver']),
  async (req, res) => {
    try {
      const driverId = req.user.id;
      
      // Mock driver profile data
      const driverProfile = {
        id: driverId,
        name: req.user.name,
        email: req.user.email,
        phone: '+44 7123 456789',
        vehicle: {
          type: 'van',
          registration: 'AB12 CDE',
          capacity: 50,
          mpg: 35
        },
        stats: {
          total_deliveries: 142,
          completed_routes: 28,
          average_rating: 4.8,
          total_distance: 1250.5
        },
        status: 'available',
        current_route: null
      };

      res.json({
        success: true,
        profile: driverProfile
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch driver profile',
        error: error.message
      });
    }
  }
);

// ===== TESTING ROUTES =====

// GET /api/auth/test - Test auth routes
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Auth routes are working correctly',
    timestamp: new Date().toISOString(),
    available_endpoints: {
      login: 'POST /api/auth/login',
      register: 'POST /api/auth/register',
      logout: 'POST /api/auth/logout',
      currentUser: 'GET /api/auth/me',
      refresh: 'POST /api/auth/refresh',
      resetPassword: 'POST /api/auth/reset-password',
      changePassword: 'PUT /api/auth/change-password',
      driverStatus: 'POST /api/auth/driver/status',
      driverProfile: 'GET /api/auth/driver/profile',
      adminUsers: 'GET /api/auth/admin/users',
      createUser: 'POST /api/auth/admin/create-user'
    },
    dev_credentials: {
      admin: { email: 'admin@xruto.com', password: 'admin123' },
      driver: { email: 'driver@xruto.com', password: 'driver123' }
    }
  });
});

// GET /api/auth/verify - Verify token endpoint
router.get('/verify', authController.verifyToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    user: req.user
  });
});

// Error handling middleware for auth routes
router.use((error, req, res, next) => {
  console.error('Auth route error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error in auth module',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

console.log('✅ Complete auth routes configured successfully');

module.exports = router;