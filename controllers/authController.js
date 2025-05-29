const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { generateJWT } = require('../middleware/auth');
const { logSecurityEvent } = require('../middleware/security');

// User registration
const register = async (req, res) => {
  try {
    const { username, email, password, full_name, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [
          { email: email },
          { username: username }
        ]
      }
    });

    if (existingUser) {
      logSecurityEvent('REGISTRATION_ATTEMPT_DUPLICATE', { email, username }, req);
      
      if (req.path.startsWith('/api/')) {
        return res.status(400).json({
          success: false,
          message: existingUser.email === email ? 'Email already registered' : 'Username already taken'
        });
      } else {
        req.flash('error', existingUser.email === email ? 'Email already registered' : 'Username already taken');
        return res.redirect('/register');
      }
    }

    // Create new user
    const user = await User.create({
      username,
      email,
      password, // Will be hashed by the model hook
      full_name,
      phone: phone || null
    });

    logSecurityEvent('USER_REGISTERED', { userId: user.id, email }, req);

    if (req.path.startsWith('/api/')) {
      // API response - don't create session yet, user needs to login
      res.status(201).json({
        success: true,
        message: 'Registration successful. Please login to continue.',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name
          }
        }
      });
    } else {
      // Web response - create session and redirect
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      };
      
      req.flash('success', 'Registration successful! Welcome to Media Management.');
      res.redirect('/user/dashboard');
    }

  } catch (error) {
    console.error('Registration error:', error);
    logSecurityEvent('REGISTRATION_ERROR', { error: error.message }, req);

    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Registration failed. Please try again.'
      });
    } else {
      req.flash('error', 'Registration failed. Please try again.');
      res.redirect('/register');
    }
  }
};

// User login
const login = async (req, res) => {
  try {
    const { email, password, remember_me } = req.body;

    // Find user by email
    const user = await User.findOne({
      where: { email: email }
    });

    if (!user) {
      logSecurityEvent('LOGIN_ATTEMPT_INVALID_EMAIL', { email }, req);
      
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      } else {
        req.flash('error', 'Invalid email or password');
        return res.redirect('/login');
      }
    }

    // Check if user is active
    if (!user.is_active) {
      logSecurityEvent('LOGIN_ATTEMPT_INACTIVE_USER', { userId: user.id, email }, req);
      
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          message: 'Account is inactive. Please contact administrator.'
        });
      } else {
        req.flash('error', 'Account is inactive. Please contact administrator.');
        return res.redirect('/login');
      }
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      logSecurityEvent('LOGIN_ATTEMPT_INVALID_PASSWORD', { userId: user.id, email }, req);
      
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      } else {
        req.flash('error', 'Invalid email or password');
        return res.redirect('/login');
      }
    }

    // Update last login
    await user.update({ last_login: new Date() });

    // Create session
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      subscription_id: user.subscription_id
    };

    // Set session expiry based on remember_me
    if (remember_me) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }

    logSecurityEvent('USER_LOGIN_SUCCESS', { userId: user.id, email }, req);

    if (req.path.startsWith('/api/')) {
      // Generate JWT for API access
      const token = generateJWT(user.id);
      
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            subscription_id: user.subscription_id
          },
          token: token
        }
      });
    } else {
      // Web response - redirect based on role
      req.flash('success', `Welcome back, ${user.full_name}!`);
      
      if (user.role === 'admin') {
        res.redirect('/admin/dashboard');
      } else {
        res.redirect('/user/dashboard');
      }
    }

  } catch (error) {
    console.error('Login error:', error);
    logSecurityEvent('LOGIN_ERROR', { error: error.message }, req);

    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Login failed. Please try again.'
      });
    } else {
      req.flash('error', 'Login failed. Please try again.');
      res.redirect('/login');
    }
  }
};

