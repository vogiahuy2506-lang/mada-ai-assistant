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
      {/* Compact card trigger - Industrial style matching AdminProducts */}
      <div className="mb-5 relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[3px] shadow-lg shadow-purple-500/25">
        <div className="bg-white rounded-2xl p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 border-[3px] border-black">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-black text-lg text-black flex items-center gap-2">
                AI Import từ Website
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-2 border-black">
                BETA
              </span>
            </div>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Paste URL sản phẩm → AI tự động trích xuất tên, giá, ảnh
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all flex items-center gap-2 border-[3px] border-black"
          >
            <Sparkles className="w-5 h-5" />
            Mở công cụ
          </button>
        </div>
      </div>

      {/* Full-screen modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8 overflow-hidden flex flex-col max-h-[90vh] border-[4px] border-black shadow-[8px_8px_0px_0px_#000]">
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-6 border-b-[4px] border-black">
              <div className="absolute inset-0 opacity-20" style={{
                background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5) 0%, transparent 50%)',
              }}></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border-[3px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)]">
                    <Sparkles className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">AI Import từ Website</h2>
                    <p className="text-sm text-white/80 mt-0.5">
                      Paste URL sản phẩm bất kỳ → AI tự động trích xuất
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setOpen(false); reset(); }}
                  className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-all border-[3px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Step 1: Input URL */}
              <div className="p-5 bg-white rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_#000]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 border-[2px] border-black flex items-center justify-center">
                    <span className="material-symbols-outlined text-indigo-600 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>link</span>
                  </div>
                  <div>
                    <h3 className="font-black text-base text-black">Nhập URL sản phẩm</h3>
                    <span className="text-xs text-slate-500">Bước 1/2: Quét trang web</span>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">link</span>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://shopabc.com/products/iphone-15"
                      disabled={loading || saving}
                      className="w-full h-12 pl-11 pr-4 rounded-xl border-2 border-black bg-white font-bold text-sm text-black placeholder:text-slate-400 focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all"
                    />
                  </div>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={loading || saving}
                    className="h-12 px-4 rounded-xl border-2 border-black bg-white font-bold text-sm text-black focus:outline-none focus:shadow-[3px_3px_0px_0px_#000] focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all min-w-[180px]"
                  >
                    <option value="">-- Danh mục --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name_vi}</option>
                    ))}
                  </select>
                  <button
                    onClick={handlePreview}
                    disabled={loading || saving || !url.trim()}
                    className="px-6 h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 border-[2px] border-black"
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
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-indigo-50 border-2 border-indigo-300 mt-3">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    <span className="text-sm text-indigo-900 font-bold">{progressMessage}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-xs text-slate-600 font-medium">Ví dụ nhanh:</span>
                  {[
                    { label: '📱 Điện thoại (Cellphones)', url: 'https://cellphones.com.vn/mobile.html' },
                    { label: '💻 Laptop (TGDD)', url: 'https://www.thegioididong.com/laptop' },
                    { label: '📚 Wiki AT', url: 'https://en.wikipedia.org/wiki/Assistive_technology' },
                  ].map((ex) => (
                    <button
                      key={ex.url}
                      type="button"
                      onClick={() => setUrl(ex.url)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-white text-indigo-700 hover:bg-indigo-50 border-2 border-black font-bold transition-colors shadow-[2px_2px_0px_0px_#000]"
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
                  <div className="bg-white rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_#000] overflow-hidden">
                    <div className="px-5 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 border-b-[3px] border-black flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-white" />
                      <div className="flex-1">
                        <h3 className="font-black text-white">
                          Đã trích xuất thành công {preview.totalFound} sản phẩm
                        </h3>
                      </div>
                      <span className={clsx(
                        'px-3 py-1 rounded-lg text-xs font-black border-2 border-black',
                        methodLabel[preview.method]?.color || 'bg-slate-100 text-slate-700'
                      )}>
                        {methodLabel[preview.method]?.label || preview.method}
                      </span>
                      <span className="px-3 py-1 rounded-lg text-xs font-black bg-white text-emerald-800 border-2 border-black">
                        ⏱️ {(preview.durationMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div className="p-5">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatBox label="Có giá" value={`${preview.stats.withPrice}/${preview.totalFound}`} color="emerald" />
                        <StatBox label="Có ảnh" value={`${preview.stats.withImage}/${preview.totalFound}`} color="blue" />
                        <StatBox label="Còn hàng" value={`${preview.stats.inStock}/${preview.totalFound}`} color="green" />
                        <StatBox label="Có thương hiệu" value={`${preview.stats.withBrand}/${preview.totalFound}`} color="purple" />
                      </div>
                    </div>
                  </div>

                  {/* Product list */}
                  <div className="bg-white rounded-xl border-[3px] border-black shadow-[4px_4px_0px_0px_#000] overflow-hidden">
                    <div className="px-5 py-4 border-b-[2px] border-black bg-slate-50">
                      <h3 className="font-black text-base text-black flex items-center gap-2">
                        <span className="material-symbols-outlined">inventory_2</span>
                        Preview ({Math.min(preview.products.length, 20)}/{preview.totalFound})
                      </h3>
                    </div>
                    <div className="space-y-2 p-4 max-h-80 overflow-y-auto">
                      {preview.products.slice(0, 20).map((p, idx) => (
                        <div key={idx} className="flex gap-3 p-3 bg-white rounded-xl border-2 border-black hover:border-indigo-500 hover:shadow-[3px_3px_0px_0px_#000] transition-all">
                          {p.imageUrl ? (
                            <img
                              src={getImageUrl(p.imageUrl)}
                              alt={p.name}
                              className="w-14 h-14 object-cover rounded-lg flex-shrink-0 bg-white border-2 border-black"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0 border-2 border-black">
                              <span className="material-symbols-outlined text-slate-400">image_not_supported</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm text-black line-clamp-1">{p.name}</h4>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={clsx(
                                'text-xs px-2 py-0.5 rounded-md font-black border-2 border-black',
                                p.price > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                              )}>
                                {formatPrice(p.price, p.currency)}
                              </span>
                              {p.brand && (
                                <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-bold border-2 border-black">
                                  {p.brand}
                                </span>
                              )}
                              {p.inStock ? (
                                <span className="text-xs px-2 py-0.5 rounded-md bg-green-100 text-green-700 font-bold border-2 border-black">
                                  ✓ Còn hàng
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-md bg-red-100 text-red-700 font-bold border-2 border-black">
                                  ✗ Hết hàng
                                </span>
                              )}
                            </div>
                          </div>
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center text-slate-600 hover:bg-indigo-500 hover:text-white transition-all shadow-[2px_2px_0px_0px_#000]"
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
            <div className="border-t-[3px] border-black p-5 bg-slate-50">
              <div className="flex items-center justify-between mb-3 text-sm">
                <span className="text-slate-700 font-bold">
                  {preview
                    ? `Sẵn sàng lưu ${preview.totalFound} sản phẩm`
                    : 'Nhập URL để bắt đầu quét'}
                </span>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={onlyValid}
                    onChange={(e) => setOnlyValid(e.target.checked)}
                    disabled={saving}
                    className="w-5 h-5 rounded border-2 border-black text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Chỉ lưu SP có giá</span>
                </label>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => { setOpen(false); reset(); }}
                  className="px-6 py-3 rounded-xl border-[3px] border-black font-black text-black bg-white shadow-[3px_3px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  disabled={!preview || saving || loading}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 border-[3px] border-black"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
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
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    green: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  };
  const colors = colorMap[color] || colorMap.blue;

  return (
    <div className={clsx('rounded-xl p-3 border-[2px] border-black bg-white shadow-[2px_2px_0px_0px_#000]', colors.bg)}>
      <p className="text-xs text-slate-600 font-bold">{label}</p>
      <p className={clsx('font-black text-lg mt-0.5', colors.text)}>{value}</p>
    </div>
  );
}