const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Wishlist = sequelize.define('Wishlist', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    validate: {
      isInt: {
        msg: 'User ID must be an integer'
      },
      notEmpty: {
        msg: 'User ID is required'
      }
    }
  },
  media_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'media_files',
      key: 'id'
    },
    validate: {
      isInt: {
        msg: 'Media ID must be an integer'
      },
      notEmpty: {
        msg: 'Media ID is required'
      }
    }
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 1000],
        msg: 'Notes must not exceed 1000 characters'
      }
    }
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high'),
    allowNull: true,
    defaultValue: 'medium',
    validate: {
      isIn: {
        args: [['low', 'medium', 'high']],
        msg: 'Priority must be low, medium, or high'
      }
    }
  },
  is_favorite: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: true,
    validate: {
      len: {
        args: [0, 50],
        msg: 'Category must not exceed 50 characters'
      }
    }
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    validate: {
      isValidTags(value) {
        if (value && !Array.isArray(value)) {
          throw new Error('Tags must be an array');
        }
        if (value && value.length > 10) {
          throw new Error('Maximum 10 tags allowed');
        }
      }
    }
  },
  reminder_date: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'Reminder date must be a valid date'
      },
      isAfter: {
        args: new Date().toISOString(),
        msg: 'Reminder date must be in the future'
      }
    }
  },
  viewed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  view_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    validate: {
      min: {
        args: 0,
        msg: 'View count cannot be negative'
      }
    }
  }
}, {
  tableName: 'user_wishlists',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'media_id'],
      name: 'unique_user_media_wishlist'
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['media_id']
    },
    {
      fields: ['priority']
    },
    {
      fields: ['is_favorite']
    },
    {
      fields: ['category']
    },
    {
      fields: ['reminder_date']
    },
    {
      fields: ['created_at']
    }
  ],
  hooks: {
    beforeCreate: (wishlist) => {
      // Set default category if not provided
      if (!wishlist.category) {
        wishlist.category = 'general';
      }
      
      // Initialize tags as empty array if null
      if (!wishlist.tags) {
        wishlist.tags = [];
      }
    },
    beforeUpdate: (wishlist) => {
      // Update viewed_at when wishlist is accessed
      if (wishlist.changed('view_count')) {
        wishlist.viewed_at = new Date();
      }
    },
    afterCreate: async (wishlist) => {
      // Update user's wishlist count or other related data
      console.log(`New wishlist item created: User ${wishlist.user_id}, Media ${wishlist.media_id}`);
    },
    beforeDestroy: async (wishlist) => {
      // Log wishlist removal
      console.log(`Wishlist item removed: User ${wishlist.user_id}, Media ${wishlist.media_id}`);
    }
  }
});

// Instance Methods
Wishlist.prototype.incrementViewCount = async function() {
  this.view_count += 1;
  this.viewed_at = new Date();
  await this.save();
  return this;
};

Wishlist.prototype.addTag = function(tag) {
  if (!this.tags) this.tags = [];
  if (!this.tags.includes(tag) && this.tags.length < 10) {
    this.tags.push(tag);
  }
  return this;
};

Wishlist.prototype.removeTag = function(tag) {
  if (!this.tags) return this;
  this.tags = this.tags.filter(t => t !== tag);
  return this;
};

Wishlist.prototype.hasTag = function(tag) {
  return this.tags && this.tags.includes(tag);
};

Wishlist.prototype.toggleFavorite = async function() {
  this.is_favorite = !this.is_favorite;
  await this.save();
  return this;
};

Wishlist.prototype.setPriority = async function(priority) {
  if (['low', 'medium', 'high'].includes(priority)) {
    this.priority = priority;
    await this.save();
  }
  return this;
};

Wishlist.prototype.setReminder = async function(date) {
  if (new Date(date) > new Date()) {
    this.reminder_date = date;
    await this.save();
  }
  return this;
};

Wishlist.prototype.clearReminder = async function() {
  this.reminder_date = null;
  await this.save();
  return this;
};

Wishlist.prototype.updateNotes = async function(notes) {
  this.notes = notes;
  await this.save();
  return this;
};

Wishlist.prototype.isOverdue = function() {
  return this.reminder_date && new Date() > this.reminder_date;
};

