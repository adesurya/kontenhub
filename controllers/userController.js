const { User, Media, Wishlist, SubscriptionPackage, UserSubscription, DownloadHistory } = require('../models');
const { Op } = require('sequelize');
const { logSecurityEvent } = require('../middleware/security');

// Get user dashboard
const getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user with subscription info
    const user = await User.findByPk(userId, {
      include: [
        {
          model: UserSubscription,
          as: 'activeSubscription',
          include: [
            {
              model: SubscriptionPackage,
              as: 'package'
            }
          ]
        }
      ]
    });

    // Get user statistics
    const [
      wishlistCount,
      downloadCount,
      recentDownloads,
      featuredMedia
    ] = await Promise.all([
      Wishlist.count({ where: { user_id: userId } }),
      DownloadHistory.count({ where: { user_id: userId } }),
      DownloadHistory.findAll({
        where: { user_id: userId },
        include: [
          {
            model: Media,
            as: 'media',
            include: [
              {
                model: require('../models').Category,
                as: 'category'
              }
            ]
          }
        ],
        order: [['created_at', 'DESC']],
        limit: 5
      }),
      Media.findAll({
        where: { 
          is_active: true,
          is_featured: true
        },
        include: [
          {
            model: require('../models').Category,
            as: 'category'
          }
        ],
        order: [['created_at', 'DESC']],
        limit: 6
      })
    ]);

    const dashboardData = {
      user,
      stats: {
        wishlistCount,
        downloadCount,
        subscriptionStatus: user.activeSubscription ? 'active' : 'inactive',
        downloadsRemaining: user.activeSubscription ? user.activeSubscription.downloads_remaining : 0
      },
      recentDownloads,
      featuredMedia
    };

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        data: dashboardData
      });
    } else {
      res.render('user/dashboard', {
        title: 'Dashboard',
        ...dashboardData,
        layout: 'main'
      });
    }

  } catch (error) {
    console.error('Get user dashboard error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to load dashboard'
      });
    } else {
      req.flash('error', 'Failed to load dashboard');
      res.redirect('/');
    }
  }
};

// Get user wishlist
const getWishlist = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category = '',
      type = ''
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = { user_id: req.user.id };

    // Build include condition for media filtering
    const mediaWhere = { is_active: true };
    if (category) mediaWhere.category_id = category;
    if (type) mediaWhere.file_type = type;

    const { count, rows: wishlistItems } = await Wishlist.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Media,
          as: 'media',
          where: mediaWhere,
          include: [
            {
              model: require('../models').Category,
              as: 'category'
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    const totalPages = Math.ceil(count / limit);

    // Get categories for filter
    const categories = await require('../models').Category.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']]
    });

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        data: {
          wishlistItems,
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
      res.render('user/wishlist', {
        title: 'My Wishlist',
        wishlistItems,
        categories,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit)
        },
        filters: { category, type },
        layout: 'main'
      });
    }

  } catch (error) {
    console.error('Get wishlist error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to get wishlist'
      });
    } else {
      req.flash('error', 'Failed to load wishlist');
      res.redirect('/user/dashboard');
    }
  }
};

// Add to wishlist
const addToWishlist = async (req, res) => {
  try {
    const { media_id, notes } = req.body;
    const userId = req.user.id;

    // Check if media exists and is active
    const media = await Media.findByPk(media_id);
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

    // Add to wishlist
    const { wishlistItem, created } = await Wishlist.addToWishlist(userId, media_id, notes);

    if (!created) {
      if (req.path.startsWith('/api/')) {
        return res.status(400).json({
          success: false,
          message: 'Media already in wishlist'
        });
      } else {
        req.flash('info', 'Media already in your wishlist');
        return res.redirect('back');
      }
    }

    logSecurityEvent('WISHLIST_ADDED', {
      userId: userId,
      mediaId: media_id
    }, req);

    if (req.path.startsWith('/api/')) {
      res.status(201).json({
        success: true,
        message: 'Added to wishlist successfully',
        data: { wishlistItem }
      });
    } else {
      req.flash('success', 'Added to wishlist successfully');
      res.redirect('back');
    }

  } catch (error) {
    console.error('Add to wishlist error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to add to wishlist'
      });
    } else {
      req.flash('error', 'Failed to add to wishlist');
      res.redirect('back');
    }
  }
};

