import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
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
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    
    if (!name || !email || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name, email, and message are required' 
      });
    }
    
    const now = new Date().toISOString();
    const id = `consult-${uuidv4()}`;
    
    db.prepare(`
      INSERT INTO consultations (id, name, email, phone, message, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(id, name, email, phone || '', message, now, now);
    
    // Log the submission
    db.prepare(`
      INSERT INTO admin_system_logs (id, level, source, message, details, timestamp)
      VALUES (?, 'info', 'consultation', ?, ?, ?)
    `).run(
      uuidv4(),
      `New consultation request from ${email}`,
      JSON.stringify({ name, email, hasPhone: !!phone }),
      now
    );

    // ========== SEND EMAIL NOTIFICATION ==========
    // Get admin email from settings or use CONSULTATION_EMAIL env / superadmin@mada.vn
    let adminEmail = 'superadmin@mada.vn'; // Default
    
    // Try to get from environment
    if (process.env.CONSULTATION_EMAIL) {
      adminEmail = process.env.CONSULTATION_EMAIL;
    }
    
    // Send email notification if SMTP is configured
    if (process.env.MAIL_HOST && process.env.MAIL_USERNAME) {
      try {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.createTransport({
          host: process.env.MAIL_HOST,
          port: parseInt(process.env.MAIL_PORT || '465'),
          secure: process.env.MAIL_SECURE === 'true',
          requireTLS: process.env.MAIL_TLS === 'true',
          auth: {
            user: process.env.MAIL_USERNAME,
            pass: process.env.MAIL_PASSWORD,
          },
        });

        const adminBaseUrl = process.env.ADMIN_URL || process.env.BASE_URL || 'https://mada.vn';
        const viewLink = `${adminBaseUrl}/admin/consultations`;
        const formattedDate = new Date(now).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        await transporter.sendMail({
          from: process.env.MAIL_FROM || 'MADA AI <noreply@mada.vn>',
          to: adminEmail,
          subject: `[MADA] New Consultation Request from ${name}`,
          html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #0047ff 0%, #0052cc 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">📋 New Consultation Request</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">MADA AI - Tech Support Assistant</p>
  </div>
  
  <!-- Content -->
  <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    
    <!-- Request ID -->
    <div style="background: #f0f4ff; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Request ID</p>
      <p style="margin: 4px 0 0; font-family: monospace; font-size: 14px; color: #0047ff; font-weight: 600;">${id}</p>
    </div>
    
    <!-- Contact Information -->
    <h2 style="font-size: 16px; color: #333; margin: 0 0 16px; padding-bottom: 8px; border-bottom: 2px solid #0047ff;">👤 Contact Information</h2>
    
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td style="padding: 8px 0; color: #666; width: 120px;">Name:</td>
        <td style="padding: 8px 0; font-weight: 600; color: #333;">${name}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Email:</td>
        <td style="padding: 8px 0;">
          <a href="mailto:${email}" style="color: #0047ff; text-decoration: none;">${email}</a>
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Phone:</td>
        <td style="padding: 8px 0; color: #333;">${phone || '<em>Not provided</em>'}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Submitted:</td>
        <td style="padding: 8px 0; color: #333;">${formattedDate}</td>
      </tr>
    </table>
    
    <!-- Request Details -->
    <h2 style="font-size: 16px; color: #333; margin: 0 0 16px; padding-bottom: 8px; border-bottom: 2px solid #0047ff;">💬 Request Details</h2>
    <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
      <p style="margin: 0; color: #333; line-height: 1.6; white-space: pre-wrap;">${message}</p>
    </div>
    
    <!-- Action Button -->
    <div style="text-align: center; margin-top: 24px;">
      <a href="${viewLink}" style="display: inline-block; background: #0047ff; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
        View Request in Admin Panel
      </a>
    </div>
  </div>
  
  <!-- Footer -->
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p style="margin: 0;">This email was automatically sent from MADA AI. Please do not reply to this email.</p>
  </div>
</body>
</html>
          `,
          text: `
NEW CONSULTATION REQUEST
========================

Request ID: ${id}
Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}
Submitted: ${formattedDate}

Message:
${message}

View details: ${viewLink}
          `,
        });
        
        console.log(`✅ Email notification sent to ${adminEmail} for consultation ${id}`);
      } catch (emailError) {
        console.error('⚠️ Failed to send email notification:', emailError);
        // Don't fail the request if email fails
      }
    } else {
      console.log(`📧 Email not configured (MAIL_HOST not set), skipping notification. Admin email would be: ${adminEmail}`);
    }
    // ========== END EMAIL NOTIFICATION ==========
    
    res.status(201).json({ success: true, data: { id, message: 'Consultation request submitted successfully' } });
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

export default router;
