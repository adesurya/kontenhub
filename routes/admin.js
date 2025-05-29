const express = require('express');
const router = express.Router();

// Import controllers
const {
  getDashboard,
  getUsers,
  updateUserStatus,
  deleteUser,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/adminController');

// Import middleware
const { authenticateAdmin } = require('../middleware/auth');
const {
  validateCategory,
  validateUserManagement,
  validateId,
  validatePagination,
  sanitizeInput
} = require('../middleware/validation');

// Apply admin authentication to all routes
router.use(authenticateAdmin);
router.use(sanitizeInput);

// Dashboard
router.get('/dashboard', getDashboard);
router.get('/stats', getDashboard);

// User Management
router.get('/users', validatePagination, getUsers);
router.put('/users/:id', validateId, validateUserManagement, updateUserStatus);
router.delete('/users/:id', validateId, deleteUser);

// Category Management
router.get('/categories', getCategories);
router.post('/categories', validateCategory, createCategory);
router.put('/categories/:id', validateId, validateCategory, updateCategory);
router.delete('/categories/:id', validateId, deleteCategory);

module.exports = router;