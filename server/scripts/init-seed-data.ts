/**
 * Seed Data Initializer
 *
 * Load seed products vào Vector DB khi server khởi động
 * Chạy: npx tsx server/scripts/init-seed-data.ts
 */

import 'dotenv/config';
import { SEED_PRODUCTS } from '../lib/data/seed-products';
import { vectorStore } from '../lib/rag/vectorStore';
import type { Document } from '../lib/rag/vectorStore';

async function initSeedData() {
  console.log('🚀 Seed Data Initializer');
  console.log('='.repeat(50));
  console.log(`📦 Found ${SEED_PRODUCTS.length} products in seed data\n`);

  try {
    // Initialize vector store
    console.log('🔌 Connecting to Vector DB...');
    await vectorStore.initialize();

    // 🔥 CLEAR EXISTING DATA if CLEAR=true
    if (process.env.CLEAR === 'true') {
      console.log('⚠️  CLEAR=true → Deleting ALL existing documents...');
      await vectorStore.clear();
      console.log('✅ Vector store cleared!\n');
    }
    console.log('✅ Vector DB connected\n');

    // Convert seed products to documents
    const documents: Document[] = SEED_PRODUCTS.map((product) => {
      // Build rich content for embedding
      const content = buildProductContent(product);
      
      return {
        id: `seed-${product.id}`,
        content,
        metadata: {
          source: product.sourceUrl,
          type: 'web',
          title: product.name.vi,
          category: product.category,
          madaCategory: product.category,
          botId: getBotIdForCategory(product.category),
          itemId: product.id,
          postId: product.madaId,
          slug: product.madaId,
          brand: product.manufacturer?.vi || '',
          tags: product.keywords,
          createdAt: new Date().toISOString(),
        },
      };
    });

    // Add to vector store
    console.log(`📤 Adding ${documents.length} documents to Vector DB...`);
    await vectorStore.addDocuments(documents);

    // Stats
    const stats = await vectorStore.getStats();
    console.log('\n📊 Vector DB Stats:', stats);

    console.log('\n✅ Seed data initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Init failed:', error);
    process.exit(1);
  }
}

function buildProductContent(product: typeof SEED_PRODUCTS[0]): string {
  const parts: string[] = [];

  parts.push(`# ${product.name.vi} / ${product.name.en}`);
  parts.push(`**Category:** ${product.subcategory}`);
  if (product.manufacturer) {
    parts.push(`**Manufacturer:** ${product.manufacturer.vi} / ${product.manufacturer.en}`);
  }
  if (product.operatingSystem) {
    parts.push(`**Operating System:** ${product.operatingSystem}`);
  }

  parts.push('\n## Description / Mô tả');
  parts.push(product.description.vi);
  parts.push(product.description.en);

  if (product.features.length > 0) {
    parts.push('\n## Features / Tính năng');
    product.features.forEach(f => parts.push(`- ${f}`));
  }

  if (product.useCases.length > 0) {
    parts.push('\n## Use Cases / Trường hợp sử dụng');
    product.useCases.forEach(uc => parts.push(`- ${uc}`));
  }

  if (product.targetSymptoms.length > 0) {
    parts.push('\n## Target Symptoms / Triệu chứng');
    parts.push('Phù hợp cho người có:');
    product.targetSymptoms.forEach(s => parts.push(`- ${s}`));
  }

  if (product.isoCodes.length > 0) {
    parts.push(`\n## Standards / Tiêu chuẩn`);
    parts.push(product.isoCodes.join(', '));
  }

  if (product.keywords.length > 0) {
    parts.push(`\n## Keywords`);
    parts.push(product.keywords.join(', '));
  }

  parts.push(`\n**Source:** ${product.sourceUrl}`);

  return parts.join('\n');
}

function getBotIdForCategory(category: string): string {
  const mapping: Record<string, string> = {
    'sensory-hearing': 'bot-hearing',
    'sensory-vision': 'bot-vision',
    'voice-and-speech': 'bot-speech',
    'mental-cognitive': 'bot-cognitive',
    'neuromusculoskeletal': 'bot-neuro',
    'mobility-transportation': 'bot-mobility',
    'regulatory-standards': 'bot-regulatory',
  };
  return mapping[category] || 'bot-general';
}

// Run
initSeedData();
