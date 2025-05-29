const express = require('express');
const router = express.Router();

// Import controllers
const {
  getDashboard,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  getSubscriptionPackages,
  getDownloadHistory,
  getProfile
} = require('../controllers/userController');

// Import middleware
const { authenticateUser } = require('../middleware/auth');
const {
  validateWishlist,
  validateId,
  validatePagination,
  sanitizeInput
} = require('../middleware/validation');

// Apply authentication and sanitization to all routes
router.use(authenticateUser);
router.use(sanitizeInput);

// Dashboard
router.get('/dashboard', getDashboard);

// Profile
router.get('/profile', getProfile);

// Wishlist
router.get('/wishlist', validatePagination, getWishlist);
router.post('/wishlist', validateWishlist, addToWishlist);
router.delete('/wishlist/:media_id', validateId, removeFromWishlist);

// Subscriptions
router.get('/subscribe', getSubscriptionPackages);

// Download history
router.get('/downloads', validatePagination, getDownloadHistory);

module.exports = router;