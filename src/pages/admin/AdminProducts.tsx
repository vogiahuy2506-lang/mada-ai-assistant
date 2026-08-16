import { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi, Product, Category } from './adminApi';
import { AIImportCard } from './AIImportCard';
import { formatPrice } from '../../lib/formatPrice';
import { getImageUrl } from '../../lib/imageProxy';
import {
  Plus, RefreshCw, X, Save, Loader2, AlertCircle,
  Edit2, Trash2, Eye, EyeOff, Star, StarOff,
  ExternalLink, Globe, Link as LinkIcon, Image as ImageIcon,
  FolderPlus, CheckCircle,
} from 'lucide-react';
import clsx from 'clsx';

// ==================== ICONS ====================
const CATEGORY_ICONS: Record<string, string> = {
  vision: 'visibility', hearing: 'hearing', mobility: 'accessible',
  cognition: 'psychology', communication: 'forum', daily_living: 'home',
  education: 'school', web_accessibility: 'language', general: 'inventory_2',
};

const CAT_COLORS: Record<string, string> = {
  vision: 'bg-blue-100 text-blue-700',
  hearing: 'bg-yellow-100 text-yellow-700',
  mobility: 'bg-rose-100 text-rose-700',
  cognition: 'bg-purple-100 text-purple-700',
  communication: 'bg-cyan-100 text-cyan-700',
  daily_living: 'bg-green-100 text-green-700',
  education: 'bg-indigo-100 text-indigo-700',
  general: 'bg-gray-100 text-gray-700',
};

const STATUS_STYLES: Record<string, string> = {
  published: 'bg-emerald-50 text-emerald-600',
  archived: 'bg-slate-100 text-slate-500',
  draft: 'bg-amber-50 text-amber-600',
};

