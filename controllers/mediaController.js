const { Media, Category, User, Wishlist, DownloadHistory } = require('../models');
const { Op } = require('sequelize');
const { uploadFile, generateSignedUrl, deleteFile } = require('../config/s3Config');
const { logSecurityEvent } = require('../middleware/security');

// Upload media file
const uploadMedia = async (req, res) => {
  try {
    if (!req.processedFile) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    const {
      title,
      description,
      category_id,
      shopee_link,
      tiktok_link,
      tags
    } = req.body;

    const {
      originalName,
      fileName,
      fileType,
      size,
      mimeType,
      buffer,
      thumbnail,
      dimensions
    } = req.processedFile;

    // Upload main file to S3
    const uploadResult = await uploadFile(
      buffer,
      fileName,
      mimeType,
      {
        title,
        originalName,
        uploadedBy: req.user.id.toString()
      }
    );

    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload file to storage'
      });
    }

    let thumbnailResult = null;
    if (thumbnail) {
      thumbnailResult = await uploadFile(
        thumbnail.buffer,
        thumbnail.fileName,
        'image/jpeg',
        {
          type: 'thumbnail',
          parentFile: fileName
        }
      );
    }

    // Create media record
    const mediaData = {
      title,
      description: description || null,
      category_id: parseInt(category_id),
      file_type: fileType,
      file_name: fileName,
      original_name: originalName,
      file_size: size,
      mime_type: mimeType,
      s3_key: fileName,
      s3_url: uploadResult.location,
      shopee_link: shopee_link || null,
      tiktok_link: tiktok_link || null,
      uploaded_by: req.user.id,
      tags: Array.isArray(tags) ? tags : (tags ? [tags] : [])
    };

    if (thumbnailResult && thumbnailResult.success) {
      mediaData.thumbnail_key = thumbnail.fileName;
      mediaData.thumbnail_url = thumbnailResult.location;
    }

    if (dimensions) {
      mediaData.dimensions = dimensions;
    }

    const media = await Media.create(mediaData);

    // Update category media count
    await Category.findByPk(category_id).then(category => {
      if (category) category.incrementMediaCount();
    });

    logSecurityEvent('MEDIA_UPLOADED', {
      mediaId: media.id,
      userId: req.user.id,
      fileType,
      fileSize: size
    }, req);

    if (req.path.startsWith('/api/')) {
      res.status(201).json({
        success: true,
        message: 'Media uploaded successfully',
        data: { media }
      });
    } else {
      req.flash('success', 'Media uploaded successfully');
      res.redirect('/admin/media/list');
    }

  } catch (error) {
    console.error('Upload media error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to upload media'
      });
    } else {
      req.flash('error', 'Failed to upload media');
      res.redirect('back');
    }
  }
};

// Get media list with search and filters
const getMediaList = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      category = '',
      type = '',
      sort = 'created_at',
      order = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = { is_active: true };

    // Search filter
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    // Category filter
    if (category) {
      whereClause.category_id = category;
    }

    // File type filter
    if (type && ['image', 'audio', 'video'].includes(type)) {
      whereClause.file_type = type;
    }

    const { count, rows: mediaFiles } = await Media.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'username', 'full_name']
        },
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug', 'icon', 'color']
        }
      ],
      order: [[sort, order.toUpperCase()]],
      limit: parseInt(limit),
      offset: offset
    });

    const totalPages = Math.ceil(count / limit);

    // Get categories for filter
    const categories = await Category.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']]
    });

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        data: {
          mediaFiles,
          categories,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalItems: count,
            itemsPerPage: parseInt(limit)
          }
        }
      });
    } else {
      res.render('admin/media-list', {
        title: 'Media Management',
        mediaFiles,
        categories,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit)
        },
        filters: { search, category, type, sort, order },
        layout: 'main',
        isAdmin: true
      });
    }

  } catch (error) {
    console.error('Get media list error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to get media list'
      });
    } else {
      req.flash('error', 'Failed to load media list');
      res.redirect('/admin/dashboard');
    }
  }
};

