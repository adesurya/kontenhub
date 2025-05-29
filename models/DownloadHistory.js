const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DownloadHistory = sequelize.define('DownloadHistory', {
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
  media_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'media_files',
      key: 'id'
    }
  },
  subscription_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'user_subscriptions',
      key: 'id'
    }
  },
  download_url: {
    type: DataTypes.STRING(1000),
    allowNull: true
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  downloaded_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  file_size: {
    type: DataTypes.BIGINT,
    allowNull: true
  }
}, {
  tableName: 'download_history',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['user_id', 'media_id'] },
    { fields: ['expires_at'] },
    { fields: ['subscription_id'] },
    { fields: ['created_at'] }
  ]
});

// Instance methods
DownloadHistory.prototype.isExpired = function() {
  return new Date() > this.expires_at;
};

DownloadHistory.prototype.isValid = function() {
  return !this.isExpired() && this.download_url;
};

DownloadHistory.prototype.markAsDownloaded = async function() {
  this.downloaded_at = new Date();
  await this.save();
  return this;
};

DownloadHistory.prototype.getTimeRemaining = function() {
  if (this.isExpired()) return null;
  
  const now = new Date();
  const timeDiff = this.expires_at.getTime() - now.getTime();
  
  const hours = Math.floor(timeDiff / (1000 * 60 * 60));
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  
  return { hours, minutes };
};

// Class methods
DownloadHistory.createDownloadRecord = async function(userId, mediaId, subscriptionId, downloadUrl, expirationMinutes = 60) {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);
  
  return await this.create({
    user_id: userId,
    media_id: mediaId,
    subscription_id: subscriptionId,
    download_url: downloadUrl,
    expires_at: expiresAt
  });
};

DownloadHistory.getUserDownloadCount = async function(userId, dateRange = null) {
  const whereClause = { user_id: userId };
  
  if (dateRange) {
    whereClause.created_at = dateRange;
  }
  
  return await this.count({ where: whereClause });
};

DownloadHistory.cleanupExpiredRecords = async function() {
  const deleted = await this.destroy({
    where: {
      expires_at: {
        [sequelize.Op.lt]: new Date()
      }
    }
  });
  
  return deleted;
};

module.exports = DownloadHistory;