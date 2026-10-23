/**
 * Rebuild vector store từ `kb_products` với metadata ĐÚNG.
 *
 * ⚠️ VÝ SAO CẦN:
 * Vector store cũ chứa 62 docs mà:
 *   - `content` = chuỗi vô nghĩa ("Operating System: Other ISO codes: []")
 *   - `metadata.category` = 'general'
 *   - KHÔNG có `botId` / `madaCategory`
 *
 * `ragEngine.retrieveDocuments` lọc theo `{ botId, madaCategory }` → khớp 0/62
 * → RAG không có context → bot trả lời "không có thông tin chi tiết".
 *
 * Script này:
 *   1. Xoá toàn bộ docs cũ trong vector store
 *   2. Index lại từ `kb_products` (chỉ dòng có nội dung thật)
 *   3. Gắn metadata.botId + metadata.madaCategory đúng theo category
 *
 * Usage:
 *   npx tsx scripts/reindex-products.ts            # reindex sản phẩm
 *   npx tsx scripts/reindex-products.ts --all      # reindex toàn bộ (kể cả KB manual)
 */

import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'mada.db');

dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config();

/** Dùng chung bảng mapping của server để botId luôn khớp runtime */
import { resolveProductOwner } from '../server/lib/categoryMapping';
import { botsForProduct } from '../server/lib/productTaxonomy';
import { AGENT_TO_MADA } from '../server/lib/categoryMapping';

/** botId → madaCategory (dùng khi gắn metadata cho doc đa nhãn) */
const BOT_TO_MADA_CATEGORY: Record<string, string> = Object.fromEntries(
  Object.entries(AGENT_TO_MADA).map(([botId, v]) => [botId, v.madaCategory])
);

/**
 * ⭐ Nhập mapping từ source-of-truth dùng chung với server.
 *
 * ⚠️ KHÔNG được map cứng `mobility → bot-neuro`: category `mobility` trong
 * kb_products trộn cả xe lăn/gậy (thuộc Bot 6 Mobility & Transportation) và
 * nẹp/chuột thay thế (thuộc Bot 5 Neuromusculoskeletal). Map cứng khiến Bot 5
 * nhận cả xe lăn và Bot 6 mất sạch xe lăn. Dùng `resolveProductOwner()` với
 * tên sản phẩm để tách đúng.
 */
function ownerFor(category: string, title: string) {
  return resolveProductOwner(category, title);
}

const MIN_CONTENT_LEN = 80;
const CHUNK_SIZE = 8;

interface ProductRow {
  id: string;
  title: string;
  title_en: string;
  description: string;
  content: string;
  category: string;
  brand: string;
  price_range: string;
  product_url: string;
  source_url: string;
  image_url: string;
  iso_codes: string;
}

/** Chunk text theo từ, giữ overlap để không cắt mất ngữ nghĩa */
function chunkText(text: string, size = 1200, overlap = 200): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= size) return [text.trim()];

  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + size).join(' ');
    if (chunk.trim()) chunks.push(chunk.trim());
    i += size - overlap;
  }
  return chunks;
}

