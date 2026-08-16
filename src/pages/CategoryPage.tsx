/**
 * CategoryPage - Browse products by category
 * WCAG 2.2 AA compliant
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Package } from 'lucide-react';
import { PublicLayout } from '@/components/PublicLayout';
import { useLanguageStore } from '@/stores';
import { ProductsPage } from './ProductsPage';

interface Category {
  id: string;
  name_vi: string;
  name_en: string;
  icon: string;
  description_vi: string | null;
  description_en: string | null;
}

export function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguageStore();
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/public/categories/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCategory(d.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <PublicLayout>
        <div className="animate-pulse">
          <div className="h-12 bg-slate-200 rounded w-1/2 mb-4" />
          <div className="h-4 bg-slate-200 rounded w-3/4" />
        </div>
      </PublicLayout>
    );
  }

  if (!category) {
    return (
      <PublicLayout>
        <div className="text-center py-20">
          <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-2xl font-black mb-2">Không tìm thấy danh mục</h1>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold mt-4"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Xem tất cả sản phẩm
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const name = language === 'en' ? category.name_en : category.name_vi;
  const desc = language === 'en' ? category.description_en : category.description_vi;

  return (
    <div>
      {/* Category Hero */}
      <div className="bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50 border-b-2 border-outline">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <nav className="text-sm text-slate-600 mb-4" aria-label="Breadcrumb">
            <ol className="flex items-center gap-1 flex-wrap" role="list">
              <li><Link to="/" className="hover:text-primary">Trang chủ</Link></li>
              <li aria-hidden="true">/</li>
              <li><Link to="/products" className="hover:text-primary">Sản phẩm</Link></li>
              <li aria-hidden="true">/</li>
              <li className="text-slate-900 font-bold" aria-current="page">{name}</li>
            </ol>
          </nav>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            <span aria-hidden="true" className="mr-3">{category.icon}</span>
            {name}
          </h1>
          {desc && (
            <p className="mt-3 text-lg text-slate-600 max-w-3xl">{desc}</p>
          )}
        </div>
      </div>

      {/* Product grid (re-use ProductsPage logic with preset filter) */}
      <PublicLayout>
        <CategoryProducts categoryId={category.id} />
      </PublicLayout>
    </div>
  );
}

function CategoryProducts({ categoryId }: { categoryId: string }) {
  // Use the existing ProductsPage with category preset
  return (
    <div data-category-preset={categoryId}>
      <ProductsPageWithCategory categoryId={categoryId} />
    </div>
  );
}

// Wrapper to inject category filter
import { useSearchParams } from 'react-router-dom';
function ProductsPageWithCategory({ categoryId }: { categoryId: string }) {
  const [, setSearchParams] = useSearchParams();
  useEffect(() => {
    setSearchParams({ category: categoryId }, { replace: true });
  }, [categoryId, setSearchParams]);
  return <ProductsPage />;
}

export default CategoryPage;
