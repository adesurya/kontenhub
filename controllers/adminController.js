const { User, Media, Category, SubscriptionPackage, UserSubscription, Transaction } = require('../models');
const { Op } = require('sequelize');
const { logSecurityEvent } = require('../middleware/security');

// Dashboard - Get statistics
const getDashboard = async (req, res) => {
  try {
    // Get statistics
    const [
      totalUsers,
      totalMedia,
      totalTransactions,
      activeSubscriptions,
      recentUsers,
      recentMedia,
      monthlyStats
    ] = await Promise.all([
      User.count({ where: { role: 'user' } }),
      Media.count({ where: { is_active: true } }),
      Transaction.count({ where: { status: 'success' } }),
      UserSubscription.count({ where: { is_active: true } }),
      User.findAll({
        where: { role: 'user' },
        order: [['created_at', 'DESC']],
        limit: 5,
        attributes: ['id', 'username', 'email', 'full_name', 'created_at']
      }),
      Media.findAll({
        order: [['created_at', 'DESC']],
        limit: 5,
        include: [
          { model: User, as: 'uploader', attributes: ['username'] },
          { model: Category, as: 'category', attributes: ['name'] }
        ]
      }),
      getMonthlyStats()
    ]);

    const stats = {
      totalUsers,
      totalMedia,
      totalTransactions,
      activeSubscriptions,
      recentUsers,
      recentMedia,
      monthlyStats
    };

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        data: stats
      });
    } else {
      res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        stats,
        layout: 'main',
        isAdmin: true
      });
    }

  } catch (error) {
    console.error('Admin dashboard error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to load dashboard data'
      });
    } else {
      req.flash('error', 'Failed to load dashboard data');
      res.redirect('/admin');
    }
  }
};

// Get monthly statistics
const getMonthlyStats = async () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const months = [];

  for (let i = 11; i >= 0; i--) {
    const date = new Date(currentYear, currentDate.getMonth() - i, 1);
    const nextDate = new Date(currentYear, currentDate.getMonth() - i + 1, 1);
    
    const [users, media, transactions] = await Promise.all([
      User.count({
        where: {
          created_at: {
            [Op.gte]: date,
            [Op.lt]: nextDate
          }
        }
      }),
      Media.count({
        where: {
          created_at: {
            [Op.gte]: date,
            [Op.lt]: nextDate
          }
        }
      }),
      Transaction.count({
        where: {
          created_at: {
            [Op.gte]: date,
            [Op.lt]: nextDate
          },
          status: 'success'
        }
      })
    ]);

    months.push({
      month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      users,
      media,
      transactions
    });
  }

  return months;
};

// User Management
const getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      role = '',
      status = ''
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {};

    // Search filter
    if (search) {
      whereClause[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { full_name: { [Op.like]: `%${search}%` } }
      ];
    }

    // Role filter
    if (role) {
      whereClause.role = role;
    }

    // Status filter
    if (status) {
      whereClause.is_active = status === 'active';
    }

    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
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
          users,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalItems: count,
            itemsPerPage: parseInt(limit)
          }
        }
      });
    } else {
      res.render('admin/users', {
        title: 'User Management',
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit)
        },
        filters: { search, role, status },
        layout: 'main',
        isAdmin: true
      });
    }

  } catch (error) {
    console.error('Get users error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to get users'
      });
    } else {
      req.flash('error', 'Failed to load users');
      res.redirect('/admin/dashboard');
    }
  }
};

