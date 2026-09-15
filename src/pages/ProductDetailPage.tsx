/**
 * ProductDetailPage - Single product view
 * WCAG 2.2 AA compliant + ISO/WCAG badges
 */
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, ExternalLink, Share2, Check } from 'lucide-react';
import { PublicLayout } from '@/components/PublicLayout';
import { useLanguageStore } from '@/stores';
import { useAuthStore } from '@/stores';
import { formatPrice } from '@/lib/formatPrice';
import clsx from 'clsx';

interface Product {
  id: string;
  title: string;
  title_en: string;
  description: string;
  description_en: string;
  content: string;
  category: string;
  brand: string;
  model: string;
  price_range: string;
  source_url: string;
  product_url: string;
  image_url: string;
  iso_codes: string[];
  wcag_level: string;
  who_gate_area: string;
  status: string;
  featured: number;
}

const API = '/api/public';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguageStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [addedCompare, setAddedCompare] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setAddedCompare(false);
    fetch(`${API}/products/${id}?lang=${language}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setProduct(d.data.product);
          setRelated(d.data.related || []);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const addToCompare = () => {
    if (!product) return;
    try {
      const current = JSON.parse(localStorage.getItem('mada-compare') || '[]') as string[];
      if (!current.includes(product.id)) {
        current.push(product.id);
        localStorage.setItem('mada-compare', JSON.stringify(current));
        setAddedCompare(true);
        window.dispatchEvent(new Event('mada-compare-changed'));
      }
    } catch {}
  };

  const buyText = language === 'en' ? 'Find Suppliers' : 'Tìm nơi mua';
  const consultText = language === 'en' ? 'Request Consultation' : 'Yêu cầu tư vấn';
  const compareText = language === 'en' ? 'Add to Compare' : 'Thêm vào so sánh';
  const addedText = language === 'en' ? 'Added to Compare' : 'Đã thêm vào so sánh';
  const shareText = language === 'en' ? 'Share' : 'Chia sẻ';
  const standardsText = language === 'en' ? 'Technical Standards' : 'Tiêu chuẩn kỹ thuật';
  const descriptionText = language === 'en' ? 'Description' : 'Mô tả';
  const categoryText = language === 'en' ? 'Category' : 'Danh mục';
  const brandText = language === 'en' ? 'Brand' : 'Thương hiệu';
  const modelText = language === 'en' ? 'Model' : 'Mẫu';
  const relatedText = language === 'en' ? 'Related Products' : 'Sản phẩm liên quan';
  const notFoundText = language === 'en' ? 'Product not found' : 'Không tìm thấy sản phẩm';

  if (loading) {
    return (
      <PublicLayout>
        <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="aspect-square bg-slate-200 rounded-2xl" />
          <div className="space-y-3">
            <div className="h-4 bg-slate-200 rounded w-1/3" />
            <div className="h-8 bg-slate-200 rounded w-3/4" />
            <div className="h-4 bg-slate-200 rounded w-1/2" />
            <div className="h-32 bg-slate-200 rounded mt-6" />
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (notFound || !product) {
    return (
      <PublicLayout>
        <div className="text-center py-20">
          <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-2xl font-black mb-2">{notFoundText}</h1>
          <p className="text-slate-600 mb-6">ID: {id}</p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Quay lại danh sách
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const ti = language === 'en' && product.title_en ? product.title_en : product.title;
  const desc = language === 'en' && product.description_en ? product.description_en : product.description;

  return (
    <PublicLayout>
      {/* Breadcrumb */}
      <nav className="text-sm text-slate-600 mb-4" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1 flex-wrap" role="list">
          <li><Link to="/" className="hover:text-primary">Trang chủ</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link to="/products" className="hover:text-primary">Sản phẩm</Link></li>
          {product.category && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link to={`/category/${product.category}`} className="hover:text-primary capitalize">
                  {product.category.replace('_', ' ')}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true">/</li>
          <li className="text-slate-900 font-bold truncate max-w-[200px]" aria-current="page">{ti}</li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {/* Product Image */}
        <div>
          <div className="aspect-square bg-slate-50 border-2 border-outline rounded-2xl overflow-hidden flex items-center justify-center sticky top-24">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={ti}
                className="w-full h-full object-contain p-4"
                referrerPolicy="no-referrer"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <Package className="w-32 h-32 text-slate-300" aria-hidden="true" />
            )}
          </div>

          {/* ISO / WCAG badges */}
          <div className="mt-4 flex flex-wrap gap-2">
            {product.wcag_level && (
              <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border-2 border-emerald-300">
                ♿ WCAG {product.wcag_level}
              </span>
            )}
            {product.iso_codes && product.iso_codes.map((code, i) => (
              <span
                key={i}
                className="px-3 py-1.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-lg border-2 border-blue-300"
              >
                ISO {code}
              </span>
            ))}
            {product.who_gate_area && (
              <span className="px-3 py-1.5 bg-purple-100 text-purple-800 text-xs font-bold rounded-lg border-2 border-purple-300">
                WHO GATE: {product.who_gate_area}
              </span>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">{ti}</h1>

          {product.brand && (
            <p className="mt-2 text-lg text-slate-600">{product.brand}</p>
          )}

          {product.price_range && (
            <p className="mt-4 text-2xl font-black text-primary">{formatPrice(product.price_range)}</p>
          )}

          {/* Meta */}
          <dl className="mt-6 space-y-2 text-sm">
            {product.category && (
              <div className="flex gap-3">
                <dt className="w-24 text-slate-500 font-bold uppercase tracking-wide text-xs">{categoryText}:</dt>
                <dd className="capitalize">{product.category.replace('_', ' ')}</dd>
              </div>
            )}
            {product.brand && (
              <div className="flex gap-3">
                <dt className="w-24 text-slate-500 font-bold uppercase tracking-wide text-xs">{brandText}:</dt>
                <dd>{product.brand}</dd>
              </div>
            )}
            {product.model && (
              <div className="flex gap-3">
                <dt className="w-24 text-slate-500 font-bold uppercase tracking-wide text-xs">{modelText}:</dt>
                <dd>{product.model}</dd>
              </div>
            )}
          </dl>

          {/* Actions */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            {product.product_url && (
              <a
                href={product.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-5 py-3 bg-primary text-on-primary font-bold rounded-xl text-center hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 flex items-center justify-center gap-2"
              >
                {buyText}
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
              </a>
            )}
            <button
              onClick={() => {
                if (!user) {
                  navigate('/chat');
                } else {
                  navigate('/chat');
                }
              }}
              className="flex-1 px-5 py-3 bg-white border-2 border-primary text-primary font-bold rounded-xl hover:bg-primary/5 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {consultText}
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={addToCompare}
              disabled={addedCompare}
              className={clsx(
                'flex-1 px-4 py-2.5 text-xs font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-1.5',
                addedCompare
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                  : 'bg-white border-outline text-slate-700 hover:border-primary'
              )}
              aria-live="polite"
            >
              {addedCompare ? <Check className="w-4 h-4" aria-hidden="true" /> : null}
              {addedCompare ? addedText : compareText}
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: ti, url: window.location.href });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                }
              }}
              className="px-4 py-2.5 bg-white border-2 border-outline text-slate-700 text-xs font-bold rounded-xl hover:border-primary flex items-center gap-1.5"
              aria-label={shareText}
            >
              <Share2 className="w-4 h-4" aria-hidden="true" />
              {shareText}
            </button>
          </div>

          {/* Description */}
          {desc && (
            <section className="mt-8" aria-labelledby="desc-heading">
              <h2 id="desc-heading" className="text-lg font-black mb-3">{descriptionText}</h2>
              <p className="text-slate-700 leading-relaxed whitespace-pre-line">{desc}</p>
            </section>
          )}

          {/* Standards detail */}
          {(product.wcag_level || (product.iso_codes && product.iso_codes.length > 0) || product.who_gate_area) && (
            <section className="mt-6 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl" aria-labelledby="standards-heading">
              <h2 id="standards-heading" className="text-sm font-black text-emerald-900 mb-2 flex items-center gap-1.5">
                <Check className="w-4 h-4" aria-hidden="true" />
                {standardsText}
              </h2>
              <ul className="space-y-1 text-sm text-emerald-900" role="list">
                {product.wcag_level && (
                  <li>• WCAG Level: <strong>{product.wcag_level}</strong></li>
                )}
                {product.iso_codes && product.iso_codes.map((code, i) => (
                  <li key={i}>• ISO {code}</li>
                ))}
                {product.who_gate_area && (
                  <li>• WHO GATE: <strong>{product.who_gate_area}</strong></li>
                )}
              </ul>
            </section>
          )}

          {/* Source attribution */}
          {product.source_url && (
            <p className="mt-6 text-xs text-slate-500">
              <a href={product.source_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                Nguồn: {new URL(product.source_url).hostname}
              </a>
            </p>
          )}
        </div>
      </div>

      {/* Related Products */}
      {related.length > 0 && (
        <section className="mt-16" aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-2xl font-black mb-6">{relatedText}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4" role="list">
            {related.map((p) => (
              <Link
                key={p.id}
                to={`/products/${p.id}`}
                className="bg-white border-2 border-outline rounded-xl overflow-hidden hover:border-primary hover:shadow-md transition-all"
                role="listitem"
              >
                <div className="aspect-square bg-slate-50 flex items-center justify-center">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.title}
                      loading="lazy"
                      className="w-full h-full object-contain p-2"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <Package className="w-10 h-10 text-slate-300" aria-hidden="true" />
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-bold line-clamp-2">{p.title}</p>
                  {p.brand && <p className="text-[10px] text-slate-500 mt-0.5">{p.brand}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </PublicLayout>
  );
}

export default ProductDetailPage;
