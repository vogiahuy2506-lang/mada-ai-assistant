/**
 * AIImportCard - Component cho Admin nhập URL website
 * để AI tự động scrape và trích xuất danh sách sản phẩm.
 *
 * Luồng:
 *  1. Admin paste URL + chọn category mặc định
 *  2. Click "Import" → gọi /api/scraper/import-url (preview only)
 *  3. Hiển thị danh sách sản phẩm trích xuất được
 *  4. Admin xác nhận → gọi /api/scraper/import-url/save (lưu vào DB)
 */

import { useState } from 'react';
import { useAuthStore } from '@/stores';
import { getAccessToken } from '@/lib/api';
import { Category } from './adminApi';
import clsx from 'clsx';
import { getImageUrl } from '../../lib/imageProxy';
import { Sparkles, ExternalLink, CheckCircle2, AlertTriangle, Loader2, Save } from 'lucide-react';

interface ImportPreviewProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  imageUrl: string;
  brand?: string;
  category?: string;
  /** Danh mục MADA được phát hiện tự động (vision, hearing, mobility, ...) */
  madaCategory?: string;
  inStock: boolean;
  url: string;
}

interface ImportPreviewResponse {
  url: string;
  totalFound: number;
  method: 'json-ld' | 'html-selectors' | 'gemini-ai' | 'mixed';
  durationMs: number;
  products: ImportPreviewProduct[];
  stats: {
    withPrice: number;
    withImage: number;
    inStock: number;
    withBrand: number;
  };
}

