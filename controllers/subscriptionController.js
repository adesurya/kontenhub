const { SubscriptionPackage, UserSubscription, User, Transaction } = require('../models');
const { Op } = require('sequelize');
const { logSecurityEvent } = require('../middleware/security');

// Get all subscription packages
const getPackages = async (req, res) => {
  try {
    const packages = await SubscriptionPackage.findAll({
      where: { is_active: true },
      order: [['sort_order', 'ASC'], ['price', 'ASC']]
    });

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        data: { packages }
      });
    } else {
      res.render('admin/subscriptions', {
        title: 'Subscription Packages',
        packages,
        layout: 'main',
        isAdmin: true
      });
    }

  } catch (error) {
    console.error('Get packages error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to get packages'
      });
    } else {
      req.flash('error', 'Failed to load packages');
      res.redirect('/admin/dashboard');
    }
  }
};

// Create new subscription package
const createPackage = async (req, res) => {
  try {
    const {
      name,
      description,
      download_limit,
      price,
      duration_days,
      features,
      is_popular,
      sort_order,
      discount_percentage,
      original_price
    } = req.body;

    const packageData = {
      name,
      description,
      download_limit: parseInt(download_limit),
      price: parseFloat(price),
      duration_days: parseInt(duration_days) || 30,
      features: Array.isArray(features) ? features : (features ? [features] : []),
      is_popular: is_popular === 'true' || is_popular === true,
      sort_order: parseInt(sort_order) || 0
    };

    if (discount_percentage && original_price) {
      packageData.discount_percentage = parseFloat(discount_percentage);
      packageData.original_price = parseFloat(original_price);
    }

    const subscriptionPackage = await SubscriptionPackage.create(packageData);

    logSecurityEvent('PACKAGE_CREATED', {
      packageId: subscriptionPackage.id,
      adminId: req.user.id
    }, req);

    if (req.path.startsWith('/api/')) {
      res.status(201).json({
        success: true,
        message: 'Package created successfully',
        data: { package: subscriptionPackage }
      });
    } else {
      req.flash('success', 'Package created successfully');
      res.redirect('/admin/subscriptions');
    }

  } catch (error) {
    console.error('Create package error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to create package'
      });
    } else {
      req.flash('error', 'Failed to create package');
      res.redirect('back');
    }
  }
};

// Update subscription package
const updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      download_limit,
      price,
      duration_days,
      features,
      is_active,
      is_popular,
      sort_order,
      discount_percentage,
      original_price
    } = req.body;

    const subscriptionPackage = await SubscriptionPackage.findByPk(id);
    if (!subscriptionPackage) {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          success: false,
          message: 'Package not found'
        });
      } else {
        req.flash('error', 'Package not found');
        return res.redirect('back');
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (download_limit) updateData.download_limit = parseInt(download_limit);
    if (price) updateData.price = parseFloat(price);
    if (duration_days) updateData.duration_days = parseInt(duration_days);
    if (features) updateData.features = Array.isArray(features) ? features : [features];
    if (typeof is_active !== 'undefined') updateData.is_active = is_active;
    if (typeof is_popular !== 'undefined') updateData.is_popular = is_popular;
    if (sort_order !== undefined) updateData.sort_order = parseInt(sort_order);
    if (discount_percentage !== undefined) updateData.discount_percentage = parseFloat(discount_percentage) || 0;
    if (original_price !== undefined) updateData.original_price = parseFloat(original_price) || null;

    await subscriptionPackage.update(updateData);

    logSecurityEvent('PACKAGE_UPDATED', {
      packageId: subscriptionPackage.id,
      adminId: req.user.id,
      changes: Object.keys(updateData)
    }, req);

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        message: 'Package updated successfully',
        data: { package: subscriptionPackage }
      });
    } else {
      req.flash('success', 'Package updated successfully');
      res.redirect('back');
    }

  } catch (error) {
    console.error('Update package error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to update package'
      });
    } else {
      req.flash('error', 'Failed to update package');
      res.redirect('back');
    }
  }
};

// Delete subscription package
const deletePackage = async (req, res) => {
  try {
    const { id } = req.params;

    const subscriptionPackage = await SubscriptionPackage.findByPk(id);
    if (!subscriptionPackage) {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          success: false,
          message: 'Package not found'
        });
      } else {
        req.flash('error', 'Package not found');
        return res.redirect('back');
      }
    }

    // Check if package has active subscriptions
    const activeSubscriptions = await UserSubscription.count({
      where: {
        package_id: id,
        is_active: true
      }
    });

    if (activeSubscriptions > 0) {
      if (req.path.startsWith('/api/')) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete package with active subscriptions'
        });
      } else {
        req.flash('error', 'Cannot delete package with active subscriptions');
        return res.redirect('back');
      }
    }

    await subscriptionPackage.destroy();

    logSecurityEvent('PACKAGE_DELETED', {
      packageId: id,
      packageName: subscriptionPackage.name,
      adminId: req.user.id
    }, req);

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        message: 'Package deleted successfully'
      });
    } else {
      req.flash('success', 'Package deleted successfully');
      res.redirect('back');
    }

  } catch (error) {
    console.error('Delete package error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete package'
      });
    } else {
      req.flash('error', 'Failed to delete package');
      res.redirect('back');
    }
  }
};

