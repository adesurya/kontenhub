const AWS = require('aws-sdk');
require('dotenv').config();

// Wasabi S3 Configuration
const s3Config = {
  accessKeyId: process.env.WASABI_ACCESS_KEY,
  secretAccessKey: process.env.WASABI_SECRET_KEY,
  endpoint: process.env.WASABI_ENDPOINT || 'https://s3.wasabisys.com',
  region: process.env.WASABI_REGION || 'us-east-1',
  s3ForcePathStyle: true,
  signatureVersion: 'v4'
};

// Create S3 instance
const s3 = new AWS.S3(s3Config);

// Bucket name
const BUCKET_NAME = process.env.WASABI_BUCKET;

// Initialize S3 connection and test
const initializeS3 = async () => {
  try {
    // Test connection by listing bucket contents
    const params = {
      Bucket: BUCKET_NAME,
      MaxKeys: 1
    };
    
    await s3.listObjectsV2(params).promise();
    console.log('✅ Wasabi S3 connection established successfully.');
    return true;
  } catch (error) {
    console.error('❌ Wasabi S3 connection failed:', error.message);
    throw error;
  }
};

// Upload file to S3
const uploadFile = async (fileBuffer, key, contentType, metadata = {}) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      Metadata: metadata,
      ServerSideEncryption: 'AES256'
    };

    const result = await s3.upload(params).promise();
    return {
      success: true,
      location: result.Location,
      key: result.Key,
      etag: result.ETag
    };
  } catch (error) {
    console.error('S3 Upload Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Generate signed URL for secure download
const generateSignedUrl = (key, expiresIn = 3600) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: expiresIn // URL expires in seconds
    };

    const url = s3.getSignedUrl('getObject', params);
    return {
      success: true,
      url: url,
      expiresIn: expiresIn
    };
  } catch (error) {
    console.error('Generate Signed URL Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Delete file from S3
const deleteFile = async (key) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key
    };

    await s3.deleteObject(params).promise();
    return {
      success: true,
      message: 'File deleted successfully'
    };
  } catch (error) {
    console.error('S3 Delete Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Check if file exists
const fileExists = async (key) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key
    };

    await s3.headObject(params).promise();
    return true;
  } catch (error) {
    if (error.statusCode === 404) {
      return false;
    }
    throw error;
  }
};

// Get file metadata
const getFileMetadata = async (key) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key
    };

    const result = await s3.headObject(params).promise();
    return {
      success: true,
      metadata: {
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        lastModified: result.LastModified,
        etag: result.ETag,
        metadata: result.Metadata
      }
    };
  } catch (error) {
    console.error('Get File Metadata Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Generate presigned URL for direct upload
const generatePresignedUploadUrl = (key, contentType, expiresIn = 300) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      Expires: expiresIn
    };

    const url = s3.getSignedUrl('putObject', params);
    return {
      success: true,
      uploadUrl: url,
      key: key,
      expiresIn: expiresIn
    };
  } catch (error) {
    console.error('Generate Presigned Upload URL Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// List files in bucket with pagination
const listFiles = async (prefix = '', maxKeys = 100, continuationToken = null) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: maxKeys
    };

    if (continuationToken) {
      params.ContinuationToken = continuationToken;
    }

    const result = await s3.listObjectsV2(params).promise();
    
    return {
      success: true,
      files: result.Contents || [],
      isTruncated: result.IsTruncated,
      nextContinuationToken: result.NextContinuationToken,
      count: result.KeyCount
    };
  } catch (error) {
    console.error('List Files Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Copy file within bucket
const copyFile = async (sourceKey, destinationKey) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      CopySource: `${BUCKET_NAME}/${sourceKey}`,
      Key: destinationKey
    };

    const result = await s3.copyObject(params).promise();
    return {
      success: true,
      etag: result.ETag,
      copySourceVersionId: result.CopySourceVersionId
    };
  } catch (error) {
    console.error('Copy File Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Get bucket information
const getBucketInfo = async () => {
  try {
    const locationResult = await s3.getBucketLocation({ Bucket: BUCKET_NAME }).promise();
    
    return {
      success: true,
      bucketName: BUCKET_NAME,
      region: locationResult.LocationConstraint || 'us-east-1',
      endpoint: s3Config.endpoint
    };
  } catch (error) {
    console.error('Get Bucket Info Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  s3,
  BUCKET_NAME,
  initializeS3,
  uploadFile,
  generateSignedUrl,
  deleteFile,
  fileExists,
  getFileMetadata,
  generatePresignedUploadUrl,
  listFiles,
  copyFile,
  getBucketInfo
};