/**
 * Permissions System - MADA AI Assistant
 * 
 * Hệ thống phân quyền theo mô hình RBAC (Role-Based Access Control) với:
 * - Permissions: Các quyền cụ thể (read, write, delete, manage)
 * - Role Permissions: Mapping quyền cho từng role
 * - Plan Permissions: Quyền mặc định theo gói dịch vụ (free/pro/enterprise)
 */

import db from './db';

// ============== PERMISSION DEFINITIONS ==============

export type Permission =
  // User Management
  | 'users:read'
  | 'users:create'
  | 'users:update'
  | 'users:delete'
  | 'users:manage_roles'
  
  // Knowledge Base
  | 'kb:read'
  | 'kb:create'
  | 'kb:update'
  | 'kb:delete'
  | 'kb:publish'
  | 'kb:import'
  | 'kb:export'
  
  // Products
  | 'products:read'
  | 'products:create'
  | 'products:update'
  | 'products:delete'
  | 'products:approve'
  | 'products:import'
  | 'products:export'
  
  // AI Agents
  | 'agents:read'
  | 'agents:create'
  | 'agents:update'
  | 'agents:delete'
  | 'agents:configure'
  | 'agents:view_logs'
  
  // Prompts
  | 'prompts:read'
  | 'prompts:create'
  | 'prompts:update'
  | 'prompts:delete'
  | 'prompts:publish'
  
  // System Settings
  | 'settings:read'
  | 'settings:update'
  | 'settings:manage_permissions'
  | 'settings:manage_plans'
  
  // Scrape & Sync
  | 'scrape:read'
  | 'scrape:create'
  | 'scrape:execute'
  | 'scrape:cancel'
  
  // Analytics
  | 'analytics:read'
  | 'analytics:export'
  
  // Audit Logs
  | 'audit:read'
  
  // Consultations
  | 'consultations:read'
  | 'consultations:respond'
  | 'consultations:delete'
  
  // File Upload
  | 'files:upload'
  | 'files:delete'
  
  // Chat & History
  | 'chat:use'
  | 'chat:export';

export type Role = 'super_admin' | 'admin' | 'data_manager' | 'expert' | 'user';

export type Plan = 'free' | 'pro' | 'enterprise';

// ============== PERMISSION DESCRIPTIONS (for UI) ==============

