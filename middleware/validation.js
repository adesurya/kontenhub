const { body, param, query, validationResult, check } = require('express-validator');
const xss = require('xss');
const validator = require('validator');
const { User, Media, Category, SubscriptionPackage } = require('../models');

// XSS Options Configuration
const xssOptions = {
  whiteList: {
    p: [],
    br: [],
    strong: [],
    em: [],
    u: [],
    i: [],
    b: [],
    span: ['style'],
    div: ['class'],
    h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
    ul: [], ol: [], li: [],
    a: ['href', 'title', 'target']
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style']
};

// Validation error handler with detailed formatting
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));
    
    // Log validation errors for debugging
    console.log('Validation Errors:', {
      url: req.url,
      method: req.method,
      errors: errorMessages,
      body: req.body,
      params: req.params,
      query: req.query
    });
    
    if (req.path.startsWith('/api/')) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errorMessages,
        timestamp: new Date().toISOString()
      });
    } else {
      const errorString = errorMessages.map(e => e.message).join(', ');
      req.flash('error', errorString);
      return res.redirect('back');
    }
  }
  
  next();
};

// Advanced input sanitization
const sanitizeInput = (req, res, next) => {
  // Sanitize body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  // Sanitize params
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

// Recursive object sanitization
function sanitizeObject(obj) {
  if (typeof obj === 'string') {
    return xss(obj.trim(), xssOptions);
  } else if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  } else if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  return obj;
}

// Custom validation functions
const customValidators = {
  // Check if user exists and is active
  isValidUser: async (userId) => {
    const user = await User.findByPk(userId);
    if (!user || !user.is_active) {
      throw new Error('User not found or inactive');
    }
    return true;
  },

  // Check if media exists and is active
  isValidMedia: async (mediaId) => {
    const media = await Media.findByPk(mediaId);
    if (!media || !media.is_active) {
      throw new Error('Media not found or inactive');
    }
    return true;
  },

  // Check if category exists and is active
  isValidCategory: async (categoryId) => {
    const category = await Category.findByPk(categoryId);
    if (!category || !category.is_active) {
      throw new Error('Category not found or inactive');
    }
    return true;
  },

  // Check if subscription package exists and is active
  isValidPackage: async (packageId) => {
    const pkg = await SubscriptionPackage.findByPk(packageId);
    if (!pkg || !pkg.is_active) {
      throw new Error('Subscription package not found or inactive');
    }
    return true;
  },

  // Check if username is unique
  isUniqueUsername: async (username, { req }) => {
    const userId = req.params.id || req.user?.id;
    const whereClause = { username };
    
    if (userId) {
      whereClause.id = { [require('sequelize').Op.ne]: userId };
    }
    
    const existingUser = await User.findOne({ where: whereClause });
    if (existingUser) {
      throw new Error('Username already taken');
    }
    return true;
  },

  // Check if email is unique
  isUniqueEmail: async (email, { req }) => {
    const userId = req.params.id || req.user?.id;
    const whereClause = { email };
    
    if (userId) {
      whereClause.id = { [require('sequelize').Op.ne]: userId };
    }
    
    const existingUser = await User.findOne({ where: whereClause });
    if (existingUser) {
      throw new Error('Email already registered');
    }
    return true;
  },

  // Validate Indonesian phone number
  isValidIndonesianPhone: (phone) => {
    const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,9}$/;
    if (!phoneRegex.test(phone)) {
      throw new Error('Invalid Indonesian phone number format');
    }
    return true;
  },

  // Validate file size
  isValidFileSize: (size, maxSize = 100 * 1024 * 1024) => {
    if (parseInt(size) > maxSize) {
      throw new Error(`File size exceeds ${Math.round(maxSize / (1024 * 1024))}MB limit`);
    }
    return true;
  },

  // Validate password strength
  isStrongPassword: (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (password.length < minLength) {
      throw new Error(`Password must be at least ${minLength} characters long`);
    }
    if (!hasUpperCase) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    if (!hasLowerCase) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    if (!hasNumbers) {
      throw new Error('Password must contain at least one number');
    }
    if (!hasSpecialChars) {
      throw new Error('Password must contain at least one special character');
    }
    return true;
  },

  // Validate tags array
  isValidTags: (tags) => {
    if (!Array.isArray(tags)) {
      throw new Error('Tags must be an array');
    }
    if (tags.length > 10) {
      throw new Error('Maximum 10 tags allowed');
    }
    for (const tag of tags) {
      if (typeof tag !== 'string' || tag.length > 50) {
        throw new Error('Each tag must be a string with maximum 50 characters');
      }
    }
    return true;
  },

  // Validate color hex code
  isValidHexColor: (color) => {
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexRegex.test(color)) {
      throw new Error('Invalid hex color format');
    }
    return true;
  },

  // Validate date range
  isValidDateRange: (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      throw new Error('Start date must be before end date');
    }
    return true;
  },

  // Validate JSON structure
  isValidJSON: (jsonString) => {
    try {
      JSON.parse(jsonString);
      return true;
    } catch (error) {
      throw new Error('Invalid JSON format');
    }
  },

  // Validate social media URLs
  isValidSocialURL: (url, platform) => {
    const patterns = {
      tiktok: /^https?:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com)\/.+/,
      shopee: /^https?:\/\/(www\.)?shopee\.(co\.id|com|sg|my|th|ph|vn|tw|br)\/.+/,
      instagram: /^https?:\/\/(www\.)?instagram\.com\/.+/,
      youtube: /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/,
      facebook: /^https?:\/\/(www\.)?facebook\.com\/.+/
    };
    
    if (platform && patterns[platform]) {
      if (!patterns[platform].test(url)) {
        throw new Error(`Invalid ${platform} URL format`);
      }
    }
    return true;
  }
};

