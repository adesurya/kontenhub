const { Transaction, SubscriptionPackage, UserSubscription, User } = require('../models');
const { 
  createSubscriptionPayment, 
  checkTransactionStatus, 
  processCallback,
  getPaymentMethods
} = require('../config/duitkuConfig');
const { logSecurityEvent } = require('../middleware/security');

// Create payment for subscription
const createPayment = async (req, res) => {
  try {
    const { package_id } = req.body;
    const userId = req.user.id;

    // Get subscription package
    const subscriptionPackage = await SubscriptionPackage.findByPk(package_id);
    if (!subscriptionPackage || !subscriptionPackage.is_active) {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          success: false,
          message: 'Subscription package not found or inactive'
        });
      } else {
        req.flash('error', 'Subscription package not found or inactive');
        return res.redirect('/user/subscribe');
      }
    }

    // Check if user already has active subscription
    const existingSubscription = await UserSubscription.findOne({
      where: {
        user_id: userId,
        is_active: true
      }
    });

    if (existingSubscription && existingSubscription.isValid()) {
      if (req.path.startsWith('/api/')) {
        return res.status(400).json({
          success: false,
          message: 'You already have an active subscription'
        });
      } else {
        req.flash('error', 'You already have an active subscription');
        return res.redirect('/user/dashboard');
      }
    }

    // Generate unique transaction ID
    const transactionId = `TXN_${userId}_${package_id}_${Date.now()}`;

    // Create payment with Duitku
    const paymentData = {
      userId: userId,
      packageId: package_id,
      packageName: subscriptionPackage.name,
      amount: subscriptionPackage.getEffectivePrice(),
      userEmail: req.user.email,
      userName: req.user.full_name,
      userPhone: req.user.phone || '08123456789'
    };

    const duitkuResult = await createSubscriptionPayment(paymentData);

    if (!duitkuResult.success) {
      if (req.path.startsWith('/api/')) {
        return res.status(400).json({
          success: false,
          message: duitkuResult.error || 'Payment creation failed'
        });
      } else {
        req.flash('error', duitkuResult.error || 'Payment creation failed');
        return res.redirect('/user/subscribe');
      }
    }

    // Create transaction record
    const transaction = await Transaction.create({
      user_id: userId,
      package_id: package_id,
      transaction_id: duitkuResult.data.merchantOrderId,
      duitku_reference: duitkuResult.data.reference,
      amount: subscriptionPackage.getEffectivePrice(),
      payment_url: duitkuResult.data.paymentUrl,
      va_number: duitkuResult.data.vaNumber,
      status: 'pending'
    });

    logSecurityEvent('PAYMENT_CREATED', {
      transactionId: transaction.id,
      userId: userId,
      packageId: package_id,
      amount: subscriptionPackage.getEffectivePrice()
    }, req);

    if (req.path.startsWith('/api/')) {
      res.status(201).json({
        success: true,
        message: 'Payment created successfully',
        data: {
          transaction: {
            id: transaction.id,
            transaction_id: transaction.transaction_id,
            amount: transaction.getFormattedAmount(),
            payment_url: transaction.payment_url,
            va_number: transaction.va_number,
            status: transaction.status
          },
          package: subscriptionPackage
        }
      });
    } else {
      // Redirect to payment URL for web interface
      res.redirect(duitkuResult.data.paymentUrl);
    }

  } catch (error) {
    console.error('Create payment error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to create payment'
      });
    } else {
      req.flash('error', 'Failed to create payment');
      res.redirect('/user/subscribe');
    }
  }
};

// Payment callback from Duitku
const handleCallback = async (req, res) => {
  try {
    console.log('Payment callback received:', req.body);

    // Process callback data
    const callbackResult = processCallback(req.body);
    
    if (!callbackResult.success) {
      console.error('Invalid callback:', callbackResult.error);
      return res.status(400).json({
        success: false,
        message: 'Invalid callback data'
      });
    }

    const { merchantOrderId, amount, status, reference } = callbackResult.data;

    // Find transaction
    const transaction = await Transaction.findOne({
      where: { transaction_id: merchantOrderId },
      include: [
        {
          model: User,
          as: 'user'
        },
        {
          model: SubscriptionPackage,
          as: 'package'
        }
      ]
    });

    if (!transaction) {
      console.error('Transaction not found:', merchantOrderId);
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Update transaction status
    if (status === 'success') {
      await transaction.markAsPaid(req.body);
      
      // Create user subscription
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + transaction.package.duration_days);
      
      const subscription = await UserSubscription.create({
        user_id: transaction.user_id,
        package_id: transaction.package_id,
        downloads_remaining: transaction.package.download_limit,
        end_date: endDate
      });

      // Update user subscription reference
      await transaction.user.update({
        subscription_id: subscription.id
      });

      logSecurityEvent('PAYMENT_SUCCESS', {
        transactionId: transaction.id,
        userId: transaction.user_id,
        subscriptionId: subscription.id
      }, req);

    } else if (status === 'failed') {
      await transaction.markAsFailed('Payment failed via callback');
      
      logSecurityEvent('PAYMENT_FAILED', {
        transactionId: transaction.id,
        userId: transaction.user_id,
        reason: 'Payment failed via callback'
      }, req);
    }

    res.json({
      success: true,
      message: 'Callback processed successfully'
    });

  } catch (error) {
    console.error('Payment callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Callback processing failed'
    });
  }
};

