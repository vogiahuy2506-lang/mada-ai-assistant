// Vectorize all knowledge_items → Pinecone
// Run with: node scripts/vectorize-now.mjs

import 'dotenv/config';
import Database from 'better-sqlite3';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

const db = new Database('./data/mada.db');

const items = db.prepare(`
  SELECT id, title, content, source, source_type, category, metadata, language, status
  FROM knowledge_items
  WHERE indexed = 0 AND content IS NOT NULL AND length(content) > 10
`).all();

console.log(`📦 Found ${items.length} items to vectorize`);

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.Index('mada-knowledge-base');

let done = 0, failed = 0;

for (const item of items) {
  try {
    let meta = {};
    try { meta = JSON.parse(item.metadata || '{}'); } catch {}

    const text = `${item.title}\n\n${(item.content||'').slice(0, 3500)}`;

    const result = await model.embedContent({
      content: { role: 'user', parts: [{ text }] },
      outputDimensionality: 768,
    });
    const values = result.embedding?.values;
    if (!values) throw new Error('No embedding values');

    await index.upsert([{
      id: item.id,
      values,
      metadata: {
        source: item.source || '',
        type: item.source_type || 'web',
        title: item.title || '',
        category: item.category || 'general',
        language: item.language || 'vi',
        thumbnailUrl: meta.thumbnailUrl || '',
        status: item.status || 'draft',
      }
    }]);

    // Mark as indexed
    db.prepare('UPDATE knowledge_items SET indexed = 1, indexed_at = ? WHERE id = ?')
      .run(new Date().toISOString(), item.id);

    done++;
    console.log(`  ✅ ${done}/${items.length}: ${item.title.slice(0, 50)}`);
  } catch(e) {
    failed++;
    console.log(`  ❌ ${item.id}: ${e.message.slice(0, 100)}`);
  }

  // Rate limit for Gemini API
  await new Promise(r => setTimeout(r, 500));
}

console.log(`\n✅ Done: ${done} success, ${failed} failed`);
console.log(`📊 Check http://localhost:3001/api/kb/stats for vector count`);
