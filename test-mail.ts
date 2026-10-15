import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
dotenv.config();

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

console.log('MAIL_HOST:', process.env.MAIL_HOST);
console.log('MAIL_PORT:', process.env.MAIL_PORT);
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
