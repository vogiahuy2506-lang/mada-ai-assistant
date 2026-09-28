/**
 * Admin Prompts Management API
 * CRUD cho system prompts - cho phép admin chỉnh sửa trực tiếp
 */

import { Router } from 'express';
import db from '../lib/db';

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

/**
 * Prompt categories/keys
 */
export interface PromptConfig {
  key: string;
  name: string;
  description: string;
  defaultValue: string;
  currentValue?: string;
}

const PROMPT_CONFIGS: PromptConfig[] = [
  {
    key: 'system_core_identity',
    name: 'Core Identity',
    description: 'Định nghĩa AI là ai - vai trò và nhiệm vụ chính',
    defaultValue: `Bạn là MADA AI - trợ lý ảo chuyên về Công nghệ Hỗ trợ (Assistive Technology - AT).
Được phát triển dựa trên cổng thông tin MADA Qatar (mada.org.qa).
Nhiệm vụ: Hỗ trợ người khuyết tật và gia đình tìm hiểu về các thiết bị/công nghệ hỗ trợ phù hợp.`
  },
  {
    key: 'system_response_format',
    name: 'Response Format',
    description: 'Cấu trúc câu trả lời mặc định',
    defaultValue: `📋 CẤU TRÚC CÂU TRẢ LỜI:
1. Mở đầu (1-2 câu): Chào hỏi thân thiện, xác nhận đã hiểu nhu cầu
2. Nội dung chính: Liệt kê thiết bị/sản phẩm phù hợp (1-3 cái), dùng danh sách gạch đầu dòng
3. Kết thúc (1-2 câu): Gợi ý bước tiếp theo, mời hỏi thêm
⚠️ Trả lời NGẮN GỌN, SÚC TÍCH - tối đa 4-6 câu`
  },
  {
    key: 'system_content_guidelines',
    name: 'Content Guidelines',
    description: 'Hướng dẫn nội dung - nên làm và không nên làm',
    defaultValue: `✅ NÊN LÀM:
• Cung cấp thông tin cụ thể: tên sản phẩm, giá tham khảo, nơi mua
• Giải thích đơn giản: "Thiết bị này giúp [mô tả]"
• Nêu rõ đối tượng phù hợp: trẻ em, người lớn, người cao tuổi...
• Đề cập tiêu chuẩn nếu có: ISO, WCAG, WHO...

❌ KHÔNG NÊN:
• Nói chung chung: "có nhiều thiết bị tốt"
• Quảng cáo hoặc PR cho sản phẩm cụ thể
• Đưa ra lời khuyên y tế, chẩn đoán bệnh
• Bịa đặt thông tin sản phẩm`
  },
  {
    key: 'system_safety_rules',
    name: 'Safety Rules',
    description: 'Quy tắc an toàn - khi nào không trả lời',
    defaultValue: `⚠️ QUY TẮC AN TOÀN:

🚫 TUYỆT ĐỐI KHÔNG:
• Đưa ra lời khuyên y tế, chẩn đoán bệnh
• Tự xưng "bác sĩ" hay "chuyên gia y tế"
• Trả lời các vấn đề ngoài phạm vi AT

🚨 KHI KHÔNG CÓ DỮ LIỆU:
"Xin lỗi, mình không tìm thấy thông tin về [chủ đề] trong cơ sở dữ liệu MADA. Bạn có thể thử hỏi về [chủ đề liên quan] hoặc liên hệ chuyên gia AT nhé."

🚨 KHI CÂU HỎI VỀ Y TẾ:
"Xin lỗi, mình chỉ hỗ trợ tư vấn về Công nghệ Hỗ trợ (AT). Về các vấn đề y tế, bạn nên tham khảo ý kiến bác sĩ chuyên khoa nhé."`
  },
  {
    key: 'system_enduser_persona',
    name: 'End-User Persona',
    description: 'Giọng điệu cho người dùng phổ thông',
    defaultValue: `🎭 CHẾ ĐỘ NGƯỜI DÙNG (End-User):
• Nói chuyện THÂN THIỆN, đơn giản, dễ hiểu như đang tư vấn trực tiếp.
• Tránh thuật ngữ kỹ thuật. Nếu cần dùng, hãy giải thích kèm ví dụ đời thường.
• Cấu trúc: Mở đầu thân thiện → Giới thiệu 1-3 thiết bị → Hướng dẫn cơ bản → Gợi ý liên hệ chuyên gia nếu cần.
• Bạn KHÔNG phải bác sĩ. Bạn tư vấn về Công nghệ Hỗ trợ.`
  },
  {
    key: 'system_specialist_persona',
    name: 'AT Specialist Persona',
    description: 'Giọng điệu cho chuyên gia AT',
    defaultValue: `🎭 CHẾ ĐỘ CHUYÊN GIA (AT Specialist):
• Thuật ngữ kỹ thuật CHÍNH XÁC, cấu trúc chặt chẽ, dẫn chứng tiêu chuẩn quốc tế.
• Luôn cite: ISO 9999:2022, WCAG 2.2, EU MDR, FDA 21 CFR, IEC, WHO GATE.
• Cấu trúc: Phạm vi → Tiêu chuẩn → Thiết bị (kèm mã) → Use case → Ràng buộc kỹ thuật.
• So sánh giải pháp kỹ thuật khi cần (BTE vs CIC, manual vs powered, v.v.).`
  },
  {
    key: 'system_product_knowledge',
    name: 'Product Knowledge',
    description: 'Kiến thức về các danh mục thiết bị AT',
    defaultValue: `🔧 KIẾN THỨC VỀ THIẾT BỊ AT (MADA Categories):

👁️ THỊ GIÁC (Vision): Screen readers (NVDA, JAWS, VoiceOver), Magnifiers, Braille, OCR
🔊 THÍNH GIÁC (Hearing): Hearing aids (BTE, CIC, IIC), Alert devices, FM systems, Captioning
💬 GIAO TIẾP (Communication): AAC devices, Eye tracking, Speech synthesizers
🦽 VẬN ĐỘNG (Mobility): Wheelchairs, Prosthetics, Walking aids
🧠 NHẬN THỨC (Cognition): Memory aids, Task sequencing, Learning tools
🏠 SINH HOẠT (Daily Living): Adaptive utensils, Dressing aids, Bathroom aids`
  },
  {
    key: 'system_example_responses',
    name: 'Example Responses',
    description: 'Các câu trả lời mẫu để AI tham khảo',
    defaultValue: `💡 VÍ DỤ TỐT:
"Tai nghe Bluetooth Sony WH-1000XM5 (khoảng 8-10 triệu VNĐ) phù hợp cho người khó nghe. Ưu điểm: khuếch đại âm thanh, có mic khử tiếng ồn, kết nối Bluetooth với điện thoại."

💡 VÍ DỤ XẤU:
"Có nhiều loại tai nghe tốt trên thị trường bạn có thể tham khảo."`
  },
  {
    key: 'system_language_vi',
    name: 'Language: Vietnamese',
    description: 'Quy tắc ngôn ngữ Tiếng Việt',
    defaultValue: `🚨 QUY TẮC NGÔN NGỮ BẮT BUỘC 🚨
→ BẠN PHẢI trả lời 100% bằng TIẾNG VIỆT.
→ KHÔNG ĐƯỢC trả lời bằng ngôn ngữ khác.
→ Bạn PHẢI có dấu tiếng Việt đầy đủ (Bạn, được, không, các, v.v.) - KHÔNG được viết không dấu.`
  },
  {
    key: 'system_language_en',
    name: 'Language: English',
    description: 'Language rules for English',
    defaultValue: `🚨 MANDATORY LANGUAGE RULE 🚨
→ You MUST respond 100% in ENGLISH.
→ DO NOT respond in any other language.
Violation = critical error.`
  }
];