// User logout
const logout = async (req, res) => {
  try {
    const userId = req.session.user ? req.session.user.id : null;
    
    logSecurityEvent('USER_LOGOUT', { userId }, req);

    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
      }
      
      // Clear session cookie
      res.clearCookie('media.session');
      
      if (req.path.startsWith('/api/')) {
        res.json({
          success: true,
          message: 'Logout successful'
        });
      } else {
        req.flash('success', 'You have been logged out successfully.');
        res.redirect('/login');
      }
    });

  } catch (error) {
    console.error('Logout error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    } else {
      req.flash('error', 'Logout failed');
      res.redirect('/');
    }
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: require('../models').UserSubscription,
          as: 'activeSubscription',
          include: [
            {
              model: require('../models').SubscriptionPackage,
              as: 'package'
            }
          ]
        }
      ]
    });

    if (!user) {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      } else {
        req.flash('error', 'User not found');
        return res.redirect('/login');
      }
    }

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        data: { user }
      });
    } else {
      res.render('user/profile', {
        title: 'My Profile',
        user: user,
        layout: 'main'
      });
    }

  } catch (error) {
    console.error('Get profile error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to get profile'
      });
    } else {
      req.flash('error', 'Failed to load profile');
      res.redirect('/user/dashboard');
    }
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, phone, current_password, new_password } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      } else {
        req.flash('error', 'User not found');
        return res.redirect('/login');
      }
    }

    // Update basic info
    const updateData = {};
    if (full_name) updateData.full_name = full_name;
    if (phone !== undefined) updateData.phone = phone || null;

    // Handle password change
    if (new_password) {
      if (!current_password) {
        if (req.path.startsWith('/api/')) {
          return res.status(400).json({
            success: false,
            message: 'Current password is required to change password'
          });
        } else {
          req.flash('error', 'Current password is required to change password');
          return res.redirect('back');
        }
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(current_password);
      if (!isCurrentPasswordValid) {
        logSecurityEvent('PROFILE_UPDATE_INVALID_PASSWORD', { userId }, req);
        
        if (req.path.startsWith('/api/')) {
          return res.status(400).json({
            success: false,
            message: 'Current password is incorrect'
          });
        } else {
          req.flash('error', 'Current password is incorrect');
          return res.redirect('back');
        }
      }

      updateData.password = new_password; // Will be hashed by model hook
    }

    // Update user
    await user.update(updateData);

    logSecurityEvent('PROFILE_UPDATED', { userId, fields: Object.keys(updateData) }, req);

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user: await User.findByPk(userId) }
      });
    } else {
      req.flash('success', 'Profile updated successfully');
      res.redirect('/user/profile');
    }

  } catch (error) {
    console.error('Update profile error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to update profile'
      });
    } else {
      req.flash('error', 'Failed to update profile');
      res.redirect('back');
    }
  }
};

// Check authentication status
const checkAuth = async (req, res) => {
  try {
    if (req.user) {
      const user = await User.findByPk(req.user.id, {
        include: [
          {
            model: require('../models').UserSubscription,
            as: 'activeSubscription',
            include: [
              {
                model: require('../models').SubscriptionPackage,
                as: 'package'
              }
            ]
          }
        ]
      });

      res.json({
        success: true,
        authenticated: true,
        data: { user }
      });
    } else {
      res.json({
        success: true,
        authenticated: false,
        message: 'Not authenticated'
      });
    }
  } catch (error) {
    console.error('Check auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication check failed'
    });
  }
};

// Change password (separate endpoint)
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password, confirm_password } = req.body;

    if (new_password !== confirm_password) {
      if (req.path.startsWith('/api/')) {
        return res.status(400).json({
          success: false,
          message: 'New passwords do not match'
        });
      } else {
        req.flash('error', 'New passwords do not match');
        return res.redirect('back');
      }
    }

    const user = await User.findByPk(userId);
    if (!user) {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      } else {
        req.flash('error', 'User not found');
        return res.redirect('/login');
      }
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(current_password);
    if (!isCurrentPasswordValid) {
      logSecurityEvent('PASSWORD_CHANGE_INVALID_CURRENT', { userId }, req);
      
      if (req.path.startsWith('/api/')) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      } else {
        req.flash('error', 'Current password is incorrect');
        return res.redirect('back');
      }
    }

    // Update password
    await user.update({ password: new_password });

    logSecurityEvent('PASSWORD_CHANGED', { userId }, req);

    if (req.path.startsWith('/api/')) {
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } else {
      req.flash('success', 'Password changed successfully');
      res.redirect('/user/profile');
    }

  } catch (error) {
    console.error('Change password error:', error);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        message: 'Failed to change password'
      });
    } else {
      req.flash('error', 'Failed to change password');
      res.redirect('back');
    }
  }
};

module.exports = {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  checkAuth,
  changePassword
};