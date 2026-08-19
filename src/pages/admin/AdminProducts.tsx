import { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi, Product, Category } from './adminApi';
import { AIImportCard } from './AIImportCard';
import { formatPrice } from '../../lib/formatPrice';
import { getImageUrl } from '../../lib/imageProxy';
import {
  Plus, RefreshCw, Save, Loader2,
  FolderPlus,
} from 'lucide-react';
import clsx from 'clsx';

// ==================== ICONS ====================
// (Icons removed - unused)

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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl overflow-hidden bg-white border-[4px] border-black shadow-[8px_8px_0px_0px_#000]">
        <div className="flex items-center justify-between p-5 border-b-[3px] border-black bg-yellow-200">
          <div>
            <h2 className="text-lg font-black text-black">{category ? 'Sửa Danh mục' : 'Tạo Danh mục mới'}</h2>
            <p className="text-xs text-black/70 mt-0.5">{category ? 'Cập nhật thông tin' : 'Thêm danh mục mới'}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center text-black hover:bg-red-200 transition-all">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {!category && (
            <div>
              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">ID <span className="text-error">*</span></label>
              <input type="text" value={form.id} onChange={(e) => setForm({...form, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')})} placeholder="custom_category" 
                className="w-full px-4 py-3 rounded-xl border border-outline bg-surface-container-low font-label-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
          )}

          <div>
            <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Icon</label>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-yellow-300 border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center text-black font-black">
                M
              </div>
              <p className="text-xs font-bold text-slate-700">Logo MADA AI</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Tên (VI) <span className="text-error">*</span></label>
              <input type="text" value={form.name_vi} onChange={(e) => setForm({...form, name_vi: e.target.value})} placeholder="Hỗ trợ Thị giác" 
                className="w-full px-4 py-3 rounded-xl border border-outline bg-surface-container-low font-label-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
            <div>
              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Tên (EN) <span className="text-error">*</span></label>
              <input type="text" value={form.name_en} onChange={(e) => setForm({...form, name_en: e.target.value})} placeholder="Vision Support" 
                className="w-full px-4 py-3 rounded-xl border border-outline bg-surface-container-low font-label-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Mô tả (VI)</label>
              <textarea value={form.description_vi} onChange={(e) => setForm({...form, description_vi: e.target.value})} rows={2} 
                className="w-full px-4 py-3 rounded-xl border border-outline bg-surface-container-low font-label-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" />
            </div>
            <div>
              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Mô tả (EN)</label>
              <textarea value={form.description_en} onChange={(e) => setForm({...form, description_en: e.target.value})} rows={2} 
                className="w-full px-4 py-3 rounded-xl border border-outline bg-surface-container-low font-label-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Link tài liệu</label>
              <input type="url" value={form.related_url} onChange={(e) => setForm({...form, related_url: e.target.value})} placeholder="https://..." 
                className="w-full px-4 py-3 rounded-xl border border-outline bg-surface-container-low font-label-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
            <div>
              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Link sản phẩm</label>
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

        <div className="flex justify-end gap-3 p-4 border-t-2 border-black bg-slate-100">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border-2 border-black font-bold text-black bg-white shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all">Hủy</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl bg-black text-white border-2 border-black font-bold shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] flex items-center gap-2 transition-all disabled:opacity-50">
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden bg-white border-[4px] border-black shadow-[8px_8px_0px_0px_#000]">
        <div className="flex items-center justify-between p-5 shrink-0 border-b-[3px] border-black bg-yellow-200">
          <div>
            <h2 className="text-lg font-black text-black">{product ? 'Sửa Sản phẩm' : 'Thêm Sản phẩm mới'}</h2>
            <p className="text-xs text-black/70 mt-0.5">{product ? 'Cập nhật thông tin sản phẩm' : 'Thêm sản phẩm vào danh mục'}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center text-black hover:bg-red-200 transition-all">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Section 1: Thông tin cơ bản */}
          <section className="p-5 rounded-xl bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] bg-blue-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-blue-700 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
              </div>
              <h3 className="text-base font-black text-black">Thông tin cơ bản</h3>
              <span className="ml-auto text-[10px] font-black text-black bg-yellow-300 px-2.5 py-1 rounded-md border-2 border-black shadow-[2px_2px_0px_0px_#000]">Bắt buộc</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Danh mục <span className="text-error">*</span></label>
                <div className="relative">
                  <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}
                    className="w-full appearance-none rounded-xl px-4 py-3 font-bold cursor-pointer bg-white text-black border-2 border-black focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all">
                    <option value="">Chọn danh mục</option>
                    {categories.map((c) => (<option key={c.id} value={c.id}>{c.icon} {c.name_vi}</option>))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Tên sản phẩm (VI) <span className="text-error">*</span></label>
                <input type="text" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})}
                  placeholder="Nhập tên sản phẩm"
                  className="w-full rounded-xl px-4 py-3 font-label-md bg-white text-black placeholder:text-slate-400 border-2 border-black focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all" />
              </div>

              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Tên sản phẩm (EN)</label>
                <input type="text" value={form.title_en} onChange={(e) => setForm({...form, title_en: e.target.value})}
                  placeholder="Enter product name"
                  className="w-full rounded-xl px-4 py-3 font-label-md bg-white text-black placeholder:text-slate-400 border-2 border-black focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all" />
              </div>

              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Thương hiệu</label>
                <input type="text" value={form.brand} onChange={(e) => setForm({...form, brand: e.target.value})}
                  placeholder="Ví dụ: Apple, Microsoft"
                  className="w-full rounded-xl px-4 py-3 font-label-md bg-white text-black placeholder:text-slate-400 border-2 border-black focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Model</label>
                  <input type="text" value={form.model} onChange={(e) => setForm({...form, model: e.target.value})}
                    placeholder="Mã model"
                    className="w-full rounded-xl px-4 py-3 font-label-md bg-white text-black placeholder:text-slate-400 border-2 border-black focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Khoảng giá</label>
                  <input type="text" value={form.price_range} onChange={(e) => setForm({...form, price_range: e.target.value})}
                    placeholder="VNĐ / USD"
                    className="w-full rounded-xl px-4 py-3 font-label-md bg-white text-black placeholder:text-slate-400 border-2 border-black focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Thứ tự hiển thị</label>
                <input type="number" value={form.sort_order} onChange={(e) => setForm({...form, sort_order: parseInt(e.target.value) || 0})}
                  placeholder="0"
                  className="w-full rounded-xl px-4 py-3 font-label-md bg-white text-black placeholder:text-slate-400 border-2 border-black focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all" />
                <span className="text-[10px] text-on-surface-variant/60 ml-1">Số nhỏ = hiển thị trước</span>
              </div>
            </div>
          </section>

          {/* Section 2: Mô tả */}
          <section className="p-5 rounded-xl bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] bg-purple-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-purple-700 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
              </div>
              <h3 className="text-base font-black text-black">Mô tả</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Mô tả ngắn (VI)</label>
                <textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})}
                  rows={3} placeholder="Tóm tắt ngắn gọn về sản phẩm"
                  className="w-full rounded-xl px-4 py-3 font-label-md resize-none bg-white text-black placeholder:text-slate-400 border-2 border-black focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all" />
              </div>
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Mô tả ngắn (EN)</label>
                <textarea value={form.description_en} onChange={(e) => setForm({...form, description_en: e.target.value})}
                  rows={3} placeholder="Short summary of the product"
                  className="w-full rounded-xl px-4 py-3 font-label-md resize-none bg-white text-black placeholder:text-slate-400 border-2 border-black focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all" />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Nội dung chi tiết (VI)</label>
              <textarea value={form.content} onChange={(e) => setForm({...form, content: e.target.value})}
                rows={4} placeholder="Nội dung HTML chi tiết về sản phẩm..."
                className="w-full rounded-xl px-4 py-3 font-label-md resize-none bg-white text-black placeholder:text-slate-400 border-2 border-black focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all" />
            </div>
          </section>

          {/* Section 3: Kỹ thuật & Liên kết */}
          <section className="p-5 rounded-xl bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] bg-amber-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-700 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>link</span>
              </div>
              <h3 className="text-base font-black text-black">Kỹ thuật & Liên kết</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Link Nguồn / Tài liệu</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">link</span>
                  <input type="url" value={form.source_url} onChange={(e) => setForm({...form, source_url: e.target.value})}
                    placeholder="https://"
                    className="w-full rounded-xl py-3 pl-10 pr-4 font-label-md bg-white text-black placeholder:text-slate-400 border-2 border-black focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Link mua hàng</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">shopping_cart</span>
                  <input type="url" value={form.product_url} onChange={(e) => setForm({...form, product_url: e.target.value})}
                    placeholder="https://"
                    className="w-full rounded-xl py-3 pl-10 pr-4 font-label-md bg-white text-black placeholder:text-slate-400 border-2 border-black focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Link hình ảnh</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">image</span>
                  <input type="url" value={form.image_url} onChange={(e) => setForm({...form, image_url: e.target.value})}
                    placeholder="https://"
                    className="w-full rounded-xl py-3 pl-10 pr-4 font-label-md bg-white text-black placeholder:text-slate-400 border-2 border-black focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all" />
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
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Mã ISO</label>
                <input type="text" value={form.iso_codes} onChange={(e) => setForm({...form, iso_codes: e.target.value})}
                  placeholder="Ví dụ: ISO 9999, ISO 9241"
                  className="w-full rounded-xl px-4 py-3 font-label-md font-mono bg-white text-black placeholder:text-slate-400 border-2 border-black focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all" />
              </div>
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">Mức WCAG</label>
                <div className="relative">
                  <select value={form.wcag_level} onChange={(e) => setForm({...form, wcag_level: e.target.value})}
                    className="w-full appearance-none rounded-xl px-4 py-3 font-bold cursor-pointer bg-white text-black border-2 border-black focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all">
                    <option value="">Không áp dụng</option>
                    <option value="A">Level A</option>
                    <option value="AA">Level AA</option>
                    <option value="AAA">Level AAA</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">WHO GATE Area</label>
                <div className="relative">
                  <select value={form.who_gate_area} onChange={(e) => setForm({...form, who_gate_area: e.target.value})}
                    className="w-full appearance-none rounded-xl px-4 py-3 font-bold cursor-pointer bg-white text-black border-2 border-black focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all">
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
          <section className="p-5 rounded-xl bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] bg-amber-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-700 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>tune</span>
              </div>
              <h3 className="text-base font-black text-black">Cấu hình</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white border border-outline">
                <label className="block text-xs font-bold text-on-surface mb-3">Trạng thái</label>
                <div className="flex flex-col gap-2">
                  {(['draft', 'published', 'archived'] as const).map((s) => (
                    <label key={s} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border-2 border-black hover:bg-yellow-50 transition-colors">
                      <input type="radio" name="status" value={s} checked={form.status === s} onChange={() => setForm({...form, status: s})}
                        className="w-4 h-4 accent-black" />
                      <span className="text-sm font-bold text-black">
                        {s === 'draft' ? 'Bản nháp' : s === 'published' ? 'Xuất bản' : 'Lưu trữ'}
                      </span>
                    </label>
                  ))}
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
                  <div className="w-12 h-7 bg-slate-200 border-2 border-black rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-black after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-300"></div>
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
    <div className="bg-white rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_#000] hover:shadow-[6px_6px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all duration-200 overflow-hidden group">
      {/* Ảnh sản phẩm - lớn, chiếm phần lớn card */}
      <div className="relative aspect-square bg-white overflow-hidden border-b-[3px] border-black">
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
            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]">
              HOT
            </span>
          )}
          {!isPublished && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-slate-700 text-white border-2 border-black shadow-[2px_2px_0px_0px_#000]">
              Nháp
            </span>
          )}
        </div>

        {/* Action buttons - góc trên phải (hover only) */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(product); }}
            className="w-7 h-7 rounded-md bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center text-black hover:bg-blue-200 transition-colors"
            title="Sửa"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(product); }}
            className="w-7 h-7 rounded-md bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center text-black hover:bg-red-300 transition-colors"
            title="Xóa"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>

        {/* Quick publish toggle - góc dưới phải */}
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePublish(product); }}
          className={clsx(
            'absolute bottom-2 right-2 px-2 py-1 rounded-md text-[10px] font-black border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center gap-1 transition-colors',
            isPublished
              ? 'bg-emerald-300 text-black hover:bg-emerald-400'
              : 'bg-white text-black hover:bg-blue-200'
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
        <h3 className="text-[13px] font-bold text-black line-clamp-2 leading-snug min-h-[34px]">
          {product.title}
        </h3>

        {/* Giá - prominent */}
        {product.price_range && (
          <div className="flex items-baseline gap-1">
            <span className="text-red-600 font-black text-[15px] leading-tight">
              {formatPrice(product.price_range)}
            </span>
          </div>
        )}

        {/* Meta: brand + category */}
        <div className="flex items-center gap-1 text-[11px]">
          {product.brand && (
            <span className="font-bold text-black truncate">{product.brand}</span>
          )}
          <span className={clsx('px-1.5 py-0.5 rounded border-2 border-black text-[10px] font-bold', style.bg, style.text)}>
            {categoryName}
          </span>
        </div>

        {/* Options/variants - TGDD style */}
        {(product.wcag_level || (Array.isArray(product.iso_codes) && product.iso_codes.length > 0)) && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {product.wcag_level && (
              <span className="px-1.5 py-0.5 rounded border-2 border-black text-[10px] text-black bg-slate-100 font-bold">
                WCAG {product.wcag_level}
              </span>
            )}
            {Array.isArray(product.iso_codes) && product.iso_codes.slice(0, 2).map((iso, idx) => (
              <span key={idx} className="px-1.5 py-0.5 rounded border-2 border-black text-[10px] text-black bg-slate-100 font-mono font-bold">
                {iso}
              </span>
            ))}
            {product.who_gate_area && (
              <span className="px-1.5 py-0.5 rounded border-2 border-black text-[10px] text-black bg-emerald-100 font-bold">
                WHO {product.who_gate_area}
              </span>
            )}
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
    <div className="bg-white rounded-2xl border-[3px] border-black shadow-[6px_6px_0px_0px_#000] hover:shadow-[10px_10px_0px_0px_#000] hover:-translate-x-[2px] hover:-translate-y-[2px] transition-all duration-200 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={clsx('w-12 h-12 rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] flex items-center justify-center', style.bg)}>
            <span className={clsx('material-symbols-outlined text-xl', style.text)} style={{ fontVariationSettings: "'FILL' 1" }}>{style.icon}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-black text-sm truncate">{category.name_vi}</h3>
            <p className="text-xs text-slate-500 truncate">{category.name_en}</p>
          </div>
        </div>

        {(category.description_vi || category.description_en) && (
          <p className="text-xs text-slate-600 line-clamp-2 mb-3">{category.description_vi || category.description_en}</p>
        )}

        <div className="flex items-center gap-2 mb-3 text-xs">
          <span className={clsx('px-2.5 py-1 rounded-md border-2 border-black font-black', style.bg, style.text)}>{productCount} SP</span>
          <span className="px-2.5 py-1 rounded-md border-2 border-black bg-white text-black font-mono font-bold">#{category.sort_order}</span>
        </div>

        <div className="flex items-center gap-2 pt-3 border-t-2 border-black">
          <button onClick={() => onEdit(category)}
            className="flex-1 py-2.5 rounded-lg bg-white border-2 border-black text-black hover:bg-blue-100 shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all text-xs font-bold">
            Sửa
          </button>
          <button onClick={() => onAddProduct(category)}
            className="flex-1 py-2.5 rounded-lg bg-black text-white border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all text-xs font-bold">
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
  const colorMap: Record<string, { bg: string; text: string; accent: string }> = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-700', accent: 'bg-blue-500' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-700', accent: 'bg-purple-500' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-700', accent: 'bg-amber-500' },
    green: { bg: 'bg-green-100', text: 'text-green-700', accent: 'bg-green-500' },
    rose: { bg: 'bg-rose-100', text: 'text-rose-700', accent: 'bg-rose-500' },
  };
  const colors = colorMap[color] || colorMap.blue;

  return (
    <div className={clsx(
      'relative bg-white rounded-2xl p-5 border-[3px] border-black',
      'shadow-[6px_6px_0px_0px_#000]',
      'hover:shadow-[10px_10px_0px_0px_#000] hover:-translate-x-[2px] hover:-translate-y-[2px]',
      'transition-all duration-200',
      'flex items-center gap-4'
    )}>
      <div className={clsx(
        'w-14 h-14 rounded-xl border-[3px] border-black flex items-center justify-center',
        'shadow-[3px_3px_0px_0px_#000]',
        colors.bg
      )}>
        <span className={clsx('material-symbols-outlined text-2xl', colors.text)} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <h3 className="text-3xl font-black text-black leading-none">{value}</h3>
          {subValue && (
            <span className={clsx(
              'px-2.5 py-1 rounded-md border-2 border-black text-[10px] font-black',
              colors.accent, 'text-white'
            )}>
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
  // ⭐ NEW: ISO/WHO filter
  const [filterIso, setFilterIso] = useState('');
  const [filterWho, setFilterWho] = useState('');
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
        featured: showFeatured || undefined, limit: 200, offset: 0,
      });
      if (res.success && res.data) {
        let items = res.data.items || [];
        // ⭐ NEW: client-side filter ISO/WHO
        if (filterIso) {
          items = items.filter((p: any) => {
            const iso = (p.iso_codes || '').toString();
            return iso.includes(filterIso);
          });
        }
        if (filterWho) {
          items = items.filter((p: any) => (p.who_gate_area || '').toLowerCase().includes(filterWho.toLowerCase()));
        }
        setProducts(items.slice(page * pageSize, (page + 1) * pageSize));
        setTotalProducts(items.length);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [search, filterCategory, showFeatured, filterIso, filterWho, page]);

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
          <div className="flex flex-col gap-3 p-4 bg-white rounded-2xl border-[3px] border-black shadow-[6px_6px_0px_0px_#000] mb-5">
            {/* Category Pills */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setFilterCategory('')}
                className={clsx('px-3 py-1.5 rounded-lg font-bold text-sm transition-all border-2 border-black',
                  !filterCategory
                    ? 'bg-black text-white shadow-[3px_3px_0px_0px_#000]'
                    : 'bg-white text-black hover:bg-slate-100 shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px]')}>
                Tất cả
              </button>
              {categories.map((cat) => {
                const filterStyles: Record<string, { icon: string; bg: string; text: string }> = {
                  vision: { icon: 'visibility', bg: 'bg-blue-200', text: 'text-blue-700' },
                  hearing: { icon: 'hearing', bg: 'bg-yellow-200', text: 'text-yellow-700' },
                  mobility: { icon: 'accessible', bg: 'bg-rose-200', text: 'text-rose-700' },
                  cognition: { icon: 'psychology', bg: 'bg-purple-200', text: 'text-purple-700' },
                  communication: { icon: 'forum', bg: 'bg-cyan-200', text: 'text-cyan-700' },
                  daily_living: { icon: 'home', bg: 'bg-green-200', text: 'text-green-700' },
                  education: { icon: 'school', bg: 'bg-indigo-200', text: 'text-indigo-700' },
                  general: { icon: 'inventory_2', bg: 'bg-slate-200', text: 'text-slate-700' },
                };
                const fStyle = filterStyles[cat.id] || filterStyles.general;
                const isActive = filterCategory === cat.id;
                return (
                  <button key={cat.id} onClick={() => setFilterCategory(filterCategory === cat.id ? '' : cat.id)}
                    className={clsx('px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1.5 transition-all border-2 border-black',
                      isActive
                        ? 'bg-black text-white shadow-[3px_3px_0px_0px_#000]'
                        : `${fStyle.bg} ${fStyle.text} shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px]`)}>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{fStyle.icon}</span>
                    {cat.name_vi}
                  </button>
                );
              })}
            </div>

            {/* Search & Actions */}
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[180px] max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-black text-lg">search</span>
                <input className="w-full h-9 pl-9 pr-3 rounded-lg bg-white border-2 border-black font-bold text-sm text-black placeholder:text-slate-400 focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all"
                  placeholder="Tìm sản phẩm..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <button onClick={() => setShowFeatured(!showFeatured)}
                className={clsx('px-3 h-9 rounded-lg font-bold text-sm flex items-center gap-1.5 transition-all border-2 border-black',
                  showFeatured
                    ? 'bg-amber-400 text-black shadow-[3px_3px_0px_0px_#000]'
                    : 'bg-white text-black hover:bg-amber-50 shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px]')}>
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                Nổi bật
              </button>
              <button onClick={loadProducts}
                className="w-9 h-9 rounded-lg bg-white border-2 border-black flex items-center justify-center text-black hover:bg-slate-100 shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all">
                <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
              </button>
              {/* ⭐ NEW: ISO filter */}
              <input
                placeholder="Lọc theo ISO (vd 22.06)"
                value={filterIso}
                onChange={(e) => setFilterIso(e.target.value)}
                className="h-9 px-3 rounded-lg bg-white border-2 border-black font-bold text-sm text-black placeholder:text-slate-400 focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all w-40"
              />
              {/* ⭐ NEW: WHO GATE filter */}
              <select
                value={filterWho}
                onChange={(e) => setFilterWho(e.target.value)}
                className="h-9 px-3 rounded-lg bg-white border-2 border-black font-bold text-sm text-black focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all"
              >
                <option value="">WHO GATE (tất cả)</option>
                <option value="hearing">Hearing</option>
                <option value="vision">Vision</option>
                <option value="mobility">Mobility</option>
                <option value="cognition">Cognition</option>
                <option value="communication">Communication</option>
                <option value="self_care">Self-care</option>
              </select>
            </div>
          </div>

          {/* Products Grid */}
          {loading ? (
            <div className="min-h-[200px] flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin"></div>
            </div>
          ) : products.length === 0 ? (
            <div className="min-h-[200px] flex flex-col items-center justify-center p-8 bg-white rounded-2xl border-[3px] border-black shadow-[6px_6px_0px_0px_#000]">
              <div className="w-16 h-16 rounded-xl border-[3px] border-black shadow-[3px_3px_0px_0px_#000] bg-white flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl text-black">inventory_2</span>
              </div>
              <h3 className="text-title-md font-black text-black mb-1">Chưa có sản phẩm nào</h3>
              <p className="text-body-md text-slate-600 mb-4">Thêm sản phẩm đầu tiên để AI có thể tư vấn.</p>
              <button onClick={() => handleOpenAddProduct()}
                className="px-6 py-3 bg-black text-white rounded-xl font-bold border-[3px] border-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[5px_5px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all flex items-center gap-2">
                <Plus className="w-5 h-5" /> Thêm sản phẩm
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {products.map((prod) => (
                  <ProductCard key={prod.id} product={prod} categoryName={getCategoryName(prod.category)}
                    onEdit={(p) => { setEditingProduct(p); setShowProductModal(true); }} onDelete={handleDeleteProduct} onTogglePublish={handleTogglePublish} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-8">
                  <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                    className="px-5 py-2.5 rounded-xl border-2 border-black bg-white text-black font-bold shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all disabled:opacity-30 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0">
                    ← Trước
                  </button>
                  <span className="px-5 py-2.5 rounded-xl border-2 border-black bg-white text-black font-bold shadow-[2px_2px_0px_0px_#000]">Trang {page + 1} / {totalPages}</span>
                  <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                    className="px-5 py-2.5 rounded-xl border-2 border-black bg-white text-black font-bold shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all disabled:opacity-30 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0">
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
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