export const PERMISSION_LABELS: Record<Permission, { vi: string; en: string; group: string }> = {
  // User Management
  'users:read': { vi: 'Xem danh sách người dùng', en: 'View user list', group: 'Người dùng' },
  'users:create': { vi: 'Tạo người dùng mới', en: 'Create new users', group: 'Người dùng' },
  'users:update': { vi: 'Cập nhật thông tin người dùng', en: 'Update user info', group: 'Người dùng' },
  'users:delete': { vi: 'Xóa người dùng', en: 'Delete users', group: 'Người dùng' },
  'users:manage_roles': { vi: 'Quản lý vai trò người dùng', en: 'Manage user roles', group: 'Người dùng' },
  
  // Knowledge Base
  'kb:read': { vi: 'Xem kiến thức', en: 'View knowledge', group: 'Knowledge Base' },
  'kb:create': { vi: 'Tạo mục kiến thức', en: 'Create knowledge items', group: 'Knowledge Base' },
  'kb:update': { vi: 'Cập nhật kiến thức', en: 'Update knowledge', group: 'Knowledge Base' },
  'kb:delete': { vi: 'Xóa kiến thức', en: 'Delete knowledge', group: 'Knowledge Base' },
  'kb:publish': { vi: 'Xuất bản kiến thức', en: 'Publish knowledge', group: 'Knowledge Base' },
  'kb:import': { vi: 'Nhập kiến thức', en: 'Import knowledge', group: 'Knowledge Base' },
  'kb:export': { vi: 'Xuất kiến thức', en: 'Export knowledge', group: 'Knowledge Base' },
  
  // Products
  'products:read': { vi: 'Xem sản phẩm', en: 'View products', group: 'Sản phẩm' },
  'products:create': { vi: 'Tạo sản phẩm', en: 'Create products', group: 'Sản phẩm' },
  'products:update': { vi: 'Cập nhật sản phẩm', en: 'Update products', group: 'Sản phẩm' },
  'products:delete': { vi: 'Xóa sản phẩm', en: 'Delete products', group: 'Sản phẩm' },
  'products:approve': { vi: 'Phê duyệt sản phẩm', en: 'Approve products', group: 'Sản phẩm' },
  'products:import': { vi: 'Nhập sản phẩm', en: 'Import products', group: 'Sản phẩm' },
  'products:export': { vi: 'Xuất sản phẩm', en: 'Export products', group: 'Sản phẩm' },
  
  // AI Agents
  'agents:read': { vi: 'Xem agents', en: 'View agents', group: 'AI Agents' },
  'agents:create': { vi: 'Tạo agent', en: 'Create agents', group: 'AI Agents' },
  'agents:update': { vi: 'Cập nhật agent', en: 'Update agents', group: 'AI Agents' },
  'agents:delete': { vi: 'Xóa agent', en: 'Delete agents', group: 'AI Agents' },
  'agents:configure': { vi: 'Cấu hình agent', en: 'Configure agents', group: 'AI Agents' },
  'agents:view_logs': { vi: 'Xem logs agent', en: 'View agent logs', group: 'AI Agents' },
  
  // Prompts
  'prompts:read': { vi: 'Xem prompts', en: 'View prompts', group: 'Prompts' },
  'prompts:create': { vi: 'Tạo prompt', en: 'Create prompts', group: 'Prompts' },
  'prompts:update': { vi: 'Cập nhật prompt', en: 'Update prompts', group: 'Prompts' },
  'prompts:delete': { vi: 'Xóa prompt', en: 'Delete prompts', group: 'Prompts' },
  'prompts:publish': { vi: 'Xuất bản prompt', en: 'Publish prompts', group: 'Prompts' },
  
  // System Settings
  'settings:read': { vi: 'Xem cài đặt', en: 'View settings', group: 'Hệ thống' },
  'settings:update': { vi: 'Cập nhật cài đặt', en: 'Update settings', group: 'Hệ thống' },
  'settings:manage_permissions': { vi: 'Quản lý phân quyền', en: 'Manage permissions', group: 'Hệ thống' },
  'settings:manage_plans': { vi: 'Quản lý gói dịch vụ', en: 'Manage plans', group: 'Hệ thống' },
  
  // Scrape
  'scrape:read': { vi: 'Xem lịch scrape', en: 'View scrape schedule', group: 'Scrape' },
  'scrape:create': { vi: 'Tạo lịch scrape', en: 'Create scrape schedule', group: 'Scrape' },
  'scrape:execute': { vi: 'Thực thi scrape', en: 'Execute scrape', group: 'Scrape' },
  'scrape:cancel': { vi: 'Hủy scrape', en: 'Cancel scrape', group: 'Scrape' },
  
  // Analytics
  'analytics:read': { vi: 'Xem thống kê', en: 'View analytics', group: 'Analytics' },
  'analytics:export': { vi: 'Xuất thống kê', en: 'Export analytics', group: 'Analytics' },
  
  // Audit
  'audit:read': { vi: 'Xem audit log', en: 'View audit logs', group: 'Audit' },
  
  // Consultations
  'consultations:read': { vi: 'Xem tư vấn', en: 'View consultations', group: 'Tư vấn' },
  'consultations:respond': { vi: 'Phản hồi tư vấn', en: 'Respond to consultations', group: 'Tư vấn' },
  'consultations:delete': { vi: 'Xóa tư vấn', en: 'Delete consultations', group: 'Tư vấn' },
  
  // Files
  'files:upload': { vi: 'Upload file', en: 'Upload files', group: 'Files' },
  'files:delete': { vi: 'Xóa file', en: 'Delete files', group: 'Files' },
  
  // Chat
  'chat:use': { vi: 'Sử dụng chat', en: 'Use chat', group: 'Chat' },
  'chat:export': { vi: 'Xuất lịch sử chat', en: 'Export chat history', group: 'Chat' },
};