// User registration validation
const validateUserRegistration = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3-50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores')
    .custom(customValidators.isUniqueUsername),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .custom(customValidators.isUniqueEmail),
  
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8-128 characters')
    .custom(customValidators.isStrongPassword),
  
  body('confirm_password')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
  
  body('full_name')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2-100 characters')
    .matches(/^[a-zA-Z\s\-\.]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, and dots'),
  
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .custom(customValidators.isValidIndonesianPhone),
  
  body('terms')
    .equals('true')
    .withMessage('You must agree to the terms and conditions'),
  
  handleValidationErrors
];

// User login validation
const validateUserLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 1, max: 128 })
    .withMessage('Password length is invalid'),
  
  body('remember_me')
    .optional()
    .isBoolean()
    .withMessage('Remember me must be a boolean value'),
  
  handleValidationErrors
];

// Media upload validation
const validateMediaUpload = [
  body('title')
    .isLength({ min: 2, max: 255 })
    .withMessage('Title must be between 2-255 characters')
    .trim()
    .escape(),
  
  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters')
    .trim(),
  
  body('category_id')
    .isInt({ min: 1 })
    .withMessage('Please select a valid category')
    .custom(customValidators.isValidCategory),
  
  body('shopee_link')
    .optional({ nullable: true, checkFalsy: true })
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Shopee link must be a valid URL')
    .custom((value) => customValidators.isValidSocialURL(value, 'shopee')),
  
  body('tiktok_link')
    .optional({ nullable: true, checkFalsy: true })
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('TikTok link must be a valid URL')
    .custom((value) => customValidators.isValidSocialURL(value, 'tiktok')),
  
  body('tags')
    .optional({ nullable: true })
    .custom((value) => {
      if (value) {
        const tags = typeof value === 'string' ? value.split(',').map(t => t.trim()) : value;
        return customValidators.isValidTags(tags);
      }
      return true;
    }),
  
  body('is_featured')
    .optional()
    .isBoolean()
    .withMessage('Featured status must be a boolean'),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('Active status must be a boolean'),
  
  handleValidationErrors
];

// Category validation
const validateCategory = [
  body('name')
    .isLength({ min: 2, max: 100 })
    .withMessage('Category name must be between 2-100 characters')
    .trim()
    .escape(),
  
  body('slug')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Slug must be between 2-100 characters')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug can only contain lowercase letters, numbers, and hyphens'),
  
  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters')
    .trim(),
  
  body('icon')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 50 })
    .withMessage('Icon class must not exceed 50 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage('Invalid icon class format'),
  
  body('color')
    .optional({ nullable: true, checkFalsy: true })
    .custom(customValidators.isValidHexColor),
  
  body('sort_order')
    .optional()
    .isInt({ min: 0, max: 9999 })
    .withMessage('Sort order must be between 0-9999'),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('Active status must be a boolean'),
  
  handleValidationErrors
];

