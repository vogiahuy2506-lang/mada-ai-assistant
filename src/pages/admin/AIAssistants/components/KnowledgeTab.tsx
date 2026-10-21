// ===================================================================
// ============== AI ASSISTANTS — Knowledge tab ===============
// ===================================================================
// 3 thứ gắn với bot:
//   - Knowledge base (cào URL / thêm text)
//   - Sản phẩm gán riêng (catalog curated)
//   - Capability toggles

import React, { useEffect, useMemo, useState } from 'react';
import {
  Database, Globe, FileText, Plus, X, Sparkles, Search,
  Loader2, CheckSquare, Square, RefreshCw, Trash2, Package,
} from 'lucide-react';
import { studioApi } from '../api';
import { adminApi } from '../../adminApi';
import { CAPABILITIES, SQ_CATEGORIES, type FixedBot } from '../constants';
import type { KnowledgeSource, StudioBot, StudioProduct } from '../types';
import { Alert, ChipToggle, EmptyRow, Field, Section } from './primitives';

interface Props {
  bot: StudioBot;
  fixedBot: FixedBot;
  draft: StudioBot | null;
  isDirty: boolean;
  onUpdate: (patch: Partial<StudioBot>) => void;
  onSave: () => Promise<void>;
}

interface KnowledgeState {
  sources: KnowledgeSource[];
  documents: Array<{ id: string; title: string; source: string; preview: string; crawledAt: string | null }>;
  totalChunks: number;
}

