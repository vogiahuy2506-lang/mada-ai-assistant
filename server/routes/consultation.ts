import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../lib/db';
import { createMailTransport, describeMailError } from '../lib/mailer';

const router = Router();

// ============== MULTER CONFIG FOR CONSULTATION UPLOADS ==============
const CONSULTATION_UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads', 'consultations');
fs.mkdirSync(CONSULTATION_UPLOAD_DIR, { recursive: true });

const consultationStorage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => cb(null, CONSULTATION_UPLOAD_DIR),
  filename: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}_${uuidv4().slice(0, 8)}${ext}`;
    cb(null, safeName);
  },
});

const consultationUpload = multer({
  storage: consultationStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (_req: any, file: any, cb: any) => {
    // Allow common file types
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported'), false);
    }
  },
});

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

// GET /api/consultation - List all consultations (admin only)
router.get('/', requireAdmin, (req, res) => {
  try {
    const { status, limit = 100, offset = 0 } = req.query;
    
    let sql = 'SELECT * FROM consultations';
    const params: any[] = [];
    
    if (status && status !== 'all') {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    
    const consultations = db.prepare(sql).all(...params);
    
    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM consultations';
    const countParams: any[] = [];
    if (status && status !== 'all') {
      countSql += ' WHERE status = ?';
      countParams.push(status);
    }
    const { total } = db.prepare(countSql).get(...countParams) as { total: number };
    
    res.json({ success: true, data: consultations, total });
  } catch (error: any) {
    console.error('Error fetching consultations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/consultation/:id - Get single consultation
router.get('/:id', requireAdmin, (req, res) => {
  try {
    const consultation = db.prepare('SELECT * FROM consultations WHERE id = ?').get(req.params.id);
    
    if (!consultation) {
      return res.status(404).json({ success: false, error: 'Consultation not found' });
    }
    
    res.json({ success: true, data: consultation });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/consultation - Submit new consultation (public)
router.post('/', consultationUpload.array('attachments', 5), async (req: any, res: any) => {
  try {
    // Handle both multipart and JSON
    let { name, email, phone, message } = req.body;
    let attachments: any[] = [];
    
    // If multipart (file upload), parse JSON fields from body
    if (req.is('multipart/form-data')) {
      // Fields come as strings from multipart
      // Files come in req.files
      if (req.files && req.files.length > 0) {
        attachments = req.files.map((file: any) => ({
          id: uuidv4(),
          filename: file.originalname,
          filepath: file.path,
          mimetype: file.mimetype,
          size: file.size,
          url: `/api/consultation/file/${file.filename}`,
        }));
      }
      // If attachments info sent as JSON string in body
      if (req.body.attachments) {
        try {
          const existingAttachments = JSON.parse(req.body.attachments);
          attachments = [...attachments, ...existingAttachments];
        } catch (e) {
          // ignore parse error
        }
      }
    } else {
      // JSON body - attachments might be base64 or URLs
      if (req.body.attachments) {
        attachments = Array.isArray(req.body.attachments) ? req.body.attachments : [req.body.attachments];
      }
    }
    
    if (!name || !email || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name, email, and message are required' 
      });
    }
    
    const now = new Date().toISOString();
    const id = `consult-${uuidv4()}`;
    
    // Store attachments as JSON in database
    const attachmentsJson = attachments.length > 0 ? JSON.stringify(attachments) : null;
    
    db.prepare(`
      INSERT INTO consultations (id, name, email, phone, message, attachments, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(id, name, email, phone || '', message, attachmentsJson, now, now);
    
    // Log the submission
    db.prepare(`
      INSERT INTO admin_system_logs (id, level, source, message, details, timestamp)
      VALUES (?, 'info', 'consultation', ?, ?, ?)
    `).run(
      uuidv4(),
      `New consultation request from ${email}${attachments.length > 0 ? ` with ${attachments.length} attachment(s)` : ''}`,
      JSON.stringify({ name, email, hasPhone: !!phone, attachmentsCount: attachments.length }),
      now
    );

    // ========== SEND EMAIL NOTIFICATION ==========
    // Resolve admin email in this order:
    //   1. CONSULTATION_EMAIL env (highest priority)
    //   2. ADMIN_NOTIFICATION_EMAIL env
    //   3. Default: hotro.digibook@gmail.com
    const adminEmail =
      process.env.CONSULTATION_EMAIL ||
      process.env.ADMIN_NOTIFICATION_EMAIL ||
      'hotro.digibook@gmail.com';

    // Resolve site URLs (for links in email)
    const adminBaseUrl =
      process.env.ADMIN_URL ||
      process.env.BASE_URL ||
      process.env.FRONTEND_URL ||
      process.env.SITE_URL ||
      'https://mada.vn';
    const siteUrl =
      process.env.FRONTEND_URL ||
      process.env.SITE_URL ||
      process.env.BASE_URL ||
      'https://mada.vn';

    // ========== HTML SANITIZATION ==========
    // Escape HTML special characters to prevent XSS in email content
    function escapeHtml(text: string): string {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };
      return String(text).replace(/[&<>"']/g, (m) => map[m]);
    }

    // Generate reference code: REQ-XXXX (last 4 chars of UUID, uppercase)
    const refCode = `REQ-${id.slice(-4).toUpperCase()}`;
    const formattedDate = new Date(now).toLocaleString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
    const formattedDateShort = new Date(now).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Sanitize user input for email
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone || '');
    const safeMessage = escapeHtml(message);

    // Build attachments list for HTML email
    const attachmentsListHtml =
      attachments.length > 0
        ? `<div style="background: #f8f9ff; padding: 16px 20px; border-radius: 10px; margin-bottom: 24px; border: 1px solid #e8edff;">
            <p style="margin: 0 0 12px; color: #333; font-size: 14px; font-weight: 600;">📎 Đính kèm (${attachments.length} tệp)</p>
            ${attachments
              .map(
                (att: any) =>
                  `<p style="margin: 4px 0; font-size: 13px; color: #555;">• ${escapeHtml(att.filename || att.name)} (${((att.size || 0) / 1024).toFixed(1)} KB)</p>`
              )
              .join('')}
          </div>`
        : '';

    const attachmentsListText =
      attachments.length > 0
        ? `\n📎 Đính kèm (${attachments.length} tệp):\n${attachments
            .map(
              (att: any) =>
                `  • ${att.filename || att.name} (${((att.size || 0) / 1024).toFixed(1)} KB)`
            )
            .join('\n')}`
        : '';

    // Build email attachments array for nodemailer
    const emailAttachments: any[] = [];
    for (const att of attachments) {
      // Handle file path (multipart upload from disk)
      if (att.filepath && fs.existsSync(att.filepath)) {
        emailAttachments.push({
          filename: att.filename || att.name,
          path: att.filepath,
          contentType: att.mimetype || att.contentType || undefined,
        });
        console.log('📧 [EMAIL] Added file from disk:', att.filename || att.name);
      }
      // Handle base64 (JSON upload from frontend)
      else if (att.base64 && (att.name || att.filename)) {
        try {
          const filename = att.name || att.filename;
          let base64Data = att.base64;
          // Remove data URL prefix if present
          if (base64Data.includes(',')) {
            base64Data = base64Data.split(',')[1];
          }
          const buffer = Buffer.from(base64Data, 'base64');
          console.log('📧 [EMAIL] Added base64 file:', filename, '- Size:', buffer.length, 'bytes');

          emailAttachments.push({
            filename: filename,
            content: buffer,
            contentType: att.type || att.contentType || 'application/octet-stream',
          });
        } catch (e) {
          console.error('⚠️ Failed to process base64 attachment:', att.name || att.filename, e);
        }
      }
      // Handle URL-based attachments
      else if (att.url && att.url.startsWith('/api/')) {
        console.log('📧 [EMAIL] URL reference found:', att.url, '->', att.filename || att.name);
      }
    }

    // Admin email HTML template
    const adminEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f7fe;">
  <div style="background: linear-gradient(135deg, #0047ff 0%, #0052cc 100%); padding: 28px 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">🆕 New Consultation Request</h1>
    <p style="color: rgba(255,255,255,0.88); margin: 8px 0 0; font-size: 14px;">MADA AI - Technology for Disability Support</p>
  </div>
  <div style="background: white; padding: 24px 28px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 16px rgba(0,71,255,0.10);">
    <div style="background: linear-gradient(135deg, #f0f4ff 0%, #e8edff 100%); padding: 16px 20px; border-radius: 10px; margin-bottom: 24px; border-left: 4px solid #0047ff;">
      <p style="margin: 0; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Reference Code</p>
      <p style="margin: 6px 0 0; font-size: 26px; color: #0047ff; font-weight: 800; letter-spacing: 2px;">${refCode}</p>
    </div>
    <p style="margin: 0 0 20px; font-size: 15px; color: #444; line-height: 1.6;">
      Dear MADA AI Support Team,<br>
      A <strong>new consultation request</strong> has been submitted${attachments.length > 0 ? ` with <strong>${attachments.length} attachment${attachments.length > 1 ? 's' : ''}</strong>` : ''}. Please review the details below and respond promptly.
    </p>
    <h2 style="font-size: 15px; color: #333; margin: 0 0 14px; padding-bottom: 10px; border-bottom: 2px solid #0047ff; font-weight: 700;">📋 Contact Information</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td style="padding: 10px 0; color: #888; width: 110px; font-size: 14px;">Name:</td>
        <td style="padding: 10px 0; font-weight: 600; color: #222; font-size: 15px;">${safeName}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 10px 0; color: #888; font-size: 14px;">Email:</td>
        <td style="padding: 10px 0; font-size: 14px;">
          <a href="mailto:${safeEmail}" style="color: #0047ff; text-decoration: none; font-weight: 600;">${safeEmail}</a>
        </td>
      </tr>
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 10px 0; color: #888; font-size: 14px;">Phone:</td>
        <td style="padding: 10px 0; color: #333; font-size: 14px; ${!phone ? 'font-style: italic; color: #bbb;' : ''}">${safePhone || 'Not provided'}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #888; font-size: 14px;">Time:</td>
        <td style="padding: 10px 0; color: #555; font-size: 14px;">${formattedDate}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #888; font-size: 14px;">Request ID:</td>
        <td style="padding: 10px 0; color: #555; font-size: 14px; font-family: monospace;">${id}</td>
      </tr>
    </table>
    ${attachmentsListHtml}
    <h2 style="font-size: 15px; color: #333; margin: 0 0 14px; padding-bottom: 10px; border-bottom: 2px solid #0047ff; font-weight: 700;">💬 Request Content</h2>
    <div style="background: #f8f9ff; padding: 16px 20px; border-radius: 10px; margin-bottom: 24px; border: 1px solid #e8edff;">
      <p style="margin: 0; color: #333; line-height: 1.7; font-size: 14px; white-space: pre-wrap; word-break: break-word;">${safeMessage}</p>
    </div>
    <div style="background: #f8f9ff; padding: 16px 20px; border-radius: 10px; margin-bottom: 24px; border: 1px solid #e8edff;">
      <p style="margin: 0 0 8px; color: #333; font-size: 14px; font-weight: 600;">🔗 Chat History</p>
      <p style="margin: 0; color: #555; font-size: 13px;">Click the button below to view the chat history and conversation logs.</p>
      <div style="text-align: center; margin-top: 12px;">
        <a href="${adminBaseUrl}/admin/consultations" style="display: inline-block; background: #0047ff; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 13px;">View Chat History</a>
      </div>
    </div>
    <div style="text-align: center; margin-top: 28px;">
      <a href="${adminBaseUrl}/admin/consultations" style="display: inline-block; background: linear-gradient(135deg, #0047ff, #0032cc); color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(0,71,255,0.3);">⚡ View & Respond Now</a>
    </div>
    <p style="margin: 20px 0 0; font-size: 12px; color: #f39c12; text-align: center; font-weight: 600;">⏰ Please respond within 24 hours to ensure the best user experience.</p>
  </div>
  <div style="text-align: center; padding: 20px; color: #aaa; font-size: 12px;">
    <p style="margin: 0 0 4px;">This email is automatically sent from MADA AI system. Please do not reply directly to this email.</p>
    <p style="margin: 0; color: #ccc; font-size: 11px;">© ${new Date().getFullYear()} MADA AI - Technology for Disability Support</p>
  </div>
</body>
</html>`;

    const adminEmailText = `
NEW CONSULTATION REQUEST
=======================

Reference Code: ${refCode}
ID: ${id}

📋 Contact Information:
  Name:      ${name}
  Email:     ${email}
  Phone:     ${phone || 'Not provided'}
  Time:      ${formattedDate}
${attachmentsListText}

💬 Request Content:
${message}

🔗 View Details: ${adminBaseUrl}/admin/consultations
⚡ Respond Now: ${adminBaseUrl}/admin/consultations/${id}

⏰ Please respond within 24 hours.
`;

// User auto-reply email HTML template
    const userAutoReplyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f7fe;">
  <div style="background: linear-gradient(135deg, #0047ff 0%, #0052cc 100%); padding: 28px 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">✅ We Have Received Your Request</h1>
    <p style="color: rgba(255,255,255,0.88); margin: 8px 0 0; font-size: 14px;">MADA AI - Technology for Disability Support</p>
  </div>
  <div style="background: white; padding: 24px 28px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 16px rgba(0,71,255,0.10);">
    <p style="margin: 0 0 20px; font-size: 15px; color: #444; line-height: 1.6;">Hello <strong>${safeName}</strong>,</p>
    <p style="margin: 0 0 20px; font-size: 15px; color: #444; line-height: 1.6;">Thank you for contacting MADA AI. We have received your consultation request and will respond within <strong>24 hours</strong>.</p>
    <div style="background: linear-gradient(135deg, #f0f4ff 0%, #e8edff 100%); padding: 16px 20px; border-radius: 10px; margin-bottom: 24px; border-left: 4px solid #0047ff;">
      <p style="margin: 0; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Your Reference Code</p>
      <p style="margin: 6px 0 0; font-size: 26px; color: #0047ff; font-weight: 800; letter-spacing: 2px;">${refCode}</p>
    </div>
    <p style="margin: 0 0 12px; font-size: 14px; color: #555; font-weight: 600;">📋 Request Summary:</p>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 10px 0; color: #888; font-size: 14px;">Submitted at:</td>
        <td style="padding: 10px 0; color: #333; font-size: 14px;">${formattedDateShort}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #888; font-size: 14px;">Status:</td>
        <td style="padding: 10px 0;"><span style="display: inline-block; background: #fff3cd; color: #856404; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600;">⏳ Pending</span></td>
      </tr>
    </table>
    <p style="margin: 0 0 20px; font-size: 15px; color: #444; line-height: 1.6;">While waiting, you can:</p>
    <ul style="margin: 0 0 24px; padding-left: 20px; color: #444; font-size: 14px; line-height: 2;">
      <li>Visit <a href="${siteUrl}" style="color: #0047ff; text-decoration: none; font-weight: 600;">MADA AI homepage</a> to learn more about the product</li>
      <li>View <a href="${siteUrl}/faq" style="color: #0047ff; text-decoration: none; font-weight: 600;">Frequently Asked Questions (FAQ)</a></li>
      <li>Contact us directly via hotline for urgent assistance</li>
    </ul>
    <div style="text-align: center; margin-top: 28px;">
      <a href="${siteUrl}" style="display: inline-block; background: linear-gradient(135deg, #0047ff, #0032cc); color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(0,71,255,0.3);">Explore MADA AI</a>
    </div>
  </div>
  <div style="text-align: center; padding: 20px; color: #aaa; font-size: 12px;">
    <p style="margin: 0 0 4px;">If you have any questions, please reply to this email or contact our support hotline.</p>
    <p style="margin: 0; color: #ccc; font-size: 11px;">© ${new Date().getFullYear()} MADA AI - Technology for Disability Support</p>
  </div>
</body>
</html>`;

    const userAutoReplyText = `
WE HAVE RECEIVED YOUR REQUEST
===========================

Hello ${name},

Thank you for contacting MADA AI. We have received your consultation request and will respond within 24 hours.

Reference Code: ${refCode}
Submitted at: ${formattedDateShort}
Status: Pending

While waiting, you can:
  - Visit MADA AI homepage to learn more about the product
  - View Frequently Asked Questions (FAQ)
  - Contact us directly via hotline for urgent assistance

${siteUrl}
`;

    // Send email notification if SMTP is configured
    let emailSent = false;
    let emailErrorMessage: string | undefined;

    if (process.env.MAIL_HOST && process.env.MAIL_USERNAME) {
      try {
        // Dùng mailer chung (server/lib/mailer.ts) — 1 nơi duy nhất tạo transporter,
        // chuẩn hoá password, và chuẩn hoá lỗi 535 thành message dễ hiểu.
        const transporter = await createMailTransport();

        // Resolve MAIL_FROM from env, fallback to admin email
        const mailFrom =
          process.env.MAIL_FROM ||
          (adminEmail.includes('@')
            ? `MADA AI <${adminEmail}>`
            : 'MADA AI <noreply@mada.vn>');

        // === 1. Send admin notification email ===
        const adminMailOptions = {
          from: mailFrom,
          to: adminEmail,
          subject: `[MADA] New consultation request from ${name}${attachments.length > 0 ? ` [${attachments.length} attachment${attachments.length > 1 ? 's' : ''}]` : ''}`,
          html: adminEmailHtml,
          text: adminEmailText,
          attachments: emailAttachments,
          // Reply-To: set to user's email so admin can reply directly
          replyTo: email,
          // Add custom headers for tracking
          headers: {
            'X-Priority': '1',
            'X-Mailer': 'MADA AI Consultation System',
            'X-Reference-Code': refCode,
            'X-Consultation-ID': id,
            'List-Unsubscribe': `<mailto:${adminEmail}?subject=Unsubscribe>`,
          },
        };

        let adminEmailSent = false;
        let adminEmailError: any = null;

        try {
          const adminInfo = await transporter.sendMail(adminMailOptions);
          adminEmailSent = true;
          console.log(`✅ [EMAIL] Admin notification sent to ${adminEmail}, messageId: ${adminInfo.messageId}`);
        } catch (sendErr: any) {
          adminEmailError = sendErr;
          console.error('⚠️ [EMAIL] Failed to send admin notification:', describeMailError(sendErr));
          // Log detailed error for debugging
          if (process.env.NODE_ENV === 'development') {
            console.error('📧 [EMAIL ERROR DETAILS]', {
              host: process.env.MAIL_HOST,
              port: process.env.MAIL_PORT,
              user: process.env.MAIL_USERNAME,
              to: adminEmail,
              hasAttachments: emailAttachments.length,
              error: sendErr?.message,
              code: sendErr?.code,
              command: sendErr?.command,
            });
          }
        }

        // === 2. Send auto-reply confirmation email to user ===
        // Only send if user provided a valid email
        if (email && email.includes('@') && email.includes('.')) {
          try {
            const userMailOptions = {
              from: mailFrom,
              to: email,
              subject: `✅ MADA AI - We have received your request - Ref: ${refCode}`,
              html: userAutoReplyHtml,
              text: userAutoReplyText,
              headers: {
                'X-Priority': '3',
                'X-Mailer': 'MADA AI Consultation System',
                'X-Reference-Code': refCode,
                'X-Consultation-ID': id,
              },
            };

            const userInfo = await transporter.sendMail(userMailOptions);
            console.log(`✅ [EMAIL] Auto-reply sent to user ${email}, messageId: ${userInfo.messageId}`);
          } catch (userEmailErr: any) {
            // Don't fail the whole request if user auto-reply fails
            console.warn('⚠️ [EMAIL] Failed to send auto-reply to user:', describeMailError(userEmailErr));
          }
        } else {
          console.log('📧 [EMAIL] Skipping user auto-reply: no valid email provided');
        }

        // Log system event
        if (!adminEmailSent) {
          emailErrorMessage = describeMailError(adminEmailError);
          // Log failure
          db.prepare(`
            INSERT INTO admin_system_logs (id, level, source, message, details, timestamp)
            VALUES (?, 'warn', 'consultation', ?, ?, ?)
          `).run(
            uuidv4(),
            `Email notification failed for consultation ${id} from ${email}`,
            JSON.stringify({ id, email, error: emailErrorMessage, refCode }),
            now
          );
        } else {
          emailSent = true;
          db.prepare(`
            INSERT INTO admin_system_logs (id, level, source, message, details, timestamp)
            VALUES (?, 'info', 'consultation', ?, ?, ?)
          `).run(
            uuidv4(),
            `Email notification sent for consultation ${id}`,
            JSON.stringify({
              id,
              email,
              refCode,
              adminEmail,
              adminSent: adminEmailSent,
              attachmentsCount: attachments.length,
            }),
            now
          );
        }
      } catch (emailError: any) {
        emailErrorMessage = describeMailError(emailError);
        console.error('⚠️ [EMAIL] Critical error in email module:', emailErrorMessage);
        // Don't fail the consultation request if email module fails
        // The consultation is already saved to database above
      }
    } else {
      emailErrorMessage = 'SMTP chưa cấu hình (thiếu MAIL_HOST/MAIL_USERNAME/MAIL_PASSWORD)';
      console.log(`📧 [EMAIL] SMTP not configured (MAIL_HOST not set). Admin email would be: ${adminEmail}`);
      console.log(`📧 [EMAIL] User auto-reply would be sent to: ${email}`);
      console.log(`📧 [EMAIL] To enable emails, set MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD in .env`);
    }
    // ========== END EMAIL NOTIFICATION ==========

    res.status(201).json({
      success: true,
      data: {
        id,
        message: 'Consultation request submitted successfully',
        attachments: attachments.map((a: any) => ({ id: a.id, filename: a.filename, url: a.url, size: a.size })),
        // ⚠️ emailSent=false nghĩa là yêu cầu ĐÃ lưu vào DB nhưng mail KHÔNG gửi được.
        // Frontend dùng cờ này để báo admin/người dùng biết cần kiểm tra lại SMTP.
        emailSent,
        emailError: emailErrorMessage,
      }
    });
  } catch (error: any) {
    console.error('Error creating consultation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/consultation/:id - Update consultation status
router.patch('/:id', requireAdmin, (req, res) => {
  try {
    const { status, notes, assigned_to } = req.body;
    const consultation = db.prepare('SELECT * FROM consultations WHERE id = ?').get(req.params.id);
    
    if (!consultation) {
      return res.status(404).json({ success: false, error: 'Consultation not found' });
    }
    
    const updates: string[] = [];
    const params: any[] = [];
    
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      params.push(assigned_to);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No updates provided' });
    }
    
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(req.params.id);
    
    db.prepare(`UPDATE consultations SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    
    // Log the status change
    db.prepare(`
      INSERT INTO admin_system_logs (id, level, source, message, details, user_id, timestamp)
      VALUES (?, 'info', 'consultation', ?, ?, ?, ?)
    `).run(
      uuidv4(),
      `Consultation ${req.params.id} updated to ${status}`,
      JSON.stringify({ status, updatedBy: (req as any).user?.email }),
      (req as any).user?.id || 'unknown',
      new Date().toISOString()
    );
    
    const updated = db.prepare('SELECT * FROM consultations WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/consultation/:id - Delete consultation
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const consultation = db.prepare('SELECT * FROM consultations WHERE id = ?').get(req.params.id);
    
    if (!consultation) {
      return res.status(404).json({ success: false, error: 'Consultation not found' });
    }
    
    db.prepare('DELETE FROM consultations WHERE id = ?').run(req.params.id);
    
    res.json({ success: true, message: 'Consultation deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/consultation/stats/summary - Get consultation stats
router.get('/stats/summary', requireAdmin, (_req, res) => {
  try {
    const stats = {
      total: db.prepare('SELECT COUNT(*) as count FROM consultations').get() as { count: number },
      pending: db.prepare("SELECT COUNT(*) as count FROM consultations WHERE status = 'pending'").get() as { count: number },
      reviewed: db.prepare("SELECT COUNT(*) as count FROM consultations WHERE status = 'reviewed'").get() as { count: number },
      contacted: db.prepare("SELECT COUNT(*) as count FROM consultations WHERE status = 'contacted'").get() as { count: number },
    };
    
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/consultation/file/:filename - Download uploaded file
router.get('/file/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filepath = path.join(CONSULTATION_UPLOAD_DIR, filename);
    
    // Security: ensure file is within upload directory
    if (!filepath.startsWith(CONSULTATION_UPLOAD_DIR)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    res.download(filepath);
  } catch (error: any) {
    console.error('Error downloading file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
