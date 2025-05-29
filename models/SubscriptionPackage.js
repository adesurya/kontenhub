const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SubscriptionPackage = sequelize.define('SubscriptionPackage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      len: [2, 100]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  download_limit: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  duration_days: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30,
    validate: {
      min: 1
    }
  },
  features: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  is_popular: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  discount_percentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
  },
  original_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  }
}, {
  tableName: 'subscription_packages',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['is_active'] },
    { fields: ['sort_order'] },
    { fields: ['price'] }
  ]
});

// Instance methods
SubscriptionPackage.prototype.getEffectivePrice = function() {
  if (this.discount_percentage > 0 && this.original_price) {
    return this.original_price * (1 - this.discount_percentage / 100);
  }
  return this.price;
};

SubscriptionPackage.prototype.hasDiscount = function() {
  return this.discount_percentage > 0;
};

SubscriptionPackage.prototype.getSavings = function() {
  if (this.hasDiscount() && this.original_price) {
    return this.original_price - this.getEffectivePrice();
  }
  return 0;
};

SubscriptionPackage.prototype.isUnlimited = function() {
  return this.download_limit >= 999999;
};

SubscriptionPackage.prototype.getFormattedPrice = function() {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR'
  }).format(this.getEffectivePrice());
};

module.exports = SubscriptionPackage;