// Get single media details
const getMediaDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const media = await Media.findByPk(id, {
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'username', 'full_name']
        },
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug', 'icon', 'color']
        }
      ]
    });

    if (!media) {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          success: false,
          message: 'Media not found'
        });
      } else {
        req.flash('error', 'Media not found');
        return res.redirect('back');
      }
    }

    // Increment view count
    await media.incrementViewCount();

    // Check if user has this in wishlist (for authenticated users)
    let isInWishlist = false;
    if (req.user) {
      isInWishlist = await Wishlist.isInWishlist(req.user.id, media.id);
    }

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        data: { 
          media,
          isInWishlist
        }
      });
    } else {
      res.render('media/details', {
        title: media.title,
        media,
        isInWishlist,
        layout: 'main'
      });
    }

  } catch (error) {
    console.error('Get media details error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to get media details'
      });
    } else {
      req.flash('error', 'Failed to load media details');
      res.redirect('back');
    }
  }
};

// Update media
const updateMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      category_id,
      shopee_link,
      tiktok_link,
      tags,
      is_active,
      is_featured
    } = req.body;

    const media = await Media.findByPk(id);
    if (!media) {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          success: false,
          message: 'Media not found'
        });
      } else {
        req.flash('error', 'Media not found');
        return res.redirect('back');
      }
    }

    // Check permissions (admin or uploader)
    if (req.user.role !== 'admin' && media.uploaded_by !== req.user.id) {
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied'
        });
      } else {
        req.flash('error', 'Permission denied');
        return res.redirect('back');
      }
    }

    const updateData = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (category_id) updateData.category_id = parseInt(category_id);
    if (shopee_link !== undefined) updateData.shopee_link = shopee_link || null;
    if (tiktok_link !== undefined) updateData.tiktok_link = tiktok_link || null;
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : (tags ? [tags] : []);
    if (typeof is_active !== 'undefined') updateData.is_active = is_active;
    if (typeof is_featured !== 'undefined') updateData.is_featured = is_featured;

    await media.update(updateData);

    logSecurityEvent('MEDIA_UPDATED', {
      mediaId: media.id,
      userId: req.user.id,
      changes: Object.keys(updateData)
    }, req);

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        message: 'Media updated successfully',
        data: { media }
      });
    } else {
      req.flash('success', 'Media updated successfully');
      res.redirect('back');
    }

  } catch (error) {
    console.error('Update media error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to update media'
      });
    } else {
      req.flash('error', 'Failed to update media');
      res.redirect('back');
    }
  }
};

// Delete media
const deleteMedia = async (req, res) => {
  try {
    const { id } = req.params;

    const media = await Media.findByPk(id);
    if (!media) {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          success: false,
          message: 'Media not found'
        });
      } else {
        req.flash('error', 'Media not found');
        return res.redirect('back');
      }
    }

    // Check permissions (admin or uploader)
    if (req.user.role !== 'admin' && media.uploaded_by !== req.user.id) {
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied'
        });
      } else {
        req.flash('error', 'Permission denied');
        return res.redirect('back');
      }
    }

    // Delete files from S3
    await deleteFile(media.s3_key);
    if (media.thumbnail_key) {
      await deleteFile(media.thumbnail_key);
    }

    // Update category media count
    const category = await Category.findByPk(media.category_id);
    if (category) {
      await category.decrementMediaCount();
    }

    await media.destroy();

    logSecurityEvent('MEDIA_DELETED', {
      mediaId: media.id,
      mediaTitle: media.title,
      userId: req.user.id
    }, req);

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        message: 'Media deleted successfully'
      });
    } else {
      req.flash('success', 'Media deleted successfully');
      res.redirect('back');
    }

  } catch (error) {
    console.error('Delete media error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete media'
      });
    } else {
      req.flash('error', 'Failed to delete media');
      res.redirect('back');
    }
  }
};

