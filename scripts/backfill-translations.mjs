/**
 * Backfill translations for existing KB products
 * Run with: node scripts/backfill-translations.mjs
 * 
 * Translates all existing kb_products to AR/FR languages
 * using the Gemini API.
 */

import 'dotenv/config';
import Database from 'better-sqlite3';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { translateProduct, detectLanguage } from '../lib/translationService';

const db = new Database('./data/mada.db');

const products = db.prepare(`
  SELECT * FROM kb_products 
  WHERE title_ar = '' OR title_fr = ''
  ORDER BY created_at DESC
`).all();

console.log(`🌐 Found ${products.length} products needing translation`);

const now = new Date().toISOString();
let done = 0, failed = 0;

for (const p of products) {
  try {
    const sourceLang = detectLanguage(p.title + ' ' + (p.description || ''));
    const result = await translateProduct({
      title: p.title,
      description: p.description,
      content: p.content,
      sourceLang,
    });

    // If product already has title_en/description_en, use them for English translation
    const translations = {
      title_en: p.title_en || result.title_en,
      title_ar: result.title_ar,
      title_fr: result.title_fr,
      description_en: p.description_en || result.description_en,
      description_ar: result.description_ar,
      description_fr: result.description_fr,
    };

    db.prepare(`
      UPDATE kb_products SET
        title_en = ?,
        title_ar = ?,
        title_fr = ?,
        description_en = ?,
        description_ar = ?,
        description_fr = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      translations.title_en,
      translations.title_ar,
      translations.title_fr,
      translations.description_en,
      translations.description_ar,
      translations.description_fr,
      now,
      p.id
    );

    // Also update knowledge_items if it exists
    const ki = db.prepare(`
      SELECT id FROM knowledge_items 
      WHERE json_extract(metadata, '$.productId') = ? 
      LIMIT 1
    `).get(p.id);

    if (ki) {
      db.prepare(`
        UPDATE knowledge_items SET
          title_en = ?,
          title_ar = ?,
          title_fr = ?,
          description_en = ?,
          description_ar = ?,
          description_fr = ?,
          content_en = ?,
          content_ar = ?,
          content_fr = ?,
          translated = 1,
          updated_at = ?
        WHERE id = ?
      `).run(
        translations.title_en,
        translations.title_ar,
        translations.title_fr,
        translations.description_en,
        translations.description_ar,
        translations.description_fr,
        `${translations.title_en}\n\n${translations.description_en}`,
        `${translations.title_ar}\n\n${translations.description_ar}`,
        `${translations.title_fr}\n\n${translations.description_fr}`,
        now,
        ki.id
      );
    }

    done++;
    console.log(`  ✅ ${done}/${products.length}: ${p.title.slice(0, 40)}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${p.id}: ${e.message}`);
  }

  // Rate limit
  await new Promise(r => setTimeout(r, 500));
}

console.log(`\n✅ Backfill complete: ${done} done, ${failed} failed`);
console.log(`📊 Check http://localhost:3001/api/kb/stats`);
