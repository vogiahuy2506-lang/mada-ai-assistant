/**
 * Sync 1 kb_products row → knowledge_items
 *
 * Khi admin publish product mới → cũng tạo/cập nhật row tương ứng
 * trong knowledge_items để AI có thể tìm thấy qua RAG.
 *
 * Được gọi từ POST /api/admin/products/:id/publish và bulk-publish.
 *
 * Đặc điểm:
 *  - Insert nếu chưa có (so sánh theo product_url trong metadata)
 *  - Update nếu đã có (giữ nguyên indexed status để không re-vector không cần)
 *  - Set source_type = 'manual' (do admin add thủ công / qua URL importer)
 *  - Lưu image_url vào metadata.thumbnailUrl để hiển thị chat
 */

import db from '../lib/db';

export interface KbProduct {
  id: string;
  title: string;
  title_en?: string | null;
  description?: string | null;
  description_en?: string | null;
  content?: string | null;
  category: string;
  brand?: string | null;
  model?: string | null;
  price_range?: string | null;
  source_url?: string | null;
  product_url?: string | null;
  image_url?: string | null;
  iso_codes?: string | string[] | null;
  wcag_level?: string | null;
  who_gate_area?: string | null;
  status: 'draft' | 'published' | 'archived';
  featured: number;
  sort_order: number;
  language: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Sync 1 kb_products → knowledge_items
 * Returns: { action: 'inserted' | 'updated' | 'archived', knowledge_item_id }
 */
export function syncProductToKnowledge(product: KbProduct): {
  action: 'inserted' | 'updated' | 'archived' | 'skipped';
  knowledge_item_id?: string;
} {
  // 1. Nếu archived → archive luôn row tương ứng trong knowledge_items
  if (product.status === 'archived') {
    const existing = findKnowledgeItemByProduct(product);
    if (existing) {
      db.prepare(
        `UPDATE knowledge_items SET status = 'archived', updated_at = ?, indexed = 0 WHERE id = ?`
      ).run(new Date().toISOString(), existing.id);
      return { action: 'archived', knowledge_item_id: existing.id };
    }
    return { action: 'skipped' };
  }

  // 2. Nếu draft → chỉ tạo bản nháp, không index vào vector store
  if (product.status === 'draft') {
    const existing = findKnowledgeItemByProduct(product);
    if (existing) {
      db.prepare(
        `UPDATE knowledge_items SET status = 'draft', updated_at = ?, indexed = 0 WHERE id = ?`
      ).run(new Date().toISOString(), existing.id);
      return { action: 'updated', knowledge_item_id: existing.id };
    }
    const id = insertKnowledgeItem(product, 'draft');
    return { action: 'inserted', knowledge_item_id: id };
  }

  // 3. Nếu published → insert/update + mark indexed=0 để sync sang vector store
  const existing = findKnowledgeItemByProduct(product);

  // Build content body (giúp AI semantic search)
  const contentParts = [
    product.title,
    product.title_en ? `(${product.title_en})` : '',
    product.brand ? `Thương hiệu: ${product.brand}` : '',
    product.model ? `Model: ${product.model}` : '',
    product.price_range ? `Giá: ${product.price_range}` : '',
    product.description || '',
    product.description_en ? `[EN] ${product.description_en}` : '',
    product.wcag_level ? `WCAG level: ${product.wcag_level}` : '',
    product.who_gate_area ? `WHO GATE area: ${product.who_gate_area}` : '',
    product.iso_codes ? `ISO codes: ${product.iso_codes}` : '',
  ].filter(Boolean);

  const content = contentParts.join('\n');

  // Build metadata (bao gồm thumbnailUrl cho chat UI)
  const metadata: any = {
    productId: product.id,
    productUrl: product.product_url || product.source_url || '',
    imageUrl: product.image_url || '',
    thumbnailUrl: product.image_url || '',
    galleryImages: product.image_url ? [product.image_url] : [],
    brand: product.brand || '',
    model: product.model || '',
    priceRange: product.price_range || '',
    wcagLevel: product.wcag_level || '',
    whoGateArea: product.who_gate_area || '',
    featured: product.featured,
    sortOrder: product.sort_order,
    importedFromKbProduct: true,
    importedAt: new Date().toISOString(),
  };

  if (existing) {
    db.prepare(`
      UPDATE knowledge_items SET
        title = ?,
        description = ?,
        content = ?,
        url = ?,
        category = ?,
        iso_codes = ?,
        wcag_level = ?,
        who_gate_area = ?,
        status = 'published',
        indexed = 0,
        language = ?,
        metadata = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      product.title,
      product.description || '',
      content,
      product.product_url || product.source_url || '',
      product.category,
      typeof product.iso_codes === 'string'
        ? product.iso_codes
        : JSON.stringify(product.iso_codes || []),
      product.wcag_level || '',
      product.who_gate_area || '',
      product.language || 'vi',
      JSON.stringify(metadata),
      new Date().toISOString(),
      existing.id
    );
    return { action: 'updated', knowledge_item_id: existing.id };
  }

  const id = insertKnowledgeItemWithContent(product, content, metadata, 'published');
  return { action: 'inserted', knowledge_item_id: id };
}

function findKnowledgeItemByProduct(product: KbProduct): any {
  // Tìm theo productId trong metadata, hoặc theo product_url
  return db.prepare(`
    SELECT id, indexed FROM knowledge_items
    WHERE (
      json_extract(metadata, '$.productId') = ?
      OR url = ?
      OR source = ?
    )
    AND json_extract(metadata, '$.importedFromKbProduct') = 1
    LIMIT 1
  `).get(
    product.id,
    product.product_url || '',
    product.product_url || ''
  );
}

function insertKnowledgeItem(
  product: KbProduct,
  status: 'draft' | 'published' | 'archived'
): string {
  return insertKnowledgeItemWithContent(product, product.description || product.title, {}, status);
}

function insertKnowledgeItemWithContent(
  product: KbProduct,
  content: string,
  metadata: any,
  status: 'draft' | 'published' | 'archived' = 'published'
): string {
  const id = `kbprod_${product.id}_${Date.now()}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO knowledge_items (
      id, title, description, content, source, source_type, url,
      category, iso_codes, wcag_level, who_gate_area,
      auto_classified, confidence, status, chunk_count, language,
      metadata, indexed, indexed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0.8, ?, 1, ?, ?, 0, NULL, ?, ?)
  `).run(
    id,
    product.title,
    product.description || '',
    content,
    product.product_url || `kb_product:${product.id}`,
    'manual',
    product.product_url || product.source_url || '',
    product.category,
    JSON.stringify(product.iso_codes || []),
    product.wcag_level || '',
    product.who_gate_area || '',
    status,
    product.language || 'vi',
    JSON.stringify(metadata),
    now,
    now
  );

  return id;
}

/**
 * Bulk sync tất cả kb_products đã published → knowledge_items
 * Dùng cho migration hoặc admin "Sync All" button
 */
export function syncAllPublishedProducts(): {
  inserted: number;
  updated: number;
  archived: number;
  errors: string[];
} {
  const products = db.prepare(`
    SELECT * FROM kb_products WHERE status IN ('published', 'draft', 'archived')
  `).all() as KbProduct[];

  let inserted = 0;
  let updated = 0;
  let archived = 0;
  const errors: string[] = [];

  for (const p of products) {
    try {
      const result = syncProductToKnowledge(p);
      if (result.action === 'inserted') inserted++;
      else if (result.action === 'updated') updated++;
      else if (result.action === 'archived') archived++;
    } catch (e: any) {
      errors.push(`${p.id}: ${e.message}`);
    }
  }

  return { inserted, updated, archived, errors };
}