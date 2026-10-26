/**
 * MADA AI - User Approval System
 * 
 * Xử lý Admin Approval Flow cho guest registrations:
 * - pending → approved/rejected
 * - Email notifications
 */

import db, { UserRow } from './db';
import { createMailTransport, describeMailError } from './mailer';
import { logActivity } from '../index';

interface ApprovalResult {
  success: boolean;
  message: string;
  userId?: string;
}

// ============== EMAIL NOTIFICATION ==============

async function sendApprovalEmail(user: UserRow, approved: boolean): Promise<void> {
  // Check if email is configured
  if (!process.env.MAIL_HOST || !process.env.MAIL_USERNAME) {
    console.log(`📧 Email not configured, skipping notification for ${user.email}`);
    return;
  }

  // Dùng mailer chung (chuẩn hoá password + lỗi 535 dễ hiểu)
  const transporter = await createMailTransport();

  const statusText = approved ? 'has been approved' : 'has been rejected';
  const statusColor = approved ? '#10B981' : '#EF4444';
  const statusIcon = approved ? '✅' : '❌';

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || 'MADA AI <noreply@mada.ai>',
      to: user.email,
      subject: `[MADA AI] Your Account ${statusText}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .status { display: inline-block; padding: 10px 20px; border-radius: 25px; font-weight: bold; color: white; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🤖 MADA AI Assistant</h1>
              <p>Assistive Technology Support</p>
            </div>
            <div class="content">
              <p>Hello <strong>${user.name}</strong>,</p>
              
              <p>${statusIcon} <strong>Your account ${statusText}!</strong></p>
              
              <p style="text-align: center; margin: 30px 0;">
                <span class="status" style="background-color: ${statusColor};">
                  ${approved ? '✅ APPROVED' : '❌ REJECTED'}
                </span>
              </p>
              
              ${approved ? `
                <p>Congratulations! Your account has been activated.</p>
                <p>You can now log in and start using MADA AI Assistant.</p>
                <p style="text-align: center; margin-top: 20px;">
                  <a href="${process.env.APP_URL || 'https://mada.ai'}/login" style="background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block;">Login Now</a>
                </p>
              ` : `
                <p>We're sorry, your account has not been approved at this time.</p>
                <p>If you have any questions, please contact us for more information.</p>
              `}
              
              <p style="margin-top: 30px; color: #666;">
                Best regards,<br>
                <strong>The MADA AI Team</strong>
              </p>
            </div>
            <div class="footer">
              <p>This is an automated email from MADA AI Assistant</p>
              <p>© ${new Date().getFullYear()} MADA AI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    logActivity('success', `Email ${approved ? 'approval' : 'rejection'} sent to ${user.email}`, 'UserApproval');
  } catch (error) {
    logActivity(
      'warn',
      `Failed to send email to ${user.email}: ${describeMailError(error)}`,
      'UserApproval'
    );
  }
}

// ============== APPROVAL FUNCTIONS ==============

/**
 * Approve a pending user
 */
export async function approveUser(userId: string, adminId: string): Promise<ApprovalResult> {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
    
    if (!user) {
      return { success: false, message: 'Không tìm thấy người dùng' };
    }

    if (user.status === 'active') {
      return { success: false, message: 'Người dùng đã được kích hoạt trước đó' };
    }

    if (user.status === 'suspended') {
      return { success: false, message: 'Không thể phê duyệt người dùng đang bị suspend' };
    }

    // Update status to active
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE users 
      SET status = 'active', updated_at = ?
      WHERE id = ?
    `).run(now, userId);

    // Log the approval
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `audit-${Date.now()}`,
      adminId,
      'USER_APPROVED',
      userId,
      JSON.stringify({ email: user.email, name: user.name }),
      now
    );

    logActivity('success', `User ${user.email} approved by admin ${adminId}`, 'UserApproval');

    // Send email notification
    await sendApprovalEmail(user, true);

    return {
      success: true,
      message: 'Người dùng đã được phê duyệt thành công',
      userId,
    };
  } catch (error) {
    logActivity('error', `Failed to approve user: ${error}`, 'UserApproval');
    return { success: false, message: `Lỗi: ${error}` };
  }
}

/**
 * Reject a pending user
 */
export async function rejectUser(userId: string, adminId: string, reason?: string): Promise<ApprovalResult> {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
    
    if (!user) {
      return { success: false, message: 'Không tìm thấy người dùng' };
    }

    // Update status to suspended (rejected)
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE users 
      SET status = 'suspended', updated_at = ?
      WHERE id = ?
    `).run(now, userId);

    // Log the rejection
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `audit-${Date.now()}`,
      adminId,
      'USER_REJECTED',
      userId,
      JSON.stringify({ email: user.email, name: user.name, reason }),
      now
    );

    logActivity('warn', `User ${user.email} rejected by admin ${adminId}${reason ? ` - Reason: ${reason}` : ''}`, 'UserApproval');

    // Send email notification
    await sendApprovalEmail(user, false);

    return {
      success: true,
      message: 'Người dùng đã bị từ chối',
      userId,
    };
  } catch (error) {
    logActivity('error', `Failed to reject user: ${error}`, 'UserApproval');
    return { success: false, message: `Lỗi: ${error}` };
  }
}

/**
 * Get pending users count
 */
export function getPendingUsersCount(): number {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM users WHERE status = 'pending'
  `).get() as { count: number };
  return result.count;
}

/**
 * Get all pending users
 */
export function getPendingUsers(): UserRow[] {
  return db.prepare(`
    SELECT * FROM users WHERE status = 'pending' ORDER BY created_at DESC
  `).all() as UserRow[];
}

/**
 * Auto-approve or notify pending users based on admin settings
 */
export function processAutoApproval(): { autoApproved: number; stillPending: number } {
  const pendingUsers = getPendingUsers();
  let autoApproved = 0;
  
  // Check if auto-approval is enabled
  const autoApproveEnabled = process.env.AUTO_APPROVE_USERS === 'true';
  
  for (const user of pendingUsers) {
    if (autoApproveEnabled) {
      // Auto-approve all pending users
      approveUser(user.id, 'system-auto-approval');
      autoApproved++;
    }
  }
  
  return {
    autoApproved,
    stillPending: pendingUsers.length - autoApproved,
  };
}
