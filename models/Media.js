const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Media = sequelize.define('Media', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: [2, 255]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'categories',
      key: 'id'
    }
  },
  file_type: {
    type: DataTypes.ENUM('image', 'audio', 'video'),
    allowNull: false
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  original_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  file_size: {
    type: DataTypes.BIGINT,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  mime_type: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  s3_key: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  s3_url: {
    type: DataTypes.STRING(1000),
    allowNull: false
  },
  thumbnail_key: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  thumbnail_url: {
    type: DataTypes.STRING(1000),
    allowNull: true
  },
  shopee_link: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: {
        protocols: ['http', 'https']
      }
    }
  },
  tiktok_link: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: {
        protocols: ['http', 'https']
      }
    }
  },
  download_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  view_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  is_featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  uploaded_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Duration in seconds for audio/video files'
  },
  dimensions: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Width and height for images/videos'
  }
}, {
  tableName: 'media_files',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['category_id'] },
    { fields: ['file_type'] },
    { fields: ['title'] },
    { fields: ['is_active'] },
    { fields: ['created_at'] },
    { fields: ['uploaded_by'] },
    { fields: ['is_featured'] }
  ]
});

// Instance methods
Media.prototype.incrementDownloadCount = async function() {
  await this.increment('download_count');
  await this.reload();
  return this;
};

Media.prototype.incrementViewCount = async function() {
  await this.increment('view_count');
  return this;
};

Media.prototype.getFormattedSize = function() {
  const bytes = this.file_size;
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

Media.prototype.getFileExtension = function() {
  return this.file_name.split('.').pop().toLowerCase();
};

Media.prototype.isImage = function() {
  return this.file_type === 'image';
};

Media.prototype.isAudio = function() {
  return this.file_type === 'audio';
};

Media.prototype.isVideo = function() {
  return this.file_type === 'video';
};

Media.prototype.hasExternalLinks = function() {
  return this.shopee_link || this.tiktok_link;
};

Media.prototype.getFormattedDuration = function() {
  if (!this.duration) return null;
  
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

Media.prototype.addTag = function(tag) {
  if (!this.tags) this.tags = [];
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
  }
  return this;
};

Media.prototype.removeTag = function(tag) {
  if (!this.tags) return this;
  this.tags = this.tags.filter(t => t !== tag);
  return this;
};

Media.prototype.hasTag = function(tag) {
  return this.tags && this.tags.includes(tag);
};

module.exports = Media;