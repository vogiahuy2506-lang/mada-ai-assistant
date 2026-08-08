import { useEffect, useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { adminApi, Product, Category } from './adminApi';
import {
  Search, Plus, RefreshCw, X, Save, Loader2, AlertCircle,
  Edit2, Trash2, Eye, EyeOff, Star, StarOff,
  ExternalLink, Globe, Link as LinkIcon, Image as ImageIcon,
  FolderPlus,
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

// ==================== SIDEBAR ====================
function Sidebar({ activeHref }: { activeHref: string }) {
  const navItems = [
    { href: '/admin', icon: 'dashboard', label: 'Tổng quan' },
    { href: '/admin/users', icon: 'group', label: 'Người dùng' },
    { href: '/admin/products', icon: 'inventory_2', label: 'Sản phẩm' },
    { href: '/admin/logs', icon: 'receipt_long', label: 'Nhật ký' },
    { href: '/admin/analytics', icon: 'analytics', label: 'Phân tích' },
    { href: '/admin/agents', icon: 'smart_toy', label: 'Agents' },
    { href: '/admin/consultations', icon: 'contact_support', label: 'Tư vấn' },
    { href: '/admin/settings', icon: 'settings', label: 'Cấu hình' },
  ];

  return (
    <nav className="fixed left-0 top-0 bottom-0 w-64 bg-white/15 backdrop-blur-[40px] border-r border-slate-200/60 z-50 flex flex-col p-6">
      {/* Logo */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">MADA AI</h1>
        <p className="text-[10px] text-slate-500 mt-1 font-medium uppercase tracking-wider">Admin Panel</p>
      </div>

      {/* Nav Links */}
      <div className="flex-1 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.href === '/admin' 
            ? activeHref === '/admin' 
            : activeHref.startsWith(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              className={clsx(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium',
                isActive
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100'
              )}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-slate-200 mt-4">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all text-sm font-medium">
          <span className="material-symbols-outlined text-xl">logout</span>
          Đăng xuất
        </button>
      </div>
    </nav>
  );
}

// ==================== TOP BAR ====================
function TopBar({ title }: { title: string }) {
  return (
    <header className="fixed top-0 right-0 left-64 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 z-40 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        <div className="relative w-80">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
          <input
            className="w-full h-10 pl-11 pr-4 rounded-xl bg-slate-100 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:bg-white transition-all"
            placeholder="Tìm kiếm trong kho tri thức..."
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-all">
          <span className="material-symbols-outlined text-xl">notifications</span>
        </button>
        <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-all">
          <span className="material-symbols-outlined text-xl">help</span>
        </button>
        <div className="flex items-center gap-3 pl-3 ml-2 border-l border-slate-200">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-800">Admin</p>
            <p className="text-xs text-violet-600 font-medium">Quản trị viên</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white font-semibold shadow-lg shadow-blue-500/30">
            A
          </div>
        </div>
      </div>
    </header>
  );
}

// ==================== SOFT CARD ====================
function SoftCard({ children, className = '', hover = true }: { children: React.ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={clsx(
      'rounded-2xl p-5 bg-white border border-slate-200/60 transition-all',
      hover && 'hover:shadow-lg hover:shadow-slate-200/50 hover:border-slate-300/60',
      className
    )}>
      {children}
    </div>
  );
}

// ==================== MODERN BUTTON ====================
function ModernButton({ children, variant = 'primary', className = '', ...props }: { 
  children: React.ReactNode; 
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  [key: string]: any;
}) {
  const variants = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
    danger: 'bg-red-500 text-white hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/25',
  };
  
  return (
    <button {...props} className={clsx('px-4 py-2 rounded-xl font-medium text-sm flex items-center gap-2 transition-all duration-200', variants[variant], className)}>
      {children}
    </button>
  );
}

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
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-cyan-50">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{category ? 'Sửa Danh mục' : 'Tạo Danh mục mới'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{category ? 'Cập nhật thông tin' : 'Thêm danh mục mới'}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all shadow-sm">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {!category && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">ID <span className="text-red-500">*</span></label>
              <input type="text" value={form.id} onChange={(e) => setForm({...form, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')})} placeholder="custom_category" 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Icon</label>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white font-semibold shadow-lg shadow-blue-500/20">
                M
              </div>
              <p className="text-xs text-slate-500">Logo MADA AI</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Tên (VI) <span className="text-red-500">*</span></label>
              <input type="text" value={form.name_vi} onChange={(e) => setForm({...form, name_vi: e.target.value})} placeholder="Hỗ trợ Thị giác" 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Tên (EN) <span className="text-red-500">*</span></label>
              <input type="text" value={form.name_en} onChange={(e) => setForm({...form, name_en: e.target.value})} placeholder="Vision Support" 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Mô tả (VI)</label>
              <textarea value={form.description_vi} onChange={(e) => setForm({...form, description_vi: e.target.value})} rows={2} 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Mô tả (EN)</label>
              <textarea value={form.description_en} onChange={(e) => setForm({...form, description_en: e.target.value})} rows={2} 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Link tài liệu</label>
              <input type="url" value={form.related_url} onChange={(e) => setForm({...form, related_url: e.target.value})} placeholder="https://..." 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Link sản phẩm</label>
              <input type="url" value={form.product_link} onChange={(e) => setForm({...form, product_link: e.target.value})} placeholder="https://..." 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm" />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
              <span className="material-symbols-outlined">error</span>
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50/50">
          <ModernButton variant="secondary" onClick={onClose}>Hủy</ModernButton>
          <ModernButton variant="primary" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Đang lưu...' : 'Lưu'}
          </ModernButton>
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
        <div className="flex items-center justify-between p-5 shrink-0 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-cyan-50">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{product ? 'Sửa Sản phẩm' : 'Thêm Sản phẩm mới'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{product ? 'Cập nhật thông tin sản phẩm' : 'Thêm sản phẩm vào danh mục'}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all shadow-sm">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Section 1: Thông tin cơ bản */}
          <section className="p-5 rounded-xl bg-gradient-to-br from-blue-50/50 to-indigo-50/50 border border-blue-100/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <span className="material-symbols-outlined text-white text-lg">info</span>
              </div>
              <h3 className="text-base font-semibold text-blue-700">Thông tin cơ bản</h3>
              <span className="ml-auto text-[10px] font-medium text-blue-600 bg-blue-100 px-2.5 py-1 rounded-full">Bắt buộc</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Danh mục <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}
                    className="w-full appearance-none rounded-xl px-4 py-2.5 text-slate-700 cursor-pointer font-medium bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400">
                    <option value="">Chọn danh mục</option>
                    {categories.map((c) => (<option key={c.id} value={c.id}>{c.icon} {c.name_vi}</option>))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">expand_more</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Tên sản phẩm (VI) <span className="text-red-500">*</span></label>
                <input type="text" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})}
                  placeholder="Nhập tên sản phẩm"
                  className="w-full rounded-xl px-4 py-2.5 text-slate-700 bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Tên sản phẩm (EN)</label>
                <input type="text" value={form.title_en} onChange={(e) => setForm({...form, title_en: e.target.value})}
                  placeholder="Enter product name"
                  className="w-full rounded-xl px-4 py-2.5 text-slate-700 bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Thương hiệu</label>
                <input type="text" value={form.brand} onChange={(e) => setForm({...form, brand: e.target.value})}
                  placeholder="Ví dụ: Apple, Microsoft"
                  className="w-full rounded-xl px-4 py-2.5 text-slate-700 bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Model</label>
                  <input type="text" value={form.model} onChange={(e) => setForm({...form, model: e.target.value})}
                    placeholder="Mã model"
                    className="w-full rounded-xl px-4 py-2.5 text-slate-700 bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Khoảng giá</label>
                  <input type="text" value={form.price_range} onChange={(e) => setForm({...form, price_range: e.target.value})}
                    placeholder="VNĐ / USD"
                    className="w-full rounded-xl px-4 py-2.5 text-slate-700 bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Thứ tự hiển thị</label>
                <input type="number" value={form.sort_order} onChange={(e) => setForm({...form, sort_order: parseInt(e.target.value) || 0})}
                  placeholder="0"
                  className="w-full rounded-xl px-4 py-2.5 text-slate-700 bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                <span className="text-[10px] text-slate-400 ml-1">Số nhỏ = hiển thị trước</span>
              </div>
            </div>
          </section>

          <div className="h-px bg-gradient-to-r from-transparent via-violet-200 to-transparent"></div>

          {/* Section 2: Mô tả */}
          <section className="p-5 rounded-xl bg-gradient-to-br from-purple-50/50 to-pink-50/50 border border-purple-100/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
                <span className="material-symbols-outlined text-white text-lg">description</span>
              </div>
              <h3 className="text-base font-semibold text-purple-700">Mô tả</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Mô tả ngắn (VI)</label>
                <textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})}
                  rows={3} placeholder="Tóm tắt ngắn gọn về sản phẩm"
                  className="w-full rounded-xl px-4 py-2.5 text-slate-700 resize-none bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Mô tả ngắn (EN)</label>
                <textarea value={form.description_en} onChange={(e) => setForm({...form, description_en: e.target.value})}
                  rows={3} placeholder="Short summary of the product"
                  className="w-full rounded-xl px-4 py-2.5 text-slate-700 resize-none bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Nội dung chi tiết</label>
              <textarea value={form.content} onChange={(e) => setForm({...form, content: e.target.value})}
                rows={5} placeholder="Nhập chi tiết sản phẩm, tính năng, thông số..."
                className="w-full rounded-xl px-4 py-2.5 text-slate-700 resize-y bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
            </div>
          </section>

          <div className="h-px bg-gradient-to-r from-transparent via-purple-200 to-transparent"></div>

          {/* Section 3: Kỹ thuật & Liên kết */}
          <section className="p-5 rounded-xl bg-gradient-to-br from-teal-50/50 to-cyan-50/50 border border-teal-100/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/25">
                <span className="material-symbols-outlined text-white text-lg">link</span>
              </div>
              <h3 className="text-base font-semibold text-teal-700">Kỹ thuật & Liên kết</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Link Nguồn / Tài liệu</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">link</span>
                  <input type="url" value={form.source_url} onChange={(e) => setForm({...form, source_url: e.target.value})}
                    placeholder="https://"
                    className="w-full rounded-xl py-2.5 pl-10 pr-4 text-slate-700 bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Link mua hàng</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">shopping_cart</span>
                  <input type="url" value={form.product_url} onChange={(e) => setForm({...form, product_url: e.target.value})}
                    placeholder="https://"
                    className="w-full rounded-xl py-2.5 pl-10 pr-4 text-slate-700 bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Link hình ảnh</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">image</span>
                  <input type="url" value={form.image_url} onChange={(e) => setForm({...form, image_url: e.target.value})}
                    placeholder="https://"
                    className="w-full rounded-xl py-2.5 pl-10 pr-4 text-slate-700 bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>
                {form.image_url && (
                  <div className="mt-2 rounded-lg overflow-hidden">
                    <img 
                      src={form.image_url} 
                      alt="Preview" 
                      className="w-full h-20 object-cover rounded-lg"
                      onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Mã ISO</label>
                <input type="text" value={form.iso_codes} onChange={(e) => setForm({...form, iso_codes: e.target.value})}
                  placeholder="Ví dụ: ISO 9999, ISO 9241"
                  className="w-full rounded-xl px-4 py-2.5 text-slate-700 font-mono bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Mức WCAG</label>
                <div className="relative">
                  <select value={form.wcag_level} onChange={(e) => setForm({...form, wcag_level: e.target.value})}
                    className="w-full appearance-none rounded-xl px-4 py-2.5 text-slate-700 cursor-pointer font-medium bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400">
                    <option value="">Không áp dụng</option>
                    <option value="A">Level A</option>
                    <option value="AA">Level AA</option>
                    <option value="AAA">Level AAA</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">expand_more</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">WHO GATE Area</label>
                <div className="relative">
                  <select value={form.who_gate_area} onChange={(e) => setForm({...form, who_gate_area: e.target.value})}
                    className="w-full appearance-none rounded-xl px-4 py-2.5 text-slate-700 cursor-pointer font-medium bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400">
                    <option value="">Chọn lĩnh vực</option>
                    <option value="vision">Thị giác</option>
                    <option value="hearing">Thính giác</option>
                    <option value="mobility">Vận động</option>
                    <option value="cognition">Nhận thức</option>
                    <option value="communication">Giao tiếp</option>
                    <option value="self_care">Tự chăm sóc</option>
                    <option value="education">Giáo dục</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">expand_more</span>
                </div>
              </div>
            </div>
          </section>

          <div className="h-px bg-gradient-to-r from-transparent via-teal-200 to-transparent"></div>

          {/* Section 4: Cấu hình */}
          <section className="p-5 rounded-xl bg-gradient-to-br from-amber-50/50 to-orange-50/50 border border-amber-100/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                <span className="material-symbols-outlined text-white text-lg">tune</span>
              </div>
              <h3 className="text-base font-semibold text-amber-700">Cấu hình</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white/80 border border-slate-200/60">
                <label className="block text-xs font-semibold text-slate-700 mb-3">Trạng thái</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="status" value="draft" checked={form.status === 'draft'} onChange={() => setForm({...form, status: 'draft'})}
                      className="w-4 h-4 accent-blue-500" />
                    <span className="text-sm text-slate-600">Bản nháp</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="status" value="published" checked={form.status === 'published'} onChange={() => setForm({...form, status: 'published'})}
                      className="w-4 h-4 accent-blue-500" />
                    <span className="text-sm text-slate-600">Xuất bản</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="status" value="archived" checked={form.status === 'archived'} onChange={() => setForm({...form, status: 'archived'})}
                      className="w-4 h-4 accent-blue-500" />
                    <span className="text-sm text-slate-600">Lưu trữ</span>
                  </label>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/80 border border-slate-200/60">
                <label className="block text-xs font-semibold text-slate-700 mb-3">Ngôn ngữ mặc định</label>
                <div className="relative">
                  <select value={form.language} onChange={(e) => setForm({...form, language: e.target.value})}
                    className="w-full appearance-none rounded-xl px-3 py-2.5 text-slate-700 cursor-pointer font-medium bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400">
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-lg">expand_more</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/80 border border-slate-200/60 flex items-center justify-between">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Đánh dấu nổi bật</label>
                  <span className="text-xs text-slate-400 mt-0.5 block">Hiển thị trên trang chủ</span>
                </div>
                <button type="button" onClick={() => setForm({...form, featured: !form.featured})}
                  className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={form.featured} onChange={() => setForm({...form, featured: !form.featured})}
                    className="sr-only peer" />
                  <div className="w-12 h-7 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </button>
              </div>
            </div>
          </section>

          {error && (
            <div className="flex items-center gap-3 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
              <span className="material-symbols-outlined">error</span>
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 shrink-0 border-t border-slate-200 bg-slate-50/50">
          <ModernButton variant="secondary" onClick={onClose}>Hủy</ModernButton>
          <ModernButton variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="material-symbols-outlined text-lg">save</span>}
            {saving ? 'Đang lưu...' : 'Lưu sản phẩm'}
          </ModernButton>
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

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden hover:shadow-lg hover:shadow-slate-200/50 hover:border-slate-300/60 transition-all duration-200 group">
      {product.image_url && (
        <div className="h-28 bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
          <img src={product.image_url} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
        </div>
      )}
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5 mb-2">
          <span className={clsx('px-2 py-0.5 rounded-lg text-[10px] font-medium', STATUS_STYLES[product.status])}>
            {product.status === 'published' ? 'Pub' : product.status === 'archived' ? 'Lưu trữ' : 'Nháp'}
          </span>
          {product.featured && <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-amber-100 text-amber-600">Nổi bật</span>}
        </div>
        <h3 className="font-semibold text-slate-900 text-sm mb-1 line-clamp-1">{product.title}</h3>
        {product.title_en && <p className="text-xs text-slate-400 mb-2 line-clamp-1">{product.title_en}</p>}
        
        <div className="flex items-center gap-2 mb-2">
          <span className={clsx('px-2.5 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1.5', style.bg, style.text)}>
            <span className="material-symbols-outlined text-xs">{style.icon}</span>
            {categoryName}
          </span>
          {product.brand && <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">{product.brand}</span>}
        </div>

        {product.description && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{product.description}</p>}

        <div className="flex items-center gap-1.5 mb-3">
          {product.price_range && <span className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-600 text-[10px] font-medium">Giá: {product.price_range}</span>}
          {Array.isArray(product.iso_codes) && product.iso_codes.length > 0 && <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-mono">ISO</span>}
          {product.wcag_level && <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[10px]">WCAG</span>}
        </div>

        <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
          <button onClick={() => onTogglePublish(product)} 
            className={clsx('flex-1 py-2 rounded-lg text-xs font-medium transition-all', 
              product.status === 'published' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100')}>
            {product.status === 'published' ? 'Hạ xuống' : 'Xuất bản'}
          </button>
          <button onClick={() => onEdit(product)} 
            className="flex-1 py-2 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 transition-all text-xs font-medium">
            Sửa
          </button>
          <button onClick={() => onDelete(product)} 
            className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all">
            <Trash2 className="w-4 h-4" />
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
    <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden hover:shadow-lg hover:shadow-slate-200/50 hover:border-slate-300/60 transition-all duration-200">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', style.bg)}>
            <span className={clsx('material-symbols-outlined text-lg', style.text)}>{style.icon}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 text-sm truncate">{category.name_vi}</h3>
            <p className="text-xs text-slate-400 truncate">{category.name_en}</p>
          </div>
        </div>

        {(category.description_vi || category.description_en) && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-3">{category.description_vi || category.description_en}</p>
        )}

        <div className="flex items-center gap-2 mb-3 text-xs">
          <span className={clsx('px-2.5 py-1 rounded-lg font-medium', style.bg, style.text)}>{productCount} SP</span>
          <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-500 font-mono">#{category.sort_order}</span>
        </div>

        <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
          <button onClick={() => onEdit(category)} 
            className="flex-1 py-2 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 transition-all text-xs font-medium">
            Sửa
          </button>
          <button onClick={() => onAddProduct(category)} 
            className="flex-1 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/25 transition-all text-xs font-medium">
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
    blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
  };
  const colors = colorMap[color] || colorMap.blue;

  return (
    <SoftCard className="flex items-center gap-4" style={{ transform: `rotate(${rotate}deg)` }}>
      <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center', colors.bg)}>
        <span className={clsx('material-symbols-outlined text-xl', colors.text)}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 uppercase tracking-wide truncate">{label}</p>
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-bold text-slate-900">{value}</h3>
          {subValue && (
            <span className={clsx('px-2 py-0.5 rounded text-[10px] font-medium', colors.bg, colors.text)}>
              {subValue}
            </span>
          )}
        </div>
      </div>
    </SoftCard>
  );
}

// ==================== MAIN PAGE ====================
export function AdminProducts() {
  const location = useLocation();
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-purple-50/30">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" />

      <style>{`
        .material-symbols-outlined { font-family: 'Material Symbols Outlined'; font-weight: normal; font-style: normal; font-size: 24px; line-height: 1; letter-spacing: normal; text-transform: none; display: inline-block; white-space: nowrap; word-wrap: normal; direction: ltr; font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        .line-clamp-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>

      <Sidebar activeHref={location.pathname} />
      <TopBar title="Quản lý Sản phẩm & Danh mục" />

      <main className="ml-64 mt-16 p-6 pb-24">
        {/* Hero Banner - Soft Blue Gradient */}
        <section className="mb-6 relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-blue-400 to-cyan-400">
            <div className="absolute inset-0 opacity-20" style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.2) 0%, transparent 50%)'
            }}></div>
            <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 blur-2xl"></div>
            <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-cyan-300/20 blur-2xl"></div>
          </div>
          
          <div className="relative p-6 flex items-center justify-between min-h-[160px]">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm mb-3">
                <span className="material-symbols-outlined text-white/90 text-sm">inventory_2</span>
                <span className="text-xs font-medium text-white/90 uppercase tracking-wider">Admin Panel</span>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2 leading-tight">
                Quản lý Sản phẩm & Danh mục
              </h1>
              <p className="text-sm text-white/80">
                Hệ thống điều hành trung tâm cho kho tri thức MADA AI.
              </p>
            </div>
            <div className="hidden lg:flex items-center gap-2">
              <button onClick={() => setViewMode('products')} 
                className={clsx('px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all',
                  viewMode === 'products' 
                    ? 'bg-white text-blue-600 shadow-lg' 
                    : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm')}>
                <span className="material-symbols-outlined text-lg">inventory_2</span>
                Sản phẩm
              </button>
              <button onClick={() => setViewMode('categories')} 
                className={clsx('px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all',
                  viewMode === 'categories' 
                    ? 'bg-white text-blue-600 shadow-lg' 
                    : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm')}>
                <span className="material-symbols-outlined text-lg">folder_open</span>
                Danh mục
              </button>
            </div>
          </div>
        </section>

        {/* Metrics Row */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <MetricCard icon="inventory_2" label="Tổng sản phẩm" value={totalProducts.toLocaleString()} subValue="+12%" color="blue" rotate={-0.3} />
          <MetricCard icon="category" label="Danh mục" value={categories.length} subValue="Active" color="purple" rotate={0.3} />
          <MetricCard icon="workspace_premium" label="Nội dung cao cấp" value="95%" color="amber" rotate={-0.2} />
        </section>

        {/* PRODUCTS VIEW */}
        {viewMode === 'products' && (
          <>
            {/* Filter Bar */}
            <SoftCard className="mb-5">
              {/* Category Pills */}
              <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                <button onClick={() => setFilterCategory('')} 
                  className={clsx('px-3.5 py-2 rounded-lg font-medium text-xs whitespace-nowrap transition-all',
                    !filterCategory ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
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
                    web_accessibility: { icon: 'language', bg: 'bg-teal-100', text: 'text-teal-600' },
                    general: { icon: 'inventory_2', bg: 'bg-slate-100', text: 'text-slate-600' },
                  };
                  const fStyle = filterStyles[cat.id] || filterStyles.general;
                  return (
                    <button key={cat.id} onClick={() => setFilterCategory(filterCategory === cat.id ? '' : cat.id)} 
                      className={clsx('px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 whitespace-nowrap transition-all',
                        filterCategory === cat.id 
                          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25' 
                          : clsx(fStyle.bg, fStyle.text, 'hover:shadow-sm'))}>
                      <span className={clsx('material-symbols-outlined text-sm', filterCategory === cat.id ? 'text-white' : fStyle.text)}>{fStyle.icon}</span>
                      {cat.name_vi}
                    </button>
                  );
                })}
              </div>
              
              {/* Search & Actions */}
              <div className="flex gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px] max-w-sm">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                  <input className="w-full h-9 pl-9 pr-4 rounded-lg bg-slate-100 text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:bg-white transition-all" 
                    placeholder="Tìm sản phẩm..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <button onClick={() => setShowFeatured(!showFeatured)} 
                  className={clsx('px-3 h-9 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all',
                    showFeatured ? 'bg-amber-100 text-amber-700 shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                  <span className="material-symbols-outlined text-sm">star</span>
                  Nổi bật
                </button>
                <button onClick={loadProducts} 
                  className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-all">
                  <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
                </button>
              </div>
            </SoftCard>

            {/* Products Grid */}
            {loading ? (
              <div className="min-h-[200px] flex items-center justify-center">
                <div className="w-10 h-10 rounded-full border-2 border-violet-200 border-t-violet-500 animate-spin"></div>
              </div>
            ) : products.length === 0 ? (
              <SoftCard className="min-h-[200px] flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-2xl text-slate-300">inventory_2</span>
                </div>
                <h3 className="text-base font-semibold text-slate-800 mb-1">Chưa có sản phẩm nào</h3>
                <p className="text-xs text-slate-500 mb-3">Thêm sản phẩm đầu tiên để AI có thể tư vấn.</p>
                <ModernButton variant="primary" onClick={() => handleOpenAddProduct()}>
                  <Plus className="w-4 h-4" /> Thêm sản phẩm
                </ModernButton>
              </SoftCard>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                  {products.map((prod) => (
                    <ProductCard key={prod.id} product={prod} categoryName={getCategoryName(prod.category)} 
                      onEdit={(p) => { setEditingProduct(p); setShowProductModal(true); }} onDelete={handleDeleteProduct} onTogglePublish={handleTogglePublish} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-8">
                    <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} 
                      className="px-4 py-2 rounded-lg border border-slate-300 font-medium text-sm bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-all">
                      ← Trước
                    </button>
                    <span className="px-4 py-2 rounded-lg bg-slate-100 text-sm font-medium text-slate-700">Trang {page + 1} / {totalPages}</span>
                    <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} 
                      className="px-4 py-2 rounded-lg border border-slate-300 font-medium text-sm bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-all">
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
      </main>

      {/* FABs */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
        <button onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }} 
          className="w-12 h-12 rounded-xl bg-white text-slate-600 flex items-center justify-center hover:shadow-lg hover:-translate-y-0.5 transition-all shadow-md border border-slate-200/60"
          title="Thêm Danh mục">
          <FolderPlus className="w-5 h-5" />
        </button>
        <button onClick={() => handleOpenAddProduct()} 
          className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all shadow-lg"
          title="Thêm Sản phẩm">
          <span className="material-symbols-outlined text-2xl">add</span>
        </button>
      </div>

      {/* Modals */}
      {showCategoryModal && <CategoryModal category={editingCategory} onSave={handleSaveCategory} onClose={() => { setShowCategoryModal(false); setEditingCategory(null); }} />}
      {showProductModal && <ProductModal product={editingProduct} categories={categories} defaultCategory={defaultCategory} onSave={handleSaveProduct} onClose={() => { setShowProductModal(false); setEditingProduct(null); setDefaultCategory(''); }} />}
    </div>
  );
}