async function main() {
  const includeAll = process.argv.includes('--all');

  console.log('🔄 Reindex vector store từ kb_products\n');

  const db = new Database(DB_PATH, { readonly: true });

  const where = includeAll
    ? `WHERE status = 'published'`
    : `WHERE status = 'published' AND length(COALESCE(content, '')) >= ${MIN_CONTENT_LEN}`;

  const rows = db.prepare(`
    SELECT id, title, title_en, description, content, category, brand, price_range,
           product_url, source_url, image_url, iso_codes
    FROM kb_products
    ${where}
    ORDER BY category, title
  `).all() as ProductRow[];

  // KB items thủ công (đọc cùng connection, trước khi đóng)
  const kbItems = db.prepare(
    `SELECT id, title, title_en, description, content, source, source_type, category, metadata
     FROM knowledge_items
     WHERE status = 'published' AND length(COALESCE(content, '')) >= ${MIN_CONTENT_LEN}`
  ).all() as any[];

  db.close();

  console.log(`📦 Sản phẩm để index: ${rows.length}`);
  console.log(`📦 KB items thủ công:    ${kbItems.length}`);

  if (rows.length === 0) {
    console.error('❌ Không có sản phẩm nào để index.');
    process.exit(1);
  }

  // Import vector store SAU khi đọc DB (tránh giữ lock)
  const { vectorStore } = await import('../server/lib/rag/vectorStore');
  await vectorStore.initialize();

  // 1) Xoá docs cũ
  const before = (await vectorStore.getStats()).totalDocuments;
  console.log(`\n🗑️  Xoá vector store cũ (${before} docs)...`);
  await vectorStore.clear();

  // 2) Build documents mới
  const documents: any[] = [];

  for (const row of rows) {
    const body = (row.content || '').trim() || (row.description || '').trim();
    const full = [row.title, row.title_en, row.brand, row.price_range, body]
      .filter(Boolean)
      .join('\n');

    const chunks = chunkText(full);

    // ⭐ MADA khai sản phẩm thuộc NHIỀU nhóm (đa nhãn). Ví dụ `proloquo2go`
    // ∈ [cognition, voice-and-speech]. Nếu chỉ gắn 1 botId, bot còn lại không
    // bao giờ tìm thấy sản phẩm → mất sản phẩm đúng chuyên môn.
    // → Index MỘT doc cho MỖI bot, ID hậu tố theo botId.
    const ownerBots = botsForProduct(row.product_url || row.source_url);
    const targets: Array<{ botId: string; madaCategory: string }> = ownerBots.length
      ? ownerBots.map((b) => ({ botId: b, madaCategory: BOT_TO_MADA_CATEGORY[b] || '' }))
      : (() => {
          const fallback = ownerFor(row.category || '', row.title);
          return fallback ? [fallback] : [];
        })();

    for (const t of targets) {
      chunks.forEach((chunk, idx) => {
        documents.push({
          // ID ổn định theo product + bot + số thứ tự chunk → reindex không nhân bản
          id: `kbprod_${row.id}_${t.botId}${chunks.length > 1 ? `_c${idx}` : ''}`,
          content: chunk,
          metadata: {
            source: row.product_url || row.source_url || '',
            type: 'web',
            title: row.title || '',
            title_en: row.title_en || '',
            category: row.category || 'general',
            // ⭐ 2 field filter RAG cần
            botId: t.botId,
            madaCategory: t.madaCategory,
            productId: row.id,
            productUrl: row.product_url || row.source_url || '',
            product_url: row.product_url || row.source_url || '',
            imageUrl: row.image_url || '',
            thumbnailUrl: row.image_url || '',
            galleryImages: row.image_url ? [row.image_url] : [],
            brand: row.brand || '',
            priceRange: row.price_range || '',
            importedFromKbProduct: true,
          },
        });
      });
    }
  }

  console.log(`📚 Tạo ${documents.length} documents\n`);

  // 2b) Index thêm các KB item thủ công (knowledge_items) — những item KHÔNG
  //     phải bản sao của kb_products (VD: WCAG 2.2, ISO 9999, JAWS/NVDA…).
  //     `vectorStore.clear()` xoá SẠCH store nên các item này phải được
  //     index lại, nếu không bot-regulatory sẽ mất sạch tài liệu chuẩn.
  let kbIndexed = 0;
  for (const item of kbItems) {
    const cat = ownerFor(item.category || '', item.title);
    let meta: any = {};
    try {
      meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata || '{}') : (item.metadata || {});
    } catch {
      meta = {};
    }

    const full = [item.title, item.title_en, item.description, item.content]
      .filter(Boolean)
      .join('\n');

    documents.push({
      id: `kbitem_${item.id}`,
      content: full.slice(0, 4000),
      metadata: {
        source: item.source || '',
        type: item.source_type || 'manual',
        title: item.title || '',
        title_en: item.title_en || '',
        category: item.category || 'general',
        ...(cat ? { botId: cat.botId, madaCategory: cat.madaCategory } : {}),
        itemId: item.id,
        ...meta,
      },
    });
    kbIndexed++;
  }

  if (kbIndexed > 0) {
    console.log(`📚 Thêm ${kbIndexed} KB items thủ công\n`);
  }

  // 3) Embed + lưu
  let done = 0;
  let failed = 0;

  for (let i = 0; i < documents.length; i += CHUNK_SIZE) {
    const chunk = documents.slice(i, i + CHUNK_SIZE);
    try {
      await vectorStore.addDocuments(chunk);
      done += chunk.length;
      process.stdout.write(`   ${done}/${documents.length}\r`);
    } catch (err) {
      failed += chunk.length;
      console.warn(`\n   ⚠️  Chunk ${i}-${i + CHUNK_SIZE} failed: ${(err as Error).message}`);
    }
  }

  console.log(`\n\n✅ Reindex xong!`);
  console.log(`   Embedded: ${done}`);
  console.log(`   Failed:   ${failed}`);

  const stats = await vectorStore.getStats();
  console.log(`   Vector store: ${stats.totalDocuments} docs (provider: ${stats.provider})`);

  // Verify: filter theo bot-hearing giờ phải khớp > 0
  const { getEmbeddingProvider } = await import('../server/lib/rag/vectorStore');
  if (getEmbeddingProvider()) {
    const check = await vectorStore.hybridSearch(
      'máy trợ thính cho người cao tuổi',
      5,
      { botId: 'bot-hearing', madaCategory: 'sensory-hearing' },
      0.7,
      0.3
    );
    console.log(`\n🔍 Verify filter bot-hearing: ${check.length} hits`);
    check.forEach((r: any) => console.log(`   - ${r.metadata.title}`));
  }
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