// Update user status
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active, role } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      } else {
        req.flash('error', 'User not found');
        return res.redirect('back');
      }
    }

    // Prevent admin from deactivating themselves
    if (user.id === req.user.id && is_active === false) {
      if (req.path.startsWith('/api/')) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate your own account'
        });
      } else {
        req.flash('error', 'Cannot deactivate your own account');
        return res.redirect('back');
      }
    }

    const updateData = {};
    if (typeof is_active !== 'undefined') updateData.is_active = is_active;
    if (role && ['admin', 'user'].includes(role)) updateData.role = role;

    await user.update(updateData);

    logSecurityEvent('USER_STATUS_UPDATED', {
      targetUserId: user.id,
      adminId: req.user.id,
      changes: updateData
    }, req);

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        message: 'User status updated successfully',
        data: { user }
      });
    } else {
      req.flash('success', 'User status updated successfully');
      res.redirect('back');
    }

  } catch (error) {
    console.error('Update user status error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to update user status'
      });
    } else {
      req.flash('error', 'Failed to update user status');
      res.redirect('back');
    }
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      } else {
        req.flash('error', 'User not found');
        return res.redirect('back');
      }
    }

    // Prevent admin from deleting themselves
    if (user.id === req.user.id) {
      if (req.path.startsWith('/api/')) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete your own account'
        });
      } else {
        req.flash('error', 'Cannot delete your own account');
        return res.redirect('back');
      }
    }

    await user.destroy();

    logSecurityEvent('USER_DELETED', {
      deletedUserId: user.id,
      deletedUserEmail: user.email,
      adminId: req.user.id
    }, req);

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } else {
      req.flash('success', 'User deleted successfully');
      res.redirect('back');
    }

  } catch (error) {
    console.error('Delete user error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete user'
      });
    } else {
      req.flash('error', 'Failed to delete user');
      res.redirect('back');
    }
  }
};

// Category Management
const getCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      order: [['sort_order', 'ASC'], ['name', 'ASC']]
    });

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        data: { categories }
      });
    } else {
      res.render('admin/categories', {
        title: 'Category Management',
        categories,
        layout: 'main',
        isAdmin: true
      });
    }

  } catch (error) {
    console.error('Get categories error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to get categories'
      });
    } else {
      req.flash('error', 'Failed to load categories');
      res.redirect('/admin/dashboard');
    }
  }
};

// Create category
const createCategory = async (req, res) => {
  try {
    const { name, description, icon, color, sort_order } = req.body;

    const category = await Category.create({
      name,
      description,
      icon: icon || 'fas fa-folder',
      color: color || '#6B7280',
      sort_order: sort_order || 0
    });

    logSecurityEvent('CATEGORY_CREATED', {
      categoryId: category.id,
      adminId: req.user.id
    }, req);

    if (req.path.startsWith('/api/')) {
      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: { category }
      });
    } else {
      req.flash('success', 'Category created successfully');
      res.redirect('/admin/categories');
    }

  } catch (error) {
    console.error('Create category error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to create category'
      });
    } else {
      req.flash('error', 'Failed to create category');
      res.redirect('back');
    }
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, color, sort_order, is_active } = req.body;

    const category = await Category.findByPk(id);
    if (!category) {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      } else {
        req.flash('error', 'Category not found');
        return res.redirect('back');
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (icon) updateData.icon = icon;
    if (color) updateData.color = color;
    if (sort_order !== undefined) updateData.sort_order = sort_order;
    if (typeof is_active !== 'undefined') updateData.is_active = is_active;

    await category.update(updateData);

    logSecurityEvent('CATEGORY_UPDATED', {
      categoryId: category.id,
      adminId: req.user.id,
      changes: updateData
    }, req);

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        message: 'Category updated successfully',
        data: { category }
      });
    } else {
      req.flash('success', 'Category updated successfully');
      res.redirect('back');
    }

  } catch (error) {
    console.error('Update category error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to update category'
      });
    } else {
      req.flash('error', 'Failed to update category');
      res.redirect('back');
    }
  }
};

// Delete category
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findByPk(id);
    if (!category) {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      } else {
        req.flash('error', 'Category not found');
        return res.redirect('back');
      }
    }

    // Check if category has media files
    const mediaCount = await Media.count({ where: { category_id: id } });
    if (mediaCount > 0) {
      if (req.path.startsWith('/api/')) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete category with associated media files'
        });
      } else {
        req.flash('error', 'Cannot delete category with associated media files');
        return res.redirect('back');
      }
    }

    await category.destroy();

    logSecurityEvent('CATEGORY_DELETED', {
      categoryId: category.id,
      categoryName: category.name,
      adminId: req.user.id
    }, req);

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        message: 'Category deleted successfully'
      });
    } else {
      req.flash('success', 'Category deleted successfully');
      res.redirect('back');
    }

  } catch (error) {
    console.error('Delete category error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete category'
      });
    } else {
      req.flash('error', 'Failed to delete category');
      res.redirect('back');
    }
  }
};

module.exports = {
  getDashboard,
  getUsers,
  updateUserStatus,
  deleteUser,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
};