// Remove from wishlist
const removeFromWishlist = async (req, res) => {
  try {
    const { media_id } = req.params;
    const userId = req.user.id;

    const removed = await Wishlist.removeFromWishlist(userId, media_id);

    if (!removed) {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          success: false,
          message: 'Item not found in wishlist'
        });
      } else {
        req.flash('error', 'Item not found in wishlist');
        return res.redirect('back');
      }
    }

    logSecurityEvent('WISHLIST_REMOVED', {
      userId: userId,
      mediaId: media_id
    }, req);

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        message: 'Removed from wishlist successfully'
      });
    } else {
      req.flash('success', 'Removed from wishlist successfully');
      res.redirect('back');
    }

  } catch (error) {
    console.error('Remove from wishlist error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to remove from wishlist'
      });
    } else {
      req.flash('error', 'Failed to remove from wishlist');
      res.redirect('back');
    }
  }
};

// Get subscription packages
const getSubscriptionPackages = async (req, res) => {
  try {
    const packages = await SubscriptionPackage.findAll({
      where: { is_active: true },
      order: [['sort_order', 'ASC'], ['price', 'ASC']]
    });

    // Get user's current subscription
    let currentSubscription = null;
    if (req.user.subscription_id) {
      currentSubscription = await UserSubscription.findByPk(req.user.subscription_id, {
        include: [
          {
            model: SubscriptionPackage,
            as: 'package'
          }
        ]
      });
    }

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        data: {
          packages,
          currentSubscription
        }
      });
    } else {
      res.render('user/subscribe', {
        title: 'Subscription Packages',
        packages,
        currentSubscription,
        layout: 'main'
      });
    }

  } catch (error) {
    console.error('Get subscription packages error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to get subscription packages'
      });
    } else {
      req.flash('error', 'Failed to load subscription packages');
      res.redirect('/user/dashboard');
    }
  }
};

// Get download history
const getDownloadHistory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type = ''
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = { user_id: req.user.id };

    // Build include condition for media filtering
    const mediaWhere = {};
    if (type) mediaWhere.file_type = type;

    const { count, rows: downloads } = await DownloadHistory.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Media,
          as: 'media',
          where: Object.keys(mediaWhere).length > 0 ? mediaWhere : undefined,
          include: [
            {
              model: require('../models').Category,
              as: 'category'
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    const totalPages = Math.ceil(count / limit);

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        data: {
          downloads,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalItems: count,
            itemsPerPage: parseInt(limit)
          }
        }
      });
    } else {
      res.render('user/downloads', {
        title: 'Download History',
        downloads,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit)
        },
        filters: { type },
        layout: 'main'
      });
    }

  } catch (error) {
    console.error('Get download history error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to get download history'
      });
    } else {
      req.flash('error', 'Failed to load download history');
      res.redirect('/user/dashboard');
    }
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: UserSubscription,
          as: 'activeSubscription',
          include: [
            {
              model: SubscriptionPackage,
              as: 'package'
            }
          ]
        }
      ]
    });

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        data: { user }
      });
    } else {
      res.render('user/profile', {
        title: 'My Profile',
        user,
        layout: 'main'
      });
    }

  } catch (error) {
    console.error('Get profile error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to get profile'
      });
    } else {
      req.flash('error', 'Failed to load profile');
      res.redirect('/user/dashboard');
    }
  }
};

module.exports = {
  getDashboard,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  getSubscriptionPackages,
  getDownloadHistory,
  getProfile
};