// Get subscription analytics
const getSubscriptionAnalytics = async (req, res) => {
  try {
    const [
      totalPackages,
      activeSubscriptions,
      expiredSubscriptions,
      totalRevenue,
      packageStats,
      recentSubscriptions
    ] = await Promise.all([
      SubscriptionPackage.count({ where: { is_active: true } }),
      UserSubscription.count({ 
        where: { 
          is_active: true,
          end_date: { [Op.gt]: new Date() }
        } 
      }),
      UserSubscription.count({ 
        where: { 
          end_date: { [Op.lt]: new Date() }
        } 
      }),
      Transaction.sum('amount', {
        where: { status: 'success' }
      }),
      getPackageStatistics(),
      UserSubscription.findAll({
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['full_name', 'email']
          },
          {
            model: SubscriptionPackage,
            as: 'package',
            attributes: ['name', 'price']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: 10
      })
    ]);

    const analytics = {
      totalPackages,
      activeSubscriptions,
      expiredSubscriptions,
      totalRevenue: totalRevenue || 0,
      packageStats,
      recentSubscriptions
    };

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        data: analytics
      });
    } else {
      res.render('admin/subscription-analytics', {
        title: 'Subscription Analytics',
        analytics,
        layout: 'main',
        isAdmin: true
      });
    }

  } catch (error) {
    console.error('Get subscription analytics error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to get analytics'
      });
    } else {
      req.flash('error', 'Failed to load analytics');
      res.redirect('/admin/dashboard');
    }
  }
};

// Get package statistics
async function getPackageStatistics() {
  try {
    const packages = await SubscriptionPackage.findAll({
      include: [
        {
          model: UserSubscription,
          as: 'subscriptions',
          required: false
        }
      ]
    });

    return packages.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      price: pkg.price,
      totalSubscriptions: pkg.subscriptions.length,
      activeSubscriptions: pkg.subscriptions.filter(sub => sub.is_active && sub.end_date > new Date()).length,
      revenue: pkg.subscriptions.reduce((sum, sub) => {
        // Calculate revenue from successful transactions for this package
        return sum + parseFloat(pkg.price);
      }, 0)
    }));
  } catch (error) {
    console.error('Package statistics error:', error);
    return [];
  }
}

// Bulk update packages
const bulkUpdatePackages = async (req, res) => {
  try {
    const { ids, action, value } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No packages selected'
      });
    }

    let updateData = {};
    
    switch (action) {
      case 'activate':
        updateData.is_active = true;
        break;
      case 'deactivate':
        updateData.is_active = false;
        break;
      case 'set_popular':
        updateData.is_popular = value === 'true';
        break;
      case 'update_sort':
        updateData.sort_order = parseInt(value) || 0;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action'
        });
    }

    await SubscriptionPackage.update(updateData, {
      where: { id: { [Op.in]: ids } }
    });

    logSecurityEvent('PACKAGES_BULK_UPDATE', {
      packageIds: ids,
      action,
      adminId: req.user.id
    }, req);

    res.json({
      success: true,
      message: `${ids.length} package(s) updated successfully`
    });

  } catch (error) {
    console.error('Bulk update packages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update packages'
    });
  }
};

// Get user subscription history
const getUserSubscriptionHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      page = 1,
      limit = 20
    } = req.query;

    const offset = (page - 1) * limit;

    const { count, rows: subscriptions } = await UserSubscription.findAndCountAll({
      where: { user_id: userId },
      include: [
        {
          model: SubscriptionPackage,
          as: 'package'
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
          subscriptions,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalItems: count,
            itemsPerPage: parseInt(limit)
          }
        }
      });
    } else {
      res.render('user/subscription-history', {
        title: 'Subscription History',
        subscriptions,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit)
        },
        layout: 'main'
      });
    }

  } catch (error) {
    console.error('Get user subscription history error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to get subscription history'
      });
    } else {
      req.flash('error', 'Failed to load subscription history');
      res.redirect('/user/dashboard');
    }
  }
};

module.exports = {
  getPackages,
  createPackage,
  updatePackage,
  deletePackage,
  getSubscriptionAnalytics,
  bulkUpdatePackages,
  getUserSubscriptionHistory
};