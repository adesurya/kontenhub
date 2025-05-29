const express = require('express');
const router = express.Router();

// Import controllers
const {
  uploadMedia,
  getMediaList,
  getMediaDetails,
  updateMedia,
  deleteMedia,
  generateDownloadUrl,
  searchMedia
} = require('../controllers/mediaController');

// Import middleware
const { authenticateUser, authenticateAdmin, optionalAuth, checkSubscription } = require('../middleware/auth');
const { uploadSingle, handleUploadError } = require('../middleware/upload');
const {
  validateMediaUpload,
  validateSearch,
  validateId,
  validatePagination,
  sanitizeInput
} = require('../middleware/validation');
const { uploadRateLimit, downloadRateLimit, secureFileAccess } = require('../middleware/security');

// Apply sanitization to all routes
router.use(sanitizeInput);

// Public routes (with optional authentication)
router.get('/search', optionalAuth, validateSearch, validatePagination, searchMedia);
router.get('/:id', optionalAuth, validateId, getMediaDetails);

// Protected routes - require authentication
router.use('/upload', authenticateUser);
router.use('/list', authenticateUser);
router.use('/download', authenticateUser);
router.use('/update', authenticateUser);
router.use('/delete', authenticateUser);

// Admin/Uploader routes
router.post('/upload', 
  uploadRateLimit,
  uploadSingle('file'),
  validateMediaUpload,
  uploadMedia,
  handleUploadError
);

router.get('/list', validatePagination, getMediaList);
router.put('/:id', validateId, validateMediaUpload, updateMedia);
router.delete('/:id', validateId, deleteMedia);

// Download routes (require active subscription)
router.get('/download/:id', 
  downloadRateLimit,
  validateId,
  secureFileAccess,
  checkSubscription,
  generateDownloadUrl
);

module.exports = router;