// Check payment status
const checkPaymentStatus = async (req, res) => {
  try {
    const { transaction_id } = req.params;

    const transaction = await Transaction.findOne({
      where: { transaction_id: transaction_id },
      include: [
        {
          model: SubscriptionPackage,
          as: 'package'
        }
      ]
    });

    if (!transaction) {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      } else {
        req.flash('error', 'Transaction not found');
        return res.redirect('/user/dashboard');
      }
    }

    // Check with Duitku if transaction is still pending
    if (transaction.isPending()) {
      const statusResult = await checkTransactionStatus(transaction_id);
      
      if (statusResult.success) {
        const duitkuStatus = statusResult.data;
        
        // Update local transaction based on Duitku status
        if (duitkuStatus.statusCode === '00') {
          await transaction.markAsPaid(duitkuStatus);
          
          // Create subscription if not exists
          const existingSubscription = await UserSubscription.findOne({
            where: {
              user_id: transaction.user_id,
              package_id: transaction.package_id
            }
          });

          if (!existingSubscription) {
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + transaction.package.duration_days);
            
            const subscription = await UserSubscription.create({
              user_id: transaction.user_id,
              package_id: transaction.package_id,
              downloads_remaining: transaction.package.download_limit,
              end_date: endDate
            });

            await User.update(
              { subscription_id: subscription.id },
              { where: { id: transaction.user_id } }
            );
          }
        } else if (duitkuStatus.statusCode === '02') {
          await transaction.markAsFailed('Payment failed');
        }
      }
    }

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        data: {
          transaction: {
            id: transaction.id,
            transaction_id: transaction.transaction_id,
            amount: transaction.getFormattedAmount(),
            status: transaction.status,
            payment_url: transaction.payment_url,
            created_at: transaction.created_at,
            paid_at: transaction.paid_at
          },
          package: transaction.package
        }
      });
    } else {
      res.render('payment/status', {
        title: 'Payment Status',
        transaction,
        layout: 'main'
      });
    }

  } catch (error) {
    console.error('Check payment status error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to check payment status'
      });
    } else {
      req.flash('error', 'Failed to check payment status');
      res.redirect('/user/dashboard');
    }
  }
};

// Get user transactions
const getUserTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = ''
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = { user_id: req.user.id };

    if (status) {
      whereClause.status = status;
    }

    const { count, rows: transactions } = await Transaction.findAndCountAll({
      where: whereClause,
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
          transactions,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalItems: count,
            itemsPerPage: parseInt(limit)
          }
        }
      });
    } else {
      res.render('user/transactions', {
        title: 'My Transactions',
        transactions,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit)
        },
        filters: { status },
        layout: 'main'
      });
    }

  } catch (error) {
    console.error('Get user transactions error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to get transactions'
      });
    } else {
      req.flash('error', 'Failed to load transactions');
      res.redirect('/user/dashboard');
    }
  }
};

// Get available payment methods
const getAvailablePaymentMethods = async (req, res) => {
  try {
    const { amount = 50000 } = req.query;

    const paymentMethods = await getPaymentMethods(amount);

    if (!paymentMethods.success) {
      if (req.path.startsWith('/api/')) {
        return res.status(500).json({
          success: false,
          message: 'Failed to get payment methods'
        });
      } else {
        req.flash('error', 'Failed to load payment methods');
        return res.redirect('back');
      }
    }

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        data: {
          paymentMethods: paymentMethods.data
        }
      });
    } else {
      res.render('payment/methods', {
        title: 'Payment Methods',
        paymentMethods: paymentMethods.data,
        amount: amount,
        layout: 'main'
      });
    }

  } catch (error) {
    console.error('Get payment methods error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to get payment methods'
      });
    } else {
      req.flash('error', 'Failed to load payment methods');
      res.redirect('back');
    }
  }
};

// Cancel transaction
const cancelTransaction = async (req, res) => {
  try {
    const { transaction_id } = req.params;
    const { reason } = req.body;

    const transaction = await Transaction.findOne({
      where: { 
        transaction_id: transaction_id,
        user_id: req.user.id
      }
    });

    if (!transaction) {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      } else {
        req.flash('error', 'Transaction not found');
        return res.redirect('back');
      }
    }

    if (!transaction.canBePaid()) {
      if (req.path.startsWith('/api/')) {
        return res.status(400).json({
          success: false,
          message: 'Transaction cannot be cancelled'
        });
      } else {
        req.flash('error', 'Transaction cannot be cancelled');
        return res.redirect('back');
      }
    }

    await transaction.cancel(reason || 'Cancelled by user');

    logSecurityEvent('TRANSACTION_CANCELLED', {
      transactionId: transaction.id,
      userId: req.user.id,
      reason: reason || 'Cancelled by user'
    }, req);

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        message: 'Transaction cancelled successfully'
      });
    } else {
      req.flash('success', 'Transaction cancelled successfully');
      res.redirect('/user/transactions');
    }

  } catch (error) {
    console.error('Cancel transaction error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to cancel transaction'
      });
    } else {
      req.flash('error', 'Failed to cancel transaction');
      res.redirect('back');
    }
  }
};

module.exports = {
  createPayment,
  handleCallback,
  checkPaymentStatus,
  getUserTransactions,
  getAvailablePaymentMethods,
  cancelTransaction
};