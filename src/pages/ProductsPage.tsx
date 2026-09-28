/**
 * ProductsPage - Browse products with filters
 * WCAG 2.2 AA compliant
 */
import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Filter, X, Package, ArrowRight } from 'lucide-react';
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

  const titleText = language === 'en' ? 'Products' : 'Sản phẩm';
  const searchPlaceholder = language === 'en' ? 'Search products...' : 'Tìm kiếm sản phẩm...';
  const noResultsText = t('product.noResults');
  const filtersText = language === 'en' ? 'Filters' : 'Bộ lọc';
  const sortText = language === 'en' ? 'Sort' : 'Sắp xếp';
  const categoryText = language === 'en' ? 'Category' : 'Danh mục';
  const brandText = language === 'en' ? 'Brand' : 'Thương hiệu';
  const allText = language === 'en' ? 'All' : 'Tất cả';
  const clearText = language === 'en' ? 'Clear filters' : 'Xóa bộ lọc';
  const viewText = language === 'en' ? 'View details' : 'Xem chi tiết';
  const showText = language === 'en' ? 'Showing' : 'Hiển thị';
  const ofText = language === 'en' ? 'of' : 'trong';

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
            <option value="created_at-DESC">{t('sort.newest')}</option>
            <option value="created_at-ASC">{t('sort.oldest')}</option>
            <option value="title-ASC">A-Z</option>
            <option value="title-DESC">Z-A</option>
            <option value="brand-ASC">A-Z (Brand)</option>
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
                  <ProductCardItem key={p.id} product={p} language={language} viewText={viewText} />
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
      </div>
    </PublicLayout>
  );
}

function ProductCardItem({ product, language, viewText }: { product: Product; language: string; viewText: string }) {
  const ti = language === 'en' && product.title_en ? product.title_en : product.title;
  return (
    <article
      className="bg-white border-2 border-outline rounded-2xl overflow-hidden hover:border-primary hover:shadow-lg transition-all"
      role="listitem"
    >
      <Link
        to={`/products/${product.id}`}
        className="block focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label={`${viewText}: ${ti}`}
      >
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
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">
            {viewText} <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </article>
  );
}

export default ProductsPage;