// ============== DEFAULT ROLE PERMISSIONS ==============

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: Object.keys(PERMISSION_LABELS) as Permission[], // Full access
  
  admin: [
    // Users
    'users:read', 'users:create', 'users:update',
    // KB
    'kb:read', 'kb:create', 'kb:update', 'kb:delete', 'kb:publish', 'kb:import',
    // Products
    'products:read', 'products:create', 'products:update', 'products:delete', 'products:approve', 'products:import',
    // Agents
    'agents:read', 'agents:create', 'agents:update', 'agents:configure',
    // Prompts
    'prompts:read', 'prompts:create', 'prompts:update', 'prompts:publish',
    // Settings
    'settings:read', 'settings:update',
    // Scrape
    'scrape:read', 'scrape:create', 'scrape:execute', 'scrape:cancel',
    // Analytics
    'analytics:read', 'analytics:export',
    // Audit
    'audit:read',
    // Consultations
    'consultations:read', 'consultations:respond',
    // Files
    'files:upload', 'files:delete',
    // Chat
    'chat:use', 'chat:export',
  ],
  
  data_manager: [
    // KB
    'kb:read', 'kb:create', 'kb:update', 'kb:publish', 'kb:import', 'kb:export',
    // Products
    'products:read', 'products:create', 'products:update', 'products:import', 'products:export',
    // Prompts
    'prompts:read', 'prompts:create', 'prompts:update',
    // Scrape
    'scrape:read', 'scrape:create', 'scrape:execute',
    // Analytics
    'analytics:read',
    // Chat
    'chat:use',
  ],
  
  expert: [
    // KB
    'kb:read',
    // Products
    'products:read',
    // Agents
    'agents:read',
    // Prompts
    'prompts:read',
    // Chat
    'chat:use',
  ],
  
  user: [
    // KB
    'kb:read',
    // Products
    'products:read',
    // Chat
    'chat:use',
  ],
};

// ============== DEFAULT PLAN PERMISSIONS ==============

export const DEFAULT_PLAN_PERMISSIONS: Record<Plan, Permission[]> = {
  free: [
    'kb:read',
    'products:read',
    'chat:use',
  ],
  
  pro: [
    'kb:read', 'kb:create', 'kb:update',
    'products:read', 'products:create', 'products:update',
    'chat:use', 'chat:export',
    'files:upload',
    'analytics:read',
  ],
  
  enterprise: Object.keys(PERMISSION_LABELS) as Permission[],
};

// ============== PERMISSION GROUPS (for UI display) ==============

export const PERMISSION_GROUPS = [
  { key: 'Người dùng', permissions: ['users:read', 'users:create', 'users:update', 'users:delete', 'users:manage_roles'] },
  { key: 'Knowledge Base', permissions: ['kb:read', 'kb:create', 'kb:update', 'kb:delete', 'kb:publish', 'kb:import', 'kb:export'] },
  { key: 'Sản phẩm', permissions: ['products:read', 'products:create', 'products:update', 'products:delete', 'products:approve', 'products:import', 'products:export'] },
  { key: 'AI Agents', permissions: ['agents:read', 'agents:create', 'agents:update', 'agents:delete', 'agents:configure', 'agents:view_logs'] },
  { key: 'Prompts', permissions: ['prompts:read', 'prompts:create', 'prompts:update', 'prompts:delete', 'prompts:publish'] },
  { key: 'Hệ thống', permissions: ['settings:read', 'settings:update', 'settings:manage_permissions', 'settings:manage_plans'] },
  { key: 'Scrape', permissions: ['scrape:read', 'scrape:create', 'scrape:execute', 'scrape:cancel'] },
  { key: 'Analytics', permissions: ['analytics:read', 'analytics:export'] },
  { key: 'Audit', permissions: ['audit:read'] },
  { key: 'Tư vấn', permissions: ['consultations:read', 'consultations:respond', 'consultations:delete'] },
  { key: 'Files', permissions: ['files:upload', 'files:delete'] },
  { key: 'Chat', permissions: ['chat:use', 'chat:export'] },
];

// ============== PERMISSION CHECK FUNCTIONS ==============

export interface UserPermissionContext {
  userId: string;
  role: Role;
  plan: Plan;
  customPermissions?: Permission[];
  deniedPermissions?: Permission[];
}

/**
 * Check if user has a specific permission
 * Combines: role permissions + plan permissions + custom user permissions
 */
