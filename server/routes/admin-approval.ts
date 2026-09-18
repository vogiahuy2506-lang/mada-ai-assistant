/**
 * MADA AI - Admin Approval Routes
 * 
 * API endpoints cho admin quản lý user approvals
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../lib/auth';
import { 
  approveUser, 
  rejectUser, 
  getPendingUsers, 
  getPendingUsersCount 
} from '../lib/user-approval';
import db from '../lib/db';

const router = Router();

// All routes require admin role
// eslint-disable-next-line @typescript-eslint/no-explicit-any
router.use(authenticate as any, requireRole('admin') as any);

// ============== GET /api/admin/approvals/pending =============

router.get('/pending', (_req: Request, res: Response) => {
  try {
    const pendingUsers = getPendingUsers();
    
    res.json({
      success: true,
      data: {
        users: pendingUsers.map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          plan: u.plan,
          createdAt: u.created_at,
          provider: u.provider,
        })),
        total: pendingUsers.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== GET /api/admin/approvals/stats =============

router.get('/stats', (_req: Request, res: Response) => {
  try {
    const pendingCount = getPendingUsersCount();
    
    // Get total users by status
    const stats = {
      pending: pendingCount,
      active: 0,
      suspended: 0,
      total: 0,
    };
    
    const statusCounts = db.prepare(`
      SELECT status, COUNT(*) as count FROM users GROUP BY status
    `).all() as Array<{ status: string; count: number }>;
    
    for (const row of statusCounts) {
      stats[row.status as keyof typeof stats] = row.count;
      stats.total += row.count;
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== POST /api/admin/approvals/:userId/approve =============
router.post('/:userId/approve', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const adminId = (req as Request & { user?: { id: string } }).user?.id || '';
    
    const result = await approveUser(userId, adminId);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json({
      success: true,
      message: result.message,
      data: { userId },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== POST /api/admin/approvals/:userId/reject =============
router.post('/:userId/reject', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminId = (req as Request & { user?: { id: string } }).user?.id || '';
    
    const result = await rejectUser(userId, adminId, reason);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json({
      success: true,
      message: result.message,
      data: { userId },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== POST /api/admin/approvals/bulk-approve =============
router.post('/bulk-approve', async (req: Request, res: Response) => {
  try {
    const { userIds } = req.body;
    const adminId = (req as Request & { user?: { id: string } }).user?.id || '';
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Danh sách userIds không hợp lệ' 
      });
    }
    
    const results = [];
    let approved = 0;
    let failed = 0;
    
    for (const userId of userIds) {
      const result = await approveUser(userId, adminId);
      if (result.success) {
        approved++;
        results.push({ userId, success: true });
      } else {
        failed++;
        results.push({ userId, success: false, error: result.message });
      }
    }
    
    res.json({
      success: true,
      message: `Đã phê duyệt ${approved}/${userIds.length} người dùng`,
      data: {
        approved,
        failed,
        results,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
