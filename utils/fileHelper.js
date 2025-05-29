const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { fromBuffer } = require('file-type');

// File type configurations
const FILE_TYPES = {
    image: {
        extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
        mimes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'],
        maxSize: 50 * 1024 * 1024, // 50MB
        icon: 'fa-image'
    },
    audio: {
        extensions: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'],
        mimes: ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg', 'audio/mp4'],
        maxSize: 100 * 1024 * 1024, // 100MB
        icon: 'fa-music'
    },
    video: {
        extensions: ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'],
        mimes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv', 'video/x-flv', 'video/webm'],
        maxSize: 100 * 1024 * 1024, // 100MB
        icon: 'fa-video'
    }
};

/**
 * Detect file type from buffer or extension
 */
async function detectFileType(buffer, originalName) {
    try {
        // Try to detect from buffer first
        const detected = await fromBuffer(buffer);
        if (detected) {
            for (const [type, config] of Object.entries(FILE_TYPES)) {
                if (config.mimes.includes(detected.mime)) {
                    return {
                        type,
                        mime: detected.mime,
                        extension: detected.ext
                    };
                }
            }
        }
        
        // Fallback to extension detection
        const extension = path.extname(originalName).toLowerCase();
        for (const [type, config] of Object.entries(FILE_TYPES)) {
            if (config.extensions.includes(extension)) {
                // Guess mime type from extension
                const mimeIndex = config.extensions.indexOf(extension);
                return {
                    type,
                    mime: config.mimes[mimeIndex] || config.mimes[0],
                    extension: extension.slice(1)
                };
            }
        }
        
        throw new Error('Unsupported file type');
    } catch (error) {
        throw new Error(`File type detection failed: ${error.message}`);
    }
}

/**
 * Validate file against type constraints
 */
function validateFile(buffer, fileType, originalName) {
    const config = FILE_TYPES[fileType];
    if (!config) {
        throw new Error('Invalid file type');
    }
    
    // Check file size
    if (buffer.length > config.maxSize) {
        throw new Error(`File size exceeds ${formatFileSize(config.maxSize)} limit`);
    }
    
    // Check extension
    const extension = path.extname(originalName).toLowerCase();
    if (!config.extensions.includes(extension)) {
        throw new Error(`File extension ${extension} not allowed for ${fileType} files`);
    }
    
    return true;
}

/**
 * Generate unique filename with timestamp and random string
 */
function generateUniqueFilename(originalName, fileType) {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalName).toLowerCase();
    const baseName = path.basename(originalName, extension);
    const sanitizedBaseName = sanitizeFilename(baseName);
    
    return `${fileType}/${timestamp}-${randomString}-${sanitizedBaseName}${extension}`;
}

/**
 * Sanitize filename for safe storage
 */