export function hasPermission(context: UserPermissionContext, permission: Permission): boolean {
  const { role, plan, customPermissions = [], deniedPermissions = [] } = context;
  
  // Check denied permissions first
  if (deniedPermissions.includes(permission)) {
    return false;
  }
  
  // Check custom user permissions
  if (customPermissions.includes(permission)) {
    return true;
  }
  
  // Check role permissions
  const rolePermissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
  if (rolePermissions.includes(permission)) {
    return true;
  }
  
  // Check plan permissions
  const planPermissions = DEFAULT_PLAN_PERMISSIONS[plan] || [];
  if (planPermissions.includes(permission)) {
    return true;
  }
  
  return false;
}

/**
 * Get all effective permissions for a user
 */
export function getEffectivePermissions(context: UserPermissionContext): Permission[] {
  const { role, plan, customPermissions = [], deniedPermissions = [] } = context;
  
  const rolePermissions = new Set(DEFAULT_ROLE_PERMISSIONS[role] || []);
  const planPermissions = new Set(DEFAULT_PLAN_PERMISSIONS[plan] || []);
  const customPermSet = new Set(customPermissions);
  
  // Combine all permissions
  const allPermissions = new Set<string>();
  rolePermissions.forEach(p => allPermissions.add(p));
  planPermissions.forEach(p => allPermissions.add(p));
  customPermSet.forEach(p => allPermissions.add(p));
  
  // Remove denied permissions
  deniedPermissions.forEach(p => allPermissions.delete(p));
  
  return Array.from(allPermissions) as Permission[];
}

/**
 * Check if user can access a specific feature
 */
export function canAccessFeature(context: UserPermissionContext, feature: string): boolean {
  const featurePermissionMap: Record<string, Permission[]> = {
    'admin_panel': ['users:read', 'settings:read'],
    'user_management': ['users:read', 'users:update'],
    'kb_management': ['kb:read', 'kb:create'],
    'product_management': ['products:read', 'products:create'],
    'scraper': ['scrape:read', 'scrape:execute'],
    'analytics': ['analytics:read'],
    'audit_logs': ['audit:read'],
    'consultations': ['consultations:read'],
    'file_upload': ['files:upload'],
    'chat_export': ['chat:export'],
  };
  
  const requiredPermissions = featurePermissionMap[feature];
  if (!requiredPermissions) {
    return false;
  }
  
  return requiredPermissions.some(p => hasPermission(context, p));
}

// ============== DATABASE MIGRATION ==============

export function initPermissionsSchema() {
  // Create permissions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description_vi TEXT,
      description_en TEXT,
      group_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  
  // Create role_permissions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      permission TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(role, permission)
    )
  `);
  
  // Create plan_permissions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS plan_permissions (
      id TEXT PRIMARY KEY,
      plan TEXT NOT NULL,
      permission TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(plan, permission)
    )
  `);
  
  // Create user_custom_permissions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_custom_permissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      permission TEXT NOT NULL,
      granted INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      created_by TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, permission)
    )
  `);
  
  // Create indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_role_perms_role ON role_permissions(role)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_plan_perms_plan ON plan_permissions(plan)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_user_perms_user ON user_custom_permissions(user_id)`);
  
  console.log('✅ Permissions schema initialized');
}

// ============== SEED DEFAULT PERMISSIONS ==============

