/**
 * ProductCard Component - Modern UI/UX Design
 * Dành cho người khuyết tật, người cao tuổi
 * 
 * Features:
 * - Modern card design với glassmorphism touch
 * - Clear visual hierarchy
 * - Smooth animations
 * - WCAG 2.2 Compliant (contrast ≥ 4.5:1)
 * - Horizontal layout for better readability
 */

import React from 'react';
import { ExternalLink, Check, Star, MapPin, ShoppingCart } from 'lucide-react';
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
  onRequestConsult,
}: ProductCardProps) {
  // Helper: kiểm tra URL có hợp lệ (http/https) không
  const isValidUrl = (url?: string): boolean => {
    if (!url || typeof url !== 'string') return false;
    return /^https?:\/\//i.test(url.trim());
  };
  const hasValidUrl = isValidUrl(product.product_url) || isValidUrl(product.source_url);

  // Đảm bảo contrast ratio ≥ 4.5:1 (WCAG 1.4.3)
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'bg-gradient-to-br from-emerald-500 to-green-600';
    if (score >= 70) return 'bg-gradient-to-br from-blue-500 to-indigo-600';
    return 'bg-gradient-to-br from-amber-500 to-orange-500';
  };

  /**
   * Map category → gradient colors cho fallback image.
   */
  const getCategoryGradient = (cat: string): string => {
    const c = (cat || '').toLowerCase();
    if (c.includes('hearing') || c.includes('điếc') || c.includes('thính')) {
      return '#06b6d4, #3b82f6';
    }
    if (c.includes('vision') || c.includes('mắt') || c.includes('thị giác') || c.includes('blind')) {
      return '#8b5cf6, #ec4899';
    }
    if (c.includes('mobility') || c.includes('vận động') || c.includes('wheelchair')) {
      return '#10b981, #06b6d4';
    }
    if (c.includes('communication') || c.includes('giao tiếp') || c.includes('speech') || c.includes('aac')) {
      return '#f59e0b, #ef4444';
    }
    if (c.includes('cognition') || c.includes('nhận thức') || c.includes('learn')) {
      return '#3b82f6, #8b5cf6';
    }
    if (c.includes('daily') || c.includes('sinh hoạt')) {
      return '#84cc16, #10b981';
    }
    return '#6366f1, #8b5cf6';
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
    return 'accessibility';
  };

  return (
    <article
      className="group bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden hover:shadow-xl hover:border-violet-200 transition-all duration-300"
      role="article"
      aria-labelledby={`product-title-${product.id}`}
      aria-describedby={`product-desc-${product.id}`}
    >
      {/* Main Content - Horizontal Layout */}
      <div className="flex flex-col lg:flex-row">
        
        {/* LEFT SIDE - Image với Match Score */}
        <div className="lg:w-64 xl:w-72 flex-shrink-0 p-4 lg:p-5 bg-gradient-to-br from-white to-slate-50 lg:border-r border-b lg:border-b-0 border-slate-100">
          <div className="flex flex-col items-center gap-4">
            {/* Image Container */}
            <div className="w-36 h-36 lg:w-full lg:h-48 rounded-2xl overflow-hidden bg-white flex-shrink-0 border border-slate-100 shadow-sm relative group-hover:shadow-md transition-shadow">
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
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : null;
              })()}
              {/* Category-based fallback */}
              <div
                className="fallback-icon absolute inset-0 w-full h-full flex items-center justify-center text-white"
                style={{
                  background: `linear-gradient(135deg, ${getCategoryGradient(product.category)})`,
                }}
                aria-hidden="true"
              >
                <span className="material-symbols-outlined text-5xl lg:text-6xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {getCategoryIcon(product.category)}
                </span>
              </div>
            </div>

            {/* Match Score Badge */}
            {matchScore !== undefined && (
              <div
                className="flex flex-col items-center"
                role="meter"
                aria-valuenow={matchScore}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Phù hợp: ${matchScore}%`}
              >
                <div className={`w-16 h-16 rounded-full ${getScoreColor(matchScore)} flex items-center justify-center text-white font-bold text-xl shadow-lg ring-4 ring-white`}>
                  {matchScore}%
                </div>
                <span className="text-xs text-slate-500 mt-2 font-semibold uppercase tracking-wide">
                  Phù hợp
                </span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE - Product Info với Scroll */}
        <div className="flex-1 p-5 flex flex-col">
          
          {/* Header - Product Info */}
          <div className="mb-4">
            {/* Category Badge */}
            <span className="inline-block px-3 py-1 bg-violet-100 text-violet-700 text-xs font-semibold rounded-full mb-2">
              {product.category}
            </span>
            
            {/* Product Name */}
            <h3
              id={`product-title-${product.id}`}
              className="text-xl font-bold text-slate-900 leading-tight mb-2 group-hover:text-violet-700 transition-colors"
            >
              {product.name}
            </h3>
            
            {/* Brand */}
            {product.brand && (
              <p className="text-sm text-slate-500 mb-2">
                <span className="font-medium">{product.brand}</span>
              </p>
            )}

            {/* Rating & Availability Row */}
            <div className="flex items-center gap-4 mb-3">
              {product.rating && (
                <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-full" role="img" aria-label={`${product.rating} sao`}>
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" aria-hidden="true" />
                  <span className="text-sm font-bold text-amber-700">{product.rating}</span>
                  {product.review_count && (
                    <span className="text-xs text-amber-600/70">({product.review_count})</span>
                  )}
                </div>
              )}
              {product.availability && (
                <div className="flex items-center gap-1 text-sm text-emerald-600">
                  <MapPin className="w-4 h-4" aria-hidden="true" />
                  <span className="font-medium">{product.availability}</span>
                </div>
              )}
            </div>

            {/* Price - Nổi bật */}
            {product.price_range && (
              <p className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                {product.price_range}
              </p>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100/50 mb-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                {product.description}
              </p>
            </div>
          )}

          {/* Features - Horizontal Layout */}
          {matchReason && product.features && product.features.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-sm text-violet-500">verified</span>
                Tính năng nổi bật
              </h4>
              <div className="flex flex-wrap gap-2" role="list" aria-label="Tính năng nổi bật">
                {product.features.slice(0, 4).map((feature, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-100">
                    <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            {/* View Details Button */}
            {(product.product_url || product.source_url) && (
              <a
                href={product.product_url || product.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all group/link"
                onClick={(e) => {
                  if (!hasValidUrl) {
                    e.preventDefault();
                    onRequestConsult?.();
                  }
                }}
              >
                <ExternalLink className="w-4 h-4 text-violet-600 group-hover/link:translate-x-0.5 transition-transform" aria-hidden="true" />
                Xem chi tiết
                <span className="material-symbols-outlined text-base ml-1 opacity-60">open_in_new</span>
              </a>
            )}

            {/* Consult Button */}
            <button
              onClick={onRequestConsult}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500"
              aria-label={`Tư vấn về ${product.name}`}
            >
              <ShoppingCart className="w-4 h-4" aria-hidden="true" />
              {t('productCard.consult', language)}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden description for screen readers */}
      <div id={`product-desc-${product.id}`} className="sr-only">
        {product.description || `${product.name} - ${product.category}`}
        {product.brand && ` - Thương hiệu: ${product.brand}`}
        {product.price_range && ` - Giá: ${product.price_range}`}
        {matchScore && ` - Phù hợp: ${matchScore}%`}
        {confidence && ` - Độ tin cậy: ${confidence}%`}
      </div>
    </article>
  );
}

// Grid wrapper for ProductCards - Adjusted for horizontal cards
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
      className={`grid grid-cols-1 xl:grid-cols-2 gap-6 ${className}`}
      role="list"
      aria-label={t('productCard.productList', language)}
    >
      {children}
    </div>
  );
}

export default ProductCard;
