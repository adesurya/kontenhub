const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

// Duitku Configuration
const duitkuConfig = {
  merchantCode: process.env.DUITKU_MERCHANT_CODE,
  apiKey: process.env.DUITKU_API_KEY,
  callbackUrl: process.env.DUITKU_CALLBACK_URL,
  returnUrl: process.env.DUITKU_RETURN_URL,
  sandbox: process.env.DUITKU_SANDBOX === 'true',
  baseUrl: process.env.DUITKU_SANDBOX === 'true' 
    ? 'https://sandbox.duitku.com/webapi/api'
    : 'https://passport.duitku.com/webapi/api'
};

// Generate signature for Duitku API
const generateSignature = (merchantCode, merchantOrderId, paymentAmount, apiKey) => {
  const signatureString = `${merchantCode}${merchantOrderId}${paymentAmount}${apiKey}`;
  return crypto.createHash('md5').update(signatureString).digest('hex');
};

// Generate callback signature for verification
const generateCallbackSignature = (merchantCode, amount, merchantOrderId, apiKey) => {
  const signatureString = `${merchantCode}${amount}${merchantOrderId}${apiKey}`;
  return crypto.createHash('md5').update(signatureString).digest('hex');
};

// Create payment request
const createPayment = async (paymentData) => {
  try {
    const {
      merchantOrderId,
      paymentAmount,
      productDetails,
      customerVaName,
      email,
      phoneNumber,
      itemDetails = [],
      customerDetail = {},
      callbackUrl = duitkuConfig.callbackUrl,
      returnUrl = duitkuConfig.returnUrl,
      expiryPeriod = 1440 // 24 hours in minutes
    } = paymentData;

    // Generate signature
    const signature = generateSignature(
      duitkuConfig.merchantCode,
      merchantOrderId,
      paymentAmount,
      duitkuConfig.apiKey
    );

    const requestBody = {
      merchantCode: duitkuConfig.merchantCode,
      paymentAmount: paymentAmount,
      merchantOrderId: merchantOrderId,
      productDetails: productDetails,
      customerVaName: customerVaName,
      email: email,
      phoneNumber: phoneNumber,
      itemDetails: itemDetails,
      customerDetail: customerDetail,
      callbackUrl: callbackUrl,
      returnUrl: returnUrl,
      signature: signature,
      expiryPeriod: expiryPeriod
    };

    const response = await axios.post(
      `${duitkuConfig.baseUrl}/merchant/createinvoice`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.data.statusCode === '00') {
      return {
        success: true,
        data: {
          merchantOrderId: response.data.merchantOrderId,
          reference: response.data.reference,
          paymentUrl: response.data.paymentUrl,
          vaNumber: response.data.vaNumber,
          amount: response.data.amount,
          statusCode: response.data.statusCode,
          statusMessage: response.data.statusMessage
        }
      };
    } else {
      return {
        success: false,
        error: response.data.statusMessage || 'Payment creation failed',
        statusCode: response.data.statusCode
      };
    }
  } catch (error) {
    console.error('Duitku Create Payment Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.statusMessage || error.message
    };
  }
};

// Check transaction status
const checkTransactionStatus = async (merchantOrderId) => {
  try {
    const signature = crypto
      .createHash('md5')
      .update(`${duitkuConfig.merchantCode}${merchantOrderId}${duitkuConfig.apiKey}`)
      .digest('hex');

    const requestBody = {
      merchantCode: duitkuConfig.merchantCode,
      merchantOrderId: merchantOrderId,
      signature: signature
    };

    const response = await axios.post(
      `${duitkuConfig.baseUrl}/merchant/transactionStatus`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Duitku Check Status Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.statusMessage || error.message
    };
  }
};

// Get payment methods
const getPaymentMethods = async (amount) => {
  try {
    const signature = crypto
      .createHash('md5')
      .update(`${duitkuConfig.merchantCode}${amount}${duitkuConfig.apiKey}`)
      .digest('hex');

    const requestBody = {
      merchantcode: duitkuConfig.merchantCode,
      amount: amount,
      signature: signature
    };

    const response = await axios.post(
      `${duitkuConfig.baseUrl}/merchant/paymentmethod/getpaymentmethod`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    return {
      success: true,
      data: response.data.paymentFee || []
    };
  } catch (error) {
    console.error('Duitku Get Payment Methods Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.statusMessage || error.message
    };
  }
};

// Verify callback signature
const verifyCallbackSignature = (callbackData) => {
  const {
    merchantCode,
    amount,
    merchantOrderId,
    signature
  } = callbackData;

  const expectedSignature = generateCallbackSignature(
    merchantCode,
    amount,
    merchantOrderId,
    duitkuConfig.apiKey
  );

  return signature === expectedSignature;
};

// Process callback data
const processCallback = (callbackData) => {
  try {
    // Verify signature first
    if (!verifyCallbackSignature(callbackData)) {
      return {
        success: false,
        error: 'Invalid callback signature'
      };
    }

    const {
      merchantOrderId,
      amount,
      resultCode,
      merchantUserId,
      reference,
      signature,
      publisherOrderId,
      spUserHash,
      settlementDate,
      issuerCode
    } = callbackData;

    // Map result codes to status
    let status = 'failed';
    let message = 'Payment failed';

    switch (resultCode) {
      case '00':
        status = 'success';
        message = 'Payment successful';
        break;
      case '01':
        status = 'pending';
        message = 'Payment pending';
        break;
      case '02':
        status = 'failed';
        message = 'Payment failed';
        break;
      default:
        status = 'unknown';
        message = 'Unknown payment status';
    }

    return {
      success: true,
      data: {
        merchantOrderId,
        amount: parseFloat(amount),
        status,
        message,
        resultCode,
        reference,
        merchantUserId,
        publisherOrderId,
        settlementDate,
        issuerCode,
        verified: true
      }
    };
  } catch (error) {
    console.error('Process Callback Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Generate payment request for subscription
const createSubscriptionPayment = async (subscriptionData) => {
  const {
    userId,
    packageId,
    packageName,
    amount,
    userEmail,
    userName,
    userPhone
  } = subscriptionData;

  const merchantOrderId = `SUB_${packageId}_${userId}_${Date.now()}`;
  
  const paymentData = {
    merchantOrderId,
    paymentAmount: amount,
    productDetails: `Subscription - ${packageName}`,
    customerVaName: userName,
    email: userEmail,
    phoneNumber: userPhone,
    itemDetails: [
      {
        name: packageName,
        price: amount,
        quantity: 1
      }
    ],
    customerDetail: {
      firstName: userName.split(' ')[0],
      lastName: userName.split(' ').slice(1).join(' ') || '',
      email: userEmail,
      phoneNumber: userPhone
    }
  };

  return await createPayment(paymentData);
};

// Validate webhook IP (optional security measure)
const validateWebhookIP = (clientIP) => {
  // Duitku webhook IPs (you should get these from Duitku documentation)
  const allowedIPs = [
    '103.140.28.114',
    '202.6.227.174'
    // Add more IPs as provided by Duitku
  ];

  return allowedIPs.includes(clientIP);
};

module.exports = {
  duitkuConfig,
  generateSignature,
  generateCallbackSignature,
  createPayment,
  checkTransactionStatus,
  getPaymentMethods,
  verifyCallbackSignature,
  processCallback,
  createSubscriptionPayment,
  validateWebhookIP
};