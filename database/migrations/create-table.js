const mysql = require('mysql2/promise');
require('dotenv').config();

async function createTables() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'media_management'
    });

    try {
        console.log('🔄 Starting database migration...');

        // Create tables in correct order (respecting foreign key dependencies)
        
        // 1. Users table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                full_name VARCHAR(100) NOT NULL,
                role ENUM('admin', 'user') DEFAULT 'user',
                subscription_id INT NULL,
                is_active BOOLEAN DEFAULT true,
                email_verified BOOLEAN DEFAULT false,
                avatar_url VARCHAR(500) NULL,
                phone VARCHAR(20) NULL,
                last_login TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_username (username),
                INDEX idx_role (role),
                INDEX idx_is_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Users table created');

        // 2. Categories table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS categories (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100) NOT NULL,
                slug VARCHAR(100) UNIQUE NOT NULL,
                description TEXT,
                icon VARCHAR(50) DEFAULT 'fas fa-folder',
                color VARCHAR(7) DEFAULT '#6B7280',
                is_active BOOLEAN DEFAULT true,
                sort_order INT DEFAULT 0,
                media_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_slug (slug),
                INDEX idx_is_active (is_active),
                INDEX idx_sort_order (sort_order)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Categories table created');

        // 3. Subscription packages table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS subscription_packages (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                download_limit INT NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                duration_days INT NOT NULL DEFAULT 30,
                features JSON DEFAULT ('[]'),
                is_active BOOLEAN DEFAULT true,
                is_popular BOOLEAN DEFAULT false,
                sort_order INT DEFAULT 0,
                discount_percentage DECIMAL(5,2) DEFAULT 0,
                original_price DECIMAL(10,2) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_is_active (is_active),
                INDEX idx_sort_order (sort_order),
                INDEX idx_price (price)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Subscription packages table created');

        // 4. User subscriptions table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS user_subscriptions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                package_id INT NOT NULL,
                downloads_used INT DEFAULT 0,
                downloads_remaining INT NOT NULL,
                start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_date TIMESTAMP NOT NULL,
                is_active BOOLEAN DEFAULT true,
                auto_renewal BOOLEAN DEFAULT false,
                cancelled_at TIMESTAMP NULL,
                cancelled_reason TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (package_id) REFERENCES subscription_packages(id),
                INDEX idx_user_active (user_id, is_active),
                INDEX idx_end_date (end_date),
                INDEX idx_package_id (package_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ User subscriptions table created');

        // 5. Media files table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS media_files (
                id INT PRIMARY KEY AUTO_INCREMENT,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                category_id INT NOT NULL,
                file_type ENUM('image', 'audio', 'video') NOT NULL,
                file_name VARCHAR(255) NOT NULL,
                original_name VARCHAR(255) NOT NULL,
                file_size BIGINT NOT NULL,
                mime_type VARCHAR(100) NOT NULL,
                s3_key VARCHAR(500) NOT NULL,
                s3_url VARCHAR(1000) NOT NULL,
                thumbnail_key VARCHAR(500),
                thumbnail_url VARCHAR(1000),
                shopee_link VARCHAR(500),
                tiktok_link VARCHAR(500),
                download_count INT DEFAULT 0,
                view_count INT DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                is_featured BOOLEAN DEFAULT false,
                uploaded_by INT NOT NULL,
                tags JSON DEFAULT ('[]'),
                metadata JSON DEFAULT ('{}'),
                duration INT NULL COMMENT 'Duration in seconds for audio/video files',
                dimensions JSON NULL COMMENT 'Width and height for images/videos',
                file_hash VARCHAR(64) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories(id),
                FOREIGN KEY (uploaded_by) REFERENCES users(id),
                INDEX idx_category (category_id),
                INDEX idx_file_type (file_type),
                INDEX idx_title (title),
                INDEX idx_active (is_active),
                INDEX idx_featured (is_featured),
                INDEX idx_created (created_at),
                INDEX idx_uploaded_by (uploaded_by),
                INDEX idx_file_hash (file_hash)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Media files table created');

        // 6. User wishlists table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS user_wishlists (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                media_id INT NOT NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (media_id) REFERENCES media_files(id) ON DELETE CASCADE,
                UNIQUE KEY unique_wishlist (user_id, media_id),
                INDEX idx_user (user_id),
                INDEX idx_media (media_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ User wishlists table created');

        // 7. Download history table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS download_history (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                media_id INT NOT NULL,
                subscription_id INT,
                download_url VARCHAR(1000),
                expires_at TIMESTAMP NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                downloaded_at TIMESTAMP NULL,
                file_size BIGINT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (media_id) REFERENCES media_files(id) ON DELETE CASCADE,
                FOREIGN KEY (subscription_id) REFERENCES user_subscriptions(id),
                INDEX idx_user_media (user_id, media_id),
                INDEX idx_expires (expires_at),
                INDEX idx_subscription (subscription_id),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Download history table created');

        // 8. Transactions table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS transactions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                package_id INT NOT NULL,
                transaction_id VARCHAR(100) UNIQUE NOT NULL,
                duitku_reference VARCHAR(100),
                amount DECIMAL(10,2) NOT NULL,
                status ENUM('pending', 'success', 'failed', 'expired', 'cancelled') DEFAULT 'pending',
                payment_method VARCHAR(50),
                payment_channel VARCHAR(50),
                payment_url TEXT,
                va_number VARCHAR(50),
                callback_data JSON,
                notes TEXT,
                paid_at TIMESTAMP NULL,
                expired_at TIMESTAMP NULL,
                fee_amount DECIMAL(10,2) DEFAULT 0,
                total_amount DECIMAL(10,2) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (package_id) REFERENCES subscription_packages(id),
                INDEX idx_transaction_id (transaction_id),
                INDEX idx_user_status (user_id, status),
                INDEX idx_status (status),
                INDEX idx_duitku_reference (duitku_reference),
                INDEX idx_created_date (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Transactions table created');

        // 9. User sessions table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                session_token VARCHAR(255) NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_token (session_token),
                INDEX idx_user (user_id),
                INDEX idx_expires (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ User sessions table created');

        // 10. Activity logs table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT,
                action VARCHAR(100) NOT NULL,
                resource_type VARCHAR(50),
                resource_id INT,
                details JSON,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_user_action (user_id, action),
                INDEX idx_resource (resource_type, resource_id),
                INDEX idx_created (created_at),
                INDEX idx_action (action)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Activity logs table created');

        // 11. Sessions table for express-session
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS Sessions (
                session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
                expires INT(11) UNSIGNED NOT NULL,
                data MEDIUMTEXT COLLATE utf8mb4_bin,
                PRIMARY KEY (session_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Sessions table created');

        // Add foreign key constraint for users.subscription_id
        await connection.execute(`
            ALTER TABLE users 
            ADD CONSTRAINT fk_user_subscription 
            FOREIGN KEY (subscription_id) REFERENCES user_subscriptions(id) ON DELETE SET NULL
        `).catch(() => {
            console.log('⚠️  Foreign key constraint already exists or failed to add');
        });

        console.log('🎉 Database migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

// Run migration if called directly
if (require.main === module) {
    createTables()
        .then(() => {
            console.log('✅ Migration completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { createTables };