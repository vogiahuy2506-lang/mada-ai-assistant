/**
 * ProductsPage - Browse products with filters
 * WCAG 2.2 AA compliant
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, X, Package, ShoppingCart, User } from 'lucide-react';
import { PublicLayout } from '@/components/PublicLayout';
import { useLanguageStore } from '@/stores';
import { formatPrice } from '@/lib/formatPrice';
import { t } from '@/lib/translations';
import clsx from 'clsx';

interface Product {
  id: string;
  title: string;
  title_en: string;
  description: string;
  description_en: string;
  category: string;
  brand: string;
  model: string;
  price_range: string;
  image_url: string;
  product_url: string;
  source_url: string;
  iso_codes: string[];
  wcag_level: string;
  who_gate_area: string;
  status: string;
  featured: number;
}

interface Category {
  id: string;
  name_vi: string;
  name_en: string;
  icon: string;
}

interface Facets {
  brands: Array<{ brand: string; count: number }>;
  categories: Array<{ category: string; count: number }>;
}

interface ConsultationFormData {
  name: string;
  email: string;
  phone: string;
  message: string;
  productId?: string;
  productName?: string;
}

const API = '/api/public';
const PAGE_SIZE = 24;

export function ProductsPage() {
  const { language } = useLanguageStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [facets, setFacets] = useState<Facets>({ brands: [], categories: [] });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
  const [brandFilter, setBrandFilter] = useState(searchParams.get('brand') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'created_at');
  const [sortOrder, setSortOrder] = useState(searchParams.get('order') || 'DESC');
  const [page, setPage] = useState(1);
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; title: string } | null>(null);
  const [consultForm, setConsultForm] = useState<ConsultationFormData>({ name: '', email: '', phone: '', message: '' });
  const [consultSubmitting, setConsultSubmitting] = useState(false);
  const [consultSuccess, setConsultSuccess] = useState(false);

  // Categories
  useEffect(() => {
    fetch(`${API}/categories`)
      .then((r) => r.json())
      .then((d) => setCategories(d.data || []))
      .catch(console.error);
  }, []);

  // Products
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (categoryFilter) params.set('category', categoryFilter);
    if (brandFilter) params.set('brand', brandFilter);
    params.set('sort', sortBy);
    params.set('order', sortOrder);
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String((page - 1) * PAGE_SIZE));
    params.set('lang', language);

    fetch(`${API}/products?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setProducts(d.data.items || []);
          setTotal(d.data.total || 0);
          setFacets(d.data.facets || { brands: [], categories: [] });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [searchQuery, categoryFilter, brandFilter, sortBy, sortOrder, page]);

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (categoryFilter) params.set('category', categoryFilter);
    if (brandFilter) params.set('brand', brandFilter);
    setSearchParams(params, { replace: true });
  }, [searchQuery, categoryFilter, brandFilter, setSearchParams]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilters = [categoryFilter, brandFilter, searchQuery].filter(Boolean).length;

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('');
    setBrandFilter('');
    setPage(1);
  };

  const titleText = t('products.title');
  const searchPlaceholder = t('products.searchPlaceholder');
  const noResultsText = t('products.noResults');
  const filtersText = t('products.filters');
  const sortText = t('products.sort');
  const categoryText = t('products.category');
  const brandText = t('products.brand');
  const allText = t('products.all');
  const clearText = t('products.clearFilters');
  const viewText = t('products.viewDetails');
  const showText = t('products.showing');
  const ofText = t('products.of');

  return (
    <PublicLayout>
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-on-background">
          {titleText}
        </h1>
        <p className="mt-2 text-on-surface-variant">
          {showText} <strong className="text-on-background">{total}</strong> {ofText} {titleText.toLowerCase()}
        </p>
      </header>

      {/* Search + Sort */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <label htmlFor="search" className="sr-only">{searchPlaceholder}</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" aria-hidden="true" />
          <input
            id="search"
            type="search"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-outline bg-white text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden flex-1 px-4 py-3 bg-white border-2 border-outline rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:border-primary"
            aria-expanded={showFilters}
            aria-controls="filters-panel"
          >
            <Filter className="w-4 h-4" aria-hidden="true" />
            {filtersText}
            {activeFilters > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-primary text-on-primary rounded-full text-[10px]">
                {activeFilters}
              </span>
            )}
          </button>

          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [s, o] = e.target.value.split('-');
              setSortBy(s);
              setSortOrder(o);
              setPage(1);
            }}
            className="px-4 py-3 bg-white border-2 border-outline rounded-xl font-bold text-sm hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label={sortText}
          >
            <option value="created_at-DESC">{t('products.sortNewest')}</option>
            <option value="created_at-ASC">{t('products.sortOldest')}</option>
            <option value="title-ASC">{t('products.sortAZ')}</option>
            <option value="title-DESC">{t('products.sortZA')}</option>
            <option value="brand-ASC">{t('products.sortBrandAZ')}</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        {/* Filters Sidebar */}
        <aside
          id="filters-panel"
          className={clsx(
            'md:block',
            showFilters ? 'block' : 'hidden'
          )}
          aria-label={filtersText}
        >
          <div className="md:sticky md:top-24 space-y-5 bg-white border-2 border-outline rounded-2xl p-5">
            {activeFilters > 0 && (
              <button
                onClick={clearFilters}
                className="w-full px-3 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200 flex items-center justify-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                {clearText}
              </button>
            )}

            {/* Categories */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                {categoryText}
              </h3>
              <ul className="space-y-1" role="list">
                <li>
                  <button
                    onClick={() => { setCategoryFilter(''); setPage(1); }}
                    className={clsx(
                      'w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between',
                      !categoryFilter ? 'bg-primary text-on-primary font-bold' : 'hover:bg-slate-100'
                    )}
                  >
                    <span>{allText}</span>
                  </button>
                </li>
                {categories.map((c) => {
                  const count = facets.categories.find((f) => f.category === c.id)?.count || 0;
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => { setCategoryFilter(c.id); setPage(1); }}
                        className={clsx(
                          'w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between',
                          categoryFilter === c.id ? 'bg-primary text-on-primary font-bold' : 'hover:bg-slate-100'
                        )}
                        disabled={count === 0}
                      >
                        <span className="truncate">
                          <span aria-hidden="true">{c.icon}</span> {language === 'en' ? c.name_en : c.name_vi}
                        </span>
                        <span className={clsx(
                          'text-[10px] px-1.5 py-0.5 rounded-full',
                          categoryFilter === c.id ? 'bg-white/20' : 'bg-slate-200'
                        )}>
                          {count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Brands */}
            {facets.brands.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                  {brandText}
                </h3>
                <ul className="space-y-1 max-h-64 overflow-y-auto" role="list">
                  <li>
                    <button
                      onClick={() => { setBrandFilter(''); setPage(1); }}
                      className={clsx(
                        'w-full text-left px-3 py-2 rounded-lg text-sm',
                        !brandFilter ? 'bg-primary text-on-primary font-bold' : 'hover:bg-slate-100'
                      )}
                    >
                      {allText}
                    </button>
                  </li>
                  {facets.brands.map((b) => (
                    <li key={b.brand}>
                      <button
                        onClick={() => { setBrandFilter(b.brand); setPage(1); }}
                        className={clsx(
                          'w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between',
                          brandFilter === b.brand ? 'bg-primary text-on-primary font-bold' : 'hover:bg-slate-100'
                        )}
                      >
                        <span className="truncate">{b.brand}</span>
                        <span className={clsx(
                          'text-[10px] px-1.5 py-0.5 rounded-full',
                          brandFilter === b.brand ? 'bg-white/20' : 'bg-slate-200'
                        )}>
                          {b.count}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>

        {/* Product Grid */}
        <section aria-busy={loading} aria-label="Danh sách sản phẩm">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" role="list">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white border-2 border-outline rounded-2xl p-4 animate-pulse" role="listitem">
                  <div className="h-40 bg-slate-200 rounded-xl mb-3" />
                  <div className="h-3 bg-slate-200 rounded mb-2" />
                  <div className="h-3 bg-slate-200 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 bg-white border-2 border-dashed border-outline rounded-2xl">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" aria-hidden="true" />
              <p className="text-on-surface-variant font-bold">{noResultsText}</p>
              {activeFilters > 0 && (
                <button
                  onClick={clearFilters}
                  className="mt-4 px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg"
                >
                  {clearText}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" role="list">
                {products.map((p) => (
                  <ProductCardItem 
                    key={p.id} 
                    product={p} 
                    language={language} 
                    viewText={viewText}
                    onRequestConsult={(product) => {
                      setSelectedProduct(product);
                      setShowConsultModal(true);
                    }}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Phân trang">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 bg-white border-2 border-outline rounded-lg text-sm font-bold disabled:opacity-50 hover:border-primary"
                  >
                    ← Trước
                  </button>
                  <span className="px-4 py-2 text-sm font-bold">
                    Trang {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 bg-white border-2 border-outline rounded-lg text-sm font-bold disabled:opacity-50 hover:border-primary"
                  >
                    Sau →
                  </button>
                </nav>
              )}
            </>
          )}
        </section>

        {/* ⭐ Consultation Modal */}
        {showConsultModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowConsultModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="consult-modal-title"
          >
            <div 
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h2 id="consult-modal-title" className="text-xl font-bold text-slate-900">
                    {language === 'vi' ? 'Yêu cầu Tư vấn Chuyên gia' : language === 'en' ? 'Expert Consultation Request' : 'طلب استشارة خبير'}
                  </h2>
                  <button
                    onClick={() => setShowConsultModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    aria-label="Đóng"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
                {selectedProduct && (
                  <p className="mt-2 text-sm text-slate-600">
                    {language === 'vi' ? 'Sản phẩm: ' : language === 'en' ? 'Product: ' : 'المنتج: '}
                    <span className="font-semibold text-[#006D77]">{selectedProduct.title}</span>
                  </p>
                )}
              </div>

              {/* Form */}
              {consultSuccess ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {language === 'vi' ? 'Yêu cầu đã được gửi!' : language === 'en' ? 'Request submitted!' : 'تم إرسال الطلب!'}
                  </h3>
                  <p className="text-slate-600 mb-4">
                    {language === 'vi' ? 'Chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất.' : language === 'en' ? 'We will contact you as soon as possible.' : 'سنتواصل معك في أقرب وقت ممكن.'}
                  </p>
                  <button
                    onClick={() => {
                      setShowConsultModal(false);
                      setConsultSuccess(false);
                      setConsultForm({ name: '', email: '', phone: '', message: '' });
                    }}
                    className="px-6 py-2 bg-[#006D77] text-white rounded-lg font-semibold hover:bg-[#005A63] transition-colors"
                  >
                    {language === 'vi' ? 'Đóng' : language === 'en' ? 'Close' : 'إغلاق'}
                  </button>
                </div>
              ) : (
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!consultForm.name || !consultForm.email || !consultForm.message) {
                      alert(language === 'vi' ? 'Vui lòng điền đầy đủ thông tin bắt buộc' : 'Please fill in all required fields');
                      return;
                    }
                    setConsultSubmitting(true);
                    try {
                      const res = await fetch('/api/consultation', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: consultForm.name,
                          email: consultForm.email,
                          phone: consultForm.phone,
                          message: selectedProduct 
                            ? `${language === 'vi' ? 'Sản phẩm quan tâm: ' : language === 'en' ? 'Interested product: ' : 'المنتج المهتم: '}${selectedProduct.title}\n\n${consultForm.message}`
                            : consultForm.message
                        })
                      });
                      if (res.ok) {
                        setConsultSuccess(true);
                      } else {
                        throw new Error('Failed to submit');
                      }
                    } catch (err) {
                      console.error('Consultation submit error:', err);
                      alert(language === 'vi' ? 'Có lỗi xảy ra. Vui lòng thử lại.' : 'An error occurred. Please try again.');
                    } finally {
                      setConsultSubmitting(false);
                    }
                  }}
                  className="p-6 space-y-4"
                >
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      {language === 'vi' ? 'Họ và tên *' : language === 'en' ? 'Full Name *' : 'الاسم الكامل *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={consultForm.name}
                      onChange={(e) => setConsultForm({ ...consultForm, name: e.target.value })}
                      className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-[#006D77] focus:outline-none transition-colors"
                      placeholder={language === 'vi' ? 'Nguyễn Văn A' : 'John Smith'}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      {language === 'vi' ? 'Email *' : language === 'en' ? 'Email *' : 'البريد الإلكتروني *'}
                    </label>
                    <input
                      type="email"
                      required
                      value={consultForm.email}
                      onChange={(e) => setConsultForm({ ...consultForm, email: e.target.value })}
                      className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-[#006D77] focus:outline-none transition-colors"
                      placeholder="email@example.com"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      {language === 'vi' ? 'Điện thoại' : language === 'en' ? 'Phone' : 'الهاتف'}
                    </label>
                    <input
                      type="tel"
                      value={consultForm.phone}
                      onChange={(e) => setConsultForm({ ...consultForm, phone: e.target.value })}
                      className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-[#006D77] focus:outline-none transition-colors"
                      placeholder="+974 1234 5678"
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      {language === 'vi' ? 'Mô tả nhu cầu *' : language === 'en' ? 'Needs Description *' : 'وصف الاحتياجات *'}
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={consultForm.message}
                      onChange={(e) => setConsultForm({ ...consultForm, message: e.target.value })}
                      className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-[#006D77] focus:outline-none transition-colors resize-none"
                      placeholder={language === 'vi' ? 'Mô tả chi tiết tình trạng và nhu cầu về thiết bị công nghệ hỗ trợ...' : 'Describe your situation and assistive technology needs in detail...'}
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={consultSubmitting}
                    className="w-full py-3 px-4 bg-gradient-to-r from-[#006D77] to-[#0A9396] text-white font-bold rounded-lg hover:from-[#005A63] hover:to-[#087E8B] transition-all disabled:opacity-50"
                  >
                    {consultSubmitting 
                      ? (language === 'vi' ? 'Đang gửi...' : 'Sending...')
                      : (language === 'vi' ? 'GỬI YÊU CẦU' : language === 'en' ? 'SUBMIT REQUEST' : 'إرسال الطلب')}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

function ProductCardItem({ product, language, viewText, onRequestConsult }: { 
  product: Product; 
  language: string; 
  viewText: string;
  onRequestConsult?: (product: { id: string; title: string }) => void;
}) {
  const ti = language === 'en' && product.title_en ? product.title_en : product.title;
  // ⭐ Link đến URL gốc của sản phẩm (MADA/at.mada.org.qa) thay vì trang nội bộ
  const productLink = product.product_url && /^https?:\/\//i.test(product.product_url)
    ? product.product_url
    : (product.source_url && /^https?:\/\//i.test(product.source_url) ? product.source_url : null);
  
  const cardContent = (
    <>
      <div className="aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={ti}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain p-3"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <Package className="w-16 h-16 text-slate-300" aria-hidden="true" />
        )}
      </div>
      <div className="p-4">
        <h3 className="text-sm font-bold line-clamp-2 mb-1 leading-tight">{ti}</h3>
        {product.brand && (
          <p className="text-xs text-slate-600 mb-2">{product.brand}</p>
        )}
        {product.iso_codes && product.iso_codes.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {product.iso_codes.slice(0, 3).map((code, i) => (
              <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded">
                {code}
              </span>
            ))}
          </div>
        )}
        {product.price_range && (
          <p className="text-sm font-bold text-primary mt-2">{formatPrice(product.price_range)}</p>
        )}
        
        {/* ⭐ 2 Buttons như thiết kế */}
        <div className="mt-3 flex flex-col gap-2">
          {/* Nút chính: Xem chi tiết & Mua sản phẩm */}
          {productLink ? (
            <a
              href={productLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-[#006D77] to-[#0A9396] hover:from-[#005A63] hover:to-[#087E8B] text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98]"
            >
              <ShoppingCart className="w-4 h-4" aria-hidden="true" />
              <span>{language === 'vi' ? 'Xem chi tiết & Mua sản phẩm' : language === 'en' ? 'View Details & Buy' : 'عرض التفاصيل والشراء'}</span>
            </a>
          ) : (
            <a
              href={`/products/${product.id}`}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-[#006D77] to-[#0A9396] hover:from-[#005A63] hover:to-[#087E8B] text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98]"
            >
              <ShoppingCart className="w-4 h-4" aria-hidden="true" />
              <span>{language === 'vi' ? 'Xem chi tiết & Mua sản phẩm' : language === 'en' ? 'View Details & Buy' : 'عرض التفاصيل والشراء'}</span>
            </a>
          )}
          
          {/* Nút phụ: Liên hệ tư vấn viên chuyên khoa */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRequestConsult?.({ id: product.id, title: ti });
            }}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-white border-2 border-[#83C5BE]/50 hover:border-[#83C5BE] text-[#006D77] text-xs font-semibold rounded-lg transition-all duration-200 hover:bg-[#EDF6F9] active:scale-[0.98]"
          >
            <User className="w-4 h-4 text-[#006D77]" aria-hidden="true" />
            <span>{language === 'vi' ? 'Liên hệ tư vấn viên chuyên khoa' : language === 'en' ? 'Contact Specialist Advisor' : 'تواصل مع مستشار متخصص'}</span>
          </button>
        </div>
      </div>
    </>
  );
  
  // Wrapper: dùng anchor cho external link, div cho không có link
  if (productLink) {
    return (
      <article
        className="bg-white border-2 border-outline rounded-2xl overflow-hidden hover:border-primary hover:shadow-lg transition-all"
        role="listitem"
      >
        <a
          href={productLink}
          target="_blank"
          rel="noopener noreferrer"
          className="block focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={`${viewText}: ${ti}`}
        >
          {cardContent}
        </a>
      </article>
    );
  }
  
  return (
    <article
      className="bg-white border-2 border-outline rounded-2xl overflow-hidden hover:border-primary hover:shadow-lg transition-all"
      role="listitem"
    >
      <div className="block">
        {cardContent}
      </div>
    </article>
  );
}

export default ProductsPage;
