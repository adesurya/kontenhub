const express = require('express');
const router = express.Router();

// Import controllers
const {
  createPayment,
  handleCallback,
  checkPaymentStatus,
  getUserTransactions,
  getAvailablePaymentMethods,
  cancelTransaction
} = require('../controllers/paymentController');

// Import middleware
const { authenticateUser } = require('../middleware/auth');
const {
  validatePayment,
  validateId,
  validatePagination,
  sanitizeInput
} = require('../middleware/validation');

// Apply sanitization to all routes
router.use(sanitizeInput);

// Public routes (no authentication required)
router.post('/callback', handleCallback); // Duitku callback
router.get('/methods', getAvailablePaymentMethods);

// Protected routes (authentication required)
router.post('/create', authenticateUser, validatePayment, createPayment);
router.get('/status/:transaction_id', authenticateUser, checkPaymentStatus);
router.get('/transactions', authenticateUser, validatePagination, getUserTransactions);
router.post('/cancel/:transaction_id', authenticateUser, cancelTransaction);

module.exports = router;