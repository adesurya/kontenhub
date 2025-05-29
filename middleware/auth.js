const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Authenticate user middleware
const authenticateUser = async (req, res, next) => {
  try {
    // Check session first
    if (req.session && req.session.user) {
      // Verify user still exists and is active
      const user = await User.findByPk(req.session.user.id);
      if (user && user.is_active) {
        req.user = user;
        return next();
      } else {
        // User not found or inactive, clear session
        req.session.destroy();
      }
    }

    // Check JWT token in headers
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.header('x-auth-token');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findByPk(decoded.userId);
        
        if (user && user.is_active) {
          req.user = user;
          return next();
        }
      } catch (jwtError) {
        console.error('JWT verification failed:', jwtError.message);
      }
    }

    // No valid authentication found
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Please login to continue.'
      });
    } else {
      req.flash('error', 'Please login to access this page.');
      return res.redirect('/login');
    }

  } catch (error) {
    console.error('Authentication middleware error:', error);
    
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({
        success: false,
        message: 'Authentication error'
      });
    } else {
      req.flash('error', 'Authentication error occurred.');
      return res.redirect('/login');
    }
  }
};

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    await authenticateUser(req, res, () => {});
    
    if (!req.user) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. Please login to continue.'
        });
      } else {
        return res.redirect('/login');
      }
    }

    if (req.user.role !== 'admin') {
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      } else {
        req.flash('error', 'Access denied. Admin privileges required.');
        return res.redirect('/user/dashboard');
      }
    }

    next();
  } catch (error) {
    console.error('Admin authentication error:', error);
    
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({
        success: false,
        message: 'Authentication error'
      });
    } else {
      req.flash('error', 'Authentication error occurred.');
      return res.redirect('/login');
    }
  }
};

// Optional authentication middleware (doesn't block if no auth)
const optionalAuth = async (req, res, next) => {
  try {
    // Check session
    if (req.session && req.session.user) {
      const user = await User.findByPk(req.session.user.id);
      if (user && user.is_active) {
        req.user = user;
      }
    }

    // Check JWT token if no session
    if (!req.user) {
      const token = req.header('Authorization')?.replace('Bearer ', '') || req.header('x-auth-token');
      
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await User.findByPk(decoded.userId);
          
          if (user && user.is_active) {
            req.user = user;
          }
        } catch (jwtError) {
          // JWT invalid but don't block request
          console.log('Optional auth JWT verification failed:', jwtError.message);
        }
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue even if error occurs
  }
};

// Check subscription middleware
const checkSubscription = async (req, res, next) => {
  try {
    // First authenticate user
    if (!req.user) {
      await authenticateUser(req, res, () => {});
    }

    if (!req.user) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      } else {
        return res.redirect('/login');
      }
    }

    // Check if user has active subscription
    if (req.user.subscription_id) {
      const { UserSubscription } = require('../models');
      const subscription = await UserSubscription.findByPk(req.user.subscription_id);
      
      if (subscription && subscription.isValid()) {
        req.user.activeSubscription = subscription;
        return next();
      }
    }

    // No valid subscription
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({
        success: false,
        message: 'Active subscription required. Please subscribe to continue.',
        redirectTo: '/user/subscribe'
      });
    } else {
      req.flash('error', 'Active subscription required. Please subscribe to continue.');
      return res.redirect('/user/subscribe');
    }

  } catch (error) {
    console.error('Subscription check error:', error);
    
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({
        success: false,
        message: 'Subscription verification error'
      });
    } else {
      req.flash('error', 'Subscription verification error occurred.');
      return res.redirect('/user/dashboard');
    }
  }
};

// Generate JWT token
const generateJWT = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Verify JWT token
const verifyJWT = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

module.exports = {
  authenticateUser,
  authenticateAdmin,
  optionalAuth,
  checkSubscription,
  generateJWT,
  verifyJWT
};