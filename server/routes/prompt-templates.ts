/**
 * Prompt Templates & Versions Management API
 * 
 * - GET /api/admin/prompt-templates - Danh sách templates
 * - POST /api/admin/prompt-templates - Tạo template mới
 * - PUT /api/admin/prompt-templates/:id - Cập nhật template
 * - DELETE /api/admin/prompt-templates/:id - Xóa template
 * - POST /api/admin/prompt-templates/:id/apply - Áp dụng template vào prompt
 * 
 * - GET /api/admin/prompt-versions/:promptId - Lịch sử phiên bản
 * - POST /api/admin/prompt-versions/:promptId/restore/:versionId - Khôi phục phiên bản
 * 
 * - POST /api/admin/prompts/test - Test prompt với câu hỏi mẫu
 * - POST /api/admin/prompts/validate - Validate prompt content
 */

import { Router } from 'express';
import db from '../lib/db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Middleware: require admin authentication
function requireAdmin(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const token = auth.split(' ')[1];
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    if (payload.role !== 'admin' && payload.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

// ============== PROMPT TEMPLATES ==============

/**
 * GET /api/admin/prompt-templates
 * Lấy danh sách tất cả templates
 */
router.get('/', requireAdmin, (req, res) => {
  try {
    const { category, language, featured, search } = req.query;
    
    let query = 'SELECT * FROM prompt_templates WHERE is_active = 1';
    const params: any[] = [];
    
    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    
    if (language && language !== 'all') {
      query += ' AND language = ?';
      params.push(language);
    }
    
    if (featured === 'true') {
      query += ' AND is_featured = 1';
    }
    
    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ' ORDER BY is_featured DESC, use_count DESC, name ASC';
    
    const templates = db.prepare(query).all(...params) as any[];
    
    // Parse JSON fields
    const result = templates.map(t => ({
      ...t,
      tags: t.tags ? JSON.parse(t.tags) : [],
      variables: t.variables ? JSON.parse(t.variables) : [],
      example_questions: t.example_questions ? JSON.parse(t.example_questions) : [],
    }));
    
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[promptTemplates] GET / error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/prompt-templates/:id
 * Lấy chi tiết một template
 */
router.get('/:id', requireAdmin, (req, res) => {
  try {
    const template = db.prepare('SELECT * FROM prompt_templates WHERE id = ? AND is_active = 1').get(req.params.id) as any;
    
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    
    // Increment use_count
    db.prepare('UPDATE prompt_templates SET use_count = use_count + 1 WHERE id = ?').run(req.params.id);
    
    const result = {
      ...template,
      tags: template.tags ? JSON.parse(template.tags) : [],
      variables: template.variables ? JSON.parse(template.variables) : [],
      example_questions: template.example_questions ? JSON.parse(template.example_questions) : [],
    };
    
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[promptTemplates] GET /:id error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/prompt-templates
 * Tạo template mới
 */
router.post('/', requireAdmin, (req, res) => {
  try {
    const { id, name, description, prompt, category, language, tags, variables, example_questions, is_featured } = req.body;
    
    if (!id || !name || !prompt) {
      return res.status(400).json({ success: false, error: 'ID, name, and prompt are required' });
    }
    
    // Check if ID already exists
    const existing = db.prepare('SELECT id FROM prompt_templates WHERE id = ?').get(id);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Template ID already exists' });
    }
    
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO prompt_templates (id, name, description, prompt, category, language, tags, variables, example_questions, is_featured, is_active, use_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
    `).run(
      id,
      name,
      description || '',
      prompt,
      category || 'general',
      language || 'vi',
      JSON.stringify(tags || []),
      JSON.stringify(variables || []),
      JSON.stringify(example_questions || []),
      is_featured ? 1 : 0,
      now,
      now
    );
    
    res.status(201).json({ success: true, data: { id, name } });
  } catch (error: any) {
    console.error('[promptTemplates] POST error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/prompt-templates/:id
 * Cập nhật template
 */
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const { name, description, prompt, category, language, tags, variables, example_questions, is_featured } = req.body;
    
    const existing = db.prepare('SELECT * FROM prompt_templates WHERE id = ? AND is_active = 1').get(req.params.id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    
    const now = new Date().toISOString();
    
    db.prepare(`
      UPDATE prompt_templates SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        prompt = COALESCE(?, prompt),
        category = COALESCE(?, category),
        language = COALESCE(?, language),
        tags = COALESCE(?, tags),
        variables = COALESCE(?, variables),
        example_questions = COALESCE(?, example_questions),
        is_featured = COALESCE(?, is_featured),
        updated_at = ?
      WHERE id = ?
    `).run(
      name,
      description,
      prompt,
      category,
      language,
      tags ? JSON.stringify(tags) : null,
      variables ? JSON.stringify(variables) : null,
      example_questions ? JSON.stringify(example_questions) : null,
      is_featured !== undefined ? (is_featured ? 1 : 0) : null,
      now,
      req.params.id
    );
    
    res.json({ success: true, data: { id: req.params.id, updated_at: now } });
  } catch (error: any) {
    console.error('[promptTemplates] PUT error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/prompt-templates/:id
 * Xóa template (soft delete)
 */
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM prompt_templates WHERE id = ? AND is_active = 1').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    
    db.prepare('UPDATE prompt_templates SET is_active = 0, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), req.params.id);
    
    res.json({ success: true, data: { message: 'Template deleted' } });
  } catch (error: any) {
    console.error('[promptTemplates] DELETE error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/prompt-templates/:id/apply
 * Áp dụng template vào một prompt hiện có
 */
router.post('/:id/apply', requireAdmin, (req, res) => {
  try {
    const { target_prompt_id, change_summary } = req.body;
    
    if (!target_prompt_id) {
      return res.status(400).json({ success: false, error: 'target_prompt_id is required' });
    }
    
    const template = db.prepare('SELECT * FROM prompt_templates WHERE id = ? AND is_active = 1').get(req.params.id) as any;
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    
    const prompt = db.prepare('SELECT * FROM admin_prompts WHERE id = ?').get(target_prompt_id) as any;
    if (!prompt) {
      return res.status(404).json({ success: false, error: 'Target prompt not found' });
    }
    
    const now = new Date().toISOString();
    
    // Save current version to history before updating
    const lastVersion = db.prepare('SELECT MAX(version) as max_v FROM prompt_versions WHERE prompt_id = ?').get(target_prompt_id) as any;
    const newVersion = (lastVersion?.max_v || 0) + 1;
    
    db.prepare(`
      INSERT INTO prompt_versions (id, prompt_id, version, prompt, change_summary, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      target_prompt_id,
      newVersion,
      prompt.prompt,
      change_summary || `Áp dụng template: ${template.name}`,
      req.user?.id || 'system',
      now
    );
    
    // Update the prompt with template content
    db.prepare('UPDATE admin_prompts SET prompt = ?, updated_at = ? WHERE id = ?')
      .run(template.prompt, now, target_prompt_id);
    
    // Increment template use_count
    db.prepare('UPDATE prompt_templates SET use_count = use_count + 1 WHERE id = ?').run(req.params.id);
    
    res.json({ 
      success: true, 
      data: { 
        message: 'Template applied successfully',
        prompt_id: target_prompt_id,
        version: newVersion,
        template_id: template.id
      } 
    });
  } catch (error: any) {
    console.error('[promptTemplates] POST apply error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== PROMPT VERSIONS ==============

/**
 * GET /api/admin/prompt-versions/:promptId
 * Lấy lịch sử phiên bản của một prompt
 */
router.get('/versions/:promptId', requireAdmin, (req, res) => {
  try {
    const versions = db.prepare(`
      SELECT pv.*, u.name as created_by_name
      FROM prompt_versions pv
      LEFT JOIN admin_users u ON pv.created_by = u.id
      WHERE pv.prompt_id = ?
      ORDER BY pv.version DESC
    `).all(req.params.promptId);
    
    res.json({ success: true, data: versions });
  } catch (error: any) {
    console.error('[promptVersions] GET error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/prompt-versions/:promptId/restore/:versionId
 * Khôi phục phiên bản cũ
 */
router.post('/versions/:promptId/restore/:versionId', requireAdmin, (req, res) => {
  try {
    const { promptId, versionId } = req.params;
    
    const version = db.prepare('SELECT * FROM prompt_versions WHERE id = ? AND prompt_id = ?').get(versionId, promptId) as any;
    if (!version) {
      return res.status(404).json({ success: false, error: 'Version not found' });
    }
    
    const prompt = db.prepare('SELECT * FROM admin_prompts WHERE id = ?').get(promptId) as any;
    if (!prompt) {
      return res.status(404).json({ success: false, error: 'Prompt not found' });
    }
    
    const now = new Date().toISOString();
    
    // Save current version first
    const lastVersion = db.prepare('SELECT MAX(version) as max_v FROM prompt_versions WHERE prompt_id = ?').get(promptId) as any;
    const newVersion = (lastVersion?.max_v || 0) + 1;
    
    db.prepare(`
      INSERT INTO prompt_versions (id, prompt_id, version, prompt, change_summary, created_by, created_at, is_restored)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      uuidv4(),
      promptId,
      newVersion,
      prompt.prompt,
      `Khôi phục từ phiên bản ${version.version}`,
      req.user?.id || 'system',
      now
    );
    
    // Restore the old content
    db.prepare('UPDATE admin_prompts SET prompt = ?, updated_at = ? WHERE id = ?')
      .run(version.prompt, now, promptId);
    
    res.json({ 
      success: true, 
      data: { 
        message: 'Version restored successfully',
        restored_version: version.version,
        new_version: newVersion
      } 
    });
  } catch (error: any) {
    console.error('[promptVersions] POST restore error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== PROMPT VALIDATION & TESTING ==============

/**
 * POST /api/admin/prompts/validate
 * Validate prompt content
 */
router.post('/validate', requireAdmin, (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt content is required' });
    }
    
    const issues: Array<{ type: string; message: string; severity: 'error' | 'warning' | 'info' }> = [];
    
    // Check 1: Language rule presence
    if (!prompt.match(/tiếng việt|tiếng anh|ngôn ngữ|language rule|ngôn ngữ bắt buộc/i)) {
      issues.push({
        type: 'missing_language_rule',
        message: 'Nên có quy tắc ngôn ngữ (language rule) trong prompt',
        severity: 'warning'
      });
    }
    
    // Check 2: Safety rule presence
    if (!prompt.match(/không được|đừng|tuyệt đối không|do not|dont|danger|safety|an toàn/i)) {
      issues.push({
        type: 'missing_safety_rule',
        message: 'Nên có quy tắc an toàn (safety rules) trong prompt',
        severity: 'warning'
      });
    }
    
    // Check 3: Response format structure
    if (!prompt.match(/cấu trúc|structure|📋|format|trả lời|response/i)) {
      issues.push({
        type: 'missing_response_format',
        message: 'Nên có hướng dẫn về cấu trúc câu trả lời',
        severity: 'info'
      });
    }
    
    // Check 4: Too short
    if (prompt.length < 100) {
      issues.push({
        type: 'too_short',
        message: `Prompt quá ngắn (${prompt.length} ký tự). Nên có ít nhất 200-500 ký tự để hướng dẫn AI hiệu quả.`,
        severity: 'error'
      });
    }
    
    // Check 5: Too long
    if (prompt.length > 10000) {
      issues.push({
        type: 'too_long',
        message: `Prompt khá dài (${prompt.length} ký tự). Cân nhắc rút gọn để tránh ảnh hưởng đến hiệu suất AI.`,
        severity: 'warning'
      });
    }
    
    // Check 6: Placeholder check
    const placeholders = prompt.match(/\{\{[^}]+\}\}/g);
    if (placeholders && placeholders.length > 0) {
      issues.push({
        type: 'has_placeholders',
        message: `Prompt chứa ${placeholders.length} placeholder(s): ${placeholders.join(', ')}. Hãy đảm bảo chúng được thay thế khi sử dụng.`,
        severity: 'info'
      });
    }
    
    // Check 7: Potential conflicting instructions
    if (prompt.match(/trả lời (bằng|tất cả) (tiếng việt|tiếng anh)/gi)) {
      const matches = prompt.match(/trả lời (bằng|tất cả) (tiếng việt|tiếng anh)/gi);
      const uniqueMatches = [...new Set(matches || [])];
      if (uniqueMatches.length > 1) {
        issues.push({
          type: 'conflicting_language',
          message: 'Phát hiện hướng dẫn ngôn ngữ có thể mâu thuẫn. Kiểm tra lại quy tắc ngôn ngữ.',
          severity: 'warning'
        });
      }
    }
    
    const hasErrors = issues.some(i => i.severity === 'error');
    const hasWarnings = issues.some(i => i.severity === 'warning');
    
    res.json({
      success: true,
      data: {
        valid: !hasErrors,
        issues,
        stats: {
          length: prompt.length,
          wordCount: prompt.split(/\s+/).length,
          lineCount: prompt.split('\n').length,
          hasPlaceholders: placeholders ? placeholders.length : 0
        }
      }
    });
  } catch (error: any) {
    console.error('[prompts] POST validate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/prompts/test
 * Test prompt với câu hỏi mẫu (simulate AI response)
 */
router.post('/test', requireAdmin, (req, res) => {
  try {
    const { prompt, question, language } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt is required' });
    }
    
    // This is a simulation endpoint - in production, this would call the actual AI
    // For now, we return a simulated response structure
    
    const simulationResult = {
      system_prompt: prompt,
      test_question: question || 'Test question not provided',
      simulated_structure: {
        steps: [
          '1. Parse system prompt instructions',
          '2. Analyze user question',
          '3. Search knowledge base for relevant products',
          '4. Generate response following format guidelines',
          '5. Apply language rules',
          '6. Return response'
        ],
        expected_format: {
          greeting: 'Friendly opening confirming understanding',
          content: '1-3 device recommendations with bullet points',
          closing: 'Suggest next steps and invite follow-up'
        },
        language_applied: language || 'vi',
        safety_check: prompt.match(/y tế|medical|chẩn đoán/i) ? 'Safety rules present' : 'No medical safety rules found'
      },
      validation: {
        prompt_length: prompt.length,
        has_language_rule: !!prompt.match(/ngôn ngữ|language rule/i),
        has_safety_rule: !!prompt.match(/an toàn|safety|không được/i),
        has_format_guide: !!prompt.match(/cấu trúc|structure|format/i),
        recommended_test_questions: question ? [] : [
          'Cho tôi xin thiết bị AT cho người khiếm thị',
          'Cách sử dụng phần mềm NVDA',
          'Thiết bị hỗ trợ người điếc giao tiếp'
        ]
      }
    };
    
    res.json({
      success: true,
      data: simulationResult
    });
  } catch (error: any) {
    console.error('[prompts] POST test error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
