const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const flash = require('express-flash');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { engine } = require('express-handlebars');
require('dotenv').config();

// Import configurations
const { sequelize } = require('./config/database');
const { initializeS3 } = require('./config/s3Config');

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const mediaRoutes = require('./routes/media');
const paymentRoutes = require('./routes/payment');

// Import middleware
const { authenticateUser } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://code.jquery.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https:"],
            mediaSrc: ["'self'", "https:", "blob:"]
        }
    }
}));

app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : true,
    credentials: true
}));

app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Logging
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session configuration
const sessionStore = new SequelizeStore({
    db: sequelize,
    tableName: 'Sessions',
    checkExpirationInterval: 15 * 60 * 1000, // Clean up expired sessions every 15 minutes
    expiration: 7 * 24 * 60 * 60 * 1000 // 7 days
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    },
    name: 'media.session'
}));

app.use(flash());

// Handlebars configuration
app.engine('hbs', engine({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views', 'layouts'),
    partialsDir: path.join(__dirname, 'views', 'partials'),
    helpers: {
        eq: (a, b) => a === b,
        neq: (a, b) => a !== b,
        gt: (a, b) => a > b,
        lt: (a, b) => a < b,
        and: (a, b) => a && b,
        or: (a, b) => a || b,
        not: (a) => !a,
        formatDate: (date) => {
            const moment = require('moment');
            return moment(date).format('DD/MM/YYYY HH:mm');
        },
        formatSize: (bytes) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },
        formatPrice: (price) => {
            return new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR'
            }).format(price);
        },
        truncate: (str, len) => {
            if (str && str.length > len) {
                return str.substring(0, len) + '...';
            }
            return str;
        },
        json: (context) => JSON.stringify(context),
        times: (n, block) => {
            let accum = '';
            for (let i = 0; i < n; ++i) {
                accum += block.fn(i);
            }
            return accum;
        }
    }
}));

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Global middleware for user data
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.isAdmin = req.session.user && req.session.user.role === 'admin';
    res.locals.isLoggedIn = !!req.session.user;
    res.locals.messages = req.flash();
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', authenticateUser, adminRoutes);
app.use('/api/user', authenticateUser, userRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/payment', paymentRoutes);

// Web routes (for rendering pages)
app.get('/', (req, res) => {
    if (req.session.user) {
        if (req.session.user.role === 'admin') {
            return res.redirect('/admin/dashboard');
        } else {
            return res.redirect('/user/dashboard');
        }
    }
    res.render('auth/login', {
        title: 'Media Management - Login',
        layout: 'main'
    });
});

app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('auth/login', {
        title: 'Login - Media Management',
        layout: 'main'
    });
});

app.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('auth/register', {
        title: 'Register - Media Management',
        layout: 'main'
    });
});

app.get('/admin/dashboard', authenticateUser, (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.redirect('/user/dashboard');
    }
    res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        layout: 'main',
        isAdmin: true
    });
});

app.get('/admin/media/upload', authenticateUser, (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.redirect('/user/dashboard');
    }
    res.render('admin/media-upload', {
        title: 'Upload Media',
        layout: 'main',
        isAdmin: true
    });
});

app.get('/admin/media/list', authenticateUser, (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.redirect('/user/dashboard');
    }
    res.render('admin/media-list', {
        title: 'Media List',
        layout: 'main',
        isAdmin: true
    });
});

app.get('/admin/users', authenticateUser, (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.redirect('/user/dashboard');
    }
    res.render('admin/users', {
        title: 'User Management',
        layout: 'main',
        isAdmin: true
    });
});

app.get('/admin/transactions', authenticateUser, (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.redirect('/user/dashboard');
    }
    res.render('admin/transactions', {
        title: 'Transaction Management',
        layout: 'main',
        isAdmin: true
    });
});

app.get('/admin/subscriptions', authenticateUser, (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.redirect('/user/dashboard');
    }
    res.render('admin/subscriptions', {
        title: 'Subscription Packages',
        layout: 'main',
        isAdmin: true
    });
});

app.get('/user/dashboard', authenticateUser, (req, res) => {
    res.render('user/dashboard', {
        title: 'User Dashboard',
        layout: 'main'
    });
});

app.get('/user/browse', authenticateUser, (req, res) => {
    res.render('user/browse', {
        title: 'Browse Media',
        layout: 'main'
    });
});

app.get('/user/wishlist', authenticateUser, (req, res) => {
    res.render('user/wishlist', {
        title: 'My Wishlist',
        layout: 'main'
    });
});

app.get('/user/profile', authenticateUser, (req, res) => {
    res.render('user/profile', {
        title: 'My Profile',
        layout: 'main'
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destruction error:', err);
        }
        res.clearCookie('media.session');
        res.redirect('/login');
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Page Not Found',
        error: {
            status: 404,
            message: 'The page you are looking for does not exist.'
        }
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    
    // Log error details
    const errorDetails = {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    };

    if (process.env.NODE_ENV !== 'production') {
        console.error('Error Details:', errorDetails);
    }

    // Set error status
    const status = err.status || err.statusCode || 500;
    
    // API vs Web error handling
    if (req.path.startsWith('/api/')) {
        res.status(status).json({
            error: {
                message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
                status: status
            }
        });
    } else {
        res.status(status).render('error', {
            title: 'Error',
            error: {
                status: status,
                message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
            }
        });
    }
});

// Initialize database and start server
async function startServer() {
    try {
        // Test database connection
        await sequelize.authenticate();
        console.log('Database connection established successfully.');

        // Sync database (create tables if they don't exist)
        if (process.env.NODE_ENV !== 'production') {
            await sequelize.sync({ alter: false });
            console.log('Database synchronized successfully.');
        }

        // Initialize S3 connection
        await initializeS3();
        console.log('S3 connection initialized successfully.');

        // Create session store table
        await sessionStore.sync();

        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🗄️  Database: ${process.env.DB_NAME}`);
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Received SIGINT. Graceful shutting down...');
    try {
        await sequelize.close();
        console.log('Database connection closed.');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM. Graceful shutting down...');
    try {
        await sequelize.close();
        console.log('Database connection closed.');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

// Start the server
startServer();

module.exports = app;