export function KnowledgeTab({ bot, fixedBot, draft, isDirty, onUpdate, onSave }: Props) {
  const view = draft ?? bot;

  // ---- Knowledge ----
  const [kb, setKb] = useState<KnowledgeState>({
    sources: [],
    documents: [],
    totalChunks: 0,
  });
  const [kbLoading, setKbLoading] = useState(false);
  const [tab, setTab] = useState<'text' | 'web'>('web');
  const [kbUrl, setKbUrl] = useState(fixedBot.madaUrl);
  const [kbText, setKbText] = useState('');
  const [kbTitle, setKbTitle] = useState('');
  const [kbAddBusy, setKbAddBusy] = useState(false);
  const [crawlBusy, setCrawlBusy] = useState(false);
  const [crawlFollow, setCrawlFollow] = useState(false);
  const [crawlMaxDepth, setCrawlMaxDepth] = useState(1);
  const [crawlMaxPages, setCrawlMaxPages] = useState(5);
  const [kbError, setKbError] = useState<string | null>(null);

  // ---- Products ----
  const [linked, setLinked] = useState<StudioProduct[]>([]);
  const [loadingLinked, setLoadingLinked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StudioProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [productTab, setProductTab] = useState<'linked' | 'all'>('linked');

  const reloadKb = async () => {
    setKbLoading(true);
    setKbError(null);
    try {
      const data = await studioApi.getKnowledge(bot.id);
      setKb({
        sources: data.sources,
        documents: data.documents,
        totalChunks: data.totalChunks,
      });
    } catch (err: any) {
      setKbError(err?.message || 'Lỗi tải KB');
    } finally {
      setKbLoading(false);
    }
  };

  const reloadLinked = async () => {
    setLoadingLinked(true);
    try {
      const items = await studioApi.getLinkedProducts(bot.id);
      setLinked(items);
    } catch {
      /* ignore */
    } finally {
      setLoadingLinked(false);
    }
  };

  // Load initial
  useEffect(() => {
    reloadKb();
    reloadLinked();
  }, [bot.id]);

  // Sync draft KB URL → input
  useEffect(() => {
    if (view.knowledgeUrl && !kbUrl) setKbUrl(view.knowledgeUrl);
  }, [bot.id]);

  // Search w/ debounce
  useEffect(() => {
    if (productTab !== 'all') return;
    const q = searchQuery.trim();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await studioApi.searchProducts(q, view.madaCategory ?? undefined);
        setSearchResults(results);
      } catch {
        /* ignore */
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, productTab, view.madaCategory]);

  const linkedIds = useMemo(() => new Set(linked.map((p) => p.id)), [linked]);

  // ---- Crawl ----
  const handleCrawl = async () => {
    if (!kbUrl.trim()) return;
    setCrawlBusy(true);
    setKbError(null);
    try {
      const res = await adminApi.crawlAgentSources(bot.id, {
        knowledge_url: kbUrl,
        product_urls: view.productUrl ? [view.productUrl] : undefined,
        crawl_follow_links: (crawlFollow ? 1 : 0) as 0 | 1,
        crawl_max_depth: crawlMaxDepth,
        crawl_max_pages: crawlMaxPages,
      });
      if (!res.success) {
        setKbError(res.error || 'Cào dữ liệu thất bại');
      } else {
        const failed = res.data?.results?.filter((r) => !r.ok).length ?? 0;
        await reloadKb();
        if (failed > 0)
          setKbError(`${res.data!.totalDocs} chunks OK · ${failed} nguồn lỗi`);
      }
    } catch (err: any) {
      setKbError(err?.message || 'Lỗi cào');
    } finally {
      setCrawlBusy(false);
    }
  };

  // ---- Add KB ----
  const handleAddKb = async () => {
    const content = tab === 'web' ? kbUrl : kbText;
    if (!content.trim()) return;
    setKbAddBusy(true);
    setKbError(null);
    try {
      const res = await studioApi.addKnowledge(bot.id, {
        type: tab,
        content,
        title: kbTitle || undefined,
      });
      if (!res.success) setKbError(res.error || 'Thêm KB thất bại');
      else {
        await reloadKb();
        setKbText('');
        setKbTitle('');
      }
    } catch (err: any) {
      setKbError(err?.message || 'Lỗi');
    } finally {
      setKbAddBusy(false);
    }
  };

  // ---- Products ----
  const toggleLink = async (product: StudioProduct) => {
    const isLinked = linkedIds.has(product.id);
    setLinking(product.id);
    try {
      if (isLinked) await studioApi.unlinkProduct(bot.id, product.id);
      else await studioApi.linkProduct(bot.id, product.id);
      await reloadLinked();
    } catch (err: any) {
      alert('Lỗi: ' + (err?.message || err));
    } finally {
      setLinking(null);
    }
  };

  const handleSyncByCategory = async () => {
    if (!view.madaCategory) {
      alert('Bot chưa có mada_category — set trước ở tab Basics.');
      return;
    }
    if (!confirm(`Auto-gán tất cả sản phẩm có category "${view.madaCategory}" vào bot này?`))
      return;
    setLinking('all');
    try {
      await studioApi.syncProductsByCategory(bot.id, view.madaCategory);
      await reloadLinked();
    } catch (err: any) {
      alert('Lỗi: ' + (err?.message || err));
    } finally {
      setLinking(null);
    }
  };

  // ---- Capabilities ----
  const toggleCap = (id: string) => {
    const cur = view.capabilities ?? [];
    const next = cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id];
    onUpdate({ capabilities: next });
  };

  return (
    <div className="max-w-4xl">
      {/* ── Knowledge URL ── */}
      <Section
        title="URL tri thức nguồn"
        description={'URL web khi bấm "Cào dữ liệu" sẽ tự fetch nội dung vào vector store của bot.'}
      >
        <Field label="Knowledge URL (chính)">
          <input
            className="lin-input lin-focus-visible"
            value={kbUrl}
            onChange={(e) => {
              setKbUrl(e.target.value);
              onUpdate({ knowledgeUrl: e.target.value });
            }}
            placeholder="https://at.mada.org.qa/technology-category/..."
          />
        </Field>
        <Field
          label="Product URL (bổ sung — sản phẩm cần giám sát)"
          className="mt-3"
        >
          <input
            className="lin-input lin-focus-visible"
            value={view.productUrl ?? ''}
            onChange={(e) => onUpdate({ productUrl: e.target.value })}
            placeholder="https://nhà-cung-cấp.example/danh-mục-thiết-bị"
          />
        </Field>

        {/* Crawl options */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Theo link phụ">
            <ChipToggle
              label={crawlFollow ? 'Bật follow link' : 'Chỉ trang này'}
              active={crawlFollow}
              onClick={() => setCrawlFollow((v) => !v)}
            />
          </Field>
          <Field label={`Độ sâu tối đa (${crawlMaxDepth})`}>
            <input
              type="range"
              min={0}
              max={3}
              value={crawlMaxDepth}
              onChange={(e) => setCrawlMaxDepth(Number(e.target.value))}
              className="w-full accent-[var(--lin-accent)]"
            />
          </Field>
          <Field label={`Số trang tối đa (${crawlMaxPages})`}>
            <input
              type="range"
              min={1}
              max={50}
              value={crawlMaxPages}
              onChange={(e) => setCrawlMaxPages(Number(e.target.value))}
              className="w-full accent-[var(--lin-accent)]"
            />
          </Field>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleCrawl}
            disabled={Boolean(crawlBusy || !kbUrl.trim())}
            className="lin-btn lin-btn-primary lin-focus-visible"
          >
            {crawlBusy ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Globe className="w-3 h-3" />
            )}
            <span className="text-[12px]">{crawlBusy ? 'Đang cào…' : 'Cào dữ liệu'}</span>
          </button>
          <button
            type="button"
            onClick={reloadKb}
            disabled={kbLoading}
            className="lin-btn lin-btn-ghost lin-focus-visible"
            title="Tải lại danh sách KB"
          >
            <RefreshCw className={`w-3 h-3 ${kbLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {kbError && (
          <Alert tone="warning">
            {kbError}
          </Alert>
        )}
      </Section>

      {/* ── Knowledge State ── */}
      <Section
        title="Tri thức trong vector store"
        description="Các chunk tài liệu đã ingest cho bot. Số chunks tăng sau mỗi lần cào."
        action={
          <span
            className="lin-badge lin-badge-accent"
            title="Tổng chunks hiện có"
          >
            {kb.totalChunks} chunks
          </span>
        }
      >
        {kbLoading && kb.sources.length === 0 ? (
          <EmptyRow>Đang tải…</EmptyRow>
        ) : kb.sources.length === 0 ? (
          <EmptyRow>Chưa có tri thức nào — bấm "Cào dữ liệu" hoặc thêm thủ công bên dưới.</EmptyRow>
        ) : (
          <div
            className="rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--lin-border)' }}
          >
            <div
              className="grid grid-cols-12 text-[10.5px] uppercase tracking-wider lin-t-quaternary px-3 py-2 font-semibold"
              style={{ background: 'var(--lin-bg-sunken)' }}
            >
              <div className="col-span-7">Nguồn</div>
              <div className="col-span-2 text-right">Chunks</div>
              <div className="col-span-3 text-right">Lần cào</div>
            </div>
            {kb.sources.map((s) => (
              <div
                key={s.source}
                className="grid grid-cols-12 px-3 py-2 text-[12px]"
                style={{ borderTop: '1px solid var(--lin-border-subtle)' }}
              >
                <div className="col-span-7 min-w-0 flex items-center gap-2">
                  <FileText
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: 'var(--lin-accent)' }}
                  />
                  <span className="truncate">
                    {s.title || s.source.split('/').pop() || s.source}
                  </span>
                </div>
                <div className="col-span-2 text-right lin-t-tertiary">{s.chunks}</div>
                <div className="col-span-3 text-right lin-t-quaternary">
                  {s.crawledAt ? new Date(s.crawledAt).toLocaleString('vi-VN') : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Add KB thủ công ── */}
      <Section
        title="Thêm tài liệu thủ công"
        description="Dán URL web hoặc đoạn văn bản — sẽ được embed vào vector store của bot."
      >
        <div
          className="flex items-center gap-1 rounded-md p-0.5 mb-3"
          style={{ background: 'var(--lin-bg-sunken)' }}
        >
          {(['web', 'text'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="flex-1 px-2 py-1 rounded text-[11.5px] font-medium transition-colors lin-focus-visible"
              style={{
                background: tab === t ? 'var(--lin-bg-elevated)' : 'transparent',
                color:
                  tab === t ? 'var(--lin-text-primary)' : 'var(--lin-text-tertiary)',
                boxShadow: tab === t ? 'var(--lin-shadow-xs)' : 'none',
              }}
            >
              {t === 'web' ? '🌐 URL' : '📝 Văn bản'}
            </button>
          ))}
        </div>

        {tab === 'web' ? (
          <Field label="URL trang web">
            <input
              className="lin-input lin-focus-visible"
              value={kbUrl}
              onChange={(e) => setKbUrl(e.target.value)}
              placeholder="https://..."
            />
          </Field>
        ) : (
          <>
            <Field label="Tiêu đề">
              <input
                className="lin-input lin-focus-visible"
                value={kbTitle}
                onChange={(e) => setKbTitle(e.target.value)}
                placeholder="VD: Hướng dẫn lắp đặt máy trợ thính BTE"
              />
            </Field>
            <Field label="Nội dung" className="mt-2">
              <textarea
                rows={5}
                className="lin-input lin-focus-visible"
                value={kbText}
                onChange={(e) => setKbText(e.target.value)}
                placeholder="Dán văn bản vào đây…"
              />
            </Field>
          </>
        )}

        <button
          type="button"
          onClick={handleAddKb}
          disabled={kbAddBusy || (tab === 'web' ? !kbUrl : !kbText)}
          className="lin-btn lin-btn-secondary lin-focus-visible mt-3"
        >
          {kbAddBusy ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Plus className="w-3 h-3" />
          )}
          <span className="text-[12px]">{kbAddBusy ? 'Đang thêm…' : 'Thêm vào KB'}</span>
        </button>
      </Section>

      {/* ── Products ── */}
      <Section
        title="Sản phẩm gán riêng cho bot"
        description="Hệ thống ưu tiên sản phẩm gán tay trước khi auto-link theo category."
        action={
          <button
            type="button"
            onClick={handleSyncByCategory}
            disabled={linking === 'all'}
            className="lin-btn lin-btn-secondary lin-btn-sm lin-focus-visible"
            title="Auto-gán tất cả sản phẩm cùng mada_category"
          >
            <Package className="w-3 h-3" />
            <span className="text-[11px]">Auto-sync theo category</span>
          </button>
        }
      >
        <div
          className="flex items-center gap-1 rounded-md p-0.5 mb-3"
          style={{ background: 'var(--lin-bg-sunken)' }}
        >
          {(['linked', 'all'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setProductTab(t)}
              className="flex-1 px-2 py-1 rounded text-[11.5px] font-medium transition-colors lin-focus-visible"
              style={{
                background: productTab === t ? 'var(--lin-bg-elevated)' : 'transparent',
                color:
                  productTab === t
                    ? 'var(--lin-text-primary)'
                    : 'var(--lin-text-tertiary)',
                boxShadow: productTab === t ? 'var(--lin-shadow-xs)' : 'none',
              }}
            >
              {t === 'linked' ? `📌 Đã gán (${linked.length})` : '🛒 Tất cả sản phẩm'}
            </button>
          ))}
        </div>

        {productTab === 'all' && (
          <Field label="Tìm kiếm">
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                style={{ color: 'var(--lin-text-quaternary)' }}
              />
              <input
                className="lin-input pl-8 lin-focus-visible"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tên, model, brand…"
              />
            </div>
          </Field>
        )}

        <div className="mt-3">
          {loadingLinked ? (
            <EmptyRow>Đang tải sản phẩm…</EmptyRow>
          ) : productTab === 'linked' ? (
            linked.length === 0 ? (
              <EmptyRow>
                Chưa gán sản phẩm nào — chuyển sang tab "Tất cả sản phẩm" để tìm và gán.
              </EmptyRow>
            ) : (
              <ProductList
                products={linked}
                linkedIds={linkedIds}
                linking={linking}
                onToggle={toggleLink}
              />
            )
          ) : searching ? (
            <EmptyRow>Đang tìm…</EmptyRow>
          ) : searchResults.length === 0 ? (
            <EmptyRow>Không có sản phẩm phù hợp.</EmptyRow>
          ) : (
            <ProductList
              products={searchResults}
              linkedIds={linkedIds}
              linking={linking}
              onToggle={toggleLink}
            />
          )}
        </div>
      </Section>

      {/* ── Capabilities ── */}
      <Section
        title="Khả năng (Capabilities)"
        description="Các tool AI có thể dùng trong câu trả lời."
      >
        <div className="flex flex-wrap gap-1.5">
          {CAPABILITIES.map((c) => (
            <ChipToggle
              key={c.id}
              label={c.label}
              active={(view.capabilities ?? []).includes(c.id)}
              onClick={() => toggleCap(c.id)}
            />
          ))}
        </div>
        {isDirty && (
          <div className="mt-3 text-[11px] lin-t-quaternary">
            Nhớ bấm <strong>Lưu</strong> ở panel dưới để áp dụng thay đổi capability.
          </div>
        )}
      </Section>
    </div>
  );
}

// ---------- Local product list ----------

function ProductList({
  products,
  linkedIds,
  linking,
  onToggle,
}: {
  products: StudioProduct[];
  linkedIds: Set<string>;
  linking: string | null;
  onToggle: (p: StudioProduct) => void;
}) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--lin-border)' }}
    >
      <div
        className="grid grid-cols-12 text-[10.5px] uppercase tracking-wider lin-t-quaternary px-3 py-2 font-semibold"
        style={{ background: 'var(--lin-bg-sunken)' }}
      >
        <div className="col-span-1">✓</div>
        <div className="col-span-6">Sản phẩm</div>
        <div className="col-span-3">Category</div>
        <div className="col-span-2 text-right">Giá</div>
      </div>
      <div className="max-h-72 overflow-y-auto lin-scroll">
        {products.map((p) => {
          const isLinked = linkedIds.has(p.id);
          const busy = linking === p.id;
          return (
            <label
              key={p.id}
              className="grid grid-cols-12 items-center px-3 py-2 cursor-pointer text-[12px] hover:bg-[var(--lin-bg-hover)]"
              style={{ borderTop: '1px solid var(--lin-border-subtle)' }}
            >
              <div className="col-span-1">
                {busy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isLinked ? (
                  <CheckSquare
                    className="w-4 h-4"
                    style={{ color: 'var(--lin-accent)' }}
                  />
                ) : (
                  <Square className="w-4 h-4 lin-t-quaternary" />
                )}
              </div>
              <div className="col-span-6 min-w-0">
                <div className="truncate font-medium">{p.title || '(chưa đặt tên)'}</div>
                <div className="truncate text-[10.5px] lin-t-quaternary">
                  {p.brand} · {p.model}
                </div>
              </div>
              <div className="col-span-3 truncate lin-t-tertiary text-[11px]">
                {p.category}
              </div>
              <div className="col-span-2 text-right lin-t-tertiary">{p.price_range || '—'}</div>

              {/* hidden checkbox control */}
              <input
                type="checkbox"
                hidden
                checked={isLinked}
                onChange={() => onToggle(p)}
                disabled={Boolean(busy)}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}