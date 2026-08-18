/**
 * Sync DEFAULT_SOURCES vào DB table scheduled_sources
 *
 * Chạy khi khởi động server hoặc qua CLI:
 *   npx tsx server/scripts/sync-default-sources.ts
 */

import db from '../lib/db';

interface ScrapingJob {
  id: string;
  name: string;
  url: string;
  category: string;
  enabled: boolean;
  schedule: string;
}

const DEFAULT_SOURCES: ScrapingJob[] = [
  {
    id: 'mada-main',
    name: 'MADA Main Website',
    url: 'https://at.mada.org.qa',
    category: 'vision,hearing,mobility,cognition',
    enabled: true,
    schedule: '0 2 * * *', // 2:00 AM daily
  },
  {
    id: 'who-gate',
    name: 'WHO GATE Programme',
    url: 'https://www.who.int/health-topics/assistive-technology',
    category: 'general',
    enabled: true,
    schedule: '0 3 * * 0', // 3:00 AM every Sunday
  },
  {
    id: 'iso-at',
    name: 'ISO Assistive Products',
    url: 'https://www.iso.org/standard/76953.html',
    category: 'standards',
    enabled: true,
    schedule: '0 4 1 * *', // 4:00 AM first day of month
  },
  {
    id: 'wcag-docs',
    name: 'WCAG Documentation',
    url: 'https://www.w3.org/WAI/WCAG21/quickref/',
    category: 'standards',
    enabled: true,
    schedule: '0 5 * * *', // 5:00 AM daily
  },
  {
    id: 'mada-hearing',
    name: 'MADA Hearing Bot',
    url: 'https://at.mada.org.qa/technology-category/body-function/sensory-hearing/',
    category: 'hearing',
    enabled: true,
    schedule: '0 6 * * *',
  },
  {
    id: 'mada-vision',
    name: 'MADA Vision Bot',
    url: 'https://at.mada.org.qa/technology-category/body-function/sensory-vision/',
    category: 'vision',
    enabled: true,
    schedule: '0 7 * * *',
  },
  {
    id: 'mada-speech',
    name: 'MADA Speech Bot',
    url: 'https://at.mada.org.qa/technology-category/body-function/voice-and-speech/',
    category: 'speech',
    enabled: true,
    schedule: '0 8 * * *',
  },
  {
    id: 'mada-cognitive',
    name: 'MADA Cognitive Bot',
    url: 'https://at.mada.org.qa/technology-category/body-function/mental-cognitive/',
    category: 'cognitive',
    enabled: true,
    schedule: '0 9 * * *',
  },
  {
    id: 'mada-neuro',
    name: 'MADA Neuro-Movement Bot',
    url: 'https://at.mada.org.qa/technology-category/body-function/neuromusculoskeletal-movement/',
    category: 'neuromusculoskeletal',
    enabled: true,
    schedule: '0 10 * * *',
  },
  {
    id: 'mada-mobility',
    name: 'MADA Mobility Bot',
    url: 'https://at.mada.org.qa/technology-category/activities-and-participation/mobility-and-transportation/',
    category: 'mobility',
    enabled: true,
    schedule: '0 11 * * *',
  },
  {
    id: 'mada-regulatory',
    name: 'MADA Regulatory Portal',
    url: 'https://at.mada.org.qa/assistive-technology-portal/',
    category: 'regulatory',
    enabled: true,
    schedule: '0 12 * * *',
  },
];

interface SourceRow {
  id: string;
  url: string;
  name: string;
  type: string;
  frequency: string;
  status: string;
}

function cronToFrequency(cron: string): 'hourly' | 'daily' | 'weekly' {
  // "0 2 * * *" → daily
  // "0 * * * *" → hourly (mọi giờ)
  // "0 3 * * 0" → weekly (Chủ nhật)
  // "0 4 1 * *" → weekly (monthly fallback — schema không có 'monthly')
  if (cron.match(/^\d+ \* \* \* \*$/)) return 'hourly';
  if (cron.match(/\* \d+$/)) return 'weekly';        // cụ thể 1 ngày trong tuần
  if (cron.match(/^\d+ \d+ \d+/)) return 'weekly';   // monthly-like → weekly
  return 'daily';
}

async function syncDefaults(): Promise<{ inserted: number; updated: number; skipped: number }> {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  const now = new Date().toISOString();

  for (const src of DEFAULT_SOURCES) {
    try {
      const existing = db.prepare('SELECT * FROM scheduled_sources WHERE id = ?').get(src.id) as SourceRow | undefined;

      const freq = cronToFrequency(src.schedule);

      if (!existing) {
        db.prepare(
          `INSERT INTO scheduled_sources (id, name, url, type, frequency, status, metadata, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          src.id,
          src.name,
          src.url,
          'web',  // ⭐ Schema yêu cầu type IN ('web', 'api')
          freq,
          src.enabled ? 'active' : 'inactive',
          JSON.stringify({ source: 'default', category: src.category, cron: src.schedule }),
          now,
          now
        );
        inserted++;
        console.log(`  ✅ Inserted: ${src.id} (${freq})`);
      } else {
        // Update name/url/type nếu khác (giữ status/last_run từ DB)
        db.prepare(
          `UPDATE scheduled_sources SET name = ?, url = ?, type = ?, frequency = ?, metadata = ?, updated_at = ?
           WHERE id = ?`
        ).run(
          src.name,
          src.url,
          'web',  // ⭐ Schema yêu cầu type IN ('web', 'api')
          freq,
          JSON.stringify({ source: 'default', category: src.category, cron: src.schedule }),
          now,
          src.id
        );
        updated++;
        console.log(`  🔄 Updated: ${src.id} (${freq})`);
      }
    } catch (err: any) {
      console.warn(`  ⚠️  ${src.id}: ${err.message}`);
      skipped++;
    }
  }

  return { inserted, updated, skipped };
}

async function main() {
  console.log('\n🚀 Sync DEFAULT_SOURCES → scheduled_sources\n');

  // Check table exists
  try {
    db.prepare('SELECT COUNT(*) FROM scheduled_sources').get();
  } catch (err: any) {
    console.error(`❌ Table scheduled_sources không tồn tại. Lỗi: ${err.message}`);
    process.exit(1);
  }

  const before = (db.prepare('SELECT COUNT(*) as count FROM scheduled_sources').get() as { count: number }).count;
  console.log(`   Before: ${before} sources trong DB`);

  const result = await syncDefaults();

  const after = (db.prepare('SELECT COUNT(*) as count FROM scheduled_sources').get() as { count: number }).count;
  console.log(`\n   After: ${after} sources trong DB`);
  console.log(`\n   📊 Summary:`);
  console.log(`      Inserted: ${result.inserted}`);
  console.log(`      Updated: ${result.updated}`);
  console.log(`      Skipped: ${result.skipped}`);
  console.log('');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});