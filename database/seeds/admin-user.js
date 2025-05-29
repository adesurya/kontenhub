const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seedDatabase() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'media_management'
    });

    try {
        console.log('🌱 Starting database seeding...');

        // 1. Insert default categories
        const categories = [
            {
                name: 'Music',
                slug: 'music',
                description: 'Audio files and music tracks',
                icon: 'fas fa-music',
                color: '#fe2c55',
                sort_order: 1
            },
            {
                name: 'Images',
                slug: 'images',
                description: 'Photos and graphic files',
                icon: 'fas fa-image',
                color: '#25f4ee',
                sort_order: 2
            },
            {
                name: 'Videos',
                slug: 'videos',
                description: 'Video files and clips',
                icon: 'fas fa-video',
                color: '#10b981',
                sort_order: 3
            },
            {
                name: 'Sound Effects',
                slug: 'sound-effects',
                description: 'Audio effects and sounds',
                icon: 'fas fa-volume-up',
                color: '#f59e0b',
                sort_order: 4
            },
            {
                name: 'Templates',
                slug: 'templates',
                description: 'Design templates and mockups',
                icon: 'fas fa-file-alt',
                color: '#8b5cf6',
                sort_order: 5
            },
            {
                name: 'Stock Photos',
                slug: 'stock-photos',
                description: 'Professional stock photography',
                icon: 'fas fa-camera',
                color: '#ef4444',
                sort_order: 6
            },
            {
                name: 'Illustrations',
                slug: 'illustrations',
                description: 'Digital illustrations and graphics',
                icon: 'fas fa-paint-brush',
                color: '#06b6d4',
                sort_order: 7
            },
            {
                name: 'Animations',
                slug: 'animations',
                description: 'Animated content and GIFs',
                icon: 'fas fa-play-circle',
                color: '#84cc16',
                sort_order: 8
            }
        ];

        // Check if categories already exist
        const [existingCategories] = await connection.execute('SELECT COUNT(*) as count FROM categories');
        if (existingCategories[0].count === 0) {
            for (const category of categories) {
                await connection.execute(`
                    INSERT INTO categories (name, slug, description, icon, color, sort_order, is_active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, true, NOW(), NOW())
                `, [category.name, category.slug, category.description, category.icon, category.color, category.sort_order]);
            }
            console.log('✅ Categories seeded successfully');
        } else {
            console.log('ℹ️  Categories already exist, skipping...');
        }

        // 2. Insert default subscription packages
        const packages = [
            {
                name: 'Basic Plan',
                description: 'Perfect for occasional users with limited downloads',
                download_limit: 10,
                price: 29000,
                duration_days: 30,
                features: JSON.stringify([
                    'Up to 10 downloads per month',
                    'Standard quality files',
                    'Basic customer support',
                    'Access to free content'
                ]),
                is_popular: false,
                sort_order: 1
            },
            {
                name: 'Standard Plan',
                description: 'Great for regular users who need more content',
                download_limit: 50,
                price: 79000,
                duration_days: 30,
                features: JSON.stringify([
                    'Up to 50 downloads per month',
                    'High quality files',
                    'Priority customer support',
                    'Access to premium content',
                    'Early access to new releases'
                ]),
                is_popular: true,
                sort_order: 2
            },
            {
                name: 'Premium Plan',
                description: 'Best for power users and content creators',
                download_limit: 200,
                price: 149000,
                duration_days: 30,
                features: JSON.stringify([
                    'Up to 200 downloads per month',
                    'Ultra HD quality files',
                    '24/7 premium support',
                    'Access to exclusive content',
                    'Commercial usage rights',
                    'Advanced search filters'
                ]),
                is_popular: false,
                sort_order: 3
            },
            {
                name: 'Unlimited Plan',
                description: 'No limits for professional users and agencies',
                download_limit: 999999,
                price: 299000,
                duration_days: 30,
                features: JSON.stringify([
                    'Unlimited downloads',
                    'All quality options available',
                    'Dedicated account manager',
                    'Full commercial license',
                    'API access',
                    'Custom integrations',
                    'Bulk download tools'
                ]),
                is_popular: false,
                sort_order: 4
            }
        ];

        // Check if packages already exist
        const [existingPackages] = await connection.execute('SELECT COUNT(*) as count FROM subscription_packages');
        if (existingPackages[0].count === 0) {
            for (const pkg of packages) {
                await connection.execute(`
                    INSERT INTO subscription_packages 
                    (name, description, download_limit, price, duration_days, features, is_active, is_popular, sort_order, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, true, ?, ?, NOW(), NOW())
                `, [pkg.name, pkg.description, pkg.download_limit, pkg.price, pkg.duration_days, pkg.features, pkg.is_popular, pkg.sort_order]);
            }
            console.log('✅ Subscription packages seeded successfully');
        } else {
            console.log('ℹ️  Subscription packages already exist, skipping...');
        }

        // 3. Create admin user
        const [existingAdmin] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE role = "admin"');
        if (existingAdmin[0].count === 0) {
            const adminPassword = await bcrypt.hash('admin123', 12);
            
            await connection.execute(`
                INSERT INTO users 
                (username, email, password, full_name, role, is_active, email_verified, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, true, true, NOW(), NOW())
            `, ['admin', 'admin@mediaapp.com', adminPassword, 'System Administrator', 'admin']);
            
            console.log('✅ Admin user created successfully');
            console.log('📧 Admin Email: admin@mediaapp.com');
            console.log('🔑 Admin Password: admin123');
            console.log('⚠️  Please change the admin password after first login!');
        } else {
            console.log('ℹ️  Admin user already exists, skipping...');
        }

        // 4. Create sample regular user
        const [existingUser] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE username = "demo"');
        if (existingUser[0].count === 0) {
            const demoPassword = await bcrypt.hash('demo123', 12);
            
            await connection.execute(`
                INSERT INTO users 
                (username, email, password, full_name, role, is_active, email_verified, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, true, true, NOW(), NOW())
            `, ['demo', 'demo@mediaapp.com', demoPassword, 'Demo User', 'user']);
            
            console.log('✅ Demo user created successfully');
            console.log('📧 Demo Email: demo@mediaapp.com');
            console.log('🔑 Demo Password: demo123');
        } else {
            console.log('ℹ️  Demo user already exists, skipping...');
        }

        console.log('🎉 Database seeding completed successfully!');
        console.log('');
        console.log('🚀 You can now start the application with:');
        console.log('   npm run dev (for development)');
        console.log('   npm start (for production)');
        console.log('');
        console.log('🌐 Access the application at: http://localhost:3000');
        console.log('');
        console.log('👨‍💼 Admin Panel: http://localhost:3000/admin/dashboard');
        console.log('👤 User Panel: http://localhost:3000/user/dashboard');

    } catch (error) {
        console.error('❌ Seeding failed:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

// Run seeder if called directly
if (require.main === module) {
    seedDatabase()
        .then(() => {
            console.log('✅ Seeding completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Seeding failed:', error);
            process.exit(1);
        });
}

module.exports = { seedDatabase };