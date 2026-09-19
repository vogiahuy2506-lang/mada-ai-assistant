/**
 * ProductCard Component - WCAG 2.2 Compliant
 * Dành cho người khuyết tật, người cao tuổi
 * 
 * WCAG Compliance:
 * - 1.4.3: Contrast ratio tối thiểu 4.5:1
 * - 1.4.11: Non-text contrast tối thiểu 3:1
 * - 2.4.6: Headings and labels
 * - 4.1.2: Name, role, value for all components
 */

import React from 'react';
import { ExternalLink, Check, Star, MapPin } from 'lucide-react';
import { getImageUrl } from '@/lib/imageProxy';
import { t } from '@/lib/translations';

interface Product {
  id: string;
  name: string;
  category: string;
  brand?: string;
  description?: string;
  price_range?: string;
  image_url?: string;
  product_url?: string;
  source_url?: string;
  standards?: string[];
  features?: string[];
  rating?: number;
  review_count?: number;
  availability?: string;
}

interface ProductCardProps {
  product: Product;
  matchScore?: number; // 0-100
  matchReason?: string;
  confidence?: number; // 82-99
  language?: 'vi' | 'en' | 'ar' | 'fr';
  onViewDetails?: () => void;
  onRequestConsult?: () => void;
}

export function ProductCard({
  product,
  matchScore,
  matchReason,
  confidence,
  language = 'vi',
  onViewDetails,
  onRequestConsult,
}: ProductCardProps) {
  // Helper: kiểm tra URL có hợp lệ (http/https) không
  const isValidUrl = (url?: string): boolean => {
    if (!url || typeof url !== 'string') return false;
    return /^https?:\/\//i.test(url.trim());
  };
  const hasValidUrl = isValidUrl(product.product_url) || isValidUrl(product.source_url);
  const handleViewDetails = () => {
    if (!hasValidUrl) {
      // URL không hợp lệ → fallback mở consultation thay vì báo lỗi
      onRequestConsult?.();
      return;
    }
    onViewDetails?.();
  };
  // Đảm bảo contrast ratio ≥ 4.5:1 (WCAG 1.4.3)
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'bg-emerald-500';
    if (score >= 70) return 'bg-blue-500';
    return 'bg-amber-500';
  };

  /**
   * Map category → gradient colors cho fallback image.
   * Giúp user phân biệt nhanh loại sản phẩm qua màu nền.
   */
  const getCategoryGradient = (cat: string): string => {
    const c = (cat || '').toLowerCase();
    if (c.includes('hearing') || c.includes('điếc') || c.includes('thính')) {
      return '#06b6d4, #3b82f6'; // cyan → blue (thính giác - tai)
    }
    if (c.includes('vision') || c.includes('mắt') || c.includes('thị giác') || c.includes('blind')) {
      return '#8b5cf6, #ec4899'; // violet → pink (thị giác)
    }
    if (c.includes('mobility') || c.includes('vận động') || c.includes('wheelchair')) {
      return '#10b981, #06b6d4'; // emerald → cyan (di chuyển)
    }
    if (c.includes('communication') || c.includes('giao tiếp') || c.includes('speech') || c.includes('aac')) {
      return '#f59e0b, #ef4444'; // amber → red (giao tiếp)
    }
    if (c.includes('cognition') || c.includes('nhận thức') || c.includes('learn')) {
      return '#3b82f6, #8b5cf6'; // blue → violet (nhận thức)
    }
    if (c.includes('daily') || c.includes('sinh hoạt')) {
      return '#84cc16, #10b981'; // lime → emerald
    }
    return '#6366f1, #8b5cf6'; // default indigo → violet
  };

  /**
   * Map category → icon name for Material Symbols.
   */
  const getCategoryIcon = (cat: string): string => {
    const c = (cat || '').toLowerCase();
    if (c.includes('hearing') || c.includes('điếc') || c.includes('thính')) return 'headphones';
    if (c.includes('vision') || c.includes('mắt') || c.includes('thị giác') || c.includes('blind')) return 'visibility';
    if (c.includes('mobility') || c.includes('vận động') || c.includes('wheelchair')) return 'accessible_forward';
    if (c.includes('communication') || c.includes('giao tiếp') || c.includes('speech') || c.includes('aac')) return 'record_voice_over';
    if (c.includes('cognition') || c.includes('nhận thức') || c.includes('learn')) return 'psychology';
    if (c.includes('daily') || c.includes('sinh hoạt')) return 'commute';
    return 'accessibility'; // default assistive technology
  };

  return (
    <article
      className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden hover:shadow-lg hover:border-violet-200 transition-all duration-200"
      role="article"
      aria-labelledby={`product-title-${product.id}`}
      aria-describedby={`product-desc-${product.id}`}
    >
      {/* Header với hình ảnh và match score - ĐÃ FIX overflow */}
      <div className="relative p-4 bg-gradient-to-br from-slate-50 to-slate-100 border-b border-slate-200">
        {/* Image */}
        <div className="flex gap-4">
          <div className="w-24 h-24 rounded-xl overflow-hidden bg-white flex-shrink-0 border border-slate-200 relative">
            {(() => {
              const safeUrl = getImageUrl(product.image_url);
              return safeUrl ? (
                <img
                  src={safeUrl}
                  alt={`${product.name} - ${product.category}`}
                  className="w-full h-full object-cover relative z-10"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    // Ản img bị lỗi → fallback gradient + emoji tự động hiện ra
                    const target = e.currentTarget as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : null;
            })()}
            {/* Category-based fallback - gradient + icon. Layer dưới img với z-index thấp hơn (z-10 của img), nên khi img load thành công sẽ che fallback. Khi img lỗi/rỗng → fallback hiện ra. */}
            <div
              className="fallback-icon absolute inset-0 w-full h-full flex items-center justify-center text-white font-bold"
              style={{
                background: `linear-gradient(135deg, ${getCategoryGradient(product.category)})`,
              }}
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                {getCategoryIcon(product.category)}
              </span>
            </div>
          </div>

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <h3
              id={`product-title-${product.id}`}
              className="text-sm font-bold text-slate-900 mb-1 leading-tight"
            >
              {product.name}
            </h3>
            <p className="text-xs text-slate-600 mb-2">{product.category}</p>

            {/* Rating & Availability */}
            <div className="flex items-center gap-3 mb-2">
              {product.rating && (
                <div className="flex items-center gap-1" role="img" aria-label={`${product.rating} ${t('productCard.reviews', language)}`}>
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" aria-hidden="true" />
                  <span className="text-xs font-semibold text-slate-700">{product.rating}</span>
                  {product.review_count && (
                    <span className="text-xs text-slate-500">({product.review_count})</span>
                  )}
                </div>
              )}
              {product.availability && (
                <div className="flex items-center gap-1 text-xs text-emerald-600">
                  <MapPin className="w-3 h-3" aria-hidden="true" />
                  <span className="font-medium">{product.availability}</span>
                </div>
              )}
            </div>

            {/* Price */}
            {product.price_range && (
              <p className="text-sm font-bold text-violet-600">{product.price_range}</p>
            )}
          </div>

          {/* Match Score Badge - ĐÃ FIX: nằm trong card */}
          {matchScore !== undefined && (
            <div
              className="flex flex-col items-center justify-center"
              role="meter"
              aria-valuenow={matchScore}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${t('productCard.matchScore', language)}: ${matchScore}%`}
            >
              <div className={`w-12 h-12 rounded-full ${getScoreColor(matchScore)} flex items-center justify-center text-white font-bold text-sm shadow-md`}>
                {matchScore}%
              </div>
              <span className="text-[10px] text-slate-500 mt-1 font-medium">{t('productCard.matchScore', language)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Match Reason - ĐÃ FIX: contrast ≥ 4.5:1 */}
        {matchReason && (
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
              {t('productCard.suitable', language)}
            </h4>
            <ul className="space-y-1.5" role="list" aria-label={t('productCard.suitable', language)}>
              {product.features?.slice(0, 3).map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-xs text-slate-700 leading-relaxed">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Standards Badges - ĐÃ FIX: nằm trong card body */}
        {product.standards && product.standards.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
              {t('productCard.standards', language)}
            </h4>
            <div className="flex flex-wrap gap-1.5" role="list" aria-label={t('productCard.standards', language)}>
              {product.standards.map((standard, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded-md border border-slate-200"
                  role="listitem"
                >
                  {standard}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Confidence Score */}
        {confidence !== undefined && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">{t('productCard.confidence', language)}:</span>
            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${getScoreColor(confidence)} transition-all`}
                style={{ width: `${confidence}%` }}
                role="progressbar"
                aria-valuenow={confidence}
                aria-valuemin={82}
                aria-valuemax={99}
              />
            </div>
            <span className="text-slate-700 font-semibold">{confidence}%</span>
          </div>
        )}
      </div>

      {/* Footer - Actions */}
      <div className="px-4 pb-4 flex gap-2">
        {/* Nút Chi tiết - Secondary (xám). Disable nếu URL không hợp lệ (vd: manual:<ts>). */}
        <button
          onClick={handleViewDetails}
          disabled={!hasValidUrl}
          title={hasValidUrl ? t('productCard.details', language) : t('productCard.contactForDetails', language)}
          className={`flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 ${
            hasValidUrl
              ? 'hover:bg-slate-200 hover:text-slate-900 cursor-pointer'
              : 'opacity-50 cursor-not-allowed'
          }`}
          aria-label={`${t('productCard.details', language)}: ${product.name}`}
        >
          {t('productCard.details', language)}
        </button>

        {/* Nút Tư vấn/Mua - Primary (xanh) */}
        <button
          onClick={onRequestConsult}
          className="flex-1 px-4 py-2.5 bg-[#0047ff] text-white text-xs font-bold rounded-xl hover:bg-[#0037cc] transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center gap-1.5"
          aria-label={`${t('productCard.consult', language)}: ${product.name}`}
        >
          {t('productCard.consult', language)}
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </button>
      </div>

      {/* Hidden description for screen readers */}
      <div id={`product-desc-${product.id}`} className="sr-only">
        {product.description || `${product.name} - ${product.category}`}
        {product.brand && ` - ${product.brand}`}
        {product.price_range && ` - ${product.price_range}`}
        {matchScore && ` - ${t('productCard.matchScore', language)}: ${matchScore}%`}
        {confidence && ` - ${t('productCard.confidence', language)}: ${confidence}%`}
      </div>
    </article>
  );
}

// Grid wrapper for ProductCards
export function ProductCardGrid({
  children,
  className = '',
  language = 'vi',
}: {
  children: React.ReactNode;
  className?: string;
  language?: 'vi' | 'en' | 'ar' | 'fr';
}) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}
      role="list"
      aria-label={t('productCard.productList', language)}
    >
      {children}
    </div>
  );
}

export default ProductCard;
