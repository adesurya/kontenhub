const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const { fromBuffer } = require('file-type');
const crypto = require('crypto');

// File type configurations
const ALLOWED_TYPES = {
  image: {
    mimes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
    maxSize: 50 * 1024 * 1024 // 50MB
  },
  audio: {
    mimes: ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg'],
    extensions: ['.mp3', '.wav', '.flac', '.aac', '.ogg'],
    maxSize: 100 * 1024 * 1024 // 100MB
  },
  video: {
    mimes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv'],
    extensions: ['.mp4', '.mov', '.avi', '.wmv'],
    maxSize: 100 * 1024 * 1024 // 100MB
  }
};

// Generate unique filename
const generateFileName = (originalName, fileType) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const extension = path.extname(originalName).toLowerCase();
  return `${fileType}/${timestamp}-${randomString}${extension}`;
};

// File filter function
const fileFilter = (req, file, cb) => {
  try {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const fileMimeType = file.mimetype.toLowerCase();
    
    // Determine file type based on mime type
    let fileType = null;
    for (const [type, config] of Object.entries(ALLOWED_TYPES)) {
      if (config.mimes.includes(fileMimeType) && config.extensions.includes(fileExtension)) {
        fileType = type;
        break;
      }
    }
    
    if (!fileType) {
      req.fileValidationError = `File type not allowed. Allowed types: ${Object.keys(ALLOWED_TYPES).join(', ')}`;
      return cb(null, false);
    }
    
    // Store file type in request for later use
    req.detectedFileType = fileType;
    cb(null, true);
    
  } catch (error) {
    console.error('File filter error:', error);
    req.fileValidationError = 'File validation error';
    cb(null, false);
  }
};

// Multer configuration for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
    files: 5 // Max 5 files at once
  },
  fileFilter: fileFilter
});

// Middleware to validate file after upload
const validateFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    // Check for file validation errors
    if (req.fileValidationError) {
      return res.status(400).json({
        success: false,
        message: req.fileValidationError
      });
    }

    const file = req.file;
    const fileType = req.detectedFileType;
    
    // Validate file size based on type
    const typeConfig = ALLOWED_TYPES[fileType];
    if (file.size > typeConfig.maxSize) {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size for ${fileType} files is ${Math.round(typeConfig.maxSize / (1024 * 1024))}MB`
      });
    }

    // Additional validation using file-type library
    const detectedType = await fromBuffer(file.buffer);
    if (detectedType && !typeConfig.mimes.includes(detectedType.mime)) {
      return res.status(400).json({
        success: false,
        message: 'File content does not match file extension'
      });
    }

    // Generate unique filename
    const fileName = generateFileName(file.originalname, fileType);
    
    // Add processed info to request
    req.processedFile = {
      originalName: file.originalname,
      fileName: fileName,
      fileType: fileType,
      size: file.size,
      mimeType: file.mimetype,
      buffer: file.buffer
    };

    next();

  } catch (error) {
    console.error('File validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'File validation failed'
    });
  }
};

// Middleware to process images (create thumbnails)
const processImage = async (req, res, next) => {
  try {
    if (!req.processedFile || req.processedFile.fileType !== 'image') {
      return next();
    }

    const { buffer, fileName } = req.processedFile;
    
    // Get image metadata
    const metadata = await sharp(buffer).metadata();
    
    // Create thumbnail (300x300 max, maintain aspect ratio)
    const thumbnailBuffer = await sharp(buffer)
      .resize(300, 300, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Generate thumbnail filename
    const thumbnailFileName = fileName.replace(/\.[^/.]+$/, '_thumb.jpg');
    
    // Add thumbnail info to processed file
    req.processedFile.thumbnail = {
      buffer: thumbnailBuffer,
      fileName: thumbnailFileName,
      size: thumbnailBuffer.length
    };
    
    // Add image dimensions
    req.processedFile.dimensions = {
      width: metadata.width,
      height: metadata.height
    };

    next();

  } catch (error) {
    console.error('Image processing error:', error);
    // Continue without thumbnail if processing fails
    next();
  }
};

// Middleware to extract audio/video metadata
const processMedia = async (req, res, next) => {
  try {
    if (!req.processedFile || (req.processedFile.fileType !== 'audio' && req.processedFile.fileType !== 'video')) {
      return next();
    }

    // For now, we'll just add basic info
    // In production, you might want to use ffprobe or similar tools
    req.processedFile.metadata = {
      processed: true,
      timestamp: new Date().toISOString()
    };

    next();

  } catch (error) {
    console.error('Media processing error:', error);
    // Continue without metadata if processing fails
    next();
  }
};

// Combined upload middleware
const uploadSingle = (fieldName = 'file') => {
  return [
    upload.single(fieldName),
    validateFile,
    processImage,
    processMedia
  ];
};

// Multiple file upload middleware
const uploadMultiple = (fieldName = 'files', maxCount = 5) => {
  return [
    upload.array(fieldName, maxCount),
    async (req, res, next) => {
      try {
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No files provided'
          });
        }

        // Process each file
        req.processedFiles = [];
        
        for (const file of req.files) {
          // Validate each file similar to single upload
          const fileExtension = path.extname(file.originalname).toLowerCase();
          const fileMimeType = file.mimetype.toLowerCase();
          
          let fileType = null;
          for (const [type, config] of Object.entries(ALLOWED_TYPES)) {
            if (config.mimes.includes(fileMimeType) && config.extensions.includes(fileExtension)) {
              fileType = type;
              break;
            }
          }
          
          if (!fileType) {
            return res.status(400).json({
              success: false,
              message: `File type not allowed for ${file.originalname}`
            });
          }
          
          const typeConfig = ALLOWED_TYPES[fileType];
          if (file.size > typeConfig.maxSize) {
            return res.status(400).json({
              success: false,
              message: `File ${file.originalname} is too large`
            });
          }
          
          const fileName = generateFileName(file.originalname, fileType);
          
          req.processedFiles.push({
            originalName: file.originalname,
            fileName: fileName,
            fileType: fileType,
            size: file.size,
            mimeType: file.mimetype,
            buffer: file.buffer
          });
        }
        
        next();
        
      } catch (error) {
        console.error('Multiple file processing error:', error);
        return res.status(500).json({
          success: false,
          message: 'File processing failed'
        });
      }
    }
  ];
};

// Error handling middleware for multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    let message = 'File upload error';
    
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
      default:
        message = err.message;
    }
    
    return res.status(400).json({
      success: false,
      message: message
    });
  }
  
  next(err);
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  handleUploadError,
  ALLOWED_TYPES,
  generateFileName
};