// Generate download URL
const generateDownloadUrl = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has active subscription
    if (!req.user.activeSubscription || !req.user.activeSubscription.canDownload()) {
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({
          success: false,
          message: 'Active subscription required or download limit exceeded',
          redirectTo: '/user/subscribe'
        });
      } else {
        req.flash('error', 'Active subscription required or download limit exceeded');
        return res.redirect('/user/subscribe');
      }
    }

    const media = await Media.findByPk(id);
    if (!media || !media.is_active) {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          success: false,
          message: 'Media not found or inactive'
        });
      } else {
        req.flash('error', 'Media not found or inactive');
        return res.redirect('back');
      }
    }

    // Generate signed URL (expires in 1 hour)
    const signedUrlResult = generateSignedUrl(media.s3_key, 3600);
    if (!signedUrlResult.success) {
      if (req.path.startsWith('/api/')) {
        return res.status(500).json({
          success: false,
          message: 'Failed to generate download URL'
        });
      } else {
        req.flash('error', 'Failed to generate download URL');
        return res.redirect('back');
      }
    }

    // Use download (decrement user's remaining downloads)
    await req.user.activeSubscription.useDownload();

    // Increment media download count
    await media.incrementDownloadCount();

    // Create download history record
    await DownloadHistory.createDownloadRecord(
      req.user.id,
      media.id,
      req.user.activeSubscription.id,
      signedUrlResult.url,
      60 // 60 minutes expiration
    );

    logSecurityEvent('MEDIA_DOWNLOAD_GENERATED', {
      mediaId: media.id,
      userId: req.user.id,
      subscriptionId: req.user.activeSubscription.id
    }, req);

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        message: 'Download URL generated successfully',
        data: {
          downloadUrl: signedUrlResult.url,
          expiresIn: signedUrlResult.expiresIn,
          media: {
            id: media.id,
            title: media.title,
            file_name: media.file_name,
            file_size: media.file_size
          }
        }
      });
    } else {
      // For web requests, redirect to the download URL
      res.redirect(signedUrlResult.url);
    }

  } catch (error) {
    console.error('Generate download URL error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate download URL'
      });
    } else {
      req.flash('error', 'Failed to generate download URL');
      res.redirect('back');
    }
  }
};

// Search media
const searchMedia = async (req, res) => {
  try {
    const {
      q = '',
      category = '',
      type = '',
      page = 1,
      limit = 20,
      sort = 'created_at',
      order = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = { is_active: true };

    // Search query
    if (q) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${q}%` } },
        { description: { [Op.like]: `%${q}%` } },
        { tags: { [Op.like]: `%${q}%` } }
      ];
    }

    // Category filter
    if (category) {
      whereClause.category_id = category;
    }

    // File type filter
    if (type && ['image', 'audio', 'video'].includes(type)) {
      whereClause.file_type = type;
    }

    const { count, rows: mediaFiles } = await Media.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug', 'icon', 'color']
        }
      ],
      order: [[sort, order.toUpperCase()]],
      limit: parseInt(limit),
      offset: offset
    });

    const totalPages = Math.ceil(count / limit);

    // Get categories for filter
    const categories = await Category.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']]
    });

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        data: {
          mediaFiles,
          categories,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalItems: count,
            itemsPerPage: parseInt(limit)
          },
          searchQuery: q
        }
      });
    } else {
      res.render('user/browse', {
        title: 'Browse Media',
        mediaFiles,
        categories,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit)
        },
        filters: { q, category, type, sort, order },
        layout: 'main'
      });
    }

  } catch (error) {
    console.error('Search media error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Search failed'
      });
    } else {
      req.flash('error', 'Search failed');
      res.redirect('back');
    }
  }
};

module.exports = {
  uploadMedia,
  getMediaList,
  getMediaDetails,
  updateMedia,
  deleteMedia,
  generateDownloadUrl,
  searchMedia
};