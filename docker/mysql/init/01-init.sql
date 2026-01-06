-- =================================
-- MySQL Initialization Script
-- =================================
-- This script runs when the MySQL container is first created
-- =================================

-- Set character encoding
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Create database if not exists (usually already created by MYSQL_DATABASE env)
CREATE DATABASE IF NOT EXISTS whatsapp_gateway 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE whatsapp_gateway;

-- Grant privileges to application user
-- Note: The user is created by MYSQL_USER env variable in docker-compose
GRANT ALL PRIVILEGES ON whatsapp_gateway.* TO 'whatsapp'@'%';
FLUSH PRIVILEGES;

-- Create indexes for better performance (Prisma will create tables)
-- These are just placeholder comments - actual tables are created by Prisma migrate

-- =========================================
-- IMPORTANT: Run prisma migrate after first start
-- docker exec -it whatsapp-gateway npx prisma migrate deploy
-- =========================================

SELECT 'MySQL initialization complete!' AS message;
