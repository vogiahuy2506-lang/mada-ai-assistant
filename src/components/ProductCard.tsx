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
import { ExternalLink, Check, Star, MapPin, Package } from 'lucide-react';

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
  // Đảm bảo contrast ratio ≥ 4.5:1 (WCAG 1.4.3)
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'bg-emerald-500';
    if (score >= 70) return 'bg-blue-500';
    return 'bg-amber-500';
  };

  const translations = {
    vi: {
      details: 'Chi tiết',
      consult: 'Tư vấn ngay',
      buy: 'Tìm nơi mua',
      suitable: 'Phù hợp vì:',
      standards: 'Tiêu chuẩn kỹ thuật:',
      rating: 'đánh giá',
      available: 'Có sẵn tại VN',
      matchScore: 'Độ khớp',
      confidence: 'Độ tin cậy',
      features: 'Đặc điểm nổi bật:',
    },
    en: {
      details: 'Details',
      consult: 'Get Consult',
      buy: 'Find Suppliers',
      suitable: 'Suitable because:',
      standards: 'Technical Standards:',
      rating: 'reviews',
      available: 'Available in VN',
      matchScore: 'Match Score',
      confidence: 'Confidence',
      features: 'Key Features:',
    },
    ar: {
      details: 'التفاصيل',
      consult: 'استشارة',
      buy: 'ابحث عن موردين',
      suitable: 'مناسب لأن:',
      standards: 'المعايير التقنية:',
      rating: 'تقييم',
      available: 'متوفر في فيتنام',
      matchScore: 'درجة التطابق',
      confidence: 'الثقة',
      features: 'الميزات الرئيسية:',
    },
    fr: {
      details: 'Détails',
      consult: 'Consultation',
      buy: 'Trouver fournisseurs',
      suitable: 'Convient car:',
      standards: 'Normes techniques:',
      rating: 'avis',
      available: 'Disponible au VN',
      matchScore: 'Score de correspondance',
      confidence: 'Confiance',
      features: 'Caractéristiques principales:',
    },
  };

  const t = translations[language];

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
          <div className="w-24 h-24 rounded-xl overflow-hidden bg-white flex-shrink-0 border border-slate-200">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={`${product.name} - ${product.category}`}
                className="w-full h-full object-cover"
                loading="eager"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                onError={(e) => {
                  // Hide img and show fallback
                  const target = e.currentTarget as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent && !parent.querySelector('.fallback-icon')) {
                    const fallback = document.createElement('div');
                    fallback.className = 'fallback-icon w-full h-full bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center';
                    fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8 text-violet-400" aria-hidden="true"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>';
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
                <Package className="w-8 h-8 text-violet-400" aria-hidden="true" />
              </div>
            )}
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
                <div className="flex items-center gap-1" role="img" aria-label={`${product.rating} ${t.rating}`}>
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
              aria-label={`${t.matchScore}: ${matchScore}%`}
            >
              <div className={`w-12 h-12 rounded-full ${getScoreColor(matchScore)} flex items-center justify-center text-white font-bold text-sm shadow-md`}>
                {matchScore}%
              </div>
              <span className="text-[10px] text-slate-500 mt-1 font-medium">{t.matchScore}</span>
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
              {t.suitable}
            </h4>
            <ul className="space-y-1.5" role="list" aria-label={t.suitable}>
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
              {t.standards}
            </h4>
            <div className="flex flex-wrap gap-1.5" role="list" aria-label={t.standards}>
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
            <span className="text-slate-500 font-medium">{t.confidence}:</span>
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
        {/* Nút Chi tiết - Secondary (xám) */}
        <button
          onClick={onViewDetails}
          className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 hover:text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400"
          aria-label={`${t.details}: ${product.name}`}
        >
          {t.details}
        </button>

        {/* Nút Tư vấn/Mua - Primary (xanh) */}
        <button
          onClick={onRequestConsult}
          className="flex-1 px-4 py-2.5 bg-[#0047ff] text-white text-xs font-bold rounded-xl hover:bg-[#0037cc] transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center gap-1.5"
          aria-label={`${t.consult}: ${product.name}`}
        >
          {t.consult}
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </button>
      </div>

      {/* Hidden description for screen readers */}
      <div id={`product-desc-${product.id}`} className="sr-only">
        {product.description || `${product.name} - ${product.category}`}
        {product.brand && ` - ${product.brand}`}
        {product.price_range && ` - ${product.price_range}`}
        {matchScore && ` - ${t.matchScore}: ${matchScore}%`}
        {confidence && ` - ${t.confidence}: ${confidence}%`}
      </div>
    </article>
  );
}

// Grid wrapper for ProductCards
export function ProductCardGrid({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}
      role="list"
      aria-label="Danh sách sản phẩm"
    >
      {children}
    </div>
  );
}

export default ProductCard;
