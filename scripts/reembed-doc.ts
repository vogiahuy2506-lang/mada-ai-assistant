/**
 * Re-embed 1 tài liệu cụ thể trong vector store.
 *
 * ⚠️ VÌ SAO CẦN:
 * Chạy `tsx -e "import { vectorStore } ..."` sẽ KHÔNG load dotenv → không có
 * GEMINI_API_KEY → `addDocuments()` ghi `embedding: []`, làm doc đó mất khả năng
 * vector search (vẫn còn trong BM25 nhưng chỉ khớp từ khóa thô).
 *
 * Script này nạp dotenv TRƯỚC rồi mới index → embedding thật.
 *
 * Usage:
 *   npx tsx scripts/reembed-doc.ts kbitem_kb-iso9999 "nội dung mới" "Tiêu đề mới"
 */

import path from 'path';
import dotenv from 'dotenv';

const ROOT = process.cwd();
dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config();

async function main() {
  const [id, content, title] = process.argv.slice(2);

  if (!id) {
    console.error('Usage: npx tsx scripts/reembed-doc.ts <docId> [content] [title]');
    process.exit(1);
  }

  const { vectorStore, getEmbeddingProvider } = await import('../server/lib/rag/vectorStore');
  await vectorStore.initialize();

  const provider = getEmbeddingProvider();
  if (!provider) {
    console.error('❌ Không có GEMINI_API_KEY — không embed được.');
    console.error('   Kiểm tra .env có GEMINI_API_KEY hợp lệ (>= 30 ký tự).');
    process.exit(1);
  }

  // Lấy metadata cũ để giữ nguyên botId/madaCategory/category
  const fs = await import('fs');
  const docsPath = path.join(ROOT, 'data', 'chroma', 'documents.json');
  const all = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));
  const prev = all.find((d: any) => d.id === id);
  const metadata = { ...((prev && prev.metadata) || {}), ...(title ? { title } : {}) };
  if (title) metadata.title = title;

  const body = content || (prev && prev.content);
  if (!body) {
    console.error(`❌ Không tìm thấy doc "${id}" trong vector store và không truyền content.`);
    process.exit(1);
  }

  await vectorStore.addDocuments([{ id, content: body, metadata }]);

  // Verify embedding thật
  const after = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));
  const saved = after.find((d: any) => d.id === id);
  const dim = saved && Array.isArray(saved.embedding) ? saved.embedding.length : 0;

  console.log(`✅ Re-embed "${id}"`);
  console.log(`   title:    ${metadata.title || '(giữ nguyên)'}`);
  console.log(`   content:  ${String(body).length} ký tự`);
  console.log(`   embedding: ${dim} chiều ${dim > 0 ? '✅' : '❌ vẫn rỗng!'}`);

  process.exit(dim > 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});