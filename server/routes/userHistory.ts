// @ts-nocheck
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, optionalAuth } from '../lib/auth';
import db from '../lib/db';

const router = Router();

/**
 * GET /api/user/history
 * Lấy danh sách conversations của user (hoặc anonymous nếu không đăng nhập)
 */
router.get('/history', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const deviceId = req.query.device_id as string || null;
    const { limit = '50', search = '' } = req.query;

    let conversations: any[];

    if (userId) {
      // User đã đăng nhập - lấy conversations của user
      const stmt = db.prepare(`
        SELECT id, title, agent_id, language, message_count, last_message_preview,
               is_pinned, created_at, updated_at
        FROM chat_conversations
        WHERE user_id = ?
        ${search ? 'AND (title LIKE ? OR last_message_preview LIKE ?)' : ''}
        ORDER BY is_pinned DESC, updated_at DESC
        LIMIT ?
      `);
      const searchPattern = search ? `%${String(search)}%` : null;
      conversations = search
        ? stmt.all(userId, searchPattern, searchPattern, Number(limit))
        : stmt.all(userId, Number(limit));
    } else if (deviceId) {
      // Anonymous user - lấy conversations theo device_id
      const stmt = db.prepare(`
        SELECT id, title, agent_id, language, message_count, last_message_preview,
               is_pinned, created_at, updated_at
        FROM chat_conversations
        WHERE device_id = ? AND user_id IS NULL
        ${search ? 'AND (title LIKE ? OR last_message_preview LIKE ?)' : ''}
        ORDER BY is_pinned DESC, updated_at DESC
        LIMIT ?
      `);
      const searchPattern = search ? `%${String(search)}%` : null;
      conversations = search
        ? stmt.all(deviceId, searchPattern, searchPattern, Number(limit))
        : stmt.all(deviceId, Number(limit));
    } else {
      // Không có userId và deviceId - không có lịch sử
      conversations = [];
    }

    return res.json({ success: true, data: { conversations } });
  } catch (err: any) {
    console.error('Get history error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/user/history/:id
 * Lấy chi tiết một conversation (tất cả messages)
 */
router.get('/history/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const deviceId = req.query.device_id as string || null;

    // Kiểm tra quyền truy cập: user sở hữu hoặc device sở hữu
    let conv;
    if (userId) {
      conv = db.prepare(
        `SELECT * FROM chat_conversations WHERE id = ? AND user_id = ?`
      ).get(id, userId);
    } else if (deviceId) {
      conv = db.prepare(
        `SELECT * FROM chat_conversations WHERE id = ? AND device_id = ? AND user_id IS NULL`
      ).get(id, deviceId);
    } else {
      conv = db.prepare(
        `SELECT * FROM chat_conversations WHERE id = ? AND user_id IS NULL AND device_id IS NULL`
      ).get(id);
    }

    if (!conv) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const messages = db.prepare(
      `SELECT id, role, content, agent_id, sources, confidence, language, created_at
       FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC`
    ).all(id);

    return res.json({
      success: true,
      data: {
        conversation: conv,
        messages: messages.map((m: any) => ({
          ...m,
          sources: m.sources ? JSON.parse(m.sources) : null,
        })),
      },
    });
  } catch (err: any) {
    console.error('Get history detail error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/user/history
 * Tạo conversation mới (khi bắt đầu chat)
 * Body: { conversationId?, title, agentId, language, firstMessage?, deviceId? }
 */
router.post('/history', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const { conversationId, title, agentId, language, firstMessage, deviceId } = req.body;

    const id = conversationId || uuidv4();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO chat_conversations
        (id, user_id, device_id, title, agent_id, language, message_count, last_message_preview, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      userId,
      deviceId || null,
      title || 'Cuộc trò chuyện mới',
      agentId || null,
      language || 'vi',
      firstMessage ? 1 : 0,
      firstMessage ? firstMessage.slice(0, 100) : null,
      now,
      now
    );

    // Lưu first message nếu có
    if (firstMessage) {
      const msgId = uuidv4();
      db.prepare(`
        INSERT INTO chat_messages (id, conversation_id, role, content, language, agent_id, created_at)
        VALUES (?, ?, 'user', ?, ?, ?, ?)
      `).run(msgId, id, firstMessage, language || 'vi', agentId || null, now);
    }

    return res.json({ success: true, data: { id } });
  } catch (err: any) {
    console.error('Create conversation error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/user/history/:id/messages
 * Thêm message mới vào conversation
 */
router.post('/history/:id/messages', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id: convId } = req.params;
    const userId = req.user?.id || null;
    const deviceId = req.body.deviceId || req.query.device_id as string || null;
    const { role, content, agentId, sources, confidence, language } = req.body;

    if (!role || !content) {
      return res.status(400).json({ success: false, error: 'role và content là bắt buộc' });
    }

    if (!['user', 'assistant', 'system'].includes(role)) {
      return res.status(400).json({ success: false, error: 'role không hợp lệ' });
    }

    // Verify conversation exists và thuộc về user/device
    let conv;
    if (userId) {
      conv = db.prepare(
        `SELECT id, user_id, title FROM chat_conversations WHERE id = ? AND user_id = ?`
      ).get(convId, userId);
    } else if (deviceId) {
      conv = db.prepare(
        `SELECT id, user_id, title FROM chat_conversations WHERE id = ? AND device_id = ? AND user_id IS NULL`
      ).get(convId, deviceId);
    } else {
      conv = db.prepare(
        `SELECT id, user_id, title FROM chat_conversations WHERE id = ? AND user_id IS NULL AND device_id IS NULL`
      ).get(convId);
    }

    if (!conv) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const msgId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO chat_messages (id, conversation_id, role, content, agent_id, sources, confidence, language, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      msgId,
      convId,
      role,
      content,
      agentId || null,
      sources ? JSON.stringify(sources) : null,
      confidence ?? null,
      language || null,
      now
    );

    // Update conversation: message_count + preview + updated_at
    db.prepare(`
      UPDATE chat_conversations
      SET message_count = message_count + 1,
          last_message_preview = ?,
          updated_at = ?
      WHERE id = ?
    `).run(content.slice(0, 100), now, convId);

    return res.json({ success: true, data: { messageId: msgId } });
  } catch (err: any) {
    console.error('Add message error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/user/history/:id
 * Update conversation (rename, pin/unpin)
 */
router.patch('/history/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { title, is_pinned } = req.body;

    const conv = db.prepare('SELECT user_id FROM chat_conversations WHERE id = ?').get(id) as any;
    if (!conv) return res.status(404).json({ success: false, error: 'Not found' });
    if (conv.user_id !== userId) return res.status(403).json({ success: false, error: 'Forbidden' });

    db.prepare(`
      UPDATE chat_conversations
      SET title = COALESCE(?, title),
          is_pinned = COALESCE(?, is_pinned),
          updated_at = ?
      WHERE id = ?
    `).run(title ?? null, is_pinned === undefined ? null : (is_pinned ? 1 : 0), new Date().toISOString(), id);

    return res.json({ success: true });
  } catch (err: any) {
    console.error('Update conversation error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/user/history/:id
 * Xóa conversation
 */
router.delete('/history/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const conv = db.prepare('SELECT user_id FROM chat_conversations WHERE id = ?').get(id) as any;
    if (!conv) return res.status(404).json({ success: false, error: 'Not found' });
    if (conv.user_id !== userId) return res.status(403).json({ success: false, error: 'Forbidden' });

    db.prepare('DELETE FROM chat_messages WHERE conversation_id = ?').run(id);
    db.prepare('DELETE FROM chat_conversations WHERE id = ?').run(id);

    return res.json({ success: true });
  } catch (err: any) {
    console.error('Delete conversation error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =============== FAVORITES ===============

/**
 * GET /api/user/favorites
 * Lấy danh sách favorites của user
 */
router.get('/favorites', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const favorites = db.prepare(
      'SELECT id, item_type, item_id, title, metadata, created_at FROM user_favorites WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId);

    return res.json({
      success: true,
      data: {
        favorites: favorites.map((f: any) => ({
          ...f,
          metadata: f.metadata ? JSON.parse(f.metadata) : null,
        })),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/user/favorites
 * Thêm favorite
 */
router.post('/favorites', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { item_type, item_id, title, metadata } = req.body;

    if (!['product', 'kb_item', 'standard'].includes(item_type)) {
      return res.status(400).json({ success: false, error: 'item_type không hợp lệ' });
    }
    if (!item_id || !title) {
      return res.status(400).json({ success: false, error: 'item_id và title bắt buộc' });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO user_favorites (id, user_id, item_type, item_id, title, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, item_type, item_id, title, metadata ? JSON.stringify(metadata) : null, new Date().toISOString());

    return res.json({ success: true, data: { id } });
  } catch (err: any) {
    // UNIQUE constraint violation
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ success: false, error: 'Already favorited' });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/user/favorites/:id
 */
router.delete('/favorites/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    db.prepare('DELETE FROM user_favorites WHERE id = ? AND user_id = ?').run(id, userId);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/user/favorites/by-item
 * Xóa favorite theo item_type + item_id
 */
router.delete('/favorites/by-item', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { item_type, item_id } = req.query;
    if (!item_type || !item_id) {
      return res.status(400).json({ success: false, error: 'item_type và item_id bắt buộc' });
    }
    db.prepare('DELETE FROM user_favorites WHERE user_id = ? AND item_type = ? AND item_id = ?').run(
      userId,
      String(item_type),
      String(item_id)
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