// ==================== MODALS ====================
function CategoryModal({ category, onSave, onClose }: {
  category?: Category | null;
  onSave: (data: Partial<Category> & { id?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    id: category?.id || '',
    name_vi: category?.name_vi || '',
    name_en: category?.name_en || '',
    icon: category?.icon || 'M',
    sort_order: category?.sort_order || 50,
    description_vi: category?.description_vi || '',
    description_en: category?.description_en || '',
    related_url: category?.related_url || '',
    product_link: category?.product_link || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.name_vi || !form.name_en) { setError('Cần nhập tên Tiếng Việt và English'); return; }
    setSaving(true); setError('');
    try { await onSave(form); } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl overflow-hidden bg-white shadow-2xl shadow-slate-900/10">
        <div className="flex items-center justify-between p-5 border-b border-outline-variant bg-gradient-to-r from-primary/5 to-tertiary/5">
          <div>
            <h2 className="text-lg font-bold text-on-surface">{category ? 'Sửa Danh mục' : 'Tạo Danh mục mới'}</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">{category ? 'Cập nhật thông tin' : 'Thêm danh mục mới'}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {!category && (
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">ID <span className="text-error">*</span></label>
              <input type="text" value={form.id} onChange={(e) => setForm({...form, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')})} placeholder="custom_category" 
                className="w-full px-4 py-3 rounded-xl border border-outline bg-surface-container-low font-label-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Icon</label>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-bold shadow-lg shadow-primary/25">
                M
              </div>
              <p className="text-xs text-on-surface-variant">Logo MADA AI</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Tên (VI) <span className="text-error">*</span></label>
              <input type="text" value={form.name_vi} onChange={(e) => setForm({...form, name_vi: e.target.value})} placeholder="Hỗ trợ Thị giác" 
                className="w-full px-4 py-3 rounded-xl border border-outline bg-surface-container-low font-label-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Tên (EN) <span className="text-error">*</span></label>
              <input type="text" value={form.name_en} onChange={(e) => setForm({...form, name_en: e.target.value})} placeholder="Vision Support" 
                className="w-full px-4 py-3 rounded-xl border border-outline bg-surface-container-low font-label-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Mô tả (VI)</label>
              <textarea value={form.description_vi} onChange={(e) => setForm({...form, description_vi: e.target.value})} rows={2} 
                className="w-full px-4 py-3 rounded-xl border border-outline bg-surface-container-low font-label-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Mô tả (EN)</label>
              <textarea value={form.description_en} onChange={(e) => setForm({...form, description_en: e.target.value})} rows={2} 
                className="w-full px-4 py-3 rounded-xl border border-outline bg-surface-container-low font-label-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Link tài liệu</label>
              <input type="url" value={form.related_url} onChange={(e) => setForm({...form, related_url: e.target.value})} placeholder="https://..." 
                className="w-full px-4 py-3 rounded-xl border border-outline bg-surface-container-low font-label-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Link sản phẩm</label>
              <input type="url" value={form.product_link} onChange={(e) => setForm({...form, product_link: e.target.value})} placeholder="https://..." 
                className="w-full px-4 py-3 rounded-xl border border-outline bg-surface-container-low font-label-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-3 bg-error/10 text-error rounded-xl font-label-md">
              <span className="material-symbols-outlined">error</span>
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-outline-variant bg-surface-container-low/50">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-outline font-label-md text-on-surface hover:bg-surface-container-high transition-all">Hủy</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl bg-primary text-white font-label-md shadow-lg shadow-primary/25 flex items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== PRODUCT MODAL ====================
function ProductModal({ product, categories, defaultCategory, onSave, onClose }: {
  product?: Product | null;
  categories: Category[];
  defaultCategory?: string;
  onSave: (data: Partial<Product>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: product?.title || '', title_en: product?.title_en || '',
    description: product?.description || '', description_en: product?.description_en || '',
    content: product?.content || '', category: product?.category || defaultCategory || '',
    brand: product?.brand || '', model: product?.model || '',
    price_range: product?.price_range || '', source_url: product?.source_url || '',
    product_url: product?.product_url || '', image_url: product?.image_url || '',
    iso_codes: Array.isArray(product?.iso_codes) ? product.iso_codes.join(', ') : '',
    wcag_level: product?.wcag_level || '', who_gate_area: product?.who_gate_area || '',
    status: product?.status || 'draft', featured: product?.featured || false,
    sort_order: product?.sort_order || 0, language: product?.language || 'vi',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.title || !form.category) { setError('Cần nhập tên và chọn danh mục'); return; }
    setSaving(true); setError('');
    try {
      const iso_codes = form.iso_codes.split(',').map(s => s.trim()).filter(Boolean);
      await onSave({ ...form, iso_codes: iso_codes as any, featured: !!form.featured });
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden bg-white shadow-2xl shadow-slate-900/10">
        <div className="flex items-center justify-between p-5 shrink-0 border-b border-outline-variant bg-gradient-to-r from-primary/5 to-tertiary/5">
          <div>
            <h2 className="text-lg font-bold text-on-surface">{product ? 'Sửa Sản phẩm' : 'Thêm Sản phẩm mới'}</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">{product ? 'Cập nhật thông tin sản phẩm' : 'Thêm sản phẩm vào danh mục'}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Section 1: Thông tin cơ bản */}
          <section className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
              </div>
              <h3 className="text-base font-bold text-on-surface">Thông tin cơ bản</h3>
              <span className="ml-auto text-[10px] font-bold text-error bg-error/10 px-2.5 py-1 rounded-full">Bắt buộc</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Danh mục <span className="text-error">*</span></label>
                <div className="relative">
                  <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}
                    className="w-full appearance-none rounded-xl px-4 py-3 font-label-md cursor-pointer bg-surface-container-low text-on-surface border border-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                    <option value="">Chọn danh mục</option>
                    {categories.map((c) => (<option key={c.id} value={c.id}>{c.icon} {c.name_vi}</option>))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Tên sản phẩm (VI) <span className="text-error">*</span></label>
                <input type="text" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})}
                  placeholder="Nhập tên sản phẩm"
                  className="w-full rounded-xl px-4 py-3 font-label-md bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/60 border border-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Tên sản phẩm (EN)</label>
                <input type="text" value={form.title_en} onChange={(e) => setForm({...form, title_en: e.target.value})}
                  placeholder="Enter product name"
                  className="w-full rounded-xl px-4 py-3 font-label-md bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/60 border border-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Thương hiệu</label>
                <input type="text" value={form.brand} onChange={(e) => setForm({...form, brand: e.target.value})}
                  placeholder="Ví dụ: Apple, Microsoft"
                  className="w-full rounded-xl px-4 py-3 font-label-md bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/60 border border-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Model</label>
                  <input type="text" value={form.model} onChange={(e) => setForm({...form, model: e.target.value})}
                    placeholder="Mã model"
                    className="w-full rounded-xl px-4 py-3 font-label-md bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/60 border border-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Khoảng giá</label>
                  <input type="text" value={form.price_range} onChange={(e) => setForm({...form, price_range: e.target.value})}
                    placeholder="VNĐ / USD"
                    className="w-full rounded-xl px-4 py-3 font-label-md bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/60 border border-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Thứ tự hiển thị</label>
                <input type="number" value={form.sort_order} onChange={(e) => setForm({...form, sort_order: parseInt(e.target.value) || 0})}
                  placeholder="0"
                  className="w-full rounded-xl px-4 py-3 font-label-md bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/60 border border-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                <span className="text-[10px] text-on-surface-variant/60 ml-1">Số nhỏ = hiển thị trước</span>
              </div>
            </div>
          </section>

          {/* Section 2: Mô tả */}
          <section className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-tertiary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-tertiary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
              </div>
              <h3 className="text-base font-bold text-on-surface">Mô tả</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Mô tả ngắn (VI)</label>
                <textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})}
                  rows={3} placeholder="Tóm tắt ngắn gọn về sản phẩm"
                  className="w-full rounded-xl px-4 py-3 font-label-md resize-none bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/60 border border-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Mô tả ngắn (EN)</label>
                <textarea value={form.description_en} onChange={(e) => setForm({...form, description_en: e.target.value})}
                  rows={3} placeholder="Short summary of the product"
                  className="w-full rounded-xl px-4 py-3 font-label-md resize-none bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/60 border border-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Nội dung chi tiết (VI)</label>
              <textarea value={form.content} onChange={(e) => setForm({...form, content: e.target.value})}
                rows={4} placeholder="Nội dung HTML chi tiết về sản phẩm..."
                className="w-full rounded-xl px-4 py-3 font-label-md resize-none bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/60 border border-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
          </section>

          {/* Section 3: Kỹ thuật & Liên kết */}
          <section className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>link</span>
              </div>
              <h3 className="text-base font-bold text-on-surface">Kỹ thuật & Liên kết</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Link Nguồn / Tài liệu</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">link</span>
                  <input type="url" value={form.source_url} onChange={(e) => setForm({...form, source_url: e.target.value})}
                    placeholder="https://"
                    className="w-full rounded-xl py-3 pl-10 pr-4 font-label-md bg-white text-on-surface placeholder:text-on-surface-variant/60 border border-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Link mua hàng</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">shopping_cart</span>
                  <input type="url" value={form.product_url} onChange={(e) => setForm({...form, product_url: e.target.value})}
                    placeholder="https://"
                    className="w-full rounded-xl py-3 pl-10 pr-4 font-label-md bg-white text-on-surface placeholder:text-on-surface-variant/60 border border-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Link hình ảnh</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">image</span>
                  <input type="url" value={form.image_url} onChange={(e) => setForm({...form, image_url: e.target.value})}
                    placeholder="https://"
                    className="w-full rounded-xl py-3 pl-10 pr-4 font-label-md bg-white text-on-surface placeholder:text-on-surface-variant/60 border border-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>
                {form.image_url && (
                  <div className="mt-2 rounded-xl overflow-hidden">
                    <img src={form.image_url} alt="Preview" className="w-full h-20 object-cover rounded-xl"
                      onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Mã ISO</label>
                <input type="text" value={form.iso_codes} onChange={(e) => setForm({...form, iso_codes: e.target.value})}
                  placeholder="Ví dụ: ISO 9999, ISO 9241"
                  className="w-full rounded-xl px-4 py-3 font-label-md font-mono bg-white text-on-surface placeholder:text-on-surface-variant/60 border border-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">Mức WCAG</label>
                <div className="relative">
                  <select value={form.wcag_level} onChange={(e) => setForm({...form, wcag_level: e.target.value})}
                    className="w-full appearance-none rounded-xl px-4 py-3 font-label-md cursor-pointer bg-white text-on-surface border border-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                    <option value="">Không áp dụng</option>
                    <option value="A">Level A</option>
                    <option value="AA">Level AA</option>
                    <option value="AAA">Level AAA</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5 ml-1">WHO GATE Area</label>
                <div className="relative">
                  <select value={form.who_gate_area} onChange={(e) => setForm({...form, who_gate_area: e.target.value})}
                    className="w-full appearance-none rounded-xl px-4 py-3 font-label-md cursor-pointer bg-white text-on-surface border border-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                    <option value="">Chọn lĩnh vực</option>
                    <option value="vision">Thị giác</option>
                    <option value="hearing">Thính giác</option>
                    <option value="mobility">Vận động</option>
                    <option value="cognition">Nhận thức</option>
                    <option value="communication">Giao tiếp</option>
                    <option value="self_care">Tự chăm sóc</option>
                    <option value="education">Giáo dục</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
                </div>
              </div>
            </div>
          </section>

          <div className="h-px bg-gradient-to-r from-transparent via-teal-200 to-transparent"></div>

          {/* Section 4: Cấu hình */}
          <section className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>tune</span>
              </div>
              <h3 className="text-base font-bold text-on-surface">Cấu hình</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white border border-outline">
                <label className="block text-xs font-bold text-on-surface mb-3">Trạng thái</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="status" value="draft" checked={form.status === 'draft'} onChange={() => setForm({...form, status: 'draft'})}
                      className="w-4 h-4 accent-primary" />
                    <span className="text-sm text-on-surface">Bản nháp</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="status" value="published" checked={form.status === 'published'} onChange={() => setForm({...form, status: 'published'})}
                      className="w-4 h-4 accent-primary" />
                    <span className="text-sm text-on-surface">Xuất bản</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="status" value="archived" checked={form.status === 'archived'} onChange={() => setForm({...form, status: 'archived'})}
                      className="w-4 h-4 accent-primary" />
                    <span className="text-sm text-on-surface">Lưu trữ</span>
                  </label>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-outline">
                <label className="block text-xs font-bold text-on-surface mb-3">Ngôn ngữ mặc định</label>
                <div className="relative">
                  <select value={form.language} onChange={(e) => setForm({...form, language: e.target.value})}
                    className="w-full appearance-none rounded-xl px-3 py-3 font-label-md cursor-pointer bg-surface-container-low text-on-surface border border-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-lg">expand_more</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-outline flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-on-surface">Đánh dấu nổi bật</label>
                  <span className="text-xs text-on-surface-variant mt-0.5 block">Hiển thị trên trang chủ</span>
                </div>
                <button type="button" onClick={() => setForm({...form, featured: !form.featured})}
                  className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={form.featured} onChange={() => setForm({...form, featured: !form.featured})}
                    className="sr-only peer" />
                  <div className="w-12 h-7 bg-surface-variant rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </button>
              </div>
            </div>
          </section>

          {error && (
            <div className="flex items-center gap-3 p-3 bg-error/10 text-error rounded-xl font-label-md">
              <span className="material-symbols-outlined">error</span>
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 shrink-0 border-t border-outline-variant bg-surface-container-low">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-outline font-label-md text-on-surface hover:bg-surface-container-high transition-all">Hủy</button>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 rounded-xl bg-primary text-white font-label-md shadow-lg shadow-primary/25 flex items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Đang lưu...' : 'Lưu sản phẩm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== PRODUCT CARD ====================
function ProductCard({ product, categoryName, onEdit, onDelete, onTogglePublish }: {
  product: Product; categoryName: string;
  onEdit: (p: Product) => void; onDelete: (p: Product) => void; onTogglePublish: (p: Product) => void;
}) {
  const categoryStyles: Record<string, { icon: string; bg: string; text: string }> = {
    vision: { icon: 'visibility', bg: 'bg-blue-100', text: 'text-blue-600' },
    hearing: { icon: 'hearing', bg: 'bg-yellow-100', text: 'text-yellow-600' },
    mobility: { icon: 'accessible', bg: 'bg-rose-100', text: 'text-rose-600' },
    cognition: { icon: 'psychology', bg: 'bg-purple-100', text: 'text-purple-600' },
    communication: { icon: 'forum', bg: 'bg-cyan-100', text: 'text-cyan-600' },
    daily_living: { icon: 'home', bg: 'bg-green-100', text: 'text-green-600' },
    education: { icon: 'school', bg: 'bg-indigo-100', text: 'text-indigo-600' },
    web_accessibility: { icon: 'language', bg: 'bg-teal-100', text: 'text-teal-600' },
    general: { icon: 'inventory_2', bg: 'bg-slate-100', text: 'text-slate-600' },
  };

  const style = categoryStyles[product.category] || categoryStyles.general;
  const isPublished = product.status === 'published';

  return (
    <div className="bg-white rounded-lg border border-outline-variant/30 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
      {/* Ảnh sản phẩm - lớn, chiếm phần lớn card */}
      <div className="relative aspect-square bg-white overflow-hidden">
        {product.image_url ? (
          <img
            src={getImageUrl(product.image_url)}
            alt={product.title}
            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
          />
        ) : null}
        <div className={clsx('w-full h-full flex items-center justify-center text-slate-300', product.image_url ? 'hidden' : '')}>
          <span className="material-symbols-outlined text-5xl">image_not_supported</span>
        </div>

        {/* Badge góc trên trái - status */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.featured && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white shadow-sm">
              HOT
            </span>
          )}
          {!isPublished && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-white shadow-sm">
              Nháp
            </span>
          )}
        </div>

        {/* Action buttons - góc trên phải (hover only) */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(product); }}
            className="w-7 h-7 rounded-full bg-white/95 shadow-sm flex items-center justify-center text-slate-700 hover:bg-blue-500 hover:text-white transition-colors"
            title="Sửa"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(product); }}
            className="w-7 h-7 rounded-full bg-white/95 shadow-sm flex items-center justify-center text-slate-700 hover:bg-red-500 hover:text-white transition-colors"
            title="Xóa"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>

        {/* Quick publish toggle - góc dưới phải */}
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePublish(product); }}
          className={clsx(
            'absolute bottom-2 right-2 px-2 py-1 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-1 transition-colors',
            isPublished
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'bg-white/95 text-slate-700 hover:bg-blue-500 hover:text-white'
          )}
          title={isPublished ? 'Hạ xuống' : 'Xuất bản'}
        >
          <span className="material-symbols-outlined text-xs">{isPublished ? 'check_circle' : 'publish'}</span>
          {isPublished ? 'Live' : 'Đăng'}
        </button>
      </div>

      {/* Nội dung - gọn gàng */}
      <div className="p-2.5 space-y-1.5">
        {/* Tên sản phẩm */}
        <h3 className="text-[13px] font-medium text-slate-800 line-clamp-2 leading-snug min-h-[34px]">
          {product.title}
        </h3>

        {/* Giá - prominent */}
        {product.price_range && (
          <div className="flex items-baseline gap-1">
            <span className="text-red-600 font-bold text-[15px] leading-tight">
              {formatPrice(product.price_range)}
            </span>
          </div>
        )}

        {/* Meta: brand + category */}
        <div className="flex items-center gap-1 text-[11px]">
          {product.brand && (
            <span className="font-bold text-slate-700 truncate">{product.brand}</span>
          )}
          <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', style.bg, style.text)}>
            {categoryName}
          </span>
        </div>

        {/* Options/variants - TGDD style */}
        {(product.wcag_level || (Array.isArray(product.iso_codes) && product.iso_codes.length > 0)) && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {product.wcag_level && (
              <span className="px-1.5 py-0.5 rounded border border-slate-200 text-[10px] text-slate-600 bg-slate-50">
                WCAG {product.wcag_level}
              </span>
            )}
            {Array.isArray(product.iso_codes) && product.iso_codes.slice(0, 2).map((iso, idx) => (
              <span key={idx} className="px-1.5 py-0.5 rounded border border-slate-200 text-[10px] text-slate-600 bg-slate-50 font-mono">
                {iso}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== CATEGORY CARD ====================
function CategoryCard({ category, productCount, onEdit, onAddProduct }: {
  category: Category; productCount: number; onEdit: (c: Category) => void; onAddProduct: (c: Category) => void;
}) {
  const categoryStyles: Record<string, { icon: string; bg: string; text: string }> = {
    vision: { icon: 'visibility', bg: 'bg-blue-100', text: 'text-blue-600' },
    hearing: { icon: 'hearing', bg: 'bg-yellow-100', text: 'text-yellow-600' },
    mobility: { icon: 'accessible', bg: 'bg-rose-100', text: 'text-rose-600' },
    cognition: { icon: 'psychology', bg: 'bg-purple-100', text: 'text-purple-600' },
    communication: { icon: 'forum', bg: 'bg-cyan-100', text: 'text-cyan-600' },
    daily_living: { icon: 'home', bg: 'bg-green-100', text: 'text-green-600' },
    education: { icon: 'school', bg: 'bg-indigo-100', text: 'text-indigo-600' },
    web_accessibility: { icon: 'language', bg: 'bg-teal-100', text: 'text-teal-600' },
    general: { icon: 'inventory_2', bg: 'bg-slate-100', text: 'text-slate-600' },
  };
  
  const style = categoryStyles[category.id] || categoryStyles.general;

  return (
    <div className="bg-white rounded-2xl border border-outline-variant/20 overflow-hidden hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-0.5 transition-all duration-200">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center', style.bg)}>
            <span className={clsx('material-symbols-outlined text-lg', style.text)} style={{ fontVariationSettings: "'FILL' 1" }}>{style.icon}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-on-surface text-sm truncate">{category.name_vi}</h3>
            <p className="text-xs text-on-surface-variant truncate">{category.name_en}</p>
          </div>
        </div>

        {(category.description_vi || category.description_en) && (
          <p className="text-xs text-on-surface-variant line-clamp-2 mb-3">{category.description_vi || category.description_en}</p>
        )}

        <div className="flex items-center gap-2 mb-3 text-xs">
          <span className={clsx('px-2.5 py-1 rounded-lg font-bold', style.bg, style.text)}>{productCount} SP</span>
          <span className="px-2.5 py-1 rounded-lg bg-surface-container-low text-on-surface-variant font-mono">#{category.sort_order}</span>
        </div>

        <div className="flex items-center gap-2 pt-3 border-t border-outline-variant/20">
          <button onClick={() => onEdit(category)} 
            className="flex-1 py-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all text-xs font-bold">
            Sửa
          </button>
          <button onClick={() => onAddProduct(category)} 
            className="flex-1 py-2.5 rounded-xl bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition-all text-xs font-bold">
            + Thêm
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== METRIC CARD ====================
function MetricCard({ icon, label, value, subValue, color, rotate = 0 }: {
  icon: string; label: string; value: string | number; subValue?: string; color: string; rotate?: number;
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-primary/10', text: 'text-primary' },
    purple: { bg: 'bg-tertiary/10', text: 'text-tertiary' },
    amber: { bg: 'bg-secondary/10', text: 'text-secondary' },
  };
  const colors = colorMap[color] || colorMap.blue;

  return (
    <div className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-outline-variant/20 shadow-sm">
      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center', colors.bg)}>
        <span className={clsx('material-symbols-outlined text-xl', colors.text)} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-on-surface-variant font-label-sm uppercase tracking-wide truncate">{label}</p>
        <div className="flex items-center gap-2">
          <h3 className="text-2xl font-bold text-on-surface">{value}</h3>
          {subValue && (
            <span className={clsx('px-2.5 py-0.5 rounded-full text-[10px] font-bold', colors.bg, colors.text)}>
              {subValue}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN PAGE ====================
export function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showFeatured, setShowFeatured] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 12;

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [defaultCategory, setDefaultCategory] = useState('');

  const [viewMode, setViewMode] = useState<'products' | 'categories'>('products');

  const loadCategories = useCallback(async () => {
    try {
      const res = await adminApi.getCategories();
      if (res.success && res.data) setCategories(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.error(e); }
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getProducts({
        q: search || undefined, category: filterCategory || undefined,
        featured: showFeatured || undefined, limit: pageSize, offset: page * pageSize,
      });
      if (res.success && res.data) {
        setProducts(res.data.items || []);
        setTotalProducts(res.data.total || 0);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [search, filterCategory, showFeatured, page]);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { setPage(0); }, [search, filterCategory, showFeatured]);

  const handleSaveCategory = async (data: Partial<Category> & { id?: string }) => {
    if (editingCategory) { await adminApi.updateCategory(editingCategory.id, data); }
    else { await adminApi.createCategory(data as any); }
    setShowCategoryModal(false); setEditingCategory(null);
    await loadCategories();
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (!confirm(`Xóa "${cat.name_vi}"?`)) return;
    const res = await adminApi.deleteCategory(cat.id);
    if (!res.success) alert(res.error);
    else await loadCategories();
  };

  const handleSaveProduct = async (data: Partial<Product>) => {
    if (editingProduct) { await adminApi.updateProduct(editingProduct.id, data); }
    else { await adminApi.createProduct(data); }
    setShowProductModal(false); setEditingProduct(null); setDefaultCategory('');
    await loadProducts();
  };

  const handleDeleteProduct = async (prod: Product) => {
    if (!confirm(`Xóa "${prod.title}"?`)) return;
    const res = await adminApi.deleteProduct(prod.id);
    if (!res.success) alert(res.error);
    else await loadProducts();
  };

  const handleTogglePublish = async (prod: Product) => {
    const newStatus = prod.status === 'published' ? 'draft' : 'published';
    await adminApi.publishProduct(prod.id, newStatus as any);
    await loadProducts();
  };

  const totalPages = Math.ceil(totalProducts / pageSize);

  const getCategoryName = (id: string) => categories.find((c) => c.id === id)?.name_vi || id;
  const getProductCount = (catId: string) => products.filter(p => p.category === catId).length;

  const handleOpenAddProduct = (cat?: Category) => {
    setEditingProduct(null);
    setDefaultCategory(cat?.id || '');
    setShowProductModal(true);
  };

  return (
    <AdminLayout
      title="Quản lý Sản phẩm"
      subtitle="Hệ thống điều hành trung tâm cho kho tri thức MADA AI."
      showFab={false}
      showLayoutTitle={false}
    >
      {/* Hero Banner */}
      <section className="mb-6 relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-tertiary">
          <div className="absolute inset-0 opacity-20" style={{
            background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.2) 0%, transparent 50%)'
          }}></div>
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 blur-2xl"></div>
          <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-tertiary/30 blur-2xl"></div>
        </div>
        
        <div className="relative p-6 flex items-center justify-between min-h-[140px]">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm mb-3">
              <span className="material-symbols-outlined text-white/90 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
              <span className="text-xs font-bold text-white/90 uppercase tracking-wider">Quản lý</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2 leading-tight">
              Quản lý Sản phẩm & Danh mục
            </h1>
            <p className="text-sm text-white/80">
              Quản lý kho tri thức sản phẩm hỗ trợ người khuyết tật.
            </p>
          </div>
          <div className="hidden lg:flex items-center gap-2">
            <button onClick={() => setViewMode('products')} 
              className={clsx('px-4 py-2.5 rounded-xl font-label-md flex items-center gap-2 transition-all',
                viewMode === 'products' 
                  ? 'bg-white text-primary shadow-lg' 
                  : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm')}>
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
              Sản phẩm
            </button>
            <button onClick={() => setViewMode('categories')} 
              className={clsx('px-4 py-2.5 rounded-xl font-label-md flex items-center gap-2 transition-all',
                viewMode === 'categories' 
                  ? 'bg-white text-primary shadow-lg' 
                  : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm')}>
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>folder_open</span>
              Danh mục
            </button>
          </div>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <MetricCard icon="inventory_2" label="Tổng sản phẩm" value={totalProducts.toLocaleString()} subValue="+12%" color="blue" />
        <MetricCard icon="category" label="Danh mục" value={categories.length} subValue="Active" color="purple" />
        <MetricCard icon="workspace_premium" label="Nội dung cao cấp" value="95%" color="amber" />
      </section>

      {/* AI Import Card */}
      {viewMode === 'products' && (
        <AIImportCard categories={categories} onImportSuccess={loadProducts} />
      )}

      {/* PRODUCTS VIEW */}
      {viewMode === 'products' && (
        <>
          {/* Filter Bar */}
          <div className="flex flex-col gap-4 p-5 bg-white rounded-2xl border border-outline-variant/20 mb-5">
            {/* Category Pills */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button onClick={() => setFilterCategory('')} 
                className={clsx('px-4 py-2.5 rounded-xl font-label-md whitespace-nowrap transition-all',
                  !filterCategory ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high')}>
                Tất cả
              </button>
              {categories.map((cat) => {
                const filterStyles: Record<string, { icon: string; bg: string; text: string }> = {
                  vision: { icon: 'visibility', bg: 'bg-blue-100', text: 'text-blue-600' },
                  hearing: { icon: 'hearing', bg: 'bg-yellow-100', text: 'text-yellow-600' },
                  mobility: { icon: 'accessible', bg: 'bg-rose-100', text: 'text-rose-600' },
                  cognition: { icon: 'psychology', bg: 'bg-purple-100', text: 'text-purple-600' },
                  communication: { icon: 'forum', bg: 'bg-cyan-100', text: 'text-cyan-600' },
                  daily_living: { icon: 'home', bg: 'bg-green-100', text: 'text-green-600' },
                  education: { icon: 'school', bg: 'bg-indigo-100', text: 'text-indigo-600' },
                  general: { icon: 'inventory_2', bg: 'bg-slate-100', text: 'text-slate-600' },
                };
                const fStyle = filterStyles[cat.id] || filterStyles.general;
                return (
                  <button key={cat.id} onClick={() => setFilterCategory(filterCategory === cat.id ? '' : cat.id)} 
                    className={clsx('px-4 py-2.5 rounded-xl font-label-md flex items-center gap-2 whitespace-nowrap transition-all',
                      filterCategory === cat.id 
                        ? 'bg-primary text-white shadow-lg shadow-primary/25' 
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high')}>
                    <span className="material-symbols-outlined text-base">{fStyle.icon}</span>
                    {cat.name_vi}
                  </button>
                );
              })}
            </div>
            
            {/* Search & Actions */}
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
                <input className="w-full h-11 pl-11 pr-4 rounded-xl bg-surface-container-low font-label-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all" 
                  placeholder="Tìm sản phẩm..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <button onClick={() => setShowFeatured(!showFeatured)} 
                className={clsx('px-4 h-11 rounded-xl font-label-md flex items-center gap-2 transition-all',
                  showFeatured ? 'bg-secondary text-white shadow-lg' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high')}>
                <span className="material-symbols-outlined text-base">star</span>
                Nổi bật
              </button>
              <button onClick={loadProducts} 
                className="w-11 h-11 rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-all">
                <RefreshCw className={clsx('w-5 h-5', loading && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* Products Grid */}
          {loading ? (
            <div className="min-h-[200px] flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin"></div>
            </div>
          ) : products.length === 0 ? (
            <div className="min-h-[200px] flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-outline-variant/20">
              <div className="w-16 h-16 rounded-2xl bg-surface-container-low flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl text-on-surface-variant">inventory_2</span>
              </div>
              <h3 className="text-title-md font-bold text-on-surface mb-1">Chưa có sản phẩm nào</h3>
              <p className="text-body-md text-on-surface-variant mb-4">Thêm sản phẩm đầu tiên để AI có thể tư vấn.</p>
              <button onClick={() => handleOpenAddProduct()} 
                className="px-6 py-3 bg-primary text-white rounded-xl font-label-md shadow-lg shadow-primary/25 flex items-center gap-2 hover:bg-primary/90 transition-all">
                <Plus className="w-5 h-5" /> Thêm sản phẩm
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {products.map((prod) => (
                  <ProductCard key={prod.id} product={prod} categoryName={getCategoryName(prod.category)}
                    onEdit={(p) => { setEditingProduct(p); setShowProductModal(true); }} onDelete={handleDeleteProduct} onTogglePublish={handleTogglePublish} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-8">
                  <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} 
                    className="px-5 py-2.5 rounded-xl border border-outline font-label-md bg-white text-on-surface hover:bg-surface-container-low disabled:opacity-50 transition-all">
                    ← Trước
                  </button>
                  <span className="px-5 py-2.5 rounded-xl bg-surface-container-low font-label-md text-on-surface">Trang {page + 1} / {totalPages}</span>
                  <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} 
                    className="px-5 py-2.5 rounded-xl border border-outline font-label-md bg-white text-on-surface hover:bg-surface-container-low disabled:opacity-50 transition-all">
                    Sau →
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* CATEGORIES VIEW */}
      {viewMode === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <CategoryCard key={cat.id} category={cat} productCount={getProductCount(cat.id)} 
              onEdit={(c) => { setEditingCategory(c); setShowCategoryModal(true); }} onAddProduct={(c) => handleOpenAddProduct(c)} />
          ))}
        </div>
      )}

      {/* FABs */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-50">
        <button 
          onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }} 
          className="group relative flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-white text-on-surface shadow-lg border border-outline-variant/30 hover:shadow-xl hover:-translate-y-1 transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
            <FolderPlus className="w-5 h-5" />
          </div>
          <div className="text-left">
            <span className="block text-label-md font-bold">Danh mục</span>
            <span className="block text-[10px] text-on-surface-variant">Thêm mới</span>
          </div>
        </button>

        <button 
          onClick={() => handleOpenAddProduct()} 
          className="group relative flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-1 transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
            <Plus className="w-6 h-6" />
          </div>
          <div className="text-left">
            <span className="block text-label-md font-bold">Sản phẩm</span>
            <span className="block text-[10px] text-white/80">Thêm mới</span>
          </div>
        </button>
      </div>

      {/* Modals */}
      {showCategoryModal && <CategoryModal category={editingCategory} onSave={handleSaveCategory} onClose={() => { setShowCategoryModal(false); setEditingCategory(null); }} />}
      {showProductModal && <ProductModal product={editingProduct} categories={categories} defaultCategory={defaultCategory} onSave={handleSaveProduct} onClose={() => { setShowProductModal(false); setEditingProduct(null); setDefaultCategory(''); }} />}
    </AdminLayout>
  );
}
