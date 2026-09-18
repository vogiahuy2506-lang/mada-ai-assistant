import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../lib/db';
import { authenticate, requireRole } from '../lib/auth';

const router = Router();

// Middleware: require admin authentication
const requireAdmin = [authenticate, requireRole('admin', 'super_admin')];

// ============== SUGGESTED QUESTIONS CRUD ==============

// GET /api/admin/suggested-questions - Get all questions with optional filters
router.get('/', (req: Request, res: Response) => {
  try {
    const { agent_id, category, view_mode, language, is_active } = req.query;
    
    let sql = 'SELECT * FROM suggested_questions WHERE 1=1';
    const params: any[] = [];
    
    if (agent_id) {
      sql += ' AND (agent_id = ? OR agent_id IS NULL)';
      params.push(agent_id);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (view_mode) {
      sql += ' AND view_mode = ?';
      params.push(view_mode);
    }
    if (language) {
      sql += ' AND language = ?';
      params.push(language);
    }
    if (is_active !== undefined) {
      sql += ' AND is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }
    
    sql += ' ORDER BY category, view_mode, language, sort_order ASC';
    
    const questions = db.prepare(sql).all(...params);
    res.json({ success: true, data: questions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/suggested-questions/grouped - Get questions grouped by category/view_mode/language
router.get('/grouped', (req: Request, res: Response) => {
  try {
    const { agent_id } = req.query;
    
    let sql = `
      SELECT 
        category,
        view_mode,
        language,
        COUNT(*) as count,
        GROUP_CONCAT(id) as question_ids
      FROM suggested_questions
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (agent_id) {
      sql += ' AND (agent_id = ? OR agent_id IS NULL)';
      params.push(agent_id);
    }
    
    sql += ' GROUP BY category, view_mode, language ORDER BY category, view_mode, language';
    
    const grouped = db.prepare(sql).all(...params);
    res.json({ success: true, data: grouped });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/suggested-questions/for-agent - Get questions for a specific agent and context
router.get('/for-agent', (req: Request, res: Response) => {
  try {
    const { agent_id, category, view_mode, language } = req.query;
    
    if (!category) {
      return res.status(400).json({ success: false, error: 'category is required' });
    }
    
    // First try to get agent-specific questions
    let sql = `
      SELECT * FROM suggested_questions 
      WHERE category = ? 
        AND is_active = 1
    `;
    const params: any[] = [category];
    
    if (agent_id) {
      sql += ' AND (agent_id = ? OR agent_id IS NULL)';
      params.push(agent_id);
    } else {
      sql += ' AND agent_id IS NULL';
    }
    
    if (view_mode) {
      sql += ' AND view_mode = ?';
      params.push(view_mode);
    }
    
    if (language) {
      sql += ' AND language = ?';
      params.push(language);
    }
    
    sql += ' ORDER BY agent_id DESC, sort_order ASC LIMIT 10';
    
    const questions = db.prepare(sql).all(...params);
    
    // If no questions found, fall back to default (no agent_id) questions
    if (questions.length === 0 && agent_id) {
      const fallbackSql = `
        SELECT * FROM suggested_questions 
        WHERE category = ? 
          AND view_mode = ?
          AND language = ?
          AND agent_id IS NULL
          AND is_active = 1
        ORDER BY sort_order ASC LIMIT 10
      `;
      const fallback = db.prepare(fallbackSql).all(
        category,
        view_mode || 'end_user',
        language || 'vi'
      );
      res.json({ success: true, data: fallback, source: fallback.length > 0 ? 'default' : 'none' });
      return;
    }
    
    res.json({ success: true, data: questions, source: questions.length > 0 ? 'agent' : 'none' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/suggested-questions/:id
router.get('/:id', (req: Request, res: Response) => {
  try {
    const question = db.prepare('SELECT * FROM suggested_questions WHERE id = ?').get(req.params.id);
    
    if (!question) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }
    
    res.json({ success: true, data: question });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/suggested-questions - Create new question
router.post('/', requireAdmin, (req: Request, res: Response) => {
  try {
    const { agent_id, category, view_mode, language, question, sort_order, is_active } = req.body;
    
    if (!category || !question) {
      return res.status(400).json({ success: false, error: 'category and question are required' });
    }
    
    const now = new Date().toISOString();
    const id = `sq_${uuidv4().slice(0, 8)}`;
    
    db.prepare(`
      INSERT INTO suggested_questions (id, agent_id, category, view_mode, language, question, sort_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      agent_id || null,
      category,
      view_mode || 'end_user',
      language || 'vi',
      question,
      sort_order || 0,
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      now,
      now
    );
    
    const newQuestion = db.prepare('SELECT * FROM suggested_questions WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: newQuestion });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/suggested-questions/bulk - Create multiple questions at once
router.post('/bulk', requireAdmin, (req: Request, res: Response) => {
  try {
    const { questions } = req.body;
    
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, error: 'questions array is required' });
    }
    
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO suggested_questions (id, agent_id, category, view_mode, language, question, sort_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((items: any[]) => {
      for (const item of items) {
        const id = `sq_${uuidv4().slice(0, 8)}`;
        stmt.run(
          id,
          item.agent_id || null,
          item.category,
          item.view_mode || 'end_user',
          item.language || 'vi',
          item.question,
          item.sort_order || 0,
          item.is_active !== undefined ? (item.is_active ? 1 : 0) : 1,
          now,
          now
        );
      }
    });
    
    insertMany(questions);
    
    res.status(201).json({ 
      success: true, 
      message: `Created ${questions.length} questions`,
      data: { count: questions.length }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/admin/suggested-questions/:id - Update question
router.patch('/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const { agent_id, category, view_mode, language, question, sort_order, is_active } = req.body;
    
    const existing = db.prepare('SELECT * FROM suggested_questions WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }
    
    const updates: string[] = [];
    const params: any[] = [];
    
    if (agent_id !== undefined) { updates.push('agent_id = ?'); params.push(agent_id || null); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (view_mode !== undefined) { updates.push('view_mode = ?'); params.push(view_mode); }
    if (language !== undefined) { updates.push('language = ?'); params.push(language); }
    if (question !== undefined) { updates.push('question = ?'); params.push(question); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No updates provided' });
    }
    
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(req.params.id);
    
    db.prepare(`UPDATE suggested_questions SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    
    const updated = db.prepare('SELECT * FROM suggested_questions WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/admin/suggested-questions/bulk - Update multiple questions at once
router.patch('/bulk', requireAdmin, (req: Request, res: Response) => {
  try {
    const { questions } = req.body;
    
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, error: 'questions array is required' });
    }
    
    const now = new Date().toISOString();
    let updatedCount = 0;
    
    const updateMany = db.transaction((items: any[]) => {
      for (const item of items) {
        if (!item.id) continue;
        
        const existing = db.prepare('SELECT * FROM suggested_questions WHERE id = ?').get(item.id);
        if (!existing) continue;
        
        const updates: string[] = [];
        const params: any[] = [];
        
        if (item.agent_id !== undefined) { updates.push('agent_id = ?'); params.push(item.agent_id || null); }
        if (item.category !== undefined) { updates.push('category = ?'); params.push(item.category); }
        if (item.view_mode !== undefined) { updates.push('view_mode = ?'); params.push(item.view_mode); }
        if (item.language !== undefined) { updates.push('language = ?'); params.push(item.language); }
        if (item.question !== undefined) { updates.push('question = ?'); params.push(item.question); }
        if (item.sort_order !== undefined) { updates.push('sort_order = ?'); params.push(item.sort_order); }
        if (item.is_active !== undefined) { updates.push('is_active = ?'); params.push(item.is_active ? 1 : 0); }
        
        if (updates.length > 0) {
          updates.push('updated_at = ?');
          params.push(now);
          params.push(item.id);
          
          db.prepare(`UPDATE suggested_questions SET ${updates.join(', ')} WHERE id = ?`).run(...params);
          updatedCount++;
        }
      }
    });
    
    updateMany(questions);
    
    res.json({ 
      success: true, 
      message: `Updated ${updatedCount} questions`,
      data: { count: updatedCount }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/admin/suggested-questions/:id - Delete question
router.delete('/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM suggested_questions WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }
    
    db.prepare('DELETE FROM suggested_questions WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Question deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/admin/suggested-questions/bulk - Delete multiple questions
router.delete('/bulk/delete', requireAdmin, (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids array is required' });
    }
    
    const placeholders = ids.map(() => '?').join(', ');
    const result = db.prepare(`DELETE FROM suggested_questions WHERE id IN (${placeholders})`).run(...ids);
    
    res.json({ 
      success: true, 
      message: `Deleted ${result.changes} questions`,
      data: { count: result.changes }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/suggested-questions/import-defaults - Import SAMPLE_QUESTIONS from types as defaults
router.post('/import-defaults', requireAdmin, (_req: Request, res: Response) => {
  try {
    const { SAMPLE_QUESTIONS } = require('../../src/types/index.ts');
    
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO suggested_questions (id, agent_id, category, view_mode, language, question, sort_order, is_active, created_at, updated_at)
      VALUES (?, NULL, ?, ?, ?, ?, ?, 1, ?, ?)
    `);
    
    let count = 0;
    for (const [category, viewModes] of Object.entries(SAMPLE_QUESTIONS)) {
      for (const [viewMode, languages] of Object.entries(viewModes as Record<string, Record<string, string[]>>)) {
        for (const [language, questions] of Object.entries(languages)) {
          questions.forEach((q: string, idx: number) => {
            const id = `sq_default_${category}_${viewMode}_${language}_${idx + 1}`;
            stmt.run(
              id,
              category,
              viewMode,
              language,
              q,
              idx,
              now,
              now
            );
            count++;
          });
        }
      }
    }
    
    res.json({ 
      success: true, 
      message: `Imported ${count} default questions`,
      data: { count }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/suggested-questions/stats - Get statistics
router.get('/stats/all', (_req: Request, res: Response) => {
  try {
    const stats = {
      total: db.prepare('SELECT COUNT(*) as count FROM suggested_questions').get() as { count: number },
      byCategory: db.prepare(`
        SELECT category, COUNT(*) as count 
        FROM suggested_questions 
        GROUP BY category 
        ORDER BY count DESC
      `).all(),
      byViewMode: db.prepare(`
        SELECT view_mode, COUNT(*) as count 
        FROM suggested_questions 
        GROUP BY view_mode
      `).all(),
      byLanguage: db.prepare(`
        SELECT language, COUNT(*) as count 
        FROM suggested_questions 
        GROUP BY language
      `).all(),
      active: db.prepare('SELECT COUNT(*) as count FROM suggested_questions WHERE is_active = 1').get() as { count: number },
      agentSpecific: db.prepare('SELECT COUNT(*) as count FROM suggested_questions WHERE agent_id IS NOT NULL').get() as { count: number },
    };
    
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
