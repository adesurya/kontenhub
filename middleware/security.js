const rateLimit = require('express-rate-limit');
const { User } = require('../models');

// Rate limiting for different endpoints
const createRateLimiter = (windowMs, max, message, skipSuccessfulRequests = false) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: message
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res) => {
      if (req.path.startsWith('/api/')) {
        res.status(429).json({
          success: false,
          message: message
        });
      } else {
        req.flash('error', message);
        res.redirect('back');
      }
    }
  });
};

// General API rate limiter
const apiRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  'Too many requests from this IP, please try again later.'
);

// Strict rate limiter for authentication
const authRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts per window
  'Too many authentication attempts, please try again later.',
  true // Skip successful requests
);

// Rate limiter for file uploads
const uploadRateLimit = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  20, // 20 uploads per hour
  'Too many file uploads, please try again later.'
);

// Rate limiter for downloads
const downloadRateLimit = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  100, // 100 downloads per hour
  'Too many download requests, please try again later.'
);

// Rate limiter for password reset
const passwordResetRateLimit = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  3, // 3 attempts per hour
  'Too many password reset attempts, please try again later.'
);

// IP whitelist middleware (for admin access if needed)
const ipWhitelist = (allowedIPs) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (allowedIPs.includes(clientIP)) {
      next();
    } else {
      console.warn(`Blocked access from IP: ${clientIP}`);
      
      if (req.path.startsWith('/api/')) {
        res.status(403).json({
          success: false,
          message: 'Access denied from this IP address'
        });
      } else {
        res.status(403).render('error', {
          title: 'Access Denied',
          error: {
            status: 403,
            message: 'Access denied from this IP address'
          }
        });
      }
    }
  };
};

// User activity tracking
const trackUserActivity = async (req, res, next) => {
  try {
    if (req.user) {
      // Update last activity
      await User.update(
        { last_login: new Date() },
        { where: { id: req.user.id } }
      );
      
      // Log activity (you can extend this to store in activity_logs table)
      console.log(`User ${req.user.id} accessed ${req.method} ${req.path}`);
    }
    
    next();
  } catch (error) {
    console.error('Activity tracking error:', error);
    next(); // Continue even if tracking fails
  }
};

// Content Security Policy headers
const setSecurityHeaders = (req, res, next) => {
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://code.jquery.com; " +
    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
    "img-src 'self' data: https: blob:; " +
    "media-src 'self' https: blob:; " +
    "connect-src 'self' https:;"
  );
  
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  next();
};

// Detect suspicious activity
const detectSuspiciousActivity = (req, res, next) => {
  const suspiciousPatterns = [
    /\b(union|select|insert|delete|drop|create|alter)\b/i, // SQL injection
    /<script|javascript:|vbscript:|onload=|onerror=/i, // XSS
    /\.\.\//g, // Directory traversal
    /(exec|eval|system|shell_exec)/i // Code execution
  ];
  
  const checkString = `${req.url} ${JSON.stringify(req.body)} ${JSON.stringify(req.query)}`;
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(checkString)) {
      console.warn(`Suspicious activity detected from IP ${req.ip}: ${checkString}`);
      
      if (req.path.startsWith('/api/')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request detected'
        });
      } else {
        req.flash('error', 'Invalid request detected');
        return res.redirect('/');
      }
    }
  }
  
  next();
};

// File access security
const secureFileAccess = async (req, res, next) => {
  try {
    // Only allow authenticated users to access files
    if (!req.user) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to access files'
        });
      } else {
        req.flash('error', 'Please login to access files');
        return res.redirect('/login');
      }
    }
    
    // Check if user has permission to access the specific file
    const mediaId = req.params.id || req.body.media_id;
    if (mediaId) {
      const { Media } = require('../models');
      const media = await Media.findByPk(mediaId);
      
      if (!media || !media.is_active) {
        if (req.path.startsWith('/api/')) {
          return res.status(404).json({
            success: false,
            message: 'File not found or inactive'
          });
        } else {
          req.flash('error', 'File not found or inactive');
          return res.redirect('back');
        }
      }
      
      // Store media info for later use
      req.mediaFile = media;
    }
    
    next();
  } catch (error) {
    console.error('File access security error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'File access verification failed'
      });
    } else {
      req.flash('error', 'File access verification failed');
      res.redirect('back');
    }
  }
};

// Session security
const secureSession = (req, res, next) => {
  // Regenerate session ID periodically for security
  if (req.session && req.session.user) {
    const lastRegeneration = req.session.lastRegeneration || 0;
    const now = Date.now();
    
    // Regenerate session every 30 minutes
    if (now - lastRegeneration > 30 * 60 * 1000) {
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration error:', err);
        } else {
          req.session.lastRegeneration = now;
          req.session.user = req.user; // Restore user data
        }
        next();
      });
    } else {
      next();
    }
  } else {
    next();
  }
};

// CORS security for API endpoints
const secureCORS = (req, res, next) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'https://yourdomain.com' // Add your production domain
  ];
  
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
  } else {
    next();
  }
};

// Log security events
const logSecurityEvent = (event, details, req) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: event,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    url: req.url,
    method: req.method,
    userId: req.user ? req.user.id : null,
    details: details
  };
  
  console.log('SECURITY EVENT:', JSON.stringify(logEntry));
  
  // In production, you might want to send this to a logging service
  // or store in database for analysis
};

module.exports = {
  apiRateLimit,
  authRateLimit,
  uploadRateLimit,
  downloadRateLimit,
  passwordResetRateLimit,
  ipWhitelist,
  trackUserActivity,
  setSecurityHeaders,
  detectSuspiciousActivity,
  secureFileAccess,
  secureSession,
  secureCORS,
  logSecurityEvent,
  createRateLimiter
};