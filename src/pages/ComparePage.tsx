/**
 * ComparePage - Compare 2-3 products side-by-side
 * WCAG 2.2 AA compliant
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Package, GitCompare, Plus, ArrowLeft } from 'lucide-react';
import { PublicLayout } from '@/components/PublicLayout';
import { useLanguageStore } from '@/stores';
import { formatPrice } from '@/lib/formatPrice';
import clsx from 'clsx';

interface CompareProduct {
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
  source_url: string;
}

const STORAGE_KEY = 'mada-compare';
const MAX_COMPARE = 3;

export function ComparePage() {
  const { language } = useLanguageStore();
  const [ids, setIds] = useState<string[]>([]);
  const [products, setProducts] = useState<CompareProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Load compare IDs from localStorage
  useEffect(() => {
    const load = () => {
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[];
        setIds(stored);
      } catch {
        setIds([]);
      }
    };
    load();
    const handler = () => load();
    window.addEventListener('mada-compare-changed', handler);
    return () => window.removeEventListener('mada-compare-changed', handler);
  }, []);

  // Load products
  useEffect(() => {
    if (ids.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all(
      ids.map((id) =>
        fetch(`/api/public/products/${id}`)
          .then((r) => r.json())
          .then((d) => (d.success ? d.data.product : null))
          .catch(() => null)
      )
    ).then((results) => {
      setProducts(results.filter(Boolean) as CompareProduct[]);
      setLoading(false);
    });
  }, [ids]);

  const removeOne = (id: string) => {
    const next = ids.filter((x) => x !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setIds(next);
    window.dispatchEvent(new Event('mada-compare-changed'));
  };

  const clearAll = () => {
    localStorage.setItem(STORAGE_KEY, '[]');
    setIds([]);
    window.dispatchEvent(new Event('mada-compare-changed'));
  };

  const titleText = language === 'en' ? 'Compare Products' : 'So sánh sản phẩm';
  const emptyText = language === 'en' ? 'No products to compare' : 'Chưa có sản phẩm để so sánh';
  const emptyHintText = language === 'en'
    ? 'Add products from product detail page to compare them side by side.'
    : 'Thêm sản phẩm từ trang chi tiết để so sánh.';
  const browseText = language === 'en' ? 'Browse products' : 'Xem sản phẩm';
  const clearAllText = language === 'en' ? 'Clear all' : 'Xóa tất cả';
  const addSlotText = language === 'en' ? 'Add product' : 'Thêm sản phẩm';

  if (loading) {
    return (
      <PublicLayout>
        <div className="animate-pulse">
          <div className="h-12 bg-slate-200 rounded w-1/2 mb-4" />
        </div>
      </PublicLayout>
    );
  }

  if (products.length === 0) {
    return (
      <PublicLayout>
        <header className="mb-6">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-2">
            <GitCompare className="w-8 h-8 text-primary" aria-hidden="true" />
            {titleText}
          </h1>
        </header>
        <div className="text-center py-16 bg-white border-2 border-dashed border-outline rounded-2xl">
          <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" aria-hidden="true" />
          <p className="text-xl font-bold text-slate-700">{emptyText}</p>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">{emptyHintText}</p>
          <Link
            to="/products"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            {browseText}
          </Link>
        </div>
      </PublicLayout>
    );
  }

  // Build comparison rows
  const rows: Array<{ label: string; key: keyof CompareProduct | 'iso' | 'wcag'; render: (p: CompareProduct) => React.ReactNode }> = [
    {
      label: language === 'en' ? 'Image' : 'Hình ảnh',
      key: 'image_url',
      render: (p) => p.image_url ? (
        <img src={p.image_url} alt={p.title} className="w-32 h-32 object-contain" />
      ) : (
        <Package className="w-16 h-16 text-slate-300" aria-hidden="true" />
      ),
    },
    {
      label: language === 'en' ? 'Product name' : 'Tên sản phẩm',
      key: 'title',
      render: (p) => (
        <Link to={`/products/${p.id}`} className="font-bold text-primary hover:underline">
          {language === 'en' && p.title_en ? p.title_en : p.title}
        </Link>
      ),
    },
    {
      label: language === 'en' ? 'Brand' : 'Thương hiệu',
      key: 'brand',
      render: (p) => p.brand || <span className="text-slate-400">—</span>,
    },
    {
      label: language === 'en' ? 'Model' : 'Mẫu',
      key: 'model',
      render: (p) => p.model || <span className="text-slate-400">—</span>,
    },
    {
      label: language === 'en' ? 'Category' : 'Danh mục',
      key: 'category',
      render: (p) => (
        <span className="capitalize px-2 py-0.5 bg-slate-100 rounded text-xs">
          {p.category.replace('_', ' ')}
        </span>
      ),
    },
    {
      label: language === 'en' ? 'Price' : 'Giá',
      key: 'price_range',
      render: (p) => p.price_range ? (
        <span className="font-bold text-primary">{formatPrice(p.price_range)}</span>
      ) : (
        <span className="text-slate-400">—</span>
      ),
    },
    {
      label: 'WCAG Level',
      key: 'wcag',
      render: (p) => p.wcag_level ? (
        <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded">
          {p.wcag_level}
        </span>
      ) : <span className="text-slate-400">—</span>,
    },
    {
      label: 'ISO Codes',
      key: 'iso',
      render: (p) => p.iso_codes && p.iso_codes.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {p.iso_codes.map((c, i) => (
            <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
              {c}
            </span>
          ))}
        </div>
      ) : <span className="text-slate-400">—</span>,
    },
    {
      label: 'WHO GATE',
      key: 'who_gate_area',
      render: (p) => p.who_gate_area ? (
        <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded">
          {p.who_gate_area}
        </span>
      ) : <span className="text-slate-400">—</span>,
    },
    {
      label: language === 'en' ? 'Description' : 'Mô tả',
      key: 'description',
      render: (p) => {
        const d = language === 'en' && p.description_en ? p.description_en : p.description;
        return d ? <p className="text-sm text-slate-700 line-clamp-4">{d}</p> : <span className="text-slate-400">—</span>;
      },
    },
    {
      label: language === 'en' ? 'Source' : 'Nguồn',
      key: 'source_url',
      render: (p) => p.source_url ? (
        <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline break-all">
          {new URL(p.source_url).hostname}
        </a>
      ) : <span className="text-slate-400">—</span>,
    },
  ];

  return (
    <PublicLayout>
      <header className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-2">
          <GitCompare className="w-8 h-8 text-primary" aria-hidden="true" />
          {titleText}
        </h1>
        <button
          onClick={clearAll}
          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"
        >
          {clearAllText}
        </button>
      </header>

      <div className="bg-white border-2 border-outline rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" role="table">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-outline">
                <th className="sticky left-0 z-10 bg-slate-50 text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 min-w-[140px]">
                  Thông tin
                </th>
                {products.map((p) => (
                  <th key={p.id} className="px-4 py-3 min-w-[260px] text-left">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700 truncate">
                        {p.brand || p.title}
                      </span>
                      <button
                        onClick={() => removeOne(p.id)}
                        className="p-1 rounded-md hover:bg-red-100 text-slate-500 hover:text-red-600"
                        aria-label={`Xóa ${p.title}`}
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className={clsx('border-b border-outline', idx % 2 === 0 && 'bg-slate-50/50')}>
                  <th className="sticky left-0 z-10 bg-inherit text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 align-top">
                    {row.label}
                  </th>
                  {products.map((p) => (
                    <td key={p.id} className="px-4 py-3 align-top">
                      {row.render(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {products.length < MAX_COMPARE && (
        <div className="mt-4 text-center">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-dashed border-outline rounded-xl text-sm font-bold hover:border-primary"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            {addSlotText} ({products.length}/{MAX_COMPARE})
          </Link>
        </div>
      )}
    </PublicLayout>
  );
}

export default ComparePage;
