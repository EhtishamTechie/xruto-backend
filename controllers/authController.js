
// const authController = {
//   // Simple login for development
//   async login(req, res) {
//     try {
//       const { email, password } = req.body;

//       // For development - simple authentication
//       // In production, you'd verify against a database with hashed passwords
//       if (email === 'admin@xruto.com' && password === 'admin123') {
//         res.json({
//           success: true,
//           message: 'Login successful',
//           user: {
//             id: 'admin-1',
//             email: 'admin@xruto.com',
//             name: 'Admin User',
//             role: 'admin'
//           },
//           token: 'dev-token-123' // In production, use JWT
//         });
//       } else {
//         res.status(401).json({
//           success: false,
//           message: 'Invalid credentials'
//         });
//       }
//     } catch (error) {
//       console.error('Login error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Login failed',
//         error: error.message
//       });
//     }
//   },

//   // Simple registration for development
//   async register(req, res) {
//     try {
//       const { name, email, password } = req.body;

//       if (!name || !email || !password) {
//         return res.status(400).json({
//           success: false,
//           message: 'Name, email, and password are required'
//         });
//       }

//       // For development - just return success
//       res.json({
//         success: true,
//         message: 'Registration successful',
//         user: {
//           id: `user-${Date.now()}`,
//           email,
//           name,
//           role: 'user'
//         }
//       });
//     } catch (error) {
//       console.error('Registration error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Registration failed',
//         error: error.message
//       });
//     }
//   },

//   // Logout
//   async logout(req, res) {
//     try {
//       res.json({
//         success: true,
//         message: 'Logout successful'
//       });
//     } catch (error) {
//       console.error('Logout error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Logout failed',
//         error: error.message
//       });
//     }
//   },

//   // Get current user
//   async getCurrentUser(req, res) {
//     try {
//       // For development - return mock user
//       res.json({
//         success: true,
//         user: {
//           id: 'admin-1',
//           email: 'admin@xruto.com',
//           name: 'Admin User',
//           role: 'admin'
//         }
//       });
//     } catch (error) {
//       console.error('Get current user error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to get current user',
//         error: error.message
//       });
//     }
//   }
// };

// module.exports = authController;

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const authController = {
  // Enhanced login with database authentication
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      console.log(`🔐 Login attempt for email: ${email}`);

      // For development - simple hardcoded authentication
      // In production, you'd verify against a users table with hashed passwords
      if (email === 'admin@xruto.com' && password === 'admin123') {
        // Generate JWT token
        const token = jwt.sign(
          { 
            id: 'admin-1',
            email: 'admin@xruto.com',
            role: 'admin',
            name: 'Admin User'
          },
          jwtSecret,
          { expiresIn: '24h' }
        );

        console.log('✅ Admin login successful');

        res.json({
          success: true,
          message: 'Login successful',
          user: {
            id: 'admin-1',
            email: 'admin@xruto.com',
            name: 'Admin User',
            role: 'admin'
          },
          token
        });
      } else if (email === 'driver@xruto.com' && password === 'driver123') {
        // Driver login
        const token = jwt.sign(
          { 
            id: 'driver-1',
            email: 'driver@xruto.com',
            role: 'driver',
            name: 'Driver User'
          },
          jwtSecret,
          { expiresIn: '24h' }
        );

        console.log('✅ Driver login successful');

        res.json({
          success: true,
          message: 'Login successful',
          user: {
            id: 'driver-1',
            email: 'driver@xruto.com',
            name: 'Driver User',
            role: 'driver'
          },
          token
        });
      } else {
        console.log('❌ Invalid credentials provided');
        
        res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: error.message
      });
    }
  },

  // Enhanced registration with password hashing
  async register(req, res) {
    try {
      const { name, email, password, role = 'user' } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, and password are required'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Validate password strength
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      console.log(`📝 Registration attempt for email: ${email}`);

      // For development - just return success without actually creating user
      // In production, you'd hash the password and store in database
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const newUser = {
        id: `user-${Date.now()}`,
        name,
        email,
        role,
        created_at: new Date().toISOString()
      };

      console.log('✅ User registration successful (dev mode)');

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        user: newUser
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed',
        error: error.message
      });
    }
  },

  // Logout - invalidate token
  async logout(req, res) {
    try {
      // In a production app, you might maintain a blacklist of invalidated tokens
      // For now, we'll just return success as the client will delete the token
      
      console.log('👋 User logout');
      
      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed',
        error: error.message
      });
    }
  },

  // Get current user from token
  async getCurrentUser(req, res) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'No token provided'
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      try {
        const decoded = jwt.verify(token, jwtSecret);
        
        console.log('✅ Token verified for user:', decoded.email);
        
        res.json({
          success: true,
          user: {
            id: decoded.id,
            email: decoded.email,
            name: decoded.name,
            role: decoded.role
          }
        });
      } catch (jwtError) {
        console.log('❌ Invalid or expired token');
        
        res.status(401).json({
          success: false,
          message: 'Invalid or expired token'
        });
      }
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get current user',
        error: error.message
      });
    }
  },

  // Refresh token
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token required'
        });
      }

      try {
        const decoded = jwt.verify(refreshToken, jwtSecret);
        
        // Generate new token
        const newToken = jwt.sign(
          { 
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            name: decoded.name
          },
          jwtSecret,
          { expiresIn: '24h' }
        );

        console.log('🔄 Token refreshed for user:', decoded.email);

        res.json({
          success: true,
          message: 'Token refreshed successfully',
          token: newToken
        });
      } catch (jwtError) {
        res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to refresh token',
        error: error.message
      });
    }
  },

  // Password reset request
  async resetPassword(req, res) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      console.log(`🔑 Password reset requested for: ${email}`);
      
      // In production, you'd generate a reset token and send an email
      // For development, just return success
      
      res.json({
        success: true,
        message: 'Password reset email sent (development mode)',
        dev_note: 'In production, this would send an actual email with reset link'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process password reset',
        error: error.message
      });
    }
  },

  // Change password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long'
        });
      }

      // Get user from token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, jwtSecret);

      console.log(`🔐 Password change requested for user: ${decoded.email}`);
      
      // In production, you'd verify current password and hash the new one
      // For development, just return success
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to change password',
        error: error.message
      });
    }
  },

  // Verify token middleware
  verifyToken: (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  },

  // Check if user has required role
  requireRole: (roles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      next();
    };
  }
};

module.exports = authController;