Wishlist.prototype.getDaysUntilReminder = function() {
  if (!this.reminder_date) return null;
  const now = new Date();
  const reminder = new Date(this.reminder_date);
  const diffTime = reminder - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Class Methods (Static Methods)
Wishlist.addToWishlist = async function(userId, mediaId, options = {}) {
  try {
    const {
      notes = null,
      priority = 'medium',
      category = 'general',
      tags = [],
      is_favorite = false,
      reminder_date = null
    } = options;

    // Check if media exists and is active
    const { Media } = require('./index');
    const media = await Media.findByPk(mediaId);
    if (!media || !media.is_active) {
      throw new Error('Media not found or inactive');
    }

    const [wishlistItem, created] = await this.findOrCreate({
      where: { 
        user_id: userId, 
        media_id: mediaId 
      },
      defaults: {
        notes,
        priority,
        category,
        tags,
        is_favorite,
        reminder_date
      }
    });

    return {
      wishlistItem,
      created,
      message: created ? 'Added to wishlist' : 'Already in wishlist'
    };
  } catch (error) {
    throw new Error(`Failed to add to wishlist: ${error.message}`);
  }
};

Wishlist.removeFromWishlist = async function(userId, mediaId) {
  try {
    const deleted = await this.destroy({
      where: { 
        user_id: userId, 
        media_id: mediaId 
      }
    });

    return {
      success: deleted > 0,
      message: deleted > 0 ? 'Removed from wishlist' : 'Item not found in wishlist'
    };
  } catch (error) {
    throw new Error(`Failed to remove from wishlist: ${error.message}`);
  }
};

Wishlist.isInWishlist = async function(userId, mediaId) {
  try {
    const item = await this.findOne({
      where: { 
        user_id: userId, 
        media_id: mediaId 
      }
    });

    return !!item;
  } catch (error) {
    throw new Error(`Failed to check wishlist: ${error.message}`);
  }
};

Wishlist.getUserWishlistCount = async function(userId, filters = {}) {
  try {
    const whereClause = { user_id: userId };
    
    if (filters.priority) {
      whereClause.priority = filters.priority;
    }
    
    if (filters.is_favorite !== undefined) {
      whereClause.is_favorite = filters.is_favorite;
    }
    
    if (filters.category) {
      whereClause.category = filters.category;
    }

    return await this.count({ where: whereClause });
  } catch (error) {
    throw new Error(`Failed to get wishlist count: ${error.message}`);
  }
};

Wishlist.getUserWishlist = async function(userId, options = {}) {
  try {
    const {
      limit = 20,
      offset = 0,
      priority = null,
      category = null,
      is_favorite = null,
      search = '',
      sort = 'created_at',
      order = 'DESC',
      include_media = true
    } = options;

    const whereClause = { user_id: userId };
    
    if (priority) whereClause.priority = priority;
    if (category) whereClause.category = category;
    if (is_favorite !== null) whereClause.is_favorite = is_favorite;

    const includeOptions = [];
    
    if (include_media) {
      const { Media, Category, User } = require('./index');
      const mediaWhere = {};
      
      if (search) {
        mediaWhere[require('sequelize').Op.or] = [
          { title: { [require('sequelize').Op.like]: `%${search}%` } },
          { description: { [require('sequelize').Op.like]: `%${search}%` } }
        ];
      }

      includeOptions.push({
        model: Media,
        as: 'media',
        where: Object.keys(mediaWhere).length > 0 ? mediaWhere : undefined,
        include: [
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'slug', 'icon', 'color']
          },
          {
            model: User,
            as: 'uploader',
            attributes: ['id', 'username', 'full_name']
          }
        ]
      });
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause,
      include: includeOptions,
      order: [[sort, order.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    return {
      wishlistItems: rows,
      totalCount: count,
      currentPage: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(count / limit),
      hasNextPage: offset + limit < count,
      hasPrevPage: offset > 0
    };
  } catch (error) {
    throw new Error(`Failed to get user wishlist: ${error.message}`);
  }
};

Wishlist.getWishlistsByPriority = async function(userId, priority) {
  try {
    return await this.findAll({
      where: { 
        user_id: userId, 
        priority: priority 
      },
      include: [{
        model: require('./index').Media,
        as: 'media',
        include: [{
          model: require('./index').Category,
          as: 'category'
        }]
      }],
      order: [['created_at', 'DESC']]
    });
  } catch (error) {
    throw new Error(`Failed to get wishlist by priority: ${error.message}`);
  }
};

Wishlist.getFavoriteWishlists = async function(userId) {
  try {
    return await this.findAll({
      where: { 
        user_id: userId, 
        is_favorite: true 
      },
      include: [{
        model: require('./index').Media,
        as: 'media',
        include: [{
          model: require('./index').Category,
          as: 'category'
        }]
      }],
      order: [['created_at', 'DESC']]
    });
  } catch (error) {
    throw new Error(`Failed to get favorite wishlists: ${error.message}`);
  }
};

Wishlist.getWishlistsWithReminders = async function(userId, upcoming = true) {
  try {
    const whereClause = { 
      user_id: userId,
      reminder_date: {
        [require('sequelize').Op.not]: null
      }
    };

    if (upcoming) {
      whereClause.reminder_date = {
        [require('sequelize').Op.gte]: new Date()
      };
    }

    return await this.findAll({
      where: whereClause,
      include: [{
        model: require('./index').Media,
        as: 'media'
      }],
      order: [['reminder_date', 'ASC']]
    });
  } catch (error) {
    throw new Error(`Failed to get wishlists with reminders: ${error.message}`);
  }
};

Wishlist.getWishlistCategories = async function(userId) {
  try {
    const categories = await this.findAll({
      attributes: [
        'category',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      where: { user_id: userId },
      group: ['category'],
      order: [[require('sequelize').fn('COUNT', require('sequelize').col('id')), 'DESC']]
    });

    return categories.map(cat => ({
      name: cat.category,
      count: parseInt(cat.getDataValue('count'))
    }));
  } catch (error) {
    throw new Error(`Failed to get wishlist categories: ${error.message}`);
  }
};

Wishlist.bulkUpdatePriority = async function(userId, mediaIds, priority) {
  try {
    const [affectedCount] = await this.update(
      { priority },
      {
        where: {
          user_id: userId,
          media_id: {
            [require('sequelize').Op.in]: mediaIds
          }
        }
      }
    );

    return {
      success: affectedCount > 0,
      affectedCount,
      message: `Updated priority for ${affectedCount} items`
    };
  } catch (error) {
    throw new Error(`Failed to bulk update priority: ${error.message}`);
  }
};

Wishlist.bulkRemove = async function(userId, mediaIds) {
  try {
    const deletedCount = await this.destroy({
      where: {
        user_id: userId,
        media_id: {
          [require('sequelize').Op.in]: mediaIds
        }
      }
    });

    return {
      success: deletedCount > 0,
      deletedCount,
      message: `Removed ${deletedCount} items from wishlist`
    };
  } catch (error) {
    throw new Error(`Failed to bulk remove from wishlist: ${error.message}`);
  }
};

Wishlist.getWishlistStats = async function(userId) {
  try {
    const [
      totalCount,
      favoriteCount,
      highPriorityCount,
      categoryCounts,
      recentlyAdded
    ] = await Promise.all([
      this.count({ where: { user_id: userId } }),
      this.count({ where: { user_id: userId, is_favorite: true } }),
      this.count({ where: { user_id: userId, priority: 'high' } }),
      this.getWishlistCategories(userId),
      this.count({
        where: {
          user_id: userId,
          created_at: {
            [require('sequelize').Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      })
    ]);

    return {
      totalCount,
      favoriteCount,
      highPriorityCount,
      categoryCounts,
      recentlyAdded,
      averageViewsPerItem: totalCount > 0 ? await this.getAverageViewCount(userId) : 0
    };
  } catch (error) {
    throw new Error(`Failed to get wishlist stats: ${error.message}`);
  }
};

Wishlist.getAverageViewCount = async function(userId) {
  try {
    const result = await this.findOne({
      attributes: [
        [require('sequelize').fn('AVG', require('sequelize').col('view_count')), 'avgViews']
      ],
      where: { user_id: userId }
    });

    return parseFloat(result.getDataValue('avgViews')) || 0;
  } catch (error) {
    return 0;
  }
};

Wishlist.cleanupExpiredReminders = async function() {
  try {
    const expiredCount = await this.update(
      { reminder_date: null },
      {
        where: {
          reminder_date: {
            [require('sequelize').Op.lt]: new Date()
          }
        }
      }
    );

    return {
      success: true,
      cleanedCount: expiredCount[0],
      message: `Cleaned up ${expiredCount[0]} expired reminders`
    };
  } catch (error) {
    throw new Error(`Failed to cleanup expired reminders: ${error.message}`);
  }
};

module.exports = Wishlist;