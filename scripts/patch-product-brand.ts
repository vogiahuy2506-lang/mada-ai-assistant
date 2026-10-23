/**
 * Patch nhỏ: cập nhật brand cho 1 sản phẩm đã index (không rebuild toàn bộ).
 *
 * Usage: npx tsx scripts/patch-product-brand.ts <productId> "<Brand>"
 *
 * Vì sao cần script riêng: reindex-products.ts rebuild TOÀN BỘ (~5.5 phút, 602 docs).
 * Khi chỉ sửa 1 brand thì chỉ doc của sản phẩm đó cần re-embed.
 *
 * ⚠️ Doc id / content phải KHỚP CHÍNH XÁC với reindex-products.ts, nếu không RAG sẽ
 *    lệch dữ liệu so với kết quả của full reindex.
 */
import path from 'path';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { botsForProduct } from '../server/lib/productTaxonomy';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'mada.db');

// ⚠️ Bắt buộc: thiếu dotenv thì GEMINI_API_KEY không có → doc được ghi lại với
// embedding rỗng/stale, làm RAG hỏng. reindex-products.ts cũng load như vậy.
dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config();

async function main() {
  const [, , productId, brand] = process.argv;
  if (!productId || !brand) {
    console.error('Usage: npx tsx scripts/patch-product-brand.ts <productId> "<Brand>"');
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });
  const row = db
    .prepare(
      `SELECT id, title, title_en, brand, price_range, content, description,
              product_url, source_url
       FROM kb_products WHERE id = ?`
    )
    .get(productId) as any;
  db.close();

  if (!row) {
    console.error(`❌ Không tìm thấy sản phẩm: ${productId}`);
    process.exit(1);
  }

  console.log(`🏷️  ${row.title}: brand="${row.brand || ''}" → "${brand}"`);

  const { vectorStore, getEmbeddingProvider } = await import('../server/lib/rag/vectorStore');
  await vectorStore.initialize();

  const store = vectorStore as any;

  // Dựng lại doc id đúng như reindex-products.ts: `kbprod_<productId>_<botId>`
  const bots = botsForProduct(row.product_url || row.source_url);
  const docIds = bots.length
    ? bots.map((b: string) => `kbprod_${row.id}_${b}`)
    : [];

  if (docIds.length === 0) {
    console.error('❌ Không map được bot nào cho sản phẩm này — cần chạy full reindex.');
    process.exit(1);
  }

  const provider = getEmbeddingProvider();

  for (const docId of docIds) {
    const existing = store.inMemoryStore.get(docId);
    if (!existing) {
      console.warn(`⚠️  Không có doc ${docId} trong store — bỏ qua`);
      continue;
    }

    // Brand nằm ở dòng thứ 3 của block [title, title_en, brand, priceRange, body].
    // Thay đúng vị trí đó để không nhân bản hoặc làm lệch nội dung.
    const lines = String(existing.content).split('\n');
    const brandIdx = lines.findIndex((l) => l === existing.metadata?.brand);
    if (existing.metadata?.brand && brandIdx >= 0) {
      lines[brandIdx] = brand;
    } else {
      lines.splice(2, 0, brand);
    }

    const content = lines.join('\n');
    const metadata = { ...existing.metadata, brand };

    // ⚠️ Nếu không embed lại được, content và embedding sẽ lệch nhau → RAG trả kết quả
    // sai cho sản phẩm này. Thà bỏ ghi còn hơn làm hỏng store.
    if (!provider) {
      console.error('❌ Không có embedding provider (thiếu GEMINI_API_KEY?) — không ghi, giữ nguyên store.');
      process.exit(1);
    }
    const embedding = await provider.embed(content);
    if (!embedding?.length) {
      console.error(`❌ Embedding rỗng cho ${docId} — không ghi.`);
      process.exit(1);
    }

    store.inMemoryStore.set(docId, { ...existing, content, metadata, embedding });
    console.log(`   ✅ ${docId} (embedding: ${embedding.length} dims)`);
  }

  store.saveMetadataToDisk();
  console.log(`\n✅ Đã cập nhật brand trong vector store.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});