export function seedDefaultPermissions() {
  const now = new Date().toISOString();
  
  // Check if permissions already seeded
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM permissions').get() as { count: number };
  if (existingCount.count > 0) {
    console.log(`📋 Permissions already seeded (${existingCount.count} rows) — skipping`);
    return;
  }
  
  // Insert all permission definitions
  const insertPerm = db.prepare(`
    INSERT OR IGNORE INTO permissions (id, name, description_vi, description_en, group_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const [perm, labels] of Object.entries(PERMISSION_LABELS)) {
    const permData = labels as { vi: string; en: string; group: string };
    insertPerm.run(
      perm,
      perm,
      permData.vi,
      permData.en,
      permData.group,
      now,
      now
    );
  }
  
  // Seed role permissions
  const insertRolePerm = db.prepare(`
    INSERT OR IGNORE INTO role_permissions (id, role, permission, created_at)
    VALUES (?, ?, ?, ?)
  `);
  
  for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    for (const perm of permissions) {
      insertRolePerm.run(
        `${role}:${perm}`,
        role,
        perm,
        now
      );
    }
  }
  
  // Seed plan permissions
  const insertPlanPerm = db.prepare(`
    INSERT OR IGNORE INTO plan_permissions (id, plan, permission, created_at)
    VALUES (?, ?, ?, ?)
  `);
  
  for (const [plan, permissions] of Object.entries(DEFAULT_PLAN_PERMISSIONS)) {
    for (const perm of permissions) {
      insertPlanPerm.run(
        `${plan}:${perm}`,
        plan,
        perm,
        now
      );
    }
  }
  
  console.log('🌱 Default permissions seeded');
}

// ============== DATABASE QUERIES ==============

export function getUserCustomPermissions(userId: string): { granted: Permission[]; denied: Permission[] } {
  const rows = db.prepare('SELECT permission, granted FROM user_custom_permissions WHERE user_id = ?').all(userId) as Array<{ permission: Permission; granted: number }>;
  
  const granted: Permission[] = [];
  const denied: Permission[] = [];
  
  for (const row of rows) {
    if (row.granted) {
      granted.push(row.permission);
    } else {
      denied.push(row.permission);
    }
  }
  
  return { granted, denied };
}

export function grantUserPermission(userId: string, permission: Permission, grantedBy: string) {
  const now = new Date().toISOString();
  const id = `${userId}:${permission}`;
  
  db.prepare(`
    INSERT INTO user_custom_permissions (id, user_id, permission, granted, created_at, created_by)
    VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT(user_id, permission) DO UPDATE SET granted = 1, created_by = ?
  `).run(id, userId, permission, now, grantedBy, grantedBy);
}

export function denyUserPermission(userId: string, permission: Permission) {
  const now = new Date().toISOString();
  const id = `${userId}:${permission}`;
  
  db.prepare(`
    INSERT INTO user_custom_permissions (id, user_id, permission, granted, created_at)
    VALUES (?, ?, ?, 0, ?)
    ON CONFLICT(user_id, permission) DO UPDATE SET granted = 0
  `).run(id, userId, permission, now);
}

export function removeUserPermission(userId: string, permission: Permission) {
  db.prepare('DELETE FROM user_custom_permissions WHERE user_id = ? AND permission = ?').run(userId, permission);
}

export function updateRolePermissions(role: Role, permissions: Permission[]) {
  const now = new Date().toISOString();
  
  db.prepare('DELETE FROM role_permissions WHERE role = ?').run(role);
  
  const insert = db.prepare(`
    INSERT INTO role_permissions (id, role, permission, created_at)
    VALUES (?, ?, ?, ?)
  `);
  
  for (const perm of permissions) {
    insert.run(`${role}:${perm}`, role, perm, now);
  }
}

export function updatePlanPermissions(plan: Plan, permissions: Permission[]) {
  const now = new Date().toISOString();
  
  db.prepare('DELETE FROM plan_permissions WHERE plan = ?').run(plan);
  
  const insert = db.prepare(`
    INSERT INTO plan_permissions (id, plan, permission, created_at)
    VALUES (?, ?, ?, ?)
  `);
  
  for (const perm of permissions) {
    insert.run(`${plan}:${perm}`, plan, perm, now);
  }
}

export function getRolePermissions(role: Role): Permission[] {
  const rows = db.prepare('SELECT permission FROM role_permissions WHERE role = ?').all(role) as Array<{ permission: Permission }>;
  return rows.map(r => r.permission);
}

export function getPlanPermissions(plan: Plan): Permission[] {
  const rows = db.prepare('SELECT permission FROM plan_permissions WHERE plan = ?').all(plan) as Array<{ permission: Permission }>;
  return rows.map(r => r.permission);
}

// ============== EXPORT TYPES ==============

export interface PermissionRow {
  id: string;
  name: Permission;
  description_vi: string | null;
  description_en: string | null;
  group_name: string;
}

export interface RolePermissionRow {
  id: string;
  role: Role;
  permission: Permission;
}

export interface PlanPermissionRow {
  id: string;
  plan: Plan;
  permission: Permission;
}

export interface UserCustomPermissionRow {
  id: string;
  user_id: string;
  permission: Permission;
  granted: number;
}
