const express = require('express');
const router = express.Router();

// Import controllers and middleware
const {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  checkAuth,
  changePassword
} = require('../controllers/authController');

const { authenticateUser } = require('../middleware/auth');
const {
  validateUserRegistration,
  validateUserLogin,
  validateProfileUpdate,
  sanitizeInput
} = require('../middleware/validation');
const {
  authRateLimit,
  passwordResetRateLimit
} = require('../middleware/security');

// Apply sanitization to all routes
router.use(sanitizeInput);

// Public routes
router.post('/register', authRateLimit, validateUserRegistration, register);
router.post('/login', authRateLimit, validateUserLogin, login);
router.post('/logout', logout);
router.get('/check', checkAuth);

// Protected routes
router.use('/profile', authenticateUser);
router.get('/profile', getProfile);
router.put('/profile', validateProfileUpdate, updateProfile);
router.post('/change-password', passwordResetRateLimit, changePassword);

module.exports = router;