// Subscription package validation
const validateSubscriptionPackage = [
  body('name')
    .isLength({ min: 2, max: 100 })
    .withMessage('Package name must be between 2-100 characters')
    .trim()
    .escape(),
  
  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters')
    .trim(),
  
  body('download_limit')
    .isInt({ min: 1, max: 999999 })
    .withMessage('Download limit must be between 1-999999'),
  
  body('price')
    .isFloat({ min: 0, max: 99999999.99 })
    .withMessage('Price must be a positive number with maximum 2 decimal places'),
  
  body('duration_days')
    .isInt({ min: 1, max: 365 })
    .withMessage('Duration must be between 1-365 days'),
  
  body('features')
    .optional({ nullable: true })
    .custom((value) => {
      if (value) {
        const features = Array.isArray(value) ? value : JSON.parse(value);
        if (!Array.isArray(features)) {
          throw new Error('Features must be an array');
        }
        if (features.length > 20) {
          throw new Error('Maximum 20 features allowed');
        }
        for (const feature of features) {
          if (typeof feature !== 'string' || feature.length > 200) {
            throw new Error('Each feature must be a string with maximum 200 characters');
          }
        }
      }
      return true;
    }),
  
  body('discount_percentage')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('Discount percentage must be between 0-100'),
  
  body('original_price')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage('Original price must be a positive number'),
  
  body('is_popular')
    .optional()
    .isBoolean()
    .withMessage('Popular status must be a boolean'),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('Active status must be a boolean'),
  
  handleValidationErrors
];

// Search validation
const validateSearch = [
  query('q')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query must be between 1-200 characters')
    .trim(),
  
  query('category')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage('Category must be a valid ID'),
  
  query('type')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['image', 'audio', 'video'])
    .withMessage('File type must be image, audio, or video'),
  
  query('sort')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['created_at', 'updated_at', 'title', 'download_count', 'view_count', 'file_size'])
    .withMessage('Invalid sort field'),
  
  query('order')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['ASC', 'DESC', 'asc', 'desc'])
    .withMessage('Order must be ASC or DESC'),
  
  query('page')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be between 1-1000'),
  
  query('limit')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1-100'),
  
  query('min_size')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage('Minimum size must be a positive number'),
  
  query('max_size')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage('Maximum size must be a positive number'),
  
  handleValidationErrors
];

// ID parameter validation
const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer'),
  
  handleValidationErrors
];

// Multiple IDs validation
const validateIds = [
  body('ids')
    .isArray({ min: 1, max: 100 })
    .withMessage('IDs must be an array with 1-100 items'),
  
  body('ids.*')
    .isInt({ min: 1 })
    .withMessage('Each ID must be a positive integer'),
  
  handleValidationErrors
];

// Pagination validation
const validatePagination = [
  query('page')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be between 1-1000')
    .toInt(),
  
  query('limit')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1-100')
    .toInt(),
  
  handleValidationErrors
];

// Profile update validation
const validateProfileUpdate = [
  body('full_name')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2-100 characters')
    .matches(/^[a-zA-Z\s\-\.]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, and dots')
    .trim(),
  
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .custom(customValidators.isValidIndonesianPhone),
  
  body('current_password')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ min: 1 })
    .withMessage('Current password is required when changing password'),
  
  body('new_password')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8-128 characters')
    .custom(customValidators.isStrongPassword),
  
  body('confirm_new_password')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value, { req }) => {
      if (req.body.new_password && value !== req.body.new_password) {
        throw new Error('New password confirmation does not match');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Payment validation
const validatePayment = [
  body('package_id')
    .isInt({ min: 1 })
    .withMessage('Please select a valid package')
    .custom(customValidators.isValidPackage),
  
  body('payment_method')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ min: 1, max: 50 })
    .withMessage('Payment method must be between 1-50 characters'),
  
  handleValidationErrors
];

