/**
 * Smoke test: brand đã được index + embed đúng chưa.
 * Usage: npx tsx scripts/verify-brand-index.ts "<query>" [botId]
 */
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config();

async function main() {
  const query = process.argv[2] || 'Tangible Play Osmo';
  const botId = process.argv[3];

  const { vectorStore } = await import('../server/lib/rag/vectorStore');
  await vectorStore.initialize();

  const filter = botId ? { filter: { botId } } : { topK: 5 };
  const results = await vectorStore.search(query, filter as any);

  console.log(`\n🔍 "${query}"${botId ? ` [${botId}]` : ''} → ${results.length} hits\n`);
  for (const r of results) {
    console.log(
      `   ${(r.score ?? 0).toFixed(4)}  ${r.metadata?.title || '?'} ` +
        `(${r.metadata?.brand || 'no brand'})`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});