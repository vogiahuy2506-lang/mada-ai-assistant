/**
 * MADA AI - Shared Mailer (SMTP)
 *
 * ⚠️ VÌ SAO CẦN FILE NÀY:
 * Trước đây mỗi nơi (consultation.ts, user-approval.ts, index.ts) tự tạo
 * transporter riêng → cùng một lỗi cấu hình SMTP bị xử lý 3 nơi khác nhau,
 * và lỗi "535 authentication failed" chỉ hiện 1 dòng log rồi bị nuốt
 * (consultation vẫn trả 201 → tưởng đã gửi mail thành công).
 *
 * File này gom:
 *   1. Tạo transporter đúng chuẩn (SSL 465 / STARTTLS 587).
 *   2. `verifyMailConnection()` — kiểm tra SMTP đăng nhập được hay không,
 *      chạy 1 lần lúc server boot và trả kết quả để /api/health báo cáo.
 *   3. Chuẩn hoá lỗi 535 thành message tiếng Việt dễ hiểu.
 */

import type { Transporter } from 'nodemailer';

export interface MailConfigStatus {
  configured: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  /** true nếu SMTP đã verify + đăng nhập thành công */
  verified: boolean;
  /** message lỗi gần nhất (nếu có) */
  lastError?: string;
  checkedAt?: string;
}

let cachedStatus: MailConfigStatus | null = null;

/**
 * Chuẩn hoá mật khẩu: bỏ khoảng trắng thừa + bỏ dấu ngoặc kép thừa.
 *
 * VÌ SAO CẦN: GitHub Actions secret / file .env hay bị dính khoảng trắng
 * hoặc dấu " quanh giá trị. SMTP server sẽ trả về
 * "535 5.7.8 authentication failed" — rất khó đoán nguyên nhân.
 */
export function normalizeMailPassword(raw?: string): string {
  if (!raw) return '';
  let value = raw.trim();
  // Bỏ dấu nháy bao ngoài nếu có (vd: "abc123")
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
    (value.startsWith("'") && value.endsWith("'") && value.length > 1)
  ) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

export function getMailConfig(): {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  username: string;
  password: string;
  from: string;
} | null {
  const host = process.env.MAIL_HOST?.trim();
  const username = process.env.MAIL_USERNAME?.trim();
  const password = normalizeMailPassword(process.env.MAIL_PASSWORD);

  if (!host || !username || !password) return null;

  const port = parseInt(process.env.MAIL_PORT || '465', 10);
  const isSSLMail = port === 465;

  return {
    host,
    port,
    secure: isSSLMail,
    requireTLS: !isSSLMail && process.env.MAIL_TLS === 'true',
    username,
    password,
    from: process.env.MAIL_FROM?.trim() || username,
  };
}

/** Tạo transporter dùng chung cho mọi nơi gửi mail. */
export async function createMailTransport(): Promise<Transporter> {
  const nodemailer = await import('nodemailer');
  const cfg = getMailConfig();

  if (!cfg) {
    throw new Error(
      'SMTP chưa được cấu hình. Thiếu MAIL_HOST / MAIL_USERNAME / MAIL_PASSWORD trong .env'
    );
  }

  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    requireTLS: cfg.requireTLS,
    tls: {
      // Mặc định chấp nhận self-signed (mail.digiso.vn dùng cert nội bộ).
      // Đặt MAIL_TLS_REJECT_UNAUTHORIZED=true nếu dùng cert công cộng.
      rejectUnauthorized: process.env.MAIL_TLS_REJECT_UNAUTHORIZED !== 'false',
    },
    auth: {
      user: cfg.username,
      pass: cfg.password,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateLimit: 10,
  });
}

/** Chuyển lỗi SMTP kỹ thuật thành message dễ hành động. */
export function describeMailError(error: any): string {
  const raw = error?.message || String(error);
  const code = error?.code || '';

  if (/535|authentication failed|Invalid login/i.test(raw)) {
    return (
      `SMTP đăng nhập thất bại (535) cho user "${process.env.MAIL_USERNAME?.trim() || '?'}". ` +
      `MAIL_USERNAME/MAIL_PASSWORD trên server KHÔNG khớp với tài khoản mail. ` +
      `→ Kiểm tra lại MAIL_PASSWORD (đúng với mail.digiso.vn) và deploy lại. Lỗi gốc: ${raw}`
    );
  }
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(code + raw)) {
    return `Không kết nối được SMTP server ${process.env.MAIL_HOST}: ${raw}`;
  }
  if (/535|auth/i.test(raw)) {
    return `SMTP auth lỗi (${code}): ${raw}`;
  }
  return raw;
}

/**
 * Kiểm tra kết nối SMTP (đăng nhập + EHLO). Gọi 1 lần lúc boot.
 * Không throw — chỉ cập nhật cachedStatus để /api/health báo cáo.
 */
export async function verifyMailConnection(): Promise<MailConfigStatus> {
  const cfg = getMailConfig();

  if (!cfg) {
    cachedStatus = {
      configured: false,
      host: process.env.MAIL_HOST?.trim() || '',
      port: parseInt(process.env.MAIL_PORT || '465', 10),
      secure: parseInt(process.env.MAIL_PORT || '465', 10) === 465,
      username: process.env.MAIL_USERNAME?.trim() || '',
      verified: false,
      lastError: 'Thiếu MAIL_HOST / MAIL_USERNAME / MAIL_PASSWORD trong .env',
      checkedAt: new Date().toISOString(),
    };
    console.warn('📧 [MAIL] Chưa cấu hình SMTP — sẽ KHÔNG gửi được mail thông báo.');
    return cachedStatus;
  }

  try {
    const transporter = await createMailTransport();
    await transporter.verify();
    cachedStatus = {
      configured: true,
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      username: cfg.username,
      verified: true,
      checkedAt: new Date().toISOString(),
    };
    console.log(
      `📧 [MAIL] SMTP OK — ${cfg.username}@${cfg.host}:${cfg.port} (${cfg.secure ? 'SSL' : 'STARTTLS'})`
    );
  } catch (error: any) {
    const message = describeMailError(error);
    cachedStatus = {
      configured: true,
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      username: cfg.username,
      verified: false,
      lastError: message,
      checkedAt: new Date().toISOString(),
    };
    console.error(`❌ [MAIL] SMTP KHÔNG DÙNG ĐƯỢC: ${message}`);
    console.error(
      '   → Mail thông báo (yêu cầu tư vấn, duyệt tài khoản) sẽ KHÔNG được gửi. ' +
        'Sửa MAIL_PASSWORD/MAIL_USERNAME rồi deploy lại.'
    );
  }

  return cachedStatus;
}

/** Trạng thái mail hiện tại (đã verify gần nhất). */
export function getMailStatus(): MailConfigStatus | null {
  return cachedStatus;
}