// Wishlist validation
const validateWishlist = [
  body('media_id')
    .isInt({ min: 1 })
    .withMessage('Please select a valid media file')
    .custom(customValidators.isValidMedia),
  
  body('notes')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters')
    .trim(),
  
  body('priority')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high'),
  
  body('category')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ min: 1, max: 50 })
    .withMessage('Category must be between 1-50 characters'),
  
  body('tags')
    .optional({ nullable: true })
    .custom(customValidators.isValidTags),
  
  body('is_favorite')
    .optional()
    .isBoolean()
    .withMessage('Favorite status must be a boolean'),
  
  body('reminder_date')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Reminder date must be a valid date')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Reminder date must be in the future');
      }
      return true;
    }),
  
  handleValidationErrors
];

// User management validation (admin)
const validateUserManagement = [
  body('role')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['admin', 'user'])
    .withMessage('Role must be admin or user'),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('Active status must be true or false'),
  
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('username')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3-50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  handleValidationErrors
];

// Date range validation
const validateDateRange = [
  query('start_date')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  
  query('end_date')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('End date must be a valid date'),
  
  // Custom validation for date range
  check().custom((value, { req }) => {
    if (req.query.start_date && req.query.end_date) {
      return customValidators.isValidDateRange(req.query.start_date, req.query.end_date);
    }
    return true;
  }),
  
  handleValidationErrors
];

// Bulk operations validation
const validateBulkOperation = [
  body('action')
    .isIn(['activate', 'deactivate', 'delete', 'update_category', 'update_priority'])
    .withMessage('Invalid bulk action'),
  
  body('ids')
    .isArray({ min: 1, max: 100 })
    .withMessage('Must select 1-100 items for bulk operation'),
  
  body('ids.*')
    .isInt({ min: 1 })
    .withMessage('Each ID must be a positive integer'),
  
  body('value')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ min: 1, max: 100 })
    .withMessage('Value must be between 1-100 characters'),
  
  handleValidationErrors
];

// File upload validation
const validateFileUpload = [
  body('file_type')
    .optional()
    .isIn(['image', 'audio', 'video'])
    .withMessage('File type must be image, audio, or video'),
  
  body('file_size')
    .optional()
    .isInt({ min: 1 })
    .withMessage('File size must be a positive integer')
    .custom((value) => customValidators.isValidFileSize(value)),
  
  handleValidationErrors
];

// Comment/Review validation
const validateComment = [
  body('content')
    .isLength({ min: 1, max: 2000 })
    .withMessage('Comment must be between 1-2000 characters')
    .trim(),
  
  body('rating')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1-5'),
  
  body('parent_id')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage('Parent ID must be a positive integer'),
  
  handleValidationErrors
];

// Advanced search validation
const validateAdvancedSearch = [
  query('q')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query must be between 1-200 characters'),
  
  query('tags')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      const tags = value.split(',').map(t => t.trim()).filter(t => t);
      return customValidators.isValidTags(tags);
    }),
  
  query('min_downloads')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage('Minimum downloads must be a positive number'),
  
  query('max_downloads')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage('Maximum downloads must be a positive number'),
  
  query('uploaded_after')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Upload date must be a valid date'),
  
  query('uploaded_before')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Upload date must be a valid date'),
  
  handleValidationErrors
];

module.exports = {
  // Core validation functions
  handleValidationErrors,
  sanitizeInput,
  customValidators,
  
  // User validations
  validateUserRegistration,
  validateUserLogin,
  validateProfileUpdate,
  validateUserManagement,
  
  // Media validations
  validateMediaUpload,
  validateFileUpload,
  
  // Category validations
  validateCategory,
  
  // Subscription validations
  validateSubscriptionPackage,
  validatePayment,
  
  // Search validations
  validateSearch,
  validateAdvancedSearch,
  
  // Wishlist validations
  validateWishlist,
  
  // Common validations
  validateId,
  validateIds,
  validatePagination,
  validateDateRange,
  validateBulkOperation,
  validateComment,
  
  // Utility functions
  sanitizeObject,
  xssOptions
};