function sanitizeFilename(filename) {
    return filename
        .replace(/[^a-zA-Z0-9\-_\.]/g, '-')
        .replace(/\-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
        .substring(0, 50);
}

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get file icon class based on type
 */
function getFileIcon(fileType) {
    return FILE_TYPES[fileType]?.icon || 'fa-file';
}

/**
 * Process image file (resize, optimize, create thumbnail)
 */
async function processImage(buffer, options = {}) {
    try {
        const {
            maxWidth = 1920,
            maxHeight = 1080,
            quality = 85,
            createThumbnail = true,
            thumbnailSize = 300
        } = options;
        
        let image = sharp(buffer);
        const metadata = await image.metadata();
        
        // Resize if needed
        if (metadata.width > maxWidth || metadata.height > maxHeight) {
            image = image.resize(maxWidth, maxHeight, {
                fit: 'inside',
                withoutEnlargement: true
            });
        }
        
        // Optimize and convert to JPEG
        const processedBuffer = await image
            .jpeg({ quality, progressive: true })
            .toBuffer();
        
        let thumbnailBuffer = null;
        if (createThumbnail) {
            thumbnailBuffer = await sharp(buffer)
                .resize(thumbnailSize, thumbnailSize, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({ quality: 80 })
                .toBuffer();
        }
        
        return {
            processedBuffer,
            thumbnailBuffer,
            metadata: {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                size: processedBuffer.length
            }
        };
    } catch (error) {
        throw new Error(`Image processing failed: ${error.message}`);
    }
}

/**
 * Extract metadata from media files
 */
async function extractMetadata(buffer, fileType, originalName) {
    const metadata = {
        originalName,
        fileType,
        size: buffer.length,
        processedAt: new Date().toISOString()
    };
    
    try {
        if (fileType === 'image') {
            const image = sharp(buffer);
            const imageMetadata = await image.metadata();
            
            metadata.dimensions = {
                width: imageMetadata.width,
                height: imageMetadata.height
            };
            metadata.format = imageMetadata.format;
            metadata.hasAlpha = imageMetadata.hasAlpha;
            metadata.colorSpace = imageMetadata.space;
        }
        
        // For audio/video files, you might want to use ffprobe or similar tools
        // This is a basic implementation
        if (fileType === 'audio' || fileType === 'video') {
            // Basic metadata extraction
            // In production, consider using ffprobe or similar tools
            metadata.estimatedDuration = null;
            metadata.bitrate = null;
        }
        
    } catch (error) {
        console.warn('Metadata extraction failed:', error.message);
    }
    
    return metadata;
}

/**
 * Validate file security (check for malicious content)
 */
async function validateFileSecurity(buffer, fileType) {
    try {
        // Check file signature/magic bytes
        const detectedType = await fromBuffer(buffer);
        if (!detectedType) {
            throw new Error('Unable to detect file type');
        }
        
        // Verify file type matches expected
        const expectedMimes = FILE_TYPES[fileType]?.mimes || [];
        if (!expectedMimes.includes(detectedType.mime)) {
            throw new Error('File content does not match file type');
        }
        
        // Additional security checks for images
        if (fileType === 'image') {
            try {
                const image = sharp(buffer);
                await image.metadata(); // This will throw if image is corrupted
                
                // Check for embedded scripts in images
                const bufferString = buffer.toString('binary');
                const suspiciousPatterns = [
                    /<script/i,
                    /javascript:/i,
                    /vbscript:/i,
                    /onload=/i,
                    /onerror=/i
                ];
                
                for (const pattern of suspiciousPatterns) {
                    if (pattern.test(bufferString)) {
                        throw new Error('Suspicious content detected in image');
                    }
                }
            } catch (error) {
                throw new Error(`Image security validation failed: ${error.message}`);
            }
        }
        
        return true;
    } catch (error) {
        throw new Error(`File security validation failed: ${error.message}`);
    }
}

/**
 * Generate file hash for duplicate detection
 */
function generateFileHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Check if file is duplicate based on hash
 */
async function checkDuplicate(fileHash, userId) {
    try {
        const { Media } = require('../models');
        const existingFile = await Media.findOne({
            where: {
                file_hash: fileHash,
                uploaded_by: userId
            }
        });
        
        return existingFile ? {
            isDuplicate: true,
            existingFile
        } : {
            isDuplicate: false,
            existingFile: null
        };
    } catch (error) {
        console.error('Duplicate check failed:', error);
        return { isDuplicate: false, existingFile: null };
    }
}

/**
 * Clean up temporary files
 */
function cleanupTempFiles(filePaths) {
    const fs = require('fs').promises;
    
    Promise.all(
        filePaths.map(async (filePath) => {
            try {
                await fs.unlink(filePath);
            } catch (error) {
                console.warn(`Failed to cleanup temp file ${filePath}:`, error.message);
            }
        })
    );
}

/**
 * Validate and process uploaded file
 */
async function processUploadedFile(buffer, originalName, userId, options = {}) {
    try {
        // Detect file type
        const fileInfo = await detectFileType(buffer, originalName);
        
        // Validate file
        validateFile(buffer, fileInfo.type, originalName);
        
        // Security validation
        await validateFileSecurity(buffer, fileInfo.type);
        
        // Generate file hash for duplicate detection
        const fileHash = generateFileHash(buffer);
        
        // Check for duplicates
        const duplicateCheck = await checkDuplicate(fileHash, userId);
        if (duplicateCheck.isDuplicate && !options.allowDuplicates) {
            throw new Error('File already exists in your library');
        }
        
        // Generate unique filename
        const uniqueFilename = generateUniqueFilename(originalName, fileInfo.type);
        
        // Extract metadata
        const metadata = await extractMetadata(buffer, fileInfo.type, originalName);
        
        let processedBuffer = buffer;
        let thumbnailBuffer = null;
        let dimensions = null;
        
        // Process images
        if (fileInfo.type === 'image') {
            const imageResult = await processImage(buffer, options.imageProcessing);
            processedBuffer = imageResult.processedBuffer;
            thumbnailBuffer = imageResult.thumbnailBuffer;
            dimensions = imageResult.metadata;
        }
        
        return {
            originalName,
            uniqueFilename,
            fileType: fileInfo.type,
            mimeType: fileInfo.mime,
            size: processedBuffer.length,
            hash: fileHash,
            processedBuffer,
            thumbnailBuffer,
            metadata,
            dimensions,
            isDuplicate: duplicateCheck.isDuplicate,
            existingFile: duplicateCheck.existingFile
        };
        
    } catch (error) {
        throw new Error(`File processing failed: ${error.message}`);
    }
}

module.exports = {
    FILE_TYPES,
    detectFileType,
    validateFile,
    generateUniqueFilename,
    sanitizeFilename,
    formatFileSize,
    getFileIcon,
    processImage,
    extractMetadata,
    validateFileSecurity,
    generateFileHash,
    checkDuplicate,
    cleanupTempFiles,
    processUploadedFile
};