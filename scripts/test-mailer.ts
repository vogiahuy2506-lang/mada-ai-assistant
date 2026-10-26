/**
 * Kiểm tra end-to-end luồng gửi mail yêu cầu tư vấn.
 * Chạy: npx tsx scripts/test-mailer.ts
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createMailTransport, verifyMailConnection, getMailStatus } from '../server/lib/mailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

async function main() {
  console.log('=== 1. Verify SMTP ===');
  const status = await verifyMailConnection();
  console.log('status:', JSON.stringify(status, null, 2));

  console.log('\n=== 2. Gửi mail thật ===');
  try {
    const transporter = await createMailTransport();
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: process.env.CONSULTATION_EMAIL || 'hotro.digibook@gmail.com',
      subject: '[MADA] Test end-to-end mailer',
      text: `Test lúc ${new Date().toISOString()}`,
    });
    console.log('✅ SEND OK:', info.messageId);
    console.log('   response:', info.response);
  } catch (error: any) {
    console.log('❌ SEND FAIL:', error.message);
  }

  console.log('\n=== 3. Status sau khi gửi ===');
  console.log(JSON.stringify(getMailStatus(), null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
