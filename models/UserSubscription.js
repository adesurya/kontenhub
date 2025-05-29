const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserSubscription = sequelize.define('UserSubscription', {
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
    }
  },
  package_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'subscription_packages',
      key: 'id'
    }
  },
  downloads_used: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  downloads_remaining: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  auto_renewal: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  cancelled_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancelled_reason: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'user_subscriptions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['user_id', 'is_active'] },
    { fields: ['end_date'] },
    { fields: ['package_id'] }
  ],
  hooks: {
    beforeCreate: (subscription) => {
      if (!subscription.end_date && subscription.start_date) {
        // Default to 30 days if no end_date specified
        const endDate = new Date(subscription.start_date);
        endDate.setDate(endDate.getDate() + 30);
        subscription.end_date = endDate;
      }
    }
  }
});

// Instance methods
UserSubscription.prototype.isExpired = function() {
  return new Date() > this.end_date;
};

UserSubscription.prototype.isValid = function() {
  return this.is_active && !this.isExpired();
};

UserSubscription.prototype.getDaysRemaining = function() {
  if (this.isExpired()) return 0;
  const now = new Date();
  const timeDiff = this.end_date.getTime() - now.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
};

UserSubscription.prototype.getUsagePercentage = function() {
  if (this.downloads_remaining + this.downloads_used === 0) return 0;
  return (this.downloads_used / (this.downloads_remaining + this.downloads_used)) * 100;
};

UserSubscription.prototype.canDownload = function() {
  return this.isValid() && this.downloads_remaining > 0;
};

UserSubscription.prototype.useDownload = async function() {
  if (!this.canDownload()) {
    throw new Error('Cannot use download: subscription invalid or no downloads remaining');
  }
  
  await this.decrement('downloads_remaining');
  await this.increment('downloads_used');
  await this.reload();
  
  return this;
};

UserSubscription.prototype.cancel = async function(reason = null) {
  this.is_active = false;
  this.cancelled_at = new Date();
  this.cancelled_reason = reason;
  await this.save();
  return this;
};

UserSubscription.prototype.extend = async function(days) {
  const newEndDate = new Date(this.end_date);
  newEndDate.setDate(newEndDate.getDate() + days);
  this.end_date = newEndDate;
  await this.save();
  return this;
};

UserSubscription.prototype.addDownloads = async function(amount) {
  await this.increment('downloads_remaining', { by: amount });
  await this.reload();
  return this;
};

module.exports = UserSubscription;