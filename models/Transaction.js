const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Transaction = sequelize.define('Transaction', {
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
  transaction_id: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  duitku_reference: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'success', 'failed', 'expired', 'cancelled'),
    defaultValue: 'pending'
  },
  payment_method: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  payment_channel: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  payment_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  va_number: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  callback_data: {
    type: DataTypes.JSON,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  paid_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expired_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  fee_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  }
}, {
  tableName: 'transactions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['transaction_id'] },
    { fields: ['user_id', 'status'] },
    { fields: ['status'] },
    { fields: ['duitku_reference'] },
    { fields: ['created_at'] }
  ],
  hooks: {
    beforeCreate: (transaction) => {
      if (!transaction.expired_at) {
        // Default expiry: 24 hours from creation
        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + 24);
        transaction.expired_at = expiryDate;
      }
      
      if (!transaction.total_amount) {
        transaction.total_amount = parseFloat(transaction.amount) + parseFloat(transaction.fee_amount || 0);
      }
    },
    beforeUpdate: (transaction) => {
      if (transaction.changed('amount') || transaction.changed('fee_amount')) {
        transaction.total_amount = parseFloat(transaction.amount) + parseFloat(transaction.fee_amount || 0);
      }
    }
  }
});

// Instance methods
Transaction.prototype.isPending = function() {
  return this.status === 'pending';
};

Transaction.prototype.isSuccess = function() {
  return this.status === 'success';
};

Transaction.prototype.isFailed = function() {
  return this.status === 'failed';
};

Transaction.prototype.isExpired = function() {
  return this.status === 'expired' || (this.expired_at && new Date() > this.expired_at);
};

Transaction.prototype.isCancelled = function() {
  return this.status === 'cancelled';
};

Transaction.prototype.canBePaid = function() {
  return this.isPending() && !this.isExpired();
};

Transaction.prototype.markAsPaid = async function(paymentData = {}) {
  this.status = 'success';
  this.paid_at = new Date();
  this.callback_data = paymentData;
  await this.save();
  return this;
};

Transaction.prototype.markAsFailed = async function(reason = null) {
  this.status = 'failed';
  this.notes = reason;
  await this.save();
  return this;
};

Transaction.prototype.markAsExpired = async function() {
  this.status = 'expired';
  await this.save();
  return this;
};

Transaction.prototype.cancel = async function(reason = null) {
  this.status = 'cancelled';
  this.notes = reason;
  await this.save();
  return this;
};

Transaction.prototype.getFormattedAmount = function() {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR'
  }).format(this.amount);
};

Transaction.prototype.getFormattedTotalAmount = function() {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR'
  }).format(this.total_amount || this.amount);
};

Transaction.prototype.getTimeRemaining = function() {
  if (!this.expired_at || this.isExpired()) return null;
  
  const now = new Date();
  const timeDiff = this.expired_at.getTime() - now.getTime();
  
  const hours = Math.floor(timeDiff / (1000 * 60 * 60));
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  
  return { hours, minutes };
};

Transaction.prototype.getStatusBadgeClass = function() {
  switch (this.status) {
    case 'success':
      return 'badge-success';
    case 'failed':
      return 'badge-danger';
    case 'expired':
      return 'badge-secondary';
    case 'cancelled':
      return 'badge-warning';
    case 'pending':
    default:
      return 'badge-primary';
  }
};

module.exports = Transaction;