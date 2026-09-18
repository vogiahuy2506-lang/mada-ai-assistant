import { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi, Product, Category } from './adminApi';
import { AIImportCard } from './AIImportCard';
import { formatPrice } from '../../lib/formatPrice';
import { getImageUrl } from '../../lib/imageProxy';
import { useTranslation } from '@/lib/translations';
import {
 Plus, RefreshCw, Loader2, CheckCircle2, AlertCircle,
 Languages,
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
 const { t } = useTranslation();
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
  if (!form.name_vi || !form.name_en) { setError(t('admin.products.pleaseEnterBothNames')); return; }
  setSaving(true); setError('');
  try { await onSave(form); } catch (e: any) { setError(e.message); } finally { setSaving(false); }
 };

 return (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
   <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
   <div className="relative w-full max-w-xl rounded-2xl overflow-hidden bg-white border-[4px] border-black shadow-[1px_1px_0px_0px_#000]">
    <div className="flex items-center justify-between p-5 border-b-[3px] border-black bg-yellow-200">
     <div>
      <h2 className="text-lg font-black text-black">{category ? t('admin.products.categoryEdit') : t('admin.products.categoryNew')}</h2>
      <p className="text-xs text-black/70 mt-0.5">{category ? t('admin.products.categoryUpdateHint') : t('admin.products.categoryAddHint')}</p>
     </div>
     <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white border-2 border-black flex items-center justify-center text-black hover:bg-red-200 transition-all">
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
       <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">{t('admin.products.categoryIcon')}</label>
      <div className="flex items-center gap-3">
       <div className="w-11 h-11 rounded-xl bg-yellow-300 border-2 border-black shadow-[1px_1px_0px_0px_#000] flex items-center justify-center text-black font-black">
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
       <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">{t('admin.products.descVi')}</label>
       <textarea value={form.description_vi} onChange={(e) => setForm({...form, description_vi: e.target.value})} rows={2} 
        className="w-full px-4 py-3 rounded-xl border border-outline bg-surface-container-low font-label-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" />
      </div>
      <div>
       <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">{t('admin.products.descEn')}</label>
       <textarea value={form.description_en} onChange={(e) => setForm({...form, description_en: e.target.value})} rows={2} 
        className="w-full px-4 py-3 rounded-xl border border-outline bg-surface-container-low font-label-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" />
      </div>
     </div>

     <div className="grid grid-cols-2 gap-4">
      <div>
       <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">{t('admin.products.docLink')}</label>
       <input type="url" value={form.related_url} onChange={(e) => setForm({...form, related_url: e.target.value})} placeholder="https://..." 
        className="w-full px-4 py-3 rounded-xl border border-outline bg-surface-container-low font-label-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
      </div>
      <div>
       <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5 ml-1">{t('admin.products.productLink')}</label>
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
     <button onClick={onClose} className="px-5 py-2.5 rounded-xl border-2 border-black font-bold text-black bg-white shadow-[1px_1px_0px_0px_#000]  transition-all">{t('admin.common.cancel')}</button>
     <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl bg-black text-white border-2 border-black font-bold shadow-[1px_1px_0px_0px_#000]  flex items-center gap-2 transition-all disabled:opacity-50">
      {saving && <Loader2 className="w-4 h-4 animate-spin" />}
      {saving ? t('admin.products.saving') : t('admin.common.save')}
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
 const { t: tp } = useTranslation();
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
const [importing, setImporting] = useState(false);
const [importError, setImportError] = useState('');
const [importSuccess, setImportSuccess] = useState(false);
const [importMeta, setImportMeta] = useState<{title: string; description: string; image: string; siteName: string} | null>(null);

const handleSave = async () => {
  if (!form.title.trim()) { setError(tp('admin.products.pleaseEnterName')); return; }
  if (!form.category) { setError(tp('admin.products.chooseCategory')); return; }
  setSaving(true); setError('');
  try {
   const iso_codes = form.iso_codes.split(',').map(s => s.trim()).filter(Boolean);
   await onSave({ ...form, iso_codes: iso_codes as any, featured: !!form.featured });
  } catch (e) { setError((e as Error)?.message || tp('admin.common.error')); } finally { setSaving(false); }
 };

// ============== URL IMPORT ==============
const handleImportFromUrl = async () => {
  const url = (form.source_url || form.product_url || '').trim();
  if (!url) { setImportError(tp('admin.products.pleaseEnterUrl')); return; }
  if (!/^https?:\/\//i.test(url)) {
    setImportError(tp('admin.products.urlMustStartWithHttp'));
    return;
  }
  setImporting(true); setImportError(''); setImportSuccess(false);
  try {
    const res = await adminApi.scrapeUrlMetadata(url);
    if (res.success && res.data) {
      const meta = res.data;
      if (meta.title && !form.title) setForm((f) => ({ ...f, title: meta.title }));
      if (meta.description && !form.description) setForm((f) => ({ ...f, description: meta.description }));
      if (meta.image && !form.image_url) setForm((f) => ({ ...f, image_url: meta.image }));
      if (meta.title && !form.title_en) setForm((f) => ({ ...f, title_en: meta.title }));
      if (meta.description && !form.description_en) setForm((f) => ({ ...f, description_en: meta.description }));
      // Hỏi người dùng: muốn import vào con chat không?
      setImportMeta(meta);
      setImportSuccess(true);
    } else {
      setImportError(res.error || tp('admin.products.fetchFailed'));
    }
  } catch (e) {
    setImportError((e as Error)?.message || tp('admin.common.error'));
  } finally {
    setImporting(false);
  }
};

 return (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
   <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

   <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl overflow-hidden bg-white border border-slate-200 shadow-xl">
    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
     <div>
      <h2 className="text-base font-semibold text-black">{product ? tp('admin.common.edit') + ' ' + tp('admin.products.tabProducts') : tp('admin.products.addProduct')}</h2>
      <p className="text-xs text-slate-500 mt-0.5">{product ? tp('admin.products.categoryUpdateHint') : tp('admin.products.empty')}</p>
     </div>
     <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
      <span className="material-symbols-outlined text-base">close</span>
     </button>
    </div>

    <div className="flex-1 overflow-y-auto p-5 space-y-4">
     {/* Section 1: Thông tin cơ bản */}
     <section className="p-4 rounded-lg bg-white border border-slate-200">
      <h3 className="text-sm font-semibold text-black mb-3 flex items-center gap-2">
       <span className="material-symbols-outlined text-base text-slate-400">info</span>
       {tp('admin.products.basicInfo')}
       <span className="ml-auto text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{tp('admin.products.required')}</span>
      </h3>
      <div className="grid grid-cols-2 gap-3">
       <div className="col-span-2">
        <label className="block text-xs font-medium text-slate-600 mb-1">{tp('admin.products.productCategory')} <span className="text-red-500">*</span></label>
        <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}
         className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-black focus:outline-none focus:border-primary transition-colors">
         <option value="">{tp('admin.products.chooseCategory')}</option>
         {categories.map((c) => (<option key={c.id} value={c.id}>{c.icon} {c.name_vi}</option>))}
        </select>
       </div>

       <div className="col-span-2">
        <label className="block text-xs font-medium text-slate-600 mb-1">{tp('admin.products.productNameVi')} <span className="text-red-500">*</span></label>
        <input type="text" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})}
         placeholder={tp('admin.products.pleaseEnterName')}
         className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-black placeholder:text-slate-400 focus:outline-none focus:border-primary transition-colors" />
       </div>

       <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{tp('admin.products.productNameEn')}</label>
        <input type="text" value={form.title_en} onChange={(e) => setForm({...form, title_en: e.target.value})}
         placeholder={tp('admin.products.englishNamePlaceholder')}
         className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-black placeholder:text-slate-400 focus:outline-none focus:border-primary transition-colors" />
       </div>

       <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{tp('admin.products.brand')}</label>
        <input type="text" value={form.brand} onChange={(e) => setForm({...form, brand: e.target.value})}
         placeholder="Apple, Microsoft..."
         className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-black placeholder:text-slate-400 focus:outline-none focus:border-primary transition-colors" />
       </div>

       <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{tp('admin.products.priceRange')}</label>
        <input type="text" value={form.price_range} onChange={(e) => setForm({...form, price_range: e.target.value})}
         placeholder={tp('admin.products.pricePlaceholder')}
         className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-black placeholder:text-slate-400 focus:outline-none focus:border-primary transition-colors" />
       </div>
      </div>
     </section>

     {/* Section 2: Mô tả */}
     <section className="p-4 rounded-lg bg-white border border-slate-200">
      <h3 className="text-sm font-semibold text-black mb-3 flex items-center gap-2">
       <span className="material-symbols-outlined text-base text-slate-400">description</span>
       {tp('admin.products.descSection')}
      </h3>
      <div className="space-y-3">
       <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{tp('admin.products.descShortVi')}</label>
        <textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})}
         rows={2} placeholder="Tóm tắt ngắn gọn"
         className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-black placeholder:text-slate-400 focus:outline-none focus:border-primary transition-colors resize-none" />
       </div>
       <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{tp('admin.products.descShortEn')}</label>
        <textarea value={form.description_en} onChange={(e) => setForm({...form, description_en: e.target.value})}
         rows={2} placeholder="Short summary"
         className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-black placeholder:text-slate-400 focus:outline-none focus:border-primary transition-colors resize-none" />
       </div>
      </div>
     </section>

      {/* Section 3: Liên kết */}
     <section className="p-4 rounded-lg bg-white border border-slate-200">
      <div className="flex items-center justify-between mb-3">
       <h3 className="text-sm font-semibold text-black flex items-center gap-2">
        <span className="material-symbols-outlined text-base text-slate-400">link</span>
        {tp('admin.products.linksTech')}
       </h3>
       {!product && (
         <button type="button" onClick={handleImportFromUrl} disabled={importing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
          {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="material-symbols-outlined text-sm">download</span>}
          {tp('admin.products.importUrl')}
         </button>
       )}
      </div>
      {importError && (
       <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">{importError}</div>
      )}
      {importSuccess && importMeta && (
       <div className="mb-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-start gap-3">
         <span className="material-symbols-outlined text-green-600 text-lg mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
         <div className="flex-1">
          <p className="text-sm font-medium text-green-800 mb-1">{tp('admin.products.metadataFetched')}</p>
          <div className="flex gap-2">
<button type="button" onClick={() => window.open(`${window.location.origin}/chat`, '_blank')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700">
            <span className="material-symbols-outlined text-sm">chat</span> {tp('admin.products.openChat')}
          </button>
           <button type="button" onClick={() => { setImportSuccess(false); setImportMeta(null); }}
            className="px-3 py-1.5 rounded-lg bg-white border border-green-300 text-green-700 text-xs font-medium hover:bg-green-50">
            {tp('admin.products.continueEditing')}
           </button>
          </div>
         </div>
        </div>
       </div>
      )}
      <div className="grid grid-cols-3 gap-3">
       <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{tp('admin.products.sourceLink')}</label>
        <input type="url" value={form.source_url} onChange={(e) => setForm({...form, source_url: e.target.value})}
         placeholder="https://"
         className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-black placeholder:text-slate-400 focus:outline-none focus:border-primary transition-colors" />
       </div>
       <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{tp('admin.products.buyLink')}</label>
        <input type="url" value={form.product_url} onChange={(e) => setForm({...form, product_url: e.target.value})}
         placeholder="https://"
         className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-black placeholder:text-slate-400 focus:outline-none focus:border-primary transition-colors" />
       </div>
       <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{tp('admin.products.imageLink')}</label>
        <input type="url" value={form.image_url} onChange={(e) => setForm({...form, image_url: e.target.value})}
         placeholder="https://"
         className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-black placeholder:text-slate-400 focus:outline-none focus:border-primary transition-colors" />
        {form.image_url && (
         <img src={form.image_url} alt="Preview" className="mt-1.5 w-full h-12 object-cover rounded-lg"
          onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
        )}
       </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
       <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{tp('admin.products.isoCode')}</label>
        <input type="text" value={form.iso_codes} onChange={(e) => setForm({...form, iso_codes: e.target.value})}
         placeholder="ISO 9999..."
         className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-black placeholder:text-slate-400 focus:outline-none focus:border-primary transition-colors" />
       </div>
       <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{tp('admin.products.wcagLevel')}</label>
        <select value={form.wcag_level} onChange={(e) => setForm({...form, wcag_level: e.target.value})}
         className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-black focus:outline-none focus:border-primary transition-colors">
         <option value="">{tp('admin.products.none')}</option>
         <option value="A">{tp('admin.products.wcagA')}</option>
         <option value="AA">{tp('admin.products.wcagAA')}</option>
         <option value="AAA">{tp('admin.products.wcagAAA')}</option>
        </select>
       </div>
       <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{tp('admin.products.whoGateArea')}</label>
        <select value={form.who_gate_area} onChange={(e) => setForm({...form, who_gate_area: e.target.value})}
         className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-black focus:outline-none focus:border-primary transition-colors">
         <option value="">{tp('admin.products.choose')}</option>
         <option value="vision">{tp('admin.products.vision')}</option>
         <option value="hearing">{tp('admin.products.hearing')}</option>
         <option value="mobility">{tp('admin.products.mobility')}</option>
         <option value="cognition">{tp('admin.products.cognition')}</option>
         <option value="communication">{tp('admin.products.communication')}</option>
         <option value="self_care">{tp('admin.products.selfCare')}</option>
        </select>
       </div>
      </div>
     </section>

     {/* Section 4: Cấu hình */}
     <section className="p-4 rounded-lg bg-white border border-slate-200">
      <h3 className="text-sm font-semibold text-black mb-3 flex items-center gap-2">
       <span className="material-symbols-outlined text-base text-slate-400">tune</span>
       {tp('admin.products.config')}
      </h3>
      <div className="grid grid-cols-3 gap-3">
       <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">{tp('admin.products.productStatus')}</label>
        <div className="flex gap-1">
         {(['draft', 'published', 'archived'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setForm({...form, status: s})}
           className={clsx('flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
            form.status === s ? 'bg-black text-white border-black' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50')}>
           {s === 'draft' ? tp('admin.products.draft') : s === 'published' ? tp('admin.products.published') : tp('admin.products.archived')}
          </button>
         ))}
        </div>
       </div>

       <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">{tp('admin.products.lang')}</label>
        <select value={form.language} onChange={(e) => setForm({...form, language: e.target.value})}
         className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-black focus:outline-none focus:border-primary">
         <option value="vi">{tp('admin.products.langVi')}</option>
         <option value="en">{tp('admin.products.langEn')}</option>
        </select>
       </div>

       <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">{tp('admin.products.featured')}</label>
        <button type="button" onClick={() => setForm({...form, featured: !form.featured})}
         className={clsx('w-full py-2 rounded-lg text-xs font-medium border transition-colors',
          form.featured ? 'bg-amber-400 text-black border-amber-400' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50')}>
         {form.featured ? tp('admin.products.featuredYes') : tp('admin.products.featuredNo')}
        </button>
       </div>
      </div>
     </section>

     {error && (
      <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
       <span className="material-symbols-outlined text-sm">error</span>
       {error}
      </div>
     )}
    </div>

    <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-200 bg-slate-50">
     <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-100 transition-colors">{tp('admin.common.cancel')}</button>
     <button onClick={handleSave} disabled={saving}
      className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50">
      {saving && <Loader2 className="w-4 h-4 animate-spin" />}
      {saving ? tp('admin.products.saving') : tp('admin.common.save')}
     </button>
    </div>
   </div>
  </div>
 );
}

// ==================== PRODUCT CARD ====================
function ProductCard({ product, categoryName, onEdit, onDelete, onTogglePublish, onTranslate }: {
 product: Product; categoryName: string;
 onEdit: (p: Product) => void; onDelete: (p: Product) => void; onTogglePublish: (p: Product) => void;
 onTranslate: (p: Product) => void;
}) {
 const { t } = useTranslation();
 const isPublished = product.status === 'published';
 const catColors: Record<string, { bg: string; text: string }> = {
  vision: { bg: 'bg-blue-100', text: 'text-blue-700' },
  hearing: { bg: 'bg-amber-100', text: 'text-amber-700' },
  mobility: { bg: 'bg-rose-100', text: 'text-rose-700' },
  cognition: { bg: 'bg-purple-100', text: 'text-purple-700' },
  communication: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  daily_living: { bg: 'bg-green-100', text: 'text-green-700' },
  education: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  general: { bg: 'bg-slate-100', text: 'text-slate-700' },
 };
 const colors = catColors[product.category] || catColors.general;

 return (
  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden group hover:shadow-md transition-shadow">
   {/* Ảnh */}
   <div className="relative aspect-square bg-slate-50">
    {product.image_url ? (
     <img
      src={getImageUrl(product.image_url)}
      alt={product.title}
      className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-200"
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
     />
    ) : (
     <div className="w-full h-full flex items-center justify-center text-slate-300">
      <span className="material-symbols-outlined text-4xl">image</span>
     </div>
    )}

    {/* Status badges */}
    <div className="absolute top-2 left-2 flex gap-1">
     {product.featured && (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-400 text-black border border-black/20">
       HOT
      </span>
     )}
     {!isPublished && (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-slate-500 text-white border border-black/20">
       {t('admin.products.draft')}
      </span>
     )}
    </div>

    {/* Actions */}
    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
     <button onClick={(e) => { e.stopPropagation(); onTranslate(product); }}
      className="w-7 h-7 rounded bg-white/90 border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-purple-100 hover:text-purple-600 transition-colors"
      title="Dịch AI (EN/AR/FR)">
      <Languages className="w-4 h-4" />
     </button>
     <button onClick={(e) => { e.stopPropagation(); onEdit(product); }}
      className="w-7 h-7 rounded bg-white/90 border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-blue-100 hover:text-blue-600 transition-colors"
      title={t('admin.common.edit')}>
      <span className="material-symbols-outlined text-sm">edit</span>
     </button>
     <button onClick={(e) => { e.stopPropagation(); onDelete(product); }}
      className="w-7 h-7 rounded bg-white/90 border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-red-100 hover:text-red-500 transition-colors"
      title={t('admin.common.delete')}>
      <span className="material-symbols-outlined text-sm">delete</span>
     </button>
    </div>
   </div>

   {/* Nội dung */}
   <div className="p-3">
    <h3 className="text-sm font-semibold text-black line-clamp-2 leading-snug mb-1">
     {product.title}
    </h3>

    {product.price_range && (
     <p className="text-sm font-bold text-red-600 mb-2">{formatPrice(product.price_range)}</p>
    )}

    <div className="flex items-center justify-between">
     <span className={clsx('text-[11px] px-2 py-0.5 rounded font-medium truncate', colors.bg, colors.text)}>{categoryName}</span>
     <button
      onClick={(e) => { e.stopPropagation(); onTogglePublish(product); }}
      className={clsx(
       'px-2 py-1 rounded text-[10px] font-bold border transition-colors',
       isPublished
        ? 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200'
        : 'bg-white text-slate-600 border-slate-300 hover:bg-blue-100 hover:text-blue-600'
      )}
     >
      {isPublished ? '✓ ' + t('admin.products.published') : t('admin.products.draft')}
     </button>
    </div>
   </div>
  </div>
 );
}

// ==================== CATEGORY CARD ====================
function CategoryCard({ category, productCount, onEdit, onAddProduct }: {
 category: Category; productCount: number; onEdit: (c: Category) => void; onAddProduct: (c: Category) => void;
}) {
 const { t } = useTranslation();
 const catColors: Record<string, { bg: string; text: string; icon: string }> = {
  vision: { bg: 'bg-blue-100 text-blue-600', text: 'text-blue-700', icon: 'visibility' },
  hearing: { bg: 'bg-amber-100 text-amber-600', text: 'text-amber-700', icon: 'hearing' },
  mobility: { bg: 'bg-rose-100 text-rose-600', text: 'text-rose-700', icon: 'accessible' },
  cognition: { bg: 'bg-purple-100 text-purple-600', text: 'text-purple-700', icon: 'psychology' },
  communication: { bg: 'bg-cyan-100 text-cyan-600', text: 'text-cyan-700', icon: 'forum' },
  daily_living: { bg: 'bg-green-100 text-green-600', text: 'text-green-700', icon: 'home' },
  education: { bg: 'bg-indigo-100 text-indigo-600', text: 'text-indigo-700', icon: 'school' },
  general: { bg: 'bg-slate-100 text-slate-600', text: 'text-slate-700', icon: 'inventory_2' },
 };
 const colors = catColors[category.id] || catColors.general;

 return (
  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
   <div className="p-4">
    <div className="flex items-center gap-3 mb-2">
     <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center text-lg', colors.bg)}>
      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{colors.icon}</span>
     </div>
     <div className="min-w-0 flex-1">
      <h3 className="font-semibold text-black text-sm truncate">{category.name_vi}</h3>
      <p className="text-xs text-slate-400">{category.name_en}</p>
     </div>
    </div>

    <div className="flex items-center gap-2 text-xs">
     <span className={clsx('px-2 py-1 rounded font-medium', colors.bg)}>{productCount} SP</span>
     <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 font-mono">#{category.sort_order}</span>
    </div>

    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
     <button onClick={() => onEdit(category)}
      className="flex-1 py-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors text-xs font-medium">
      {t('admin.common.edit')}
     </button>
     <button onClick={() => onAddProduct(category)}
      className="flex-1 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors text-xs font-medium">
      + {t('admin.common.add')}
     </button>
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
 const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

 const loadCategories = useCallback(async () => {
  try {
   const res = await adminApi.getCategories();
   if (res.success && res.data) setCategories(Array.isArray(res.data) ? res.data : []);
  } catch (e: unknown) {
   // Ignore AbortError (timeout)
   if (e instanceof Error && e.name === 'AbortError') {
    console.warn('AdminProducts: Failed to load categories (timeout)');
   } else {
    console.error(e);
   }
  }
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
  } catch (e: unknown) {
   // Ignore AbortError (timeout)
   if (e instanceof Error && e.name === 'AbortError') {
    console.warn('AdminProducts: Failed to load products (timeout)');
   } else {
    console.error(e);
   }
  } finally { setLoading(false); }
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

 const handleSaveProduct = async (data: Partial<Product>) => {
  if (editingProduct) { await adminApi.updateProduct(editingProduct.id, data); }
  else { await adminApi.createProduct(data); }
  setShowProductModal(false); setEditingProduct(null); setDefaultCategory('');
  await loadProducts();
 };

const handleDeleteProduct = async (prod: Product) => {
  if (!confirm(t('admin.products.confirmDelete'))) return;
  const res = await adminApi.deleteProduct(prod.id);
  if (!res.success) alert(res.error);
  else await loadProducts();
};

const handleTogglePublish = async (prod: Product) => {
  const newStatus = prod.status === 'published' ? 'draft' : 'published';
  await adminApi.publishProduct(prod.id, newStatus as any);
  await loadProducts();
};

const handleTranslate = async (prod: Product) => {
  if (!confirm(`Dịch sản phẩm "${prod.title}" sang EN/AR/FR bằng AI?`)) return;
  try {
    const result = await adminApi.translateProduct(prod.id);
    if (result.success) {
      alert(`✅ Đã dịch thành công!`);
      await loadProducts();
    } else {
      alert(`❌ Lỗi: ${result.error}`);
    }
  } catch (e) {
    alert(`❌ Lỗi: ${(e as Error)?.message}`);
  }
};

const handlePublishAll = async () => {
  if (!confirm(t('admin.products.publishAll'))) return;
  const unpublished = products.filter(p => p.status !== 'published');
  if (unpublished.length === 0) {
    alert(t('admin.products.noUnpublished'));
    return;
  }
  try {
    const result = await adminApi.bulkPublish({ scope: 'all_unpublished' });
    const msg = result?.message || `Đã đăng ${unpublished.length} sản phẩm`;
    alert(`✅ ${msg}`);
    await loadProducts();
  } catch (e) {
    alert(`❌ Lỗi: ${(e as Error)?.message || 'Không thể đăng hàng loạt'}`);
  }
};

const handleBulkPublish = async () => {
  if (selectedProducts.size === 0) return;
  if (!confirm(t('admin.products.publishSelected'))) return;
  try {
    const result = await adminApi.bulkPublish({ ids: Array.from(selectedProducts), scope: 'selected' });
    const msg = result?.message || `${t('admin.common.success')}: ${selectedProducts.size} ${t('admin.products.count')}`;
    alert(msg);
    setSelectedProducts(new Set());
    await loadProducts();
  } catch (e) {
    alert(`${t('admin.common.error')}: ${(e as Error)?.message || t('admin.products.bulkPublishFailed')}`);
  }
};

const handleBulkUnpublish = async () => {
  if (selectedProducts.size === 0) return;
  if (!confirm(t('admin.products.unpublishSelected'))) return;
  try {
    const result = await adminApi.bulkUnpublish({ ids: Array.from(selectedProducts), scope: 'selected' });
    const msg = result?.message || `${t('admin.common.success')}: ${selectedProducts.size} ${t('admin.products.count')}`;
    alert(msg);
    setSelectedProducts(new Set());
    await loadProducts();
  } catch (e) {
    alert(`${t('admin.common.error')}: ${(e as Error)?.message || t('admin.products.bulkUnpublishFailed')}`);
  }
};

const totalPages = Math.ceil(totalProducts / pageSize);

 const getCategoryName = (id: string) => categories.find((c) => c.id === id)?.name_vi || id;
 const getProductCount = (catId: string) => products.filter(p => p.category === catId).length;

 const handleOpenAddProduct = (cat?: Category) => {
  setEditingProduct(null);
  setDefaultCategory(cat?.id || '');
  setShowProductModal(true);
 };

  const { t } = useTranslation();

  return (
   <AdminLayout
    title={t('admin.topBar.products')}
    titleEn="Product Management"
    titleAr="إدارة المنتجات"
    titleFr="Gestion des produits"
    subtitle={t('admin.topBar.productsSub')}
    subtitleEn="Central operating system for the MADA AI knowledge base."
    subtitleAr="نظام التشغيل المركزي لقاعدة معرفة MADA AI."
    subtitleFr="Système d'exploitation central pour la base de connaissances MADA AI."
    showFab={false}
    showLayoutTitle={false}
   >
   {/* Hero Banner */}
   <section className="mb-8">
    <div className="flex justify-between items-end mb-6 relative">
     <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-white to-amber-500/10 backdrop-blur-xl rounded-3xl"></div>
     <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent rounded-3xl"></div>
     <div className="max-w-2xl relative z-10 py-6 px-6">
      <h2 className="text-3xl font-black text-on-surface mb-3 tracking-tight">
       {t('admin.products.title2')}
      </h2>
      <p className="text-base font-medium text-on-surface-variant border-l-4 border-primary pl-5 py-2 bg-white/40 backdrop-blur-sm rounded-r-xl">
       {t('admin.products.subtitle2')}
      </p>
     </div>
    </div>
   </section>

   {/* Metrics Row */}
   <section className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
    <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-xl rounded-2xl p-4 border-[3px] border-black shadow-[4px_4px_0px_0px_#000] transform rotate-[-0.3deg] hover:rotate-0 transition-all flex items-center gap-3">
     <div className="w-10 h-10 rounded-xl border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000] bg-primary/20">
      <span className="material-symbols-outlined text-lg text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
     </div>
     <div>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('admin.products.statProducts')}</p>
      {loading ? (
       <div className="w-16 h-6 bg-gray-200 rounded animate-pulse"></div>
      ) : (
       <h3 className="text-xl font-black text-on-surface">{totalProducts.toLocaleString()}</h3>
      )}
      <p className="text-[10px] text-on-surface-variant mt-0.5">trong hệ thống</p>
     </div>
    </div>
    <div className="relative bg-gradient-to-br from-amber-50/80 to-amber-100/40 backdrop-blur-xl rounded-2xl p-4 border-[3px] border-black shadow-[4px_4px_0px_0px_#000] transform rotate-[0.3deg] hover:rotate-0 transition-all flex items-center gap-3">
     <div className="w-10 h-10 rounded-xl border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000] bg-amber-200">
      <span className="material-symbols-outlined text-lg text-amber-600" style={{ fontVariationSettings: "'FILL' 1" }}>category</span>
     </div>
     <div>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('admin.products.statCategories')}</p>
      {loading ? (
       <div className="w-10 h-6 bg-gray-200 rounded animate-pulse"></div>
      ) : (
       <h3 className="text-xl font-black text-on-surface">{categories.length}</h3>
      )}
      <p className="text-[10px] text-on-surface-variant mt-0.5">active</p>
     </div>
    </div>
    <div className="relative bg-gradient-to-br from-emerald-50/80 to-emerald-100/40 backdrop-blur-xl rounded-2xl p-4 border-[3px] border-black shadow-[4px_4px_0px_0px_#000] transform rotate-[-0.3deg] hover:rotate-0 transition-all flex items-center gap-3">
     <div className="w-10 h-10 rounded-xl border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000] bg-emerald-200">
      <span className="material-symbols-outlined text-lg text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
     </div>
     <div>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('admin.products.statPublished')}</p>
      {loading ? (
       <div className="w-10 h-6 bg-gray-200 rounded animate-pulse"></div>
      ) : (
       <h3 className="text-xl font-black text-on-surface">{products.filter(p => p.status === 'published').length}</h3>
      )}
      <p className="text-[10px] text-on-surface-variant mt-0.5">{t('admin.products.count')}</p>
     </div>
    </div>
   </section>

   {/* Error Banner */}
   {!loading && categories.length === 0 && (
    <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-xl flex items-center gap-3">
     <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
     <div>
      <p className="font-semibold text-red-700">{t('admin.products.loadCatFail')}</p>
      <p className="text-sm text-red-600">{t('admin.products.loadCatHint')}</p>
     </div>
     <button onClick={() => { loadCategories(); loadProducts(); }}
      className="ml-auto px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600">
      Thử lại
     </button>
    </div>
   )}

   {/* AI Import Card */}
   <AIImportCard categories={categories} onImportSuccess={loadProducts} />

   {/* Header với tabs */}
   <div className="flex items-center justify-between mb-6">
     <div>
      <h1 className="text-2xl font-black text-black">{t('admin.products.title2')}</h1>
      <p className="text-sm text-slate-500 mt-0.5">{totalProducts} {t('admin.products.count')} · {categories.length} {t('admin.products.tabCategories')}</p>
     </div>
     <div className="flex items-center gap-2">
      {products.some(p => p.status !== 'published') && (
       <button onClick={handlePublishAll}
        className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-bold text-sm border-2 border-black hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-[2px_2px_0px_0px_#000]">
        <CheckCircle2 className="w-4 h-4" /> {t('admin.products.publishAll')}
       </button>
      )}
      <button onClick={async () => {
        if (!confirm('🔄 Sync tất cả sản phẩm vào AI Knowledge Base?\n\nĐiều này sẽ:\n1. Đồng bộ kb_products → Knowledge Items\n2. Index vào Vector Store để AI tìm được\n\nCó thể mất 30-60 giây.')) return;
        try {
          const result = await (adminApi as any).syncAndIndex();
          if (result?.success) {
            alert(result.message || '✅ Sync hoàn tất!');
          } else {
            alert('❌ Lỗi: ' + (result?.error || 'Không rõ'));
          }
        } catch (e) {
          alert('❌ Lỗi: ' + (e as Error)?.message);
        }
      }}
       className="px-4 py-2 rounded-lg bg-violet-500 text-white font-bold text-sm border-2 border-black hover:bg-violet-600 transition-all flex items-center gap-2 shadow-[2px_2px_0px_0px_#000]">
       <RefreshCw className="w-4 h-4" /> Sync & Index
      </button>
      <button onClick={() => setViewMode('products')} 
       className={clsx('px-4 py-2 rounded-lg font-bold text-sm transition-all border-2 border-black',
        viewMode === 'products' 
         ? 'bg-black text-white' 
         : 'bg-white text-black hover:bg-slate-50')}>
       {t('admin.products.tabProducts')}
      </button>
      <button onClick={() => setViewMode('categories')} 
       className={clsx('px-4 py-2 rounded-lg font-bold text-sm transition-all border-2 border-black',
        viewMode === 'categories' 
         ? 'bg-black text-white' 
         : 'bg-white text-black hover:bg-slate-50')}>
       {t('admin.products.tabCategories')}
      </button>
      <button onClick={() => handleOpenAddProduct()}
       className="px-4 py-2 rounded-lg bg-primary text-white font-bold text-sm border-2 border-black hover:bg-primary/90 transition-all flex items-center gap-2">
       <Plus className="w-4 h-4" /> {t('admin.common.add')}
      </button>
     </div>
    </div>

   {/* Filter Bar - compact */}
   {viewMode === 'products' && (
    <>
     <div className="flex flex-wrap items-center gap-3 mb-5">
      {/* Category Pills */}
      <div className="flex flex-wrap gap-1.5">
       <button onClick={() => setFilterCategory('')}
        className={clsx('px-3 py-1.5 rounded-lg font-bold text-xs transition-all border border-slate-300',
         !filterCategory ? 'bg-black text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}>
        {t('admin.common.all')}
       </button>
       {categories.map((cat) => {
        const isActive = filterCategory === cat.id;
        const catColors: Record<string, { active: string; inactive: string; icon: string }> = {
         vision: { active: 'bg-blue-500 text-white border-blue-600', inactive: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200', icon: 'visibility' },
         hearing: { active: 'bg-amber-500 text-white border-amber-600', inactive: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200', icon: 'hearing' },
         mobility: { active: 'bg-rose-500 text-white border-rose-600', inactive: 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200', icon: 'accessible' },
         cognition: { active: 'bg-purple-500 text-white border-purple-600', inactive: 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200', icon: 'psychology' },
         communication: { active: 'bg-cyan-500 text-white border-cyan-600', inactive: 'bg-cyan-100 text-cyan-700 border-cyan-200 hover:bg-cyan-200', icon: 'forum' },
         daily_living: { active: 'bg-green-500 text-white border-green-600', inactive: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200', icon: 'home' },
         education: { active: 'bg-indigo-500 text-white border-indigo-600', inactive: 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200', icon: 'school' },
         general: { active: 'bg-slate-500 text-white border-slate-600', inactive: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200', icon: 'inventory_2' },
        };
        const colors = catColors[cat.id] || catColors.general;
        return (
         <button key={cat.id} onClick={() => setFilterCategory(filterCategory === cat.id ? '' : cat.id)}
          className={clsx('px-3 py-1.5 rounded-lg font-bold text-xs transition-all border flex items-center gap-1.5',
           isActive ? colors.active : colors.inactive)}>
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{colors.icon}</span>
          {cat.name_vi}
         </button>
        );
       })}
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-2 ml-auto">
       <select
        value={filterWho}
        onChange={(e) => setFilterWho(e.target.value)}
        className="h-8 px-3 rounded-lg bg-white border border-slate-300 font-medium text-xs text-black focus:outline-none focus:border-black"
       >
        <option value="">WHO GATE</option>
        <option value="hearing">Hearing</option>
        <option value="vision">Vision</option>
        <option value="mobility">Mobility</option>
        <option value="cognition">Cognition</option>
        <option value="communication">Communication</option>
        <option value="self_care">Self-care</option>
       </select>
       <input
        placeholder="ISO..."
        value={filterIso}
        onChange={(e) => setFilterIso(e.target.value)}
        className="h-8 px-3 rounded-lg bg-white border border-slate-300 font-medium text-xs text-black placeholder:text-slate-400 focus:outline-none focus:border-black w-28"
       />
       <div className="relative">
        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
        <input className="h-8 pl-8 pr-3 rounded-lg bg-white border border-slate-300 font-medium text-sm text-black placeholder:text-slate-400 focus:outline-none focus:border-black w-48"
         placeholder="Tìm..." value={search} onChange={(e) => setSearch(e.target.value)} />
       </div>
       <button onClick={() => setShowFeatured(!showFeatured)}
        className={clsx('px-3 h-8 rounded-lg font-bold text-xs flex items-center gap-1 transition-all border border-slate-300',
         showFeatured ? 'bg-amber-400 text-black' : 'bg-white text-slate-600 hover:bg-slate-50')}>
        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
       </button>
       <button onClick={loadProducts}
        className="w-8 h-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-all">
        <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
       </button>
      </div>
     </div>

     {/* Products Grid */}
     {loading ? (
      <div className="min-h-[200px] flex items-center justify-center">
       <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin"></div>
      </div>
     ) : products.length === 0 ? (
      <div className="min-h-[200px] flex flex-col items-center justify-center p-8 bg-white rounded-2xl border-[3px] border-black shadow-[1px_1px_0px_0px_#000]">
       <div className="w-16 h-16 rounded-xl border-[3px] border-black shadow-[1px_1px_0px_0px_#000] bg-white flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-3xl text-black">inventory_2</span>
       </div>
       <h3 className="text-title-md font-black text-black mb-1">{t('admin.products.emptyTitle')}</h3>
       <p className="text-body-md text-slate-600 mb-4">{t('admin.products.emptyHint')}</p>
       <button onClick={() => handleOpenAddProduct()}
        className="px-6 py-3 bg-black text-white rounded-xl font-bold border-[3px] border-black shadow-[1px_1px_0px_0px_#000]  transition-all flex items-center gap-2">
        <Plus className="w-5 h-5" /> {t('admin.products.addProduct')}
       </button>
      </div>
     ) : (
      <>
       {products.length > 0 && (
        <div className="mb-4 flex items-center gap-3 p-3 bg-slate-50 rounded-xl border-2 border-black">
         <input
          type="checkbox"
          id="select-all"
          checked={selectedProducts.size === products.length && products.length > 0}
          onChange={(e) => {
           if (e.target.checked) setSelectedProducts(new Set(products.map(p => p.id)));
           else setSelectedProducts(new Set());
          }}
          className="w-5 h-5 rounded border-2 border-black text-indigo-600 focus:ring-indigo-500"
         />
         <label htmlFor="select-all" className="font-bold text-sm text-black cursor-pointer">{t('admin.common.selectAll')} ({products.length})</label>
         {selectedProducts.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
           <span className="text-sm font-bold text-slate-600">{selectedProducts.size} {t('admin.common.selected')}</span>
           <button onClick={handleBulkPublish}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white font-bold text-xs border-2 border-black hover:bg-emerald-600 transition-all">
            ✓ {t('admin.products.publishSelected')}
           </button>
           <button onClick={handleBulkUnpublish}
            className="px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold text-xs border-2 border-black hover:bg-amber-600 transition-all">
            ✗ {t('admin.products.unpublishSelected')}
           </button>
           <button onClick={() => setSelectedProducts(new Set())}
            className="px-3 py-1.5 rounded-lg bg-slate-200 text-black font-bold text-xs border-2 border-black hover:bg-slate-300 transition-all">
            {t('admin.common.deselect')}
           </button>
          </div>
         )}
        </div>
       )}
       <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {products.map((prod) => (
         <div key={prod.id} className="relative">
          {selectedProducts.size > 0 && (
           <input
            type="checkbox"
            checked={selectedProducts.has(prod.id)}
            onChange={() => {
             const newSet = new Set(selectedProducts);
             if (newSet.has(prod.id)) newSet.delete(prod.id);
             else newSet.add(prod.id);
             setSelectedProducts(newSet);
            }}
            className="absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 border-black text-indigo-600 focus:ring-indigo-500 bg-white cursor-pointer"
           />
          )}
          <ProductCard product={prod} categoryName={getCategoryName(prod.category)}
           onEdit={(p) => { setEditingProduct(p); setShowProductModal(true); }} onDelete={handleDeleteProduct} onTogglePublish={handleTogglePublish} onTranslate={handleTranslate} />
         </div>
        ))}
       </div>

       {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
<button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
         className="px-5 py-2.5 rounded-xl border-2 border-black bg-white text-black font-bold shadow-[1px_1px_0px_0px_#000]  transition-all disabled:opacity-30 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0">
         ← {t('admin.common.previous')}
        </button>
        <span className="px-5 py-2.5 rounded-xl border-2 border-black bg-white text-black font-bold shadow-[1px_1px_0px_0px_#000]">{t('admin.common.page')} {page + 1} / {totalPages}</span>
        <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
         className="px-5 py-2.5 rounded-xl border-2 border-black bg-white text-black font-bold shadow-[1px_1px_0px_0px_#000]  transition-all disabled:opacity-30 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0">
         {t('admin.common.next')} →
        </button>
        </div>
       )}
      </>
     )}
    </>
   )}

   {/* CATEGORIES VIEW */}
   {viewMode === 'categories' && (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
     {categories.map((cat) => (
      <CategoryCard key={cat.id} category={cat} productCount={getProductCount(cat.id)}
       onEdit={(c) => { setEditingCategory(c); setShowCategoryModal(true); }} onAddProduct={(c) => handleOpenAddProduct(c)} />
     ))}
    </div>
   )}

   {/* Modals */}
   {showCategoryModal && <CategoryModal category={editingCategory} onSave={handleSaveCategory} onClose={() => { setShowCategoryModal(false); setEditingCategory(null); }} />}
   {showProductModal && <ProductModal product={editingProduct} categories={categories} defaultCategory={defaultCategory} onSave={handleSaveProduct} onClose={() => { setShowProductModal(false); setEditingProduct(null); setDefaultCategory(''); }} />}
  </AdminLayout>
 );
}
export default AdminProducts;
