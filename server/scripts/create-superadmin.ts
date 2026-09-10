/**
 * Create Super Admin Account
 * 
 * Script này tạo tài khoản Super Admin đầu tiên
 * Chạy: npx tsx server/scripts/create-superadmin.ts
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import db from '../lib/db';

async function createSuperAdmin() {
  console.log('🚀 Tạo Tài Khoản Super Admin');
  console.log('='.repeat(50));

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@mada.vn';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
  const superAdminName = process.env.SUPER_ADMIN_NAME || 'Super Administrator';

  try {
    // Check existing super admin
    const existing = db.prepare('SELECT id, email, role FROM users WHERE role = ?').get('super_admin') as any;
    if (existing) {
      console.log(`\n⚠️  Super Admin đã tồn tại: ${existing.email}`);
      console.log(`🔗 ID: ${existing.id}`);
      console.log(`\n💡 Để đổi mật khẩu, chạy lệnh SQL:`);
      console.log(`   UPDATE users SET password_hash = '$2a$12$YOUR_HASH' WHERE role = 'super_admin';\n`);
      process.exit(0);
    }

    // Create super admin
    const hash = bcrypt.hashSync(superAdminPassword, 12);
    const now = new Date().toISOString();
    const id = `superadmin-${Date.now()}`;

    db.prepare(`
      INSERT INTO users (id, email, name, password_hash, role, plan, status, provider, quota_used, quota_limit, last_login_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, superAdminEmail, superAdminName, hash, 'super_admin', 'enterprise', 'active', 'email', 0, -1, now, now, now);

    console.log('\n✅ TẠO SUPER ADMIN THÀNH CÔNG!');
    console.log('='.repeat(50));
    console.log(`📧 Email:    ${superAdminEmail}`);
    console.log(`🔐 Password: ${superAdminPassword}`);
    console.log(`👤 Name:     ${superAdminName}`);
    console.log(`🆔 ID:       ${id}`);
    console.log('='.repeat(50));
    console.log('\n🔗 Đăng nhập tại: http://localhost:5173/admin');
    console.log('\n⚠️  LƯU LẠI THÔNG TIN ĐĂNG NHẬP!');
    console.log('   Đây là tài khoản cao nhất - có quyền quản lý tất cả!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Lỗi khi tạo Super Admin:', error);
    process.exit(1);
  }
}

createSuperAdmin();
