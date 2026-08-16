/**
 * SearchPage - Full-text search with filters
 * WCAG 2.2 AA compliant
 */
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search as SearchIcon, Package, X } from 'lucide-react';
import { PublicLayout } from '@/components/PublicLayout';
import { useLanguageStore } from '@/stores';
import { formatPrice } from '@/lib/formatPrice';

interface Product {
  id: string;
  title: string;
  title_en: string;
  description: string;
  description_en: string;
  category: string;
  brand: string;
  image_url: string;
  price_range: string;
  iso_codes: string[];
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useLanguageStore();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const activeQuery = searchParams.get('q') || '';

  useEffect(() => {
    if (!activeQuery) {
      setResults([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    fetch(`/api/public/search?q=${encodeURIComponent(activeQuery)}&limit=50`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setResults(d.data.items || []);
          setTotal(d.data.total || 0);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams(query ? { q: query } : {}, { replace: true });
  };

  const suggestions = [
    'iPhone cho người mù màu',
    'Laptop màn hình lớn',
    'Tai nghe trợ thính',
    'Bàn phím Braille',
    'Phần mềm đọc màn hình',
  ];

  const titleText = language === 'en' ? 'Search' : 'Tìm kiếm';
  const placeholderText = language === 'en' ? 'Search products...' : 'Tìm sản phẩm...';
  const noResultsText = language === 'en' ? 'No results' : 'Không có kết quả';
  const tryText = language === 'en' ? 'Try one of these:' : 'Thử một trong các từ khóa:';

  return (
    <PublicLayout>
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">{titleText}</h1>
      </header>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="mb-6" role="search">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" aria-hidden="true" />
            <label htmlFor="search-q" className="sr-only">{placeholderText}</label>
            <input
              id="search-q"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholderText}
              autoFocus
              className="w-full pl-10 pr-10 py-3 text-lg rounded-xl border-2 border-outline bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center"
                aria-label="Xóa"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-primary text-on-primary font-bold rounded-xl hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {titleText}
          </button>
        </div>
      </form>

      {/* Active query state */}
      {activeQuery && (
        <div className="mb-6">
          <p className="text-sm text-slate-600" aria-live="polite">
            {loading ? 'Đang tìm...' : (
              <>
                Tìm thấy <strong className="text-slate-900">{total}</strong> kết quả cho "
                <strong className="text-slate-900">{activeQuery}</strong>"
              </>
            )}
          </p>
        </div>
      )}

      {/* Results */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" role="list">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border-2 border-outline rounded-2xl p-4 animate-pulse" role="listitem">
              <div className="h-40 bg-slate-200 rounded-xl mb-3" />
              <div className="h-3 bg-slate-200 rounded mb-2" />
              <div className="h-3 bg-slate-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {!loading && activeQuery && results.length === 0 && (
        <div className="text-center py-12 bg-white border-2 border-dashed border-outline rounded-2xl">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-on-surface-variant font-bold">{noResultsText}</p>
          <p className="text-sm text-slate-500 mt-1">"{activeQuery}"</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" role="list">
          {results.map((p) => {
            const ti = language === 'en' && p.title_en ? p.title_en : p.title;
            return (
              <Link
                key={p.id}
                to={`/products/${p.id}`}
                className="bg-white border-2 border-outline rounded-2xl overflow-hidden hover:border-primary hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                role="listitem"
              >
                <div className="aspect-square bg-slate-50 flex items-center justify-center">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={ti}
                      loading="lazy"
                      className="w-full h-full object-contain p-3"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <Package className="w-16 h-16 text-slate-300" aria-hidden="true" />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-bold line-clamp-2 leading-tight">{ti}</h3>
                  {p.brand && <p className="text-xs text-slate-600 mt-1">{p.brand}</p>}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded capitalize">
                      {p.category.replace('_', ' ')}
                    </span>
                    {p.price_range && (
                      <span className="text-xs font-bold text-primary">{formatPrice(p.price_range)}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Suggestions */}
      {!activeQuery && (
        <div className="mt-8">
          <p className="text-sm text-slate-600 mb-3">{tryText}</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => { setQuery(s); setSearchParams({ q: s }, { replace: true }); }}
                className="px-4 py-2 bg-white border-2 border-outline rounded-full text-sm font-bold hover:border-primary"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </PublicLayout>
  );
}

export default SearchPage;
