// models/index.js - Model Associations and Exports

const User = require('./User');
const Category = require('./Category');
const Media = require('./Media');
const SubscriptionPackage = require('./SubscriptionPackage');
const UserSubscription = require('./UserSubscription');
const Transaction = require('./Transaction');
const Wishlist = require('./Wishlist');
const DownloadHistory = require('./DownloadHistory');

// Define associations

// User associations
User.hasMany(Media, { 
  foreignKey: 'uploaded_by', 
  as: 'uploadedMedia',
  onDelete: 'CASCADE'
});

User.hasMany(UserSubscription, { 
  foreignKey: 'user_id', 
  as: 'subscriptions',
  onDelete: 'CASCADE'
});

User.hasMany(Transaction, { 
  foreignKey: 'user_id', 
  as: 'transactions',
  onDelete: 'CASCADE'
});

User.hasMany(Wishlist, { 
  foreignKey: 'user_id', 
  as: 'wishlistItems',
  onDelete: 'CASCADE'
});

User.hasMany(DownloadHistory, { 
  foreignKey: 'user_id', 
  as: 'downloadHistory',
  onDelete: 'CASCADE'
});

User.belongsTo(UserSubscription, { 
  foreignKey: 'subscription_id', 
  as: 'activeSubscription'
});

// Category associations
Category.hasMany(Media, { 
  foreignKey: 'category_id', 
  as: 'mediaFiles',
  onDelete: 'RESTRICT'
});

// Media associations
Media.belongsTo(User, { 
  foreignKey: 'uploaded_by', 
  as: 'uploader'
});

Media.belongsTo(Category, { 
  foreignKey: 'category_id', 
  as: 'category'
});

Media.hasMany(Wishlist, { 
  foreignKey: 'media_id', 
  as: 'wishlistEntries',
  onDelete: 'CASCADE'
});

Media.hasMany(DownloadHistory, { 
  foreignKey: 'media_id', 
  as: 'downloadHistory',
  onDelete: 'CASCADE'
});

// SubscriptionPackage associations
SubscriptionPackage.hasMany(UserSubscription, { 
  foreignKey: 'package_id', 
  as: 'subscriptions',
  onDelete: 'RESTRICT'
});

SubscriptionPackage.hasMany(Transaction, { 
  foreignKey: 'package_id', 
  as: 'transactions',
  onDelete: 'RESTRICT'
});

// UserSubscription associations
UserSubscription.belongsTo(User, { 
  foreignKey: 'user_id', 
  as: 'user'
});

UserSubscription.belongsTo(SubscriptionPackage, { 
  foreignKey: 'package_id', 
  as: 'package'
});

UserSubscription.hasMany(DownloadHistory, { 
  foreignKey: 'subscription_id', 
  as: 'downloads',
  onDelete: 'SET NULL'
});

UserSubscription.hasOne(User, { 
  foreignKey: 'subscription_id', 
  as: 'activeUser'
});

// Transaction associations
Transaction.belongsTo(User, { 
  foreignKey: 'user_id', 
  as: 'user'
});

Transaction.belongsTo(SubscriptionPackage, { 
  foreignKey: 'package_id', 
  as: 'package'
});

// Wishlist associations
Wishlist.belongsTo(User, { 
  foreignKey: 'user_id', 
  as: 'user'
});

Wishlist.belongsTo(Media, { 
  foreignKey: 'media_id', 
  as: 'media'
});

// DownloadHistory associations
DownloadHistory.belongsTo(User, { 
  foreignKey: 'user_id', 
  as: 'user'
});

DownloadHistory.belongsTo(Media, { 
  foreignKey: 'media_id', 
  as: 'media'
});

DownloadHistory.belongsTo(UserSubscription, { 
  foreignKey: 'subscription_id', 
  as: 'subscription'
});

// Many-to-Many associations through Wishlist
User.belongsToMany(Media, { 
  through: Wishlist, 
  foreignKey: 'user_id', 
  otherKey: 'media_id',
  as: 'wishlistedMedia'
});

Media.belongsToMany(User, { 
  through: Wishlist, 
  foreignKey: 'media_id', 
  otherKey: 'user_id',
  as: 'wishlistedByUsers'
});

// Export all models
module.exports = {
  User,
  Category,
  Media,
  SubscriptionPackage,
  UserSubscription,
  Transaction,
  Wishlist,
  DownloadHistory
};