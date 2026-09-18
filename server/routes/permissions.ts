/**
 * Permissions API Routes - MADA AI Assistant
 * 
 * Routes for managing permissions, roles, and plans
 */

import { Router, Response } from 'express';
import db from '../lib/db';
import { authenticate, requireRole } from '../lib/auth';
import {
  Permission,
  Role,
  Plan,
  PERMISSION_LABELS,
  PERMISSION_GROUPS,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_PLAN_PERMISSIONS,
  getUserCustomPermissions,
  grantUserPermission,
  denyUserPermission,
  removeUserPermission,
  updateRolePermissions,
  updatePlanPermissions,
  getRolePermissions,
  getPlanPermissions,
  hasPermission,
  getEffectivePermissions,
  canAccessFeature,
  UserPermissionContext,
} from '../lib/permissions';

const router = Router();

// ============== HELPER ==============

function isValidPermission(p: string): p is Permission {
  return p in PERMISSION_LABELS;
}

function isValidRole(r: string): r is Role {
  return ['super_admin', 'admin', 'data_manager', 'expert', 'user'].includes(r);
}

function isValidPlan(p: string): p is Plan {
  return ['free', 'pro', 'enterprise'].includes(p);
}

// ============== PUBLIC ROUTES ==============

// GET /api/permissions/list - List all available permissions
router.get('/list', (_req, res) => {
  try {
    const permissions = Object.entries(PERMISSION_LABELS).map(([key, labels]) => ({
      key,
      label: labels.vi,
      labelEn: labels.en,
      group: labels.group,
    }));
    
    res.json({
      success: true,
      data: {
        permissions,
        groups: PERMISSION_GROUPS,
        roles: ['super_admin', 'admin', 'data_manager', 'expert', 'user'],
        plans: ['free', 'pro', 'enterprise'],
        defaultRolePermissions: DEFAULT_ROLE_PERMISSIONS,
        defaultPlanPermissions: DEFAULT_PLAN_PERMISSIONS,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/permissions/plan/:plan - Get permissions for a specific plan
router.get('/plan/:plan', (req, res) => {
  try {
    const { plan } = req.params;
    if (!isValidPlan(plan)) {
      return res.status(400).json({ success: false, error: 'Invalid plan' });
    }
    
    // Get from database first, fallback to defaults
    let permissions = getPlanPermissions(plan);
    if (permissions.length === 0) {
      permissions = DEFAULT_PLAN_PERMISSIONS[plan] || [];
    }
    
    res.json({ success: true, data: { plan, permissions } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== AUTHENTICATED ROUTES ==============

// GET /api/permissions/my - Get current user's effective permissions
router.get('/my', authenticate, (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    const { granted, denied } = getUserCustomPermissions(user.id);
    
    const context: UserPermissionContext = {
      userId: user.id,
      role: user.role,
      plan: user.plan,
      customPermissions: granted,
      deniedPermissions: denied,
    };
    
    const effectivePermissions = getEffectivePermissions(context);
    
    res.json({
      success: true,
      data: {
        role: user.role,
        plan: user.plan,
        customPermissions: granted,
        deniedPermissions: denied,
        effectivePermissions,
        features: {
          admin_panel: canAccessFeature(context, 'admin_panel'),
          user_management: canAccessFeature(context, 'user_management'),
          kb_management: canAccessFeature(context, 'kb_management'),
          product_management: canAccessFeature(context, 'product_management'),
          scraper: canAccessFeature(context, 'scraper'),
          analytics: canAccessFeature(context, 'analytics'),
          audit_logs: canAccessFeature(context, 'audit_logs'),
          consultations: canAccessFeature(context, 'consultations'),
          file_upload: canAccessFeature(context, 'file_upload'),
          chat_export: canAccessFeature(context, 'chat_export'),
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/permissions/user/:userId - Get permissions for a specific user
router.get('/user/:userId', authenticate, (req: any, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;
    
    // Only admins can view other users' permissions
    if (userId !== currentUser.id && !['admin', 'super_admin'].includes(currentUser.role)) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    
    const targetUser = db.prepare('SELECT id, role, plan FROM users WHERE id = ?').get(userId) as any;
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const { granted, denied } = getUserCustomPermissions(userId);
    
    const context: UserPermissionContext = {
      userId: targetUser.id,
      role: targetUser.role,
      plan: targetUser.plan,
      customPermissions: granted,
      deniedPermissions: denied,
    };
    
    res.json({
      success: true,
      data: {
        userId: targetUser.id,
        role: targetUser.role,
        plan: targetUser.plan,
        customPermissions: granted,
        deniedPermissions: denied,
        effectivePermissions: getEffectivePermissions(context),
        rolePermissions: getRolePermissions(targetUser.role),
        planPermissions: getPlanPermissions(targetUser.plan),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/permissions/user/:userId/check - Check if user has a specific permission
router.post('/user/:userId/check', authenticate, (req: any, res: Response) => {
  try {
    const { userId } = req.params;
    const { permission } = req.body;
    const currentUser = req.user;
    
    if (!permission || !isValidPermission(permission)) {
      return res.status(400).json({ success: false, error: 'Invalid permission' });
    }
    
    // Only admins can check other users' permissions
    if (userId !== currentUser.id && !['admin', 'super_admin'].includes(currentUser.role)) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    
    const targetUser = db.prepare('SELECT id, role, plan FROM users WHERE id = ?').get(userId) as any;
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const { granted, denied } = getUserCustomPermissions(userId);
    
    const context: UserPermissionContext = {
      userId: targetUser.id,
      role: targetUser.role,
      plan: targetUser.plan,
      customPermissions: granted,
      deniedPermissions: denied,
    };
    
    const hasPerm = hasPermission(context, permission);
    
    res.json({ success: true, data: { permission, hasPermission: hasPerm } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/permissions/user/:userId/grant - Grant a permission to a user
router.post('/user/:userId/grant', authenticate, requireRole('admin', 'super_admin'), (req: any, res: Response) => {
  try {
    const { userId } = req.params;
    const { permission } = req.body;
    const currentUser = req.user;
    
    if (!permission || !isValidPermission(permission)) {
      return res.status(400).json({ success: false, error: 'Invalid permission' });
    }
    
    // Super admin required to manage super_admin permissions
    if (permission.startsWith('settings:manage') && currentUser.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Super Admin required for this permission' });
    }
    
    const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    grantUserPermission(userId, permission, currentUser.id);
    
    res.json({
      success: true,
      message: `Permission '${permission}' granted successfully`,
      data: { userId, permission },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/permissions/user/:userId/deny - Deny a permission from a user
router.post('/user/:userId/deny', authenticate, requireRole('admin', 'super_admin'), (req: any, res: Response) => {
  try {
    const { userId } = req.params;
    const { permission } = req.body;
    
    if (!permission || !isValidPermission(permission)) {
      return res.status(400).json({ success: false, error: 'Invalid permission' });
    }
    
    const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    denyUserPermission(userId, permission);
    
    res.json({
      success: true,
      message: `Permission '${permission}' denied successfully`,
      data: { userId, permission },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/permissions/user/:userId/:permission - Remove custom permission
router.delete('/user/:userId/:permission', authenticate, requireRole('admin', 'super_admin'), (req: any, res: Response) => {
  try {
    const { userId, permission } = req.params;
    
    if (!isValidPermission(permission)) {
      return res.status(400).json({ success: false, error: 'Invalid permission' });
    }
    
    removeUserPermission(userId, permission);
    
    res.json({
      success: true,
      message: `Permission '${permission}' removed from user`,
      data: { userId, permission },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== ROLE MANAGEMENT ROUTES ==============

// GET /api/permissions/roles - Get all role permissions
router.get('/roles', authenticate, requireRole('admin', 'super_admin'), (_req: any, res: Response) => {
  try {
    const roles: Role[] = ['super_admin', 'admin', 'data_manager', 'expert', 'user'];
    
    const rolePermissions: Record<string, string[]> = {};
    for (const role of roles) {
      let perms = getRolePermissions(role);
      if (perms.length === 0) {
        perms = (DEFAULT_ROLE_PERMISSIONS[role] || []) as Permission[];
      }
      rolePermissions[role] = perms;
    }
    
    res.json({ success: true, data: rolePermissions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/permissions/roles/:role - Update permissions for a role
router.put('/roles/:role', authenticate, requireRole('super_admin'), (req: any, res: Response) => {
  try {
    const { role } = req.params;
    const { permissions } = req.body;
    
    if (!isValidRole(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }
    
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ success: false, error: 'Permissions must be an array' });
    }
    
    // Validate all permissions
    const validPermissions = permissions.filter((p: string): p is Permission => isValidPermission(p));
    
    updateRolePermissions(role as Role, validPermissions);
    
    res.json({
      success: true,
      message: `Role '${role}' permissions updated`,
      data: { role, permissions: validPermissions },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/permissions/roles/:role/reset - Reset role to default permissions
router.post('/roles/:role/reset', authenticate, requireRole('super_admin'), (req: any, res: Response) => {
  try {
    const { role } = req.params;
    
    if (!isValidRole(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }
    
    const defaultPermissions = (DEFAULT_ROLE_PERMISSIONS[role as Role] || []) as string[];
    updateRolePermissions(role as Role, defaultPermissions as Permission[]);
    
    res.json({
      success: true,
      message: `Role '${role}' reset to default permissions`,
      data: { role, permissions: defaultPermissions },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== PLAN MANAGEMENT ROUTES ==============

// GET /api/permissions/plans - Get all plan permissions
router.get('/plans', authenticate, requireRole('admin', 'super_admin'), (_req: any, res: Response) => {
  try {
    const plans: Plan[] = ['free', 'pro', 'enterprise'];
    
    const planPermissions: Record<string, string[]> = {};
    for (const plan of plans) {
      let perms = getPlanPermissions(plan);
      if (perms.length === 0) {
        perms = (DEFAULT_PLAN_PERMISSIONS[plan] || []) as Permission[];
      }
      planPermissions[plan] = perms;
    }
    
    res.json({ success: true, data: planPermissions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/permissions/plans/:plan - Update permissions for a plan
router.put('/plans/:plan', authenticate, requireRole('super_admin'), (req: any, res: Response) => {
  try {
    const { plan } = req.params;
    const { permissions } = req.body;
    
    if (!isValidPlan(plan)) {
      return res.status(400).json({ success: false, error: 'Invalid plan' });
    }
    
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ success: false, error: 'Permissions must be an array' });
    }
    
    // Validate all permissions
    const validPermissions = permissions.filter((p: string): p is Permission => isValidPermission(p));
    
    updatePlanPermissions(plan as Plan, validPermissions);
    
    res.json({
      success: true,
      message: `Plan '${plan}' permissions updated`,
      data: { plan, permissions: validPermissions },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/permissions/plans/:plan/reset - Reset plan to default permissions
router.post('/plans/:plan/reset', authenticate, requireRole('super_admin'), (req: any, res: Response) => {
  try {
    const { plan } = req.params;
    
    if (!isValidPlan(plan)) {
      return res.status(400).json({ success: false, error: 'Invalid plan' });
    }
    
    const defaultPermissions = (DEFAULT_PLAN_PERMISSIONS[plan as Plan] || []) as string[];
    updatePlanPermissions(plan as Plan, defaultPermissions as Permission[]);
    
    res.json({
      success: true,
      message: `Plan '${plan}' reset to default permissions`,
      data: { plan, permissions: defaultPermissions },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== BULK USER MANAGEMENT ==============

// POST /api/permissions/user/:userId/bulk - Bulk update user permissions
router.post('/user/:userId/bulk', authenticate, requireRole('admin', 'super_admin'), (req: any, res: Response) => {
  try {
    const { userId } = req.params;
    const { grant = [], deny = [], remove = [] } = req.body;
    const currentUser = req.user;
    
    const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const results = {
      granted: [] as string[],
      denied: [] as string[],
      removed: [] as string[],
    };
    
    // Grant permissions
    for (const p of grant) {
      if (isValidPermission(p)) {
        grantUserPermission(userId, p, currentUser.id);
        results.granted.push(p);
      }
    }
    
    // Deny permissions
    for (const p of deny) {
      if (isValidPermission(p)) {
        denyUserPermission(userId, p);
        results.denied.push(p);
      }
    }
    
    // Remove custom permissions
    for (const p of remove) {
      if (isValidPermission(p)) {
        removeUserPermission(userId, p);
        results.removed.push(p);
      }
    }
    
    res.json({
      success: true,
      message: 'User permissions updated',
      data: results,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