/** Map MADA category ID → label + color */
export const MADA_CATEGORY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  vision: { label: '👁️ Thị giác', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  hearing: { label: '🔊 Thính giác', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  communication: { label: '💬 Giao tiếp', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200' },
  mobility: { label: '🦽 Vận động', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  cognition: { label: '🧠 Nhận thức', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  daily_living: { label: '🏠 Sinh hoạt', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  web_accessibility: { label: '🌐 Web A11y', color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-200' },
  general: { label: '📋 Tổng quát', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
};

interface AIImportCardProps {
  categories: Category[];
  onImportSuccess?: () => void;
}

export function AIImportCard({ categories, onImportSuccess }: AIImportCardProps) {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [onlyValid, setOnlyValid] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  const isAdmin =
    user?.role === 'admin' ||
    user?.role === 'data_manager';

  if (!isAdmin) return null;

  const reset = () => {
    setUrl('');
    setCategory('');
    setError(null);
    setPreview(null);
  };

  const handlePreview = async () => {
    if (!url.trim()) {
      setError('Vui lòng nhập URL');
      return;
    }
    try {
      new URL(url);
    } catch {
      setError('URL không hợp lệ (ví dụ: https://shop.com/products)');
      return;
    }

    setLoading(true);
    setError(null);
    setPreview(null);
    setProgressMessage('⏳ Đang tải trang web...');
    try {
      const token = getAccessToken() || '';

      // Update progress sau 2s để user biết đang chờ
      const progressTimer1 = setTimeout(() => {
        setProgressMessage('🔍 Đang tìm sản ph�m trong HTML/JSON-LD...');
      }, 2000);
      const progressTimer2 = setTimeout(() => {
        setProgressMessage('🤖 Đang dùng AI phân tích nội dung... (có thể mất 10-20 giây)');
      }, 6000);

      const res = await fetch('/api/scraper/import-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: url.trim(), defaultCategory: category || 'general' }),
      });
      const json = await res.json();
      clearTimeout(progressTimer1);
      clearTimeout(progressTimer2);
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Không thể scrape URL này');
      }
      setPreview(json.data);

      // Gợi ý nếu 0 sản phẩm
      if (json.data?.totalFound === 0) {
        const url = json.data?.url || '';
        const isHomepage = /\/$|home|index/.test(url);
        setError(
          '⚠️ URL này không có sản ph�m nào (đã thử 3 phương pháp: JSON-LD, HTML selectors, AI).\n\n' +
          '🔍 Nguyên nhân có thể:\n' +
          (isHomepage ? '• Đây là trang chủ/homepage (chỉ có banner)\n' : '• Trang không phải shop bán hàng (wiki, blog, tin tức)\n') +
          '• Trang cần đăng nhập/cookie\n' +
          '• Trang chặn bot/scraper\n\n' +
          '✅ Thử các URL kiểu này:\n' +
          '• Trang danh mục: https://www.thegioididong.com/laptop\n' +
          '• Trang SP đơn: https://www.thegioididong.com/dtdd/iphone-15-pro-max\n' +
          '• Shop VN: cellphones.com.vn/mobile.html, fptshop.com.vn/dien-thoai'
        );
      }
    } catch (err: any) {
      // Distinguish network errors from server errors
      const msg = err?.message || 'Lỗi không xác định';
      let displayMsg = msg;
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('Network request failed') ||
        msg.includes('NetworkError') ||
        msg.includes('fetch') ||
        !navigator.onLine
      ) {
        displayMsg = '❌ Không thể kết nối server. Kiểm tra mạng hoặc server có đang chạy không.';
      } else if (msg.includes('timeout') || msg.includes('Timeout')) {
        displayMsg = '⏱️ Hết thời gian chờ (timeout). URL có thể chặn scraper hoặc server quá chậm.';
      }
      setError(displayMsg);
    } finally {
      setLoading(false);
      setProgressMessage(null);
    }
  };

  const handleSave = async () => {
    if (!preview) return;
    if (!confirm(`Lưu ${preview.totalFound} sản phẩm vào kho tri thức?`)) return;

    setSaving(true);
    setError(null);
    try {
      const token = getAccessToken() || '';
      const res = await fetch('/api/scraper/import-url/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          url: preview.url,
          defaultCategory: category || 'general',
          onlyValid,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Lưu thất bại');
      }
      const { saved, skipped } = json.data || {};
      alert(`✅ ${json.message}\n\nĐã lưu: ${saved || 0} SP${skipped ? ` | Bỏ qua trùng: ${skipped} SP` : ''}`);
      reset();
      setOpen(false);
      onImportSuccess?.();
    } catch (err: any) {
      const msg = err?.message || 'Lỗi không xác định';
      let displayMsg = msg;
      if (msg.includes('Failed to fetch') || msg.includes('Network request failed') || msg.includes('NetworkError') || !navigator.onLine) {
        displayMsg = '❌ Không thể kết nối server. Kiểm tra mạng hoặc server có đang chạy không.';
      }
      setError(displayMsg);
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (price: number, currency: string) => {
    if (!price) return 'Liên hệ';
    return `${price.toLocaleString('vi-VN')} ${currency}`;
  };

  const methodLabel: Record<string, { label: string; color: string }> = {
    'json-ld': { label: 'JSON-LD', color: 'bg-green-100 text-green-700' },
    'html-selectors': { label: 'HTML', color: 'bg-blue-100 text-blue-700' },
    'gemini-ai': { label: 'Gemini AI', color: 'bg-purple-100 text-purple-700' },
    mixed: { label: 'Mixed', color: 'bg-amber-100 text-amber-700' },
  };

  return (
    <>
      {/* Compact card trigger - Stitch style */}
      <div className="mb-5 rounded-xl bg-white border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-semibold text-sm text-gray-800 flex items-center gap-2">
                AI Import từ Website
              </h3>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider bg-blue-100 text-blue-600">
                BETA
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Paste URL sản phẩm → AI tự động trích xuất tên, giá, ảnh
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium text-xs hover:bg-blue-700 transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Mở công cụ
          </button>
        </div>
      </div>

      {/* Full-screen modal - Stitch style */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl my-8 overflow-hidden flex flex-col max-h-[90vh] border border-blue-200">
            {/* Header - Light blue */}
            <div className="px-6 py-5 border-b border-blue-100 bg-blue-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">AI Import từ Website</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Paste URL sản phẩm bất kỳ → AI tự động trích xuất
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setOpen(false); reset(); }}
                  className="w-10 h-10 rounded-lg hover:bg-blue-100 flex items-center justify-center text-gray-500 transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Step 1: Input URL */}
              <div className="p-4 bg-white rounded-lg border border-blue-200 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-blue-600 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>link</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-gray-800">Nhập URL sản phẩm</h3>
                    <span className="text-xs text-gray-400">Bước 1/2: Quét trang web</span>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-2">
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">link</span>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://shopabc.com/products/iphone-15"
                      disabled={loading || saving}
                      className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-colors"
                    />
                  </div>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={loading || saving}
                    className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:border-blue-400 min-w-[150px]"
                  >
                    <option value="">-- Danh mục --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name_vi}</option>
                    ))}
                  </select>
                  <button
                    onClick={handlePreview}
                    disabled={loading || saving || !url.trim()}
                    className="px-5 h-10 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Đang quét...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Quét URL
                      </>
                    )}
                  </button>
                </div>
                {/* Progress message khi đang loading */}
                {loading && progressMessage && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 mt-3">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="text-sm text-blue-700">{progressMessage}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-xs text-gray-500">Ví dụ nhanh:</span>
                  {[
                    { label: '📱 Điện thoại', url: 'https://cellphones.com.vn/mobile.html' },
                    { label: '💻 Laptop', url: 'https://www.thegioididong.com/laptop' },
                  ].map((ex) => (
                    <button
                      key={ex.url}
                      type="button"
                      onClick={() => setUrl(ex.url)}
                      className="text-xs px-3 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors font-medium"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-700">Lỗi</p>
                    <p className="text-sm text-red-600 mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {/* Step 2: Preview */}
              {preview && (
                <>
                  <div className="bg-white rounded-lg border border-blue-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-blue-600 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm text-white">
                          Đã trích xuất thành công {preview.totalFound} sản phẩm
                        </h3>
                      </div>
                      <span className={clsx(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        methodLabel[preview.method]?.color || 'bg-white/20 text-white'
                      )}>
                        {methodLabel[preview.method]?.label || preview.method}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs bg-white/20 text-white">
                        ⏱️ {(preview.durationMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatBox label="Có giá" value={`${preview.stats.withPrice}/${preview.totalFound}`} color="blue" />
                        <StatBox label="Có ảnh" value={`${preview.stats.withImage}/${preview.totalFound}`} color="indigo" />
                        <StatBox label="Còn hàng" value={`${preview.stats.inStock}/${preview.totalFound}`} color="green" />
                        <StatBox label="Có thương hiệu" value={`${preview.stats.withBrand}/${preview.totalFound}`} color="gray" />
                      </div>
                    </div>
                  </div>

                  {/* Product list */}
                  <div className="bg-white rounded-lg border border-blue-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-blue-100 bg-gray-50">
                      <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600 text-base">inventory_2</span>
                        Preview ({Math.min(preview.products.length, 20)}/{preview.totalFound})
                      </h3>
                    </div>
                    <div className="space-y-2 p-3 max-h-80 overflow-y-auto">
                      {preview.products.slice(0, 20).map((p, idx) => (
                        <div key={idx} className="flex gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all">
                          {p.imageUrl ? (
                            <img
                              src={getImageUrl(p.imageUrl)}
                              alt={p.name}
                              className="w-12 h-12 object-cover rounded-lg flex-shrink-0 bg-gray-100 border border-gray-200"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-200">
                              <span className="material-symbols-outlined text-gray-400 text-base">image_not_supported</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm text-gray-800 line-clamp-1">{p.name}</h4>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={clsx(
                                'text-xs px-2 py-0.5 rounded font-medium',
                                p.price > 0 ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-gray-100 text-gray-500'
                              )}>
                                {formatPrice(p.price, p.currency)}
                              </span>
                              {p.brand && (
                                <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium border border-indigo-100">
                                  {p.brand}
                                </span>
                              )}
                              {p.inStock ? (
                                <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700 font-medium border border-green-100">
                                  ✓ Còn hàng
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-700 font-medium border border-red-100">
                                  ✗ Hết hàng
                                </span>
                              )}
                              {/* MADA Category Badge */}
                              {p.madaCategory && MADA_CATEGORY_LABELS[p.madaCategory] && (
                                <span className={clsx(
                                  'text-xs px-2 py-0.5 rounded font-medium border',
                                  MADA_CATEGORY_LABELS[p.madaCategory].bg,
                                  MADA_CATEGORY_LABELS[p.madaCategory].color
                                )}>
                                  {MADA_CATEGORY_LABELS[p.madaCategory].label}
                                </span>
                              )}
                            </div>
                          </div>
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
                            title="Mở sản phẩm"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-blue-100 p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3 text-sm">
                <span className="text-gray-600 font-medium">
                  {preview
                    ? `Sẵn sàng lưu ${preview.totalFound} sản phẩm`
                    : 'Nhập URL để bắt đầu quét'}
                </span>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={onlyValid}
                    onChange={(e) => setOnlyValid(e.target.checked)}
                    disabled={saving}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Chỉ lưu SP có giá</span>
                </label>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => { setOpen(false); reset(); }}
                  className="px-4 py-2 rounded-lg border border-gray-200 font-medium text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  disabled={!preview || saving || loading}
                  className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Lưu vào kho tri thức
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    gray: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
  };
  const colors = colorMap[color] || colorMap.blue;

  return (
    <div className={clsx('rounded-lg p-3 border bg-white', colors.bg, colors.border)}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={clsx('font-semibold text-base mt-0.5', colors.text)}>{value}</p>
    </div>
  );

}

export default AIImportCard;
