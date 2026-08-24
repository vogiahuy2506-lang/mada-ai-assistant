import { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi } from './adminApi';
import { useLanguageStore } from '@/stores';
import {
  Play, RefreshCw, Database, CheckCircle, AlertCircle,
  Loader2, Trash2, Plus, ToggleLeft, ToggleRight, ExternalLink,
  CloudDownload,
} from 'lucide-react';
import clsx from 'clsx';

// ============== TYPES ==============
interface MadaCategory {
  slug: string;
  name: string;
  nameVi: string;
  botId: string;
  url: string;
  isoCodes: string[];
}

interface CrawlJob {
  id: string;
  category: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
}

interface FileStat {
  exists: boolean;
  size: number;
  modified: string | null;
}

interface Source {
  id: string;
  name: string;
  url: string;
  type: string;
  frequency: string;
  status: string;
  last_run: string | null;
  last_success: string | null;
}

// ============== I18N STRINGS ==============
const I18N = {
  // --- AdminLayout title/subtitle ---
  layout: {
    title: { en: 'Scraper & KB Manager', vi: 'Quản lý Scraper & KB' },
    subtitle: {
      en: 'Crawl real data from MADA Qatar, ingest into Knowledge Base, manage scheduled cron jobs.',
      vi: 'Thu thập dữ liệu thật từ MADA Qatar, đẩy vào Knowledge Base, quản lý các cron job tự động.',
    },
  },

  // --- Hero section ---
  hero: {
    title: { en: 'Scraper & Knowledge Base', vi: 'Scraper & Knowledge Base' },
    desc: {
      en: 'Crawl real data from MADA Qatar → embed into RAG → power AI agents with accurate AT product knowledge.',
      vi: 'Thu thập dữ liệu thật từ MADA Qatar → nhúng vào RAG → cung cấp cho AI agents kiến thức sản phẩm AT chính xác.',
    },
  },

  // --- Stats ---
  stats: {
    products: {
      label: { en: 'PRODUCTS', vi: 'SẢN PHẨM' },
      sub: { en: 'in KB', vi: 'trong KB' },
    },
    chunks: {
      label: { en: 'RAG CHUNKS', vi: 'RAG CHUNKS' },
      sub: { en: 'ready to ingest', vi: 'sẵn sàng ingest' },
    },
    categories: {
      label: { en: 'MADA CATEGORIES', vi: 'DANH MỤC MADA' },
      sub: { en: '7 specialized bots', vi: '7 bot chuyên biệt' },
    },
    cron: {
      label: { en: 'CRON JOBS', vi: 'CRON JOBS' },
      sub: { en: (n: number) => `${n} total`,
             vi: (n: number) => `${n} tổng cộng` },
    },
    running: {
      label: { en: 'RUNNING', vi: 'ĐANG CHẠY' },
      sub: { en: (n: number, t: number) => `${n} of ${t} jobs`,
             vi: (n: number, t: number) => `${n} trong ${t} jobs` },
    },
  },

  // --- Action bar ---
  actions: {
    quickActions: { en: 'Quick Actions:', vi: 'Hành động nhanh:' },
    crawlAll: {
      en: 'Crawl all 7 MADA categories',
      vi: 'Thu thập tất cả 7 danh mục MADA',
    },
    ingest: {
      en: (n: number) => `Ingest ${n} chunks → KB`,
      vi: (n: number) => `Ingest ${n} chunks → KB`,
    },
    refresh: { en: 'Refresh', vi: 'Làm mới' },
  },

  // --- MADA Categories card ---
  categoriesCard: {
    heading: { en: '7 MADA Qatar Categories', vi: '7 Danh mục MADA Qatar' },
    desc: {
      en: 'Click to crawl each category. Real URLs from at.mada.org.qa, ISO 9999 codes mapping.',
      vi: 'Click để thu thập từng danh mục. URL thật từ at.mada.org.qa, ánh xạ ISO 9999 codes.',
    },
    madaPortal: { en: 'MADA Portal', vi: 'Cổng MADA' },
    crawl: { en: 'Crawl', vi: 'Thu thập' },
  },

  // --- Crawl Jobs History ---
  jobs: {
    heading: { en: 'Crawl Jobs History', vi: 'Lịch sử Thu thập' },
    desc: {
      en: 'Track all crawl jobs (last 50). Auto-refresh when jobs are running.',
      vi: 'Theo dõi tất cả crawl jobs (50 gần nhất). Tự động làm mới khi có job đang chạy.',
    },
    empty: {
      en: 'No crawl jobs yet. Click "Crawl all 7 MADA categories" above.',
      vi: 'Chưa có crawl job nào. Click "Thu thập tất cả 7 danh mục MADA" phía trên.',
    },
    started: { en: 'Started', vi: 'Bắt đầu' },
    finished: { en: 'Finished', vi: 'Kết thúc' },
  },

  // --- KB Files ---
  kbFiles: {
    heading: { en: 'KB Files', vi: 'Tệp KB' },
    missing: { en: 'missing', vi: 'không tồn tại' },
  },

  // --- Ingest Pipeline ---
  pipeline: {
    heading: { en: 'Ingest Pipeline', vi: 'Đường ống Ingest' },
    steps: {
      step1: { en: 'Crawl from at.mada.org.qa', vi: 'Thu thập từ at.mada.org.qa' },
      step2: {
        en: (p: number, c: number) => `Generate ${p} products + ${c} RAG chunks`,
        vi: (p: number, c: number) => `Tạo ${p} sản phẩm + ${c} RAG chunks`,
      },
      step3: { en: 'Push into vector store (ChromaDB)', vi: 'Đẩy vào vector store (ChromaDB)' },
      step4: { en: 'AI agents serve users via KB', vi: 'AI agents phục vụ user qua KB' },
    },
    warning: {
      en: 'Need to run Crawl at least once before Ingest.',
      vi: 'Cần chạy Crawl ít nhất 1 lần trước khi Ingest.',
    },
  },

  // --- Scheduled Sources ---
  sources: {
    heading: { en: 'Scheduled Sources (Cron)', vi: 'Nguồn theo lịch (Cron)' },
    desc: {
      en: 'Auto-scraping sources on schedule. Toggle on/off to enable/disable.',
      vi: 'Các nguồn scraping tự động theo lịch. Bật/tắt để kích hoạt/vô hiệu hóa.',
    },
    add: { en: 'Add Source', vi: 'Thêm nguồn' },
    placeholderId: { en: 'ID (e.g. mada-hearing)', vi: 'ID (vd: mada-hearing)' },
    placeholderName: { en: 'Source name', vi: 'Tên nguồn' },
    frequency: {
      hourly: { en: 'Hourly', vi: 'Theo giờ' },
      daily: { en: 'Daily', vi: 'Theo ngày' },
      weekly: { en: 'Weekly', vi: 'Theo tuần' },
      monthly: { en: 'Monthly', vi: 'Theo tháng' },
    },
    save: { en: 'Save', vi: 'Lưu' },
    cancel: { en: 'Cancel', vi: 'Hủy' },
    empty: {
      en: 'No scheduled sources yet. Default sources are pre-configured in scheduler, you can also add custom ones.',
      vi: 'Chưa có scheduled source nào. Default sources đã có sẵn trong scheduler, có thể thêm custom.',
    },
    enable: { en: 'Enable', vi: 'Bật' },
    disable: { en: 'Disable', vi: 'Tắt' },
    delete: { en: 'Delete', vi: 'Xóa' },
  },

  // --- Status badges ---
  status: {
    queued: { en: 'Queued', vi: 'Đang chờ' },
    running: { en: 'Running', vi: 'Đang chạy' },
    completed: { en: 'Completed', vi: 'Hoàn thành' },
    failed: { en: 'Failed', vi: 'Thất bại' },
    active: { en: 'Active', vi: 'Hoạt động' },
    off: { en: 'Off', vi: 'Tắt' },
  },

  // --- Messages ---
  msg: {
    loadError: { en: 'Load error', vi: 'Lỗi tải dữ liệu' },
    crawlStarted: { en: 'Crawl started', vi: 'Đã khởi động crawl' },
    crawlError: { en: 'Crawl error', vi: 'Lỗi crawl' },
    ingestComplete: { en: 'Ingest complete', vi: 'Ingest hoàn tất' },
    ingestChunksAdded: {
      en: (n: number) => `chunks added`,
      vi: (n: number) => `chunks đã thêm`,
    },
    ingestErrors: { en: 'Errors', vi: 'Lỗi' },
    ingestError: { en: 'Ingest error', vi: 'Lỗi ingest' },
    willIngest: { en: (n: number) => `Will ingest ${n} chunks into KB. Continue?`,
                  vi: (n: number) => `Sẽ ingest ${n} chunks vào KB. Tiếp tục?` },
    sourceAdded: { en: 'Source added', vi: 'Đã thêm source' },
    sourceDeleted: { en: 'Source deleted', vi: 'Đã xóa source' },
    confirmDeleteSource: { en: (id: string) => `Delete source "${id}"?`,
                           vi: (id: string) => `Xóa source "${id}"?` },
    sourceEnabled: { en: 'Enabled', vi: 'Đã bật' },
    sourceDisabled: { en: 'Disabled', vi: 'Đã tắt' },
    requiredFields: { en: 'id, name, url are required', vi: 'id, name, url là bắt buộc' },
  },
};

