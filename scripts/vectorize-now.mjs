// Vectorize all knowledge_items → Pinecone
// Run with: node scripts/vectorize-now.mjs

import 'dotenv/config';
import Database from 'better-sqlite3';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

const db = new Database('./data/mada.db');

// Get all items that need indexing
const items = db.prepare(`
  SELECT id, title, content, source, source_type, category, metadata, language, status
  FROM knowledge_items
  WHERE content IS NOT NULL AND length(content) > 10
`).all();

console.log(`📦 Found ${items.length} items to vectorize`);

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.Index('mada-knowledge-base');

let done = 0, failed = 0;

async function embedText(text) {
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text }] },
    taskType: 'RETRIEVAL_DOCUMENT',
    outputDimensionality: 768,  // Must match Pinecone index dimension
  });
  return result.embedding?.values || [];
}

for (const item of items) {
  try {
    let meta = {};
    try { meta = JSON.parse(item.metadata || '{}'); } catch {}

    const text = `${item.title}\n\n${(item.content||'').slice(0, 3500)}`;
    const values = await embedText(text);
    
    if (!values || values.length === 0) {
      throw new Error('No embedding values returned');
    }

    const record = {
      id: item.id,
      values: values,
      metadata: {
        source: item.source || '',
        type: item.source_type || 'web',
        title: item.title || '',
        category: item.category || 'general',
        language: item.language || 'vi',
        thumbnailUrl: meta.thumbnailUrl || meta.image_url || '',
        status: item.status || 'draft',
      }
    };

    // Use the new Pinecone SDK format with 'records' key
    await index.upsert({ records: [record] });

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
console.log(`📊 Check http://localhost:3008/api/kb/stats for vector count`);
