import { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from './AdminLayout';
import { adminApi } from './adminApi';
import { useLanguageStore } from '@/stores';
import { translations as _, t } from '@/lib/translations';
import type { Language } from '@/types';
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

// ============== COMPONENT ==============
export function AdminScraper() {
  const language = useLanguageStore((s) => s.language ?? 'vi') as Language;
  const isVi = language === 'vi';
  const isAr = language === 'ar';
  const isFr = language === 'fr';

  // Category name helper based on language
  const getCategoryName = (cat: MadaCategory): string => {
    if (isAr) {
      // Arabic translations for categories
      const arNames: Record<string, string> = {
        vision: 'الرؤية',
        hearing: 'السمع',
        mobility: 'الحركة',
        cognition: 'الإدراك',
        communication: 'التواصل',
        daily_living: 'الحياة اليومية',
      };
      return arNames[cat.slug] || cat.nameVi;
    }
    if (isFr) {
      const frNames: Record<string, string> = {
        vision: 'Vision',
        hearing: 'Audition',
        mobility: 'Mobilité',
        cognition: 'Cognition',
        communication: 'Communication',
        daily_living: 'Vie quotidienne',
      };
      return frNames[cat.slug] || cat.nameVi;
    }
    if (isVi || !isAr) {
      return cat.nameVi;
    }
    return cat.name;
  };

  const [categories, setCategories] = useState<MadaCategory[]>([]);
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [fileStats, setFileStats] = useState<{ files: Record<string, FileStat>; chunkCount: number; productCount: number } | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSource, setNewSource] = useState({ id: '', name: '', url: '', type: 'mada', frequency: 'daily' });

  // Translation helper function
  const tr = useCallback((key: string, params?: Record<string, string | number>): string => {
    let text = t(key as any, language);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return text;
  }, [language]);

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
      showMsg('error', `${tr('admin.scraper.msg.loadError')}: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [tr]);

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
        showMsg('success', `${tr('admin.scraper.msg.crawlStarted')}: ${category}. Job ID: ${res.data?.jobId}`);
        await loadAll();
      } else {
        showMsg('error', `${tr('admin.scraper.msg.crawlError')}: ${res.error || 'unknown'}`);
      }
    } catch (e: any) {
      showMsg('error', `${tr('admin.scraper.msg.crawlError')}: ${e.message}`);
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
          tr('admin.scraper.msg.willIngest', { n: dry.data.wouldIngest })
        );
        if (!confirmed) {
          setBusy(null);
          return;
        }
      }

      const res = await adminApi.ingestRagChunks({});
      if (res.success && res.data) {
        showMsg('success', `${tr('admin.scraper.msg.ingestComplete')}: ${tr('admin.scraper.msg.ingestChunksAdded', { n: res.data.added })}. ${tr('admin.scraper.msg.ingestErrors')}: ${res.data.errors?.length || 0}`);
        await loadAll();
      } else {
        showMsg('error', `${tr('admin.scraper.msg.ingestError')}: ${res.error || 'unknown'}`);
      }
    } catch (e: any) {
      showMsg('error', `${tr('admin.scraper.msg.crawlError')}: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const handleAddSource = async () => {
    if (!newSource.id || !newSource.name || !newSource.url) {
      showMsg('error', tr('admin.scraper.msg.requiredFields'));
      return;
    }
    setBusy('add-source');
    try {
      const res = await adminApi.addSource(newSource);
      if (res.success) {
        showMsg('success', `${tr('admin.scraper.msg.sourceAdded')}: ${newSource.id}`);
        setShowAddSource(false);
        setNewSource({ id: '', name: '', url: '', type: 'mada', frequency: 'daily' });
        await loadAll();
      } else {
        showMsg('error', res.error || 'Error');
      }
    } catch (e: any) {
      showMsg('error', `${tr('admin.scraper.msg.crawlError')}: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteSource = async (id: string) => {
    const confirmText = tr('admin.scraper.msg.confirmDeleteSource', { id });
    if (!confirm(confirmText)) return;
    setBusy(`del-${id}`);
    try {
      const res = await adminApi.deleteSource(id);
      if (res.success) {
        showMsg('success', `${tr('admin.scraper.msg.sourceDeleted')}: ${id}`);
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
        showMsg('success', `${enabled ? tr('admin.scraper.msg.sourceEnabled') : tr('admin.scraper.msg.sourceDisabled')}: ${id}`);
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
    const locale = isVi ? 'vi-VN' : isAr ? 'ar-SA' : isFr ? 'fr-FR' : 'en-US';
    return new Date(iso).toLocaleString(locale);
  };

  const getStatusBadge = (status: string) => {
    const statusKey = `admin.scraper.status.${status}` as any;
    const label = tr(statusKey) || status;
    
    const clsMap: Record<string, string> = {
      queued: 'bg-slate-100 text-slate-700 border-slate-300',
      running: 'bg-blue-100 text-blue-700 border-blue-300',
      completed: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      failed: 'bg-red-100 text-red-700 border-red-300',
      active: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      inactive: 'bg-slate-100 text-slate-500 border-slate-300',
    };
    
    const iconMap: Record<string, string> = {
      queued: 'schedule',
      running: 'autorenew',
      completed: 'check_circle',
      failed: 'error',
      active: 'check_circle',
      inactive: 'block',
    };
    
    const s = statusMap[status] || { label, cls: clsMap[status] || 'bg-slate-100 text-slate-500 border-slate-300', icon: iconMap[status] || 'help' };
    
    return (
      <span className={clsx('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border-2', s.cls)}>
        <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
        {s.label}
      </span>
    );
  };

  // Status badge configuration
  const statusMap: Record<string, { label: string; cls: string; icon: string }> = {
    queued: { label: tr('admin.scraper.status.queued'), cls: 'bg-slate-100 text-slate-700 border-slate-300', icon: 'schedule' },
    running: { label: tr('admin.scraper.status.running'), cls: 'bg-blue-100 text-blue-700 border-blue-300', icon: 'autorenew' },
    completed: { label: tr('admin.scraper.status.completed'), cls: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: 'check_circle' },
    failed: { label: tr('admin.scraper.status.failed'), cls: 'bg-red-100 text-red-700 border-red-300', icon: 'error' },
    active: { label: tr('admin.scraper.status.active'), cls: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: 'check_circle' },
    inactive: { label: tr('admin.scraper.status.off'), cls: 'bg-slate-100 text-slate-500 border-slate-300', icon: 'block' },
  };

  const runningCount = jobs.filter(j => j.status === 'running').length;
  const activeCronCount = sources.filter(s => s.status === 'active').length;

  const stats = [
    {
      label: tr('admin.scraper.stats.products.label'),
      value: fileStats?.productCount || 0,
      sub: tr('admin.scraper.stats.products.inKb'),
      color: 'from-primary/10 to-primary/5',
      iconColor: 'text-primary',
      icon: 'inventory_2',
      iconBg: 'bg-primary/20',
    },
    {
      label: tr('admin.scraper.stats.chunks.label'),
      value: fileStats?.chunkCount || 0,
      sub: tr('admin.scraper.stats.chunks.readyToIngest'),
      color: 'from-amber-50/80 to-amber-100/40',
      iconColor: 'text-amber-600',
      icon: 'layers',
      iconBg: 'bg-amber-200',
    },
    {
      label: tr('admin.scraper.stats.categories.label'),
      value: categories.length,
      sub: tr('admin.scraper.stats.categories.specialized'),
      color: 'from-purple-50/80 to-purple-100/40',
      iconColor: 'text-purple-600',
      icon: 'category',
      iconBg: 'bg-purple-200',
    },
    {
      label: tr('admin.scraper.stats.cron.label'),
      value: activeCronCount,
      sub: tr('admin.scraper.stats.cron.total', { n: activeCronCount }),
      color: 'from-green-50/80 to-green-100/40',
      iconColor: 'text-green-600',
      icon: 'schedule',
      iconBg: 'bg-green-200',
    },
    {
      label: tr('admin.scraper.stats.running.label'),
      value: runningCount,
      sub: tr('admin.scraper.stats.running.of', { n: runningCount, t: jobs.length }),
      color: 'from-blue-50/80 to-blue-100/40',
      iconColor: 'text-blue-600',
      icon: 'autorenew',
      iconBg: 'bg-blue-200',
      pulse: true,
    },
  ];

  return (
    <AdminLayout
      titleKey="admin.topBar.scraper"
      subtitleKey="admin.topBar.scraperSub"
      showLayoutTitle={false}
    >
      {/* Hero Banner */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-white to-amber-500/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-8 px-6">
            <h2 className="text-4xl font-black text-on-surface mb-4 tracking-tight" dir={isAr ? 'rtl' : 'ltr'}>
              {tr('admin.scraper.hero.title')}
            </h2>
            <p className="text-lg font-medium text-on-surface-variant border-l-4 border-primary pl-6 py-2 bg-white/40 backdrop-blur-sm rounded-r-xl" dir={isAr ? 'rtl' : 'ltr'}>
              {tr('admin.scraper.hero.desc')}
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
            <div className={clsx('w-10 h-10 rounded-xl border border-slate-300 flex items-center justify-center shadow-sm', s.iconBg)}>
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
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="flex items-center gap-3 p-1.5 bg-white/60 backdrop-blur-xl rounded-full border border-slate-300">
          <span className="text-on-surface-variant font-medium text-sm ml-4 mr-2">{tr('admin.scraper.actions.quickActions')}</span>
          <button
            onClick={() => handleCrawl('all')}
            disabled={busy === 'all' || busy !== null}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm transition-all border-2 bg-primary text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:opacity-40"
          >
            {busy === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
            <span>{tr('admin.scraper.actions.crawlAll')}</span>
          </button>
          <button
            onClick={handleIngest}
            disabled={busy === 'ingest' || !fileStats?.chunkCount}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm transition-all border-2 bg-amber-500 text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:opacity-40"
          >
            {busy === 'ingest' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            <span>{tr('admin.scraper.actions.ingest', { n: fileStats?.chunkCount || 0 })}</span>
          </button>
        </div>

        <button
          onClick={loadAll}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/60 backdrop-blur-xl border border-slate-300 font-bold text-sm hover:bg-white hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-sm shadow-sm transition-all disabled:opacity-50"
        >
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          <span>{tr('admin.scraper.actions.refresh')}</span>
        </button>
      </div>

      {/* Message banner */}
      {message && (
        <div className={clsx(
          'mb-6 p-4 rounded-2xl border-[3px] border-black flex items-center gap-3 text-sm font-bold shadow-sm',
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
        <div className="px-6 py-4 border-b border-slate-200/10 bg-gradient-to-r from-primary/5 to-transparent flex items-center justify-between">
          <div>
            <h2 className="font-black text-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>category</span>
              {tr('admin.scraper.categories.heading')}
            </h2>
            <p className="text-xs text-on-surface-variant mt-1">
              {tr('admin.scraper.categories.desc')}
            </p>
          </div>
          <a
            href="https://at.mada.org.qa/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-300 bg-white hover:bg-primary/5 font-bold text-xs shadow-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-sm transition-all"
          >
            {tr('admin.scraper.categories.madaPortal')} <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="divide-y divide-outline-variant/50">
          {categories.map((cat) => (
            <div key={cat.slug} className="px-6 py-4 flex items-center justify-between hover:bg-primary/5 transition-colors group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-slate-300 flex items-center justify-center shrink-0">
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
                  <span className="font-bold text-sm">{getCategoryName(cat)}</span>
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
                className="ml-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-white border border-slate-300 font-bold text-xs shadow-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-sm disabled:opacity-40 transition-all"
              >
                {busy === cat.slug ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>{tr('admin.scraper.categories.crawl')}</span>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Crawl Jobs History */}
      <section className="bg-white/70 backdrop-blur-xl rounded-3xl border-[3px] border-black shadow-[6px_6px_0px_0px_#000] mb-8 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/10 bg-gradient-to-r from-blue-500/5 to-transparent">
          <h2 className="font-black text-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600" style={{ fontVariationSettings: "'FILL' 1" }}>history</span>
            {tr('admin.scraper.jobs.heading')}
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            {tr('admin.scraper.jobs.desc')}
          </p>
        </div>
        <div className="overflow-x-auto">
          {jobs.length === 0 ? (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-7xl text-on-surface-variant/30 inline-block" style={{ fontVariationSettings: "'FILL' 0" }}>history_toggle_off</span>
              <p className="text-sm text-on-surface-variant mt-3">
                {tr('admin.scraper.jobs.empty')}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-blue-500/5 text-left text-xs font-bold uppercase tracking-wider text-on-surface-variant border-b border-slate-200/10">
                <tr>
                  <th className="px-6 py-3">{tr('admin.scraper.table.jobId')}</th>
                  <th className="px-6 py-3">{tr('admin.scraper.table.category')}</th>
                  <th className="px-6 py-3">{tr('admin.scraper.table.status')}</th>
                  <th className="px-6 py-3">{tr('admin.scraper.jobs.started')}</th>
                  <th className="px-6 py-3">{tr('admin.scraper.jobs.finished')}</th>
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
            {tr('admin.scraper.kbFiles.heading')}
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
                    {tr('admin.scraper.kbFiles.missing')}
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
            {tr('admin.scraper.pipeline.heading')}
          </h3>
          <ol className="text-xs space-y-3 text-on-surface-variant">
            <li className="flex items-center gap-3 p-2.5 rounded-xl bg-purple-50 border-2 border-purple-200">
              <div className="w-8 h-8 rounded-full bg-purple-500 text-white border border-slate-300 flex items-center justify-center font-black text-xs shadow-sm">1</div>
              <span className="material-symbols-outlined text-base text-purple-700" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_download</span>
              <span className="font-medium text-on-surface">{tr('admin.scraper.pipeline.step1')}</span>
            </li>
            <li className="flex items-center gap-3 p-2.5 rounded-xl bg-purple-50 border-2 border-purple-200">
              <div className="w-8 h-8 rounded-full bg-purple-500 text-white border border-slate-300 flex items-center justify-center font-black text-xs shadow-sm">2</div>
              <span className="material-symbols-outlined text-base text-purple-700" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              <span className="font-medium text-on-surface">
                {tr('admin.scraper.pipeline.step2', { p: fileStats?.productCount || 0, c: fileStats?.chunkCount || 0 })}
              </span>
            </li>
            <li className="flex items-center gap-3 p-2.5 rounded-xl bg-purple-50 border-2 border-purple-200">
              <div className="w-8 h-8 rounded-full bg-purple-500 text-white border border-slate-300 flex items-center justify-center font-black text-xs shadow-sm">3</div>
              <span className="material-symbols-outlined text-base text-purple-700" style={{ fontVariationSettings: "'FILL' 1" }}>storage</span>
              <span className="font-medium text-on-surface">{tr('admin.scraper.pipeline.step3')}</span>
            </li>
            <li className="flex items-center gap-3 p-2.5 rounded-xl bg-purple-50 border-2 border-purple-200">
              <div className="w-8 h-8 rounded-full bg-purple-500 text-white border border-slate-300 flex items-center justify-center font-black text-xs shadow-sm">4</div>
              <span className="material-symbols-outlined text-base text-purple-700" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              <span className="font-medium text-on-surface">{tr('admin.scraper.pipeline.step4')}</span>
            </li>
          </ol>
          <div className="mt-4 pt-3 border-t border-slate-200/10 text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border-2 border-amber-300 inline-flex items-start gap-2 w-full">
            <span className="material-symbols-outlined text-base shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            <span>{tr('admin.scraper.pipeline.warning')}</span>
          </div>
        </div>
      </section>

      {/* Scheduled Sources */}
      <section className="bg-white/70 backdrop-blur-xl rounded-3xl border-[3px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/10 bg-gradient-to-r from-green-500/5 to-transparent flex items-center justify-between">
          <div>
            <h2 className="font-black text-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-green-600" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
              {tr('admin.scraper.sources.heading')}
            </h2>
            <p className="text-xs text-on-surface-variant mt-1">
              {tr('admin.scraper.sources.desc')}
            </p>
          </div>
          <button
            onClick={() => setShowAddSource(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-white border border-slate-300 font-bold text-xs shadow-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{tr('admin.scraper.sources.add')}</span>
          </button>
        </div>

        {showAddSource && (
          <div className="p-6 bg-gradient-to-br from-blue-50/60 to-purple-50/60 border-b border-slate-200/10">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <input
                placeholder={tr('admin.scraper.sources.placeholderId')}
                value={newSource.id}
                onChange={(e) => setNewSource({ ...newSource, id: e.target.value })}
                className="px-3 py-2.5 rounded-full border border-slate-300 bg-white text-sm font-medium"
              />
              <input
                placeholder={tr('admin.scraper.sources.placeholderName')}
                value={newSource.name}
                onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                className="px-3 py-2.5 rounded-full border border-slate-300 bg-white text-sm font-medium"
              />
              <input
                placeholder="URL"
                value={newSource.url}
                onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                className="px-3 py-2.5 rounded-full border border-slate-300 bg-white text-sm font-medium col-span-2 md:col-span-1"
              />
              <select
                value={newSource.frequency}
                onChange={(e) => setNewSource({ ...newSource, frequency: e.target.value })}
                className="px-3 py-2.5 rounded-full border border-slate-300 bg-white text-sm font-bold"
              >
                <option value="hourly">{tr('admin.scraper.sources.frequency.hourly')}</option>
                <option value="daily">{tr('admin.scraper.sources.frequency.daily')}</option>
                <option value="weekly">{tr('admin.scraper.sources.frequency.weekly')}</option>
                <option value="monthly">{tr('admin.scraper.sources.frequency.monthly')}</option>
              </select>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleAddSource}
                disabled={busy === 'add-source'}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-primary text-white border border-slate-300 font-bold text-sm shadow-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-sm disabled:opacity-40"
              >
                {busy === 'add-source' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {tr('admin.scraper.sources.save')}
              </button>
              <button
                onClick={() => setShowAddSource(false)}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-white border border-slate-300 font-bold text-sm shadow-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-sm"
              >
                {tr('admin.scraper.sources.cancel')}
              </button>
            </div>
          </div>
        )}

        {sources.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-7xl text-on-surface-variant/30 inline-block" style={{ fontVariationSettings: "'FILL' 0" }}>schedule_send</span>
            <p className="text-sm text-on-surface-variant mt-3">
              {tr('admin.scraper.sources.empty')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/50">
            {sources.map((src) => (
              <div key={src.id} className="px-6 py-4 flex items-center justify-between hover:bg-green-500/5 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-200 to-green-100 border border-slate-300 flex items-center justify-center shrink-0">
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
                    title={src.status === 'active' ? tr('admin.scraper.sources.disable') : tr('admin.scraper.sources.enable')}
                  >
                    {src.status === 'active' ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                  </button>
                  <button
                    onClick={() => handleDeleteSource(src.id)}
                    disabled={busy === `del-${src.id}`}
                    className="p-2.5 rounded-xl hover:bg-red-50 hover:text-red-600 border-2 border-transparent hover:border-red-300 transition-all"
                    title={tr('admin.scraper.sources.delete')}
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