type Lang = 'en' | 'vi';

function i18n<T>(val: { en: T; vi: T }, lang: Lang): T {
  return val[lang];
}

function i18nFn<T>(val: (n: number) => T, n: number, lang: Lang): T;
function i18nFn2<T>(val: (n: number, t: number) => T, n: number, t: number, lang: Lang): T {
  return val(n, t);
}
function i18nDyn<T>(val: { en: (n: number) => T; vi: (n: number) => T }, n: number, lang: Lang): T {
  return val[lang](n);
}
function i18nDyn2<T>(
  val: { en: (n: number, t: number) => T; vi: (n: number, t: number) => T },
  n: number, t: number, lang: Lang
): T {
  return val[lang](n, t);
}

// ============== COMPONENT ==============
export function AdminScraper() {
  const language = useLanguageStore((s) => s.language);
  const isVi = language === 'vi';
  const isEn = !isVi;

  const [categories, setCategories] = useState<MadaCategory[]>([]);
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [fileStats, setFileStats] = useState<{ files: Record<string, FileStat>; chunkCount: number; productCount: number } | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSource, setNewSource] = useState({ id: '', name: '', url: '', type: 'mada', frequency: 'daily' });

  const showMsg = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [catsRes, jobsRes, statsRes, sourcesRes] = await Promise.all([
        adminApi.getMadaCategories(),
        adminApi.listCrawlJobs(),
        adminApi.getRagChunksStats(),
        adminApi.getSources(),
      ]);
      if (catsRes.success && catsRes.data) setCategories(Array.isArray(catsRes.data) ? catsRes.data : []);
      if (jobsRes.success && jobsRes.data) setJobs(jobsRes.data);
      if (statsRes.success && statsRes.data) setFileStats(statsRes.data);
      if (sourcesRes.success && sourcesRes.data) setSources(Array.isArray(sourcesRes.data) ? sourcesRes.data : []);
    } catch (e: any) {
      showMsg('error', `${i18n(I18N.msg.loadError, language)}: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const hasRunning = jobs.some(j => j.status === 'running' || j.status === 'queued');
    if (!hasRunning) return;
    const timer = setInterval(loadAll, 5000);
    return () => clearInterval(timer);
  }, [jobs, loadAll]);

  const handleCrawl = async (category: string) => {
    setBusy(category);
    try {
      const res = await adminApi.startCrawlMada(category);
      if (res.success) {
        showMsg('success', `${i18n(I18N.msg.crawlStarted, language)}: ${category}. Job ID: ${res.data?.jobId}`);
        await loadAll();
      } else {
        showMsg('error', `${i18n(I18N.msg.crawlError, language)}: ${res.error || 'unknown'}`);
      }
    } catch (e: any) {
      showMsg('error', `${i18n(I18N.msg.crawlError, language)}: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const handleIngest = async () => {
    setBusy('ingest');
    try {
      const dry = await adminApi.ingestRagChunks({ dryRun: true });
      if (dry.success && dry.data) {
        const confirmed = confirm(
          i18nDyn2(I18N.msg.willIngest, dry.data.wouldIngest, dry.data.wouldIngest, language)
        );
        if (!confirmed) {
          setBusy(null);
          return;
        }
      }

      const res = await adminApi.ingestRagChunks({});
      if (res.success && res.data) {
        showMsg('success', `${i18n(I18N.msg.ingestComplete, language)}: ${i18nDyn(I18N.msg.ingestChunksAdded, res.data.added, language)}. ${i18n(I18N.msg.ingestErrors, language)}: ${res.data.errors?.length || 0}`);
        await loadAll();
      } else {
        showMsg('error', `${i18n(I18N.msg.ingestError, language)}: ${res.error || 'unknown'}`);
      }
    } catch (e: any) {
      showMsg('error', `${i18n(I18N.msg.crawlError, language)}: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const handleAddSource = async () => {
    if (!newSource.id || !newSource.name || !newSource.url) {
      showMsg('error', i18n(I18N.msg.requiredFields, language));
      return;
    }
    setBusy('add-source');
    try {
      const res = await adminApi.addSource(newSource);
      if (res.success) {
        showMsg('success', `${i18n(I18N.msg.sourceAdded, language)}: ${newSource.id}`);
        setShowAddSource(false);
        setNewSource({ id: '', name: '', url: '', type: 'mada', frequency: 'daily' });
        await loadAll();
      } else {
        showMsg('error', res.error || 'Error');
      }
    } catch (e: any) {
      showMsg('error', `${i18n(I18N.msg.crawlError, language)}: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm(i18nDyn(I18N.msg.confirmDeleteSource, id, language === 'en' ? 'en' : 'vi', language).replace('{id}', id))) return;
    // Fix: pass correct language param
    const confirmText = isEn
      ? `Delete source "${id}"?`
      : `Xóa source "${id}"?`;
    if (!confirm(confirmText)) return;
    setBusy(`del-${id}`);
    try {
      const res = await adminApi.deleteSource(id);
      if (res.success) {
        showMsg('success', `${i18n(I18N.msg.sourceDeleted, language)}: ${id}`);
        await loadAll();
      } else {
        showMsg('error', res.error || 'Error');
      }
    } finally {
      setBusy(null);
    }
  };

  const handleToggleSource = async (id: string, enabled: boolean) => {
    setBusy(`toggle-${id}`);
    try {
      const res = await adminApi.toggleSource(id, enabled);
      if (res.success) {
        showMsg('success', `${enabled ? i18n(I18N.msg.sourceEnabled, language) : i18n(I18N.msg.sourceDisabled, language)}: ${id}`);
        await loadAll();
      }
    } finally {
      setBusy(null);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const formatDate = (iso: string | null): string => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString(isVi ? 'vi-VN' : 'en-US');
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, Record<Lang, { label: string; cls: string; icon: string }>> = {
      queued: {
        en: { label: 'Queued', cls: 'bg-slate-100 text-slate-700 border-slate-300', icon: 'schedule' },
        vi: { label: 'Đang chờ', cls: 'bg-slate-100 text-slate-700 border-slate-300', icon: 'schedule' },
      },
      running: {
        en: { label: 'Running', cls: 'bg-blue-100 text-blue-700 border-blue-300', icon: 'autorenew' },
        vi: { label: 'Đang chạy', cls: 'bg-blue-100 text-blue-700 border-blue-300', icon: 'autorenew' },
      },
      completed: {
        en: { label: 'Completed', cls: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: 'check_circle' },
        vi: { label: 'Hoàn thành', cls: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: 'check_circle' },
      },
      failed: {
        en: { label: 'Failed', cls: 'bg-red-100 text-red-700 border-red-300', icon: 'error' },
        vi: { label: 'Thất bại', cls: 'bg-red-100 text-red-700 border-red-300', icon: 'error' },
      },
      active: {
        en: { label: 'Active', cls: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: 'check_circle' },
        vi: { label: 'Hoạt động', cls: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: 'check_circle' },
      },
      inactive: {
        en: { label: 'Off', cls: 'bg-slate-100 text-slate-500 border-slate-300', icon: 'block' },
        vi: { label: 'Tắt', cls: 'bg-slate-100 text-slate-500 border-slate-300', icon: 'block' },
      },
    };
    const lang: Lang = isEn ? 'en' : 'vi';
    const s = statusMap[status]?.[lang] || { label: status, cls: 'bg-slate-100 text-slate-500 border-slate-300', icon: 'help' };
    return (
      <span className={clsx('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border-2', s.cls)}>
        <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
        {s.label}
      </span>
    );
  };

  const runningCount = jobs.filter(j => j.status === 'running').length;
  const activeCronCount = sources.filter(s => s.status === 'active').length;

  const stats = [
    {
      label: i18n(I18N.stats.products.label, language),
      value: fileStats?.productCount || 0,
      sub: i18n(I18N.stats.products.sub, language),
      color: 'from-primary/10 to-primary/5',
      iconColor: 'text-primary',
      icon: 'inventory_2',
      iconBg: 'bg-primary/20',
    },
    {
      label: i18n(I18N.stats.chunks.label, language),
      value: fileStats?.chunkCount || 0,
      sub: i18n(I18N.stats.chunks.sub, language),
      color: 'from-amber-50/80 to-amber-100/40',
      iconColor: 'text-amber-600',
      icon: 'layers',
      iconBg: 'bg-amber-200',
    },
    {
      label: i18n(I18N.stats.categories.label, language),
      value: categories.length,
      sub: i18n(I18N.stats.categories.sub, language),
      color: 'from-purple-50/80 to-purple-100/40',
      iconColor: 'text-purple-600',
      icon: 'category',
      iconBg: 'bg-purple-200',
    },
    {
      label: i18n(I18N.stats.cron.label, language),
      value: activeCronCount,
      sub: i18nDyn2(I18N.stats.cron.sub, activeCronCount, sources.length, language as Lang),
      color: 'from-green-50/80 to-green-100/40',
      iconColor: 'text-green-600',
      icon: 'schedule',
      iconBg: 'bg-green-200',
    },
    {
      label: i18n(I18N.stats.running.label, language),
      value: runningCount,
      sub: i18nDyn2(I18N.stats.running.sub, runningCount, jobs.length, language as Lang),
      color: 'from-blue-50/80 to-blue-100/40',
      iconColor: 'text-blue-600',
      icon: 'autorenew',
      iconBg: 'bg-blue-200',
      pulse: true,
    },
  ];

  const lang: Lang = isEn ? 'en' : 'vi';

  return (
    <AdminLayout
      title={I18N.layout.title[lang]}
      titleEn={I18N.layout.title.en}
      subtitle={I18N.layout.subtitle[lang]}
      subtitleEn={I18N.layout.subtitle.en}
      showLayoutTitle={false}
    >
      {/* Hero Banner */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-white to-amber-500/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-8 px-6">
            <h2 className="text-4xl font-black text-on-surface mb-4 tracking-tight">
              {i18n(I18N.hero.title, language)}
            </h2>
            <p className="text-lg font-medium text-on-surface-variant border-l-4 border-primary pl-6 py-2 bg-white/40 backdrop-blur-sm rounded-r-xl">
              {i18n(I18N.hero.desc, language)}
            </p>
          </div>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={clsx(
              'relative bg-gradient-to-br backdrop-blur-xl rounded-2xl p-4 border-[3px] border-black flex items-center gap-3 transition-shadow hover:shadow-[8px_8px_0px_0px_#000]',
              s.color,
              i % 2 === 0 ? 'transform rotate-[-0.3deg] hover:rotate-0' : 'transform rotate-[0.3deg] hover:rotate-0',
              'shadow-[6px_6px_0px_0px_#000]'
            )}
          >
            <div className={clsx('w-10 h-10 rounded-xl border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]', s.iconBg)}>
              <span className={clsx('material-symbols-outlined text-lg', s.iconColor)} style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{s.label}</p>
              <h3 className={clsx('text-xl font-black', s.pulse ? 'text-blue-700 animate-pulse' : 'text-on-surface')}>{s.value}</h3>
              <p className="text-[10px] text-on-surface-variant mt-0.5">{s.sub}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Action Bar */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-3 p-1.5 bg-white/60 backdrop-blur-xl rounded-full border-2 border-black">
          <span className="text-on-surface-variant font-medium text-sm ml-4 mr-2">{i18n(I18N.actions.quickActions, language)}</span>
          <button
            onClick={() => handleCrawl('all')}
            disabled={busy === 'all' || busy !== null}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm transition-all border-2 bg-primary text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:opacity-40"
          >
            {busy === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
            <span>{i18n(I18N.actions.crawlAll, language)}</span>
          </button>
          <button
            onClick={handleIngest}
            disabled={busy === 'ingest' || !fileStats?.chunkCount}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm transition-all border-2 bg-amber-500 text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:opacity-40"
          >
            {busy === 'ingest' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            <span>{i18nDyn(I18N.actions.ingest, fileStats?.chunkCount || 0, language)}</span>
          </button>
        </div>

        <button
          onClick={loadAll}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/60 backdrop-blur-xl border-2 border-black font-bold text-sm hover:bg-white hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#000] shadow-[2px_2px_0px_0px_#000] transition-all disabled:opacity-50"
        >
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          <span>{i18n(I18N.actions.refresh, language)}</span>
        </button>
      </div>

      {/* Message banner */}
      {message && (
        <div className={clsx(
          'mb-6 p-4 rounded-2xl border-[3px] border-black flex items-center gap-3 text-sm font-bold shadow-[3px_3px_0px_0px_#000]',
          message.type === 'success' && 'bg-emerald-100 text-emerald-800',
          message.type === 'error' && 'bg-red-100 text-red-800',
          message.type === 'info' && 'bg-blue-100 text-blue-800',
        )}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* MADA Categories Card */}
      <section className="bg-white/70 backdrop-blur-xl rounded-3xl border-[3px] border-black shadow-[6px_6px_0px_0px_#000] mb-8 overflow-hidden">
        <div className="px-6 py-4 border-b-2 border-black/10 bg-gradient-to-r from-primary/5 to-transparent flex items-center justify-between">
          <div>
            <h2 className="font-black text-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>category</span>
              {i18n(I18N.categoriesCard.heading, language)}
            </h2>
            <p className="text-xs text-on-surface-variant mt-1">
              {i18n(I18N.categoriesCard.desc, language)}
            </p>
          </div>
          <a
            href="https://at.mada.org.qa/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-black bg-white hover:bg-primary/5 font-bold text-xs shadow-[2px_2px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#000] transition-all"
          >
            {i18n(I18N.categoriesCard.madaPortal, language)} <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="divide-y divide-outline-variant/50">
          {categories.map((cat) => (
            <div key={cat.slug} className="px-6 py-4 flex items-center justify-between hover:bg-primary/5 transition-colors group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-black flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {cat.slug === 'vision' ? 'visibility' :
                       cat.slug === 'hearing' ? 'hearing' :
                       cat.slug === 'mobility' ? 'directions_walk' :
                       cat.slug === 'communication' ? 'forum' :
                       cat.slug === 'cognition' ? 'psychology' :
                       cat.slug === 'daily_living' ? 'home' :
                       'category'}
                    </span>
                  </div>
                  <span className="font-bold text-sm">{cat.nameVi}</span>
                  <span className="text-xs text-on-surface-variant">/ {cat.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono border-2 border-slate-300">{cat.botId}</span>
                </div>
                <div className="text-xs text-on-surface-variant mt-2 truncate ml-11">
                  <a href={cat.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline font-mono">
                    {cat.url}
                  </a>
                </div>
                {cat.isoCodes.length > 0 && (
                  <div className="text-xs text-on-surface-variant mt-1.5 ml-11 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>label</span>
                    ISO: {cat.isoCodes.map(c => <span key={c} className="font-mono px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded">{c}</span>)}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleCrawl(cat.slug)}
                disabled={busy === cat.slug || busy !== null}
                className="ml-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-white border-2 border-black font-bold text-xs shadow-[2px_2px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#000] disabled:opacity-40 transition-all"
              >
                {busy === cat.slug ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>{i18n(I18N.categoriesCard.crawl, language)}</span>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Crawl Jobs History */}
      <section className="bg-white/70 backdrop-blur-xl rounded-3xl border-[3px] border-black shadow-[6px_6px_0px_0px_#000] mb-8 overflow-hidden">
        <div className="px-6 py-4 border-b-2 border-black/10 bg-gradient-to-r from-blue-500/5 to-transparent">
          <h2 className="font-black text-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600" style={{ fontVariationSettings: "'FILL' 1" }}>history</span>
            {i18n(I18N.jobs.heading, language)}
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            {i18n(I18N.jobs.desc, language)}
          </p>
        </div>
        <div className="overflow-x-auto">
          {jobs.length === 0 ? (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-7xl text-on-surface-variant/30 inline-block" style={{ fontVariationSettings: "'FILL' 0" }}>history_toggle_off</span>
              <p className="text-sm text-on-surface-variant mt-3">
                {i18n(I18N.jobs.empty, language)}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-blue-500/5 text-left text-xs font-bold uppercase tracking-wider text-on-surface-variant border-b-2 border-black/10">
                <tr>
                  <th className="px-6 py-3">Job ID</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">{i18n(I18N.jobs.started, language)}</th>
                  <th className="px-6 py-3">{i18n(I18N.jobs.finished, language)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {jobs.slice(0, 20).map((job) => (
                  <tr key={job.id} className="hover:bg-blue-500/5 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs">
                      <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded">{job.id.slice(-8)}</span>
                    </td>
                    <td className="px-6 py-3 font-medium">{job.category}</td>
                    <td className="px-6 py-3">{getStatusBadge(job.status)}</td>
                    <td className="px-6 py-3 text-xs">{formatDate(job.startedAt)}</td>
                    <td className="px-6 py-3 text-xs">{formatDate(job.finishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* KB Files & Pipeline Row */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* KB Files */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl border-[3px] border-black shadow-[6px_6px_0px_0px_#000] p-6">
          <h3 className="font-black text-base mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
            {i18n(I18N.kbFiles.heading, language)}
          </h3>
          <div className="space-y-2">
            {fileStats && Object.entries(fileStats.files).map(([name, stat]) => (
              <div key={name} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50 border-2 border-slate-200">
                <span className="font-mono text-slate-700 font-bold">{name}</span>
                {stat.exists ? (
                  <span className="text-on-surface-variant">{formatSize(stat.size)} • {formatDate(stat.modified)}</span>
                ) : (
                  <span className="text-red-600 font-bold inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                    {i18n(I18N.kbFiles.missing, language)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Ingest Pipeline */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl border-[3px] border-black shadow-[6px_6px_0px_0px_#000] p-6">
          <h3 className="font-black text-base mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-600" style={{ fontVariationSettings: "'FILL' 1" }}>memory</span>
            {i18n(I18N.pipeline.heading, language)}
          </h3>
          <ol className="text-xs space-y-3 text-on-surface-variant">
            <li className="flex items-center gap-3 p-2.5 rounded-xl bg-purple-50 border-2 border-purple-200">
              <div className="w-8 h-8 rounded-full bg-purple-500 text-white border-2 border-black flex items-center justify-center font-black text-xs shadow-[2px_2px_0px_0px_#000]">1</div>
              <span className="material-symbols-outlined text-base text-purple-700" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_download</span>
              <span className="font-medium text-on-surface">{i18n(I18N.pipeline.steps.step1, language)}</span>
            </li>
            <li className="flex items-center gap-3 p-2.5 rounded-xl bg-purple-50 border-2 border-purple-200">
              <div className="w-8 h-8 rounded-full bg-purple-500 text-white border-2 border-black flex items-center justify-center font-black text-xs shadow-[2px_2px_0px_0px_#000]">2</div>
              <span className="material-symbols-outlined text-base text-purple-700" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              <span className="font-medium text-on-surface">
                {i18nDyn(I18N.pipeline.steps.step2, fileStats?.productCount || 0, language)}({fileStats?.chunkCount || 0})
              </span>
            </li>
            <li className="flex items-center gap-3 p-2.5 rounded-xl bg-purple-50 border-2 border-purple-200">
              <div className="w-8 h-8 rounded-full bg-purple-500 text-white border-2 border-black flex items-center justify-center font-black text-xs shadow-[2px_2px_0px_0px_#000]">3</div>
              <span className="material-symbols-outlined text-base text-purple-700" style={{ fontVariationSettings: "'FILL' 1" }}>storage</span>
              <span className="font-medium text-on-surface">{i18n(I18N.pipeline.steps.step3, language)}</span>
            </li>
            <li className="flex items-center gap-3 p-2.5 rounded-xl bg-purple-50 border-2 border-purple-200">
              <div className="w-8 h-8 rounded-full bg-purple-500 text-white border-2 border-black flex items-center justify-center font-black text-xs shadow-[2px_2px_0px_0px_#000]">4</div>
              <span className="material-symbols-outlined text-base text-purple-700" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              <span className="font-medium text-on-surface">{i18n(I18N.pipeline.steps.step4, language)}</span>
            </li>
          </ol>
          <div className="mt-4 pt-3 border-t-2 border-black/10 text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border-2 border-amber-300 inline-flex items-start gap-2 w-full">
            <span className="material-symbols-outlined text-base shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            <span>{i18n(I18N.pipeline.warning, language)}</span>
          </div>
        </div>
      </section>

      {/* Scheduled Sources */}
      <section className="bg-white/70 backdrop-blur-xl rounded-3xl border-[3px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden">
        <div className="px-6 py-4 border-b-2 border-black/10 bg-gradient-to-r from-green-500/5 to-transparent flex items-center justify-between">
          <div>
            <h2 className="font-black text-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-green-600" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
              {i18n(I18N.sources.heading, language)}
            </h2>
            <p className="text-xs text-on-surface-variant mt-1">
              {i18n(I18N.sources.desc, language)}
            </p>
          </div>
          <button
            onClick={() => setShowAddSource(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-white border-2 border-black font-bold text-xs shadow-[2px_2px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#000] transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{i18n(I18N.sources.add, language)}</span>
          </button>
        </div>

        {showAddSource && (
          <div className="p-6 bg-gradient-to-br from-blue-50/60 to-purple-50/60 border-b-2 border-black/10">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <input
                placeholder={i18n(I18N.sources.placeholderId, language)}
                value={newSource.id}
                onChange={(e) => setNewSource({ ...newSource, id: e.target.value })}
                className="px-3 py-2.5 rounded-full border-2 border-black bg-white text-sm font-medium"
              />
              <input
                placeholder={i18n(I18N.sources.placeholderName, language)}
                value={newSource.name}
                onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                className="px-3 py-2.5 rounded-full border-2 border-black bg-white text-sm font-medium"
              />
              <input
                placeholder="URL"
                value={newSource.url}
                onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                className="px-3 py-2.5 rounded-full border-2 border-black bg-white text-sm font-medium col-span-2 md:col-span-1"
              />
              <select
                value={newSource.frequency}
                onChange={(e) => setNewSource({ ...newSource, frequency: e.target.value })}
                className="px-3 py-2.5 rounded-full border-2 border-black bg-white text-sm font-bold"
              >
                <option value="hourly">{i18n(I18N.sources.frequency.hourly, language)}</option>
                <option value="daily">{i18n(I18N.sources.frequency.daily, language)}</option>
                <option value="weekly">{i18n(I18N.sources.frequency.weekly, language)}</option>
                <option value="monthly">{i18n(I18N.sources.frequency.monthly, language)}</option>
              </select>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleAddSource}
                disabled={busy === 'add-source'}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-primary text-white border-2 border-black font-bold text-sm shadow-[2px_2px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#000] disabled:opacity-40"
              >
                {busy === 'add-source' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {i18n(I18N.sources.save, language)}
              </button>
              <button
                onClick={() => setShowAddSource(false)}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-white border-2 border-black font-bold text-sm shadow-[2px_2px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#000]"
              >
                {i18n(I18N.sources.cancel, language)}
              </button>
            </div>
          </div>
        )}

        {sources.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-7xl text-on-surface-variant/30 inline-block" style={{ fontVariationSettings: "'FILL' 0" }}>schedule_send</span>
            <p className="text-sm text-on-surface-variant mt-3">
              {i18n(I18N.sources.empty, language)}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/50">
            {sources.map((src) => (
              <div key={src.id} className="px-6 py-4 flex items-center justify-between hover:bg-green-500/5 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-200 to-green-100 border-2 border-black flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-green-700 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
                    </div>
                    <span className="font-bold text-sm">{src.name}</span>
                    {getStatusBadge(src.status)}
                  </div>
                  <div className="text-xs text-on-surface-variant mt-1.5 ml-11">
                    <span className="font-mono font-bold">{src.id}</span> • <span className="px-1.5 py-0.5 bg-slate-100 rounded">{src.frequency}</span> • {formatDate(src.last_run)}
                  </div>
                  <div className="text-xs text-on-surface-variant truncate ml-11 mt-0.5">
                    <a href={src.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline font-mono">
                      {src.url}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleSource(src.id, src.status !== 'active')}
                    disabled={busy === `toggle-${src.id}`}
                    className="p-2.5 rounded-xl hover:bg-green-50 border-2 border-transparent hover:border-green-300 transition-all"
                    title={src.status === 'active' ? i18n(I18N.sources.disable, language) : i18n(I18N.sources.enable, language)}
                  >
                    {src.status === 'active' ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                  </button>
                  <button
                    onClick={() => handleDeleteSource(src.id)}
                    disabled={busy === `del-${src.id}`}
                    className="p-2.5 rounded-xl hover:bg-red-50 hover:text-red-600 border-2 border-transparent hover:border-red-300 transition-all"
                    title={i18n(I18N.sources.delete, language)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminLayout>
  );
}

export default AdminScraper;
