/**
 * ⭐ STUB: Seed Products Database
 *
 * File này từng tồn tại ở `backend/src/data/seed-products.ts` (commit 8289bfb đã xóa
 * toàn bộ `backend/` khi refactor sang `server/`). Tuy nhiên `rag.service.ts` vẫn
 * reference tới path này và dùng các types `Product` + `MadaCategory` ở nhiều nơi.
 *
 * Để không block compile/build, ta tạo stub này với:
 *   - Type definitions đầy đủ (Product, MadaCategory)
 *   - SEED_PRODUCTS = [] (empty array - sẽ được fallback sang vector store)
 *   - searchProducts() = stub function trả về []
 *
 * Trong production, recommend migrate `rag.service.ts` sang dùng `vectorStore`
 * trực tiếp thay vì seed data. Đây chỉ là bridge tạm.
 */

export type MadaCategory =
  | 'hearing'
  | 'vision'
  | 'mobility'
  | 'communication'
  | 'cognition'
  | 'daily_living'
  | 'web_accessibility'
  | 'general';

export interface ProductName {
  vi: string;
  en: string;
  ar?: string;
  fr?: string;
}

export interface Product {
  id: string;
  madaId?: string;
  category: MadaCategory;
  subcategory: string;
  name: ProductName;
  description: ProductName;
  manufacturer?: ProductName;
  operatingSystem?: string;
  features: string[];
  useCases: string[];
  targetSymptoms: string[];
  keywords: string[];
  isoCodes: string[];
  sourceUrl: string;
  priceRange?: ProductName;
  /** Optional fields populated when source is database (kb_products table). */
  brand?: string;
  model?: string;
  imageUrl?: string;
  wcagLevel?: string;
  whoGateArea?: string;
  language?: string;
}

/**
 * Empty seed list. Vì backend giờ dùng Pinecone vector store + SQLite KB,
 * seed data không còn cần thiết. Trả về mảng rỗng sẽ cho phép rag.service
 * fallback sang các data sources khác.
 */
export const SEED_PRODUCTS: Product[] = [];

/**
 * Stub search function - không tìm trong empty list.
 * rag.service.ts import với alias `seedSearchProducts` nhưng không gọi trong logic.
 *
 * @param _query Chuỗi truy vấn (hiện không dùng vì SEED_PRODUCTS rỗng)
 * @param _opts Tùy chọn (hiện không dùng)
 * @returns Luôn trả về mảng rỗng - fallback sang vector store
 */
export function searchProducts(_query: string, _opts?: unknown): Product[] {
  return [];
}

export default { SEED_PRODUCTS, searchProducts };
