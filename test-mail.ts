import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
dotenv.config();

// mail.digiso.vn uses SSL on port 465
// - Port 465: implicit SSL, use secure: true
// - Port 587: STARTTLS, use requireTLS: true
const mailPort = parseInt(process.env.MAIL_PORT || '465', 10);
const isSSLMail = mailPort === 465;

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: mailPort,
  secure: isSSLMail, // true for port 465 (implicit SSL)
  requireTLS: !isSSLMail && process.env.MAIL_TLS === 'true', // STARTTLS for other ports
  tls: {
    rejectUnauthorized: process.env.MAIL_TLS_REJECT_UNAUTHORIZED !== 'false',
  },
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 30000,
});

console.log('MAIL_HOST:', process.env.MAIL_HOST);
console.log('MAIL_PORT:', mailPort);
console.log('MAIL_SECURE:', isSSLMail);
console.log('MAIL_USERNAME:', process.env.MAIL_USERNAME);
console.log('---');

(async () => {
  try {
    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP verified successfully');

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: 'hotro.digibook@gmail.com',
      subject: '[MADA TEST] Direct Test Email',
      text: 'This is a direct test from test-mail.ts',
    });
    console.log('✅ Email sent:', info.messageId);
  } catch (err: any) {
    console.error('❌ Error:', err.message);
    console.error('Code:', err.code);
    console.error('Command:', err.command);
  }
})();
