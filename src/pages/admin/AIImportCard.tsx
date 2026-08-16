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
        const method = json.data?.method || '';
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
      setError(err.message || 'Lỗi không xác định');
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
      setError(err.message || 'Lỗi không xác định');
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
      {/* Compact card trigger */}
      <div className="mb-5 relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[1px] shadow-lg shadow-purple-500/25">
        <div className="bg-white rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-on-surface flex items-center gap-2">
              AI Import từ Website
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                BETA
              </span>
            </h3>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Paste URL sản phẩm → AI tự động trích xuất tên, giá, ảnh
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-label-md shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Mở công cụ
          </button>
        </div>
      </div>

      {/* Full-screen modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-6">
              <div className="absolute inset-0 opacity-20" style={{
                background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5) 0%, transparent 50%)',
              }}></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">AI Import từ Website</h2>
                    <p className="text-sm text-white/80 mt-0.5">
                      Paste URL sản phẩm bất kỳ → AI tự động trích xuất
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setOpen(false); reset(); }}
                  className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-all"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Step 1: Input URL */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-on-surface">
                  🔗 URL trang sản phẩm
                </label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">link</span>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://shopabc.com/products/iphone-15"
                      disabled={loading || saving}
                      className="w-full h-12 pl-11 pr-4 rounded-xl border border-outline bg-surface-container-low font-label-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all"
                    />
                  </div>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={loading || saving}
                    className="h-12 px-4 rounded-xl border border-outline bg-surface-container-low font-label-md text-on-surface focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all min-w-[180px]"
                  >
                    <option value="">-- Danh mục --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name_vi}</option>
                    ))}
                  </select>
                  <button
                    onClick={handlePreview}
                    disabled={loading || saving || !url.trim()}
                    className="px-6 h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
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
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-50 border border-indigo-200">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    <span className="text-sm text-indigo-900 font-medium">{progressMessage}</span>
                  </div>
                )}
                <p className="text-xs text-on-surface-variant">
                  💡 Paste URL <b>trang sản phẩm</b> hoặc <b>trang danh mục</b>. Không phải trang chủ shop (homepage không có cấu trúc sản phẩm).
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs text-on-surface-variant">Ví dụ nhanh:</span>
                  {[
                    { label: '📱 Điện thoại (Cellphones)', url: 'https://cellphones.com.vn/mobile.html' },
                    { label: '💻 Laptop (TGDD)', url: 'https://www.thegioididong.com/laptop' },
                    { label: '📚 Wiki AT', url: 'https://en.wikipedia.org/wiki/Assistive_technology' },
                  ].map((ex) => (
                    <button
                      key={ex.url}
                      type="button"
                      onClick={() => setUrl(ex.url)}
                      className="text-xs px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-3 p-4 bg-error/10 border border-error/30 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-error">Lỗi</p>
                    <p className="text-sm text-error/80 mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {/* Step 2: Preview */}
              {preview && (
                <>
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <h3 className="font-bold text-emerald-900">
                        Đã trích xuất thành công {preview.totalFound} sản phẩm
                      </h3>
                      <span className={clsx(
                        'px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider',
                        methodLabel[preview.method]?.color || 'bg-slate-100 text-slate-700'
                      )}>
                        {methodLabel[preview.method]?.label || preview.method}
                      </span>
                      <span className="text-xs text-emerald-700 ml-auto">
                        ⏱️ {(preview.durationMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                      <StatBox label="Có giá" value={`${preview.stats.withPrice}/${preview.totalFound}`} />
                      <StatBox label="Có ảnh" value={`${preview.stats.withImage}/${preview.totalFound}`} />
                      <StatBox label="Còn hàng" value={`${preview.stats.inStock}/${preview.totalFound}`} />
                      <StatBox label="Có thương hiệu" value={`${preview.stats.withBrand}/${preview.totalFound}`} />
                    </div>
                  </div>

                  {/* Product list */}
                  <div>
                    <h3 className="font-bold text-on-surface mb-3 flex items-center gap-2">
                      <span className="material-symbols-outlined">inventory_2</span>
                      Preview ({Math.min(preview.products.length, 20)}/{preview.totalFound})
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                      {preview.products.slice(0, 20).map((p, idx) => (
                        <div key={idx} className="flex gap-3 p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 hover:border-purple-500/40 transition-all">
                          {p.imageUrl ? (
                            <img
                              src={getImageUrl(p.imageUrl)}
                              alt={p.name}
                              className="w-16 h-16 object-cover rounded-lg flex-shrink-0 bg-white"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                              <span className="material-symbols-outlined text-slate-400">image_not_supported</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm text-on-surface line-clamp-1">{p.name}</h4>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={clsx(
                                'text-xs px-2 py-0.5 rounded-md font-bold',
                                p.price > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                              )}>
                                {formatPrice(p.price, p.currency)}
                              </span>
                              {p.brand && (
                                <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">
                                  {p.brand}
                                </span>
                              )}
                              {p.inStock ? (
                                <span className="text-xs px-2 py-0.5 rounded-md bg-green-100 text-green-700">
                                  ✓ Còn hàng
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-md bg-red-100 text-red-700">
                                  ✗ Hết hàng
                                </span>
                              )}
                            </div>
                            {p.description && (
                              <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{p.description}</p>
                            )}
                          </div>
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-purple-500 hover:text-white transition-all flex-shrink-0"
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
            <div className="border-t border-outline-variant p-5 bg-surface-container-low/50">
              <div className="flex items-center justify-between mb-3 text-sm">
                <span className="text-on-surface-variant">
                  {preview
                    ? `Sẵn sàng lưu ${preview.totalFound} sản phẩm`
                    : 'Nhập URL để bắt đầu quét'}
                </span>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={onlyValid}
                    onChange={(e) => setOnlyValid(e.target.checked)}
                    disabled={saving}
                    className="w-4 h-4 rounded border-outline text-purple-600 focus:ring-purple-500"
                  />
                  <span>Chỉ lưu SP có giá</span>
                </label>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => { setOpen(false); reset(); }}
                  className="px-5 py-2.5 rounded-xl border border-outline font-label-md text-on-surface hover:bg-surface-container-high transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  disabled={!preview || saving || loading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-label-md shadow-lg shadow-emerald-500/25 flex items-center gap-2 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg p-3 border border-emerald-200">
      <p className="text-xs text-on-surface-variant">{label}</p>
      <p className="font-bold text-emerald-900 mt-0.5">{value}</p>
    </div>
  );
}