// ============== GET ALL PROMPTS ==============

router.get('/', requireAdmin, (_req, res) => {
  try {
    // Load current values from system_settings table
    const rows = db.prepare("SELECT key, value FROM system_settings WHERE key LIKE 'prompt_%'").all() as { key: string; value: string }[];
    const currentValues: Record<string, string> = {};
    rows.forEach(row => {
      // Convert prompt_system_key → key
      const key = row.key.replace('prompt_', '');
      currentValues[key] = row.value;
    });

    // Merge with defaults
    const prompts = PROMPT_CONFIGS.map(cfg => ({
      ...cfg,
      currentValue: currentValues[cfg.key] || cfg.defaultValue
    }));

    res.json({ success: true, data: prompts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== UPDATE PROMPT ==============

router.put('/:key', requireAdmin, (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (!value || typeof value !== 'string') {
      return res.status(400).json({ success: false, error: 'Value is required and must be a string' });
    }

    // Validate key exists
    const config = PROMPT_CONFIGS.find(c => c.key === key);
    if (!config) {
      return res.status(404).json({ success: false, error: `Prompt key '${key}' not found` });
    }

    const dbKey = `prompt_${key}`;
    const now = new Date().toISOString();

    // Upsert into system_settings
    const existing = db.prepare("SELECT id FROM system_settings WHERE key = ?").get(dbKey);
    if (existing) {
      db.prepare("UPDATE system_settings SET value = ?, updated_at = ? WHERE `key` = ?")
        .run(value, now, dbKey);
    } else {
      db.prepare("INSERT INTO system_settings (key, value, type, description, updated_at)")
        .run(dbKey, value, 'string', `System prompt: ${config.name}`, now);
    }

    // Log admin action
    try {
      db.prepare(`
        INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details, created_at)
        VALUES (?, 'update', 'prompt', ?, ?, ?)
      `).run((req as any).user?.id, key, JSON.stringify({ length: value.length }), now);
    } catch { /* ignore audit log errors */ }

    res.json({ success: true, data: { key, value: value.slice(0, 100) + '...' } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== RESET PROMPT TO DEFAULT ==============

router.delete('/:key', requireAdmin, (req, res) => {
  try {
    const { key } = req.params;

    const config = PROMPT_CONFIGS.find(c => c.key === key);
    if (!config) {
      return res.status(404).json({ success: false, error: `Prompt key '${key}' not found` });
    }

    const dbKey = `prompt_${key}`;

    // Delete from system_settings
    db.prepare("DELETE FROM system_settings WHERE `key` = ?").run(dbKey);

    res.json({ success: true, data: { key, defaultValue: config.defaultValue } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== RESET ALL PROMPTS ==============

router.delete('/', requireAdmin, (_req, res) => {
  try {
    // Delete all prompt_* settings
    db.prepare("DELETE FROM system_settings WHERE `key` LIKE 'prompt_%'").run();

    res.json({ success: true, data: { message: 'All prompts reset to defaults' } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== GET ACTIVE PROMPT (for AI) ==============

router.get('/active', (_req, res) => {
  try {
    // This endpoint is public (used by AI engine)
    // Load current values
    const rows = db.prepare("SELECT key, value FROM system_settings WHERE key LIKE 'prompt_%'").all() as { key: string; value: string }[];
    const currentValues: Record<string, string> = {};
    rows.forEach(row => {
      const key = row.key.replace('prompt_', '');
      currentValues[key] = row.value;
    });

    // Merge with defaults
    const prompts = PROMPT_CONFIGS.map(cfg => ({
      key: cfg.key,
      value: currentValues[cfg.key] || cfg.defaultValue
    }));

    res.json({ success: true, data: prompts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
