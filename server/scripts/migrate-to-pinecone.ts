/**
 * Pinecone Migration Script
 * 
 * Migrate existing knowledge base to Pinecone vector database
 * 
 * Usage:
 *   npm run pinecone:migrate
 *   npx tsx server/scripts/migrate-to-pinecone.ts
 */

// @ts-nocheck

import path from 'path';
import fs from 'fs';
import { Pinecone } from '@pinecone-database/pinecone';
import { pineconeConfig } from '../lib/rag/pinecone';
import { getEmbeddingProvider } from '../lib/rag/vectorStore';

interface DocumentData {
  id: string;
  content: string;
  source: string;
  type: string;
  title?: string;
  category?: string;
  createdAt: string;
}

async function migrateToPinecone() {
  console.log('='.repeat(50));
  console.log('   PINECONE MIGRATION SCRIPT');
  console.log('='.repeat(50));
  console.log();

  // Check if Pinecone is configured
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey || apiKey === 'your_pinecone_api_key_here') {
    console.error('❌ Pinecone is not configured');
    console.log('Please set PINECONE_API_KEY in your .env file');
    console.log('');
    console.log('Get your API key at: https://app.pinecone.io/');
    process.exit(1);
  }

  // Initialize Pinecone
  console.log('🔌 Connecting to Pinecone...');
  const pinecone = new Pinecone({ apiKey });
  
  try {
    // Check if index exists, create if not
    const indexes = await pinecone.listIndexes();
    const indexExists = indexes.indexes?.some(
      (idx: any) => idx.name === pineconeConfig.indexName
    );

    if (!indexExists) {
      console.log(`📦 Creating Pinecone index: ${pineconeConfig.indexName}`);
      await pinecone.createIndex({
        name: pineconeConfig.indexName,
        dimension: pineconeConfig.embedding.dimension,
        metric: pineconeConfig.embedding.metric,
        spec: {
          serverless: {
            cloud: pineconeConfig.cloud,
            region: pineconeConfig.environment,
          },
        },
      });
      
      // Wait for index to be ready
      console.log('⏳ Waiting for index to be ready...');
      await waitForIndex(pinecone);
    }

    const index = pinecone.Index(pineconeConfig.indexName);
    console.log('✅ Connected to Pinecone');
    console.log();

    // Load existing documents
    const dataDir = path.join(process.cwd(), 'data', 'chroma');
    const docsPath = path.join(dataDir, 'documents.json');
    
    let documents: DocumentData[] = [];
    
    if (fs.existsSync(docsPath)) {
      console.log('📂 Loading existing documents from disk...');
      try {
        const data = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));
        documents = data.map((doc: any) => ({
          id: doc.id,
          content: doc.content,
          source: doc.metadata?.source || doc.source || '',
          type: doc.metadata?.type || doc.type || 'text',
          title: doc.metadata?.title || doc.title || '',
          category: doc.metadata?.category || doc.category || 'general',
          createdAt: doc.metadata?.createdAt || doc.createdAt || new Date().toISOString(),
        }));
        console.log(`   Loaded ${documents.length} documents from disk`);
      } catch (err) {
        console.error('   Failed to load documents:', err);
      }
    }

    // Load seed knowledge if no documents
    if (documents.length === 0) {
      console.log('📚 No documents found. Loading seed knowledge...');
      documents = await loadSeedKnowledge();
    }

    if (documents.length === 0) {
      console.log('⚠️  No documents to migrate');
      console.log('   Run the app first to generate some data:');
      console.log('   npm run server');
      console.log('   Then try migration again');
    } else {
      console.log();
      console.log(`📊 Starting migration of ${documents.length} documents...`);
      console.log();

      // Get embedding provider
      const embeddingProvider = getEmbeddingProvider();
      console.log(`   Using embedding provider: ${embeddingProvider.name}`);
      console.log(`   Dimension: ${embeddingProvider.dimension}`);
      console.log();

      // Migrate in batches
      const batchSize = 100;
      let migrated = 0;
      let failed = 0;

      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(documents.length / batchSize);

        process.stdout.write(`   Batch ${batchNum}/${totalBatches}: Migrating ${batch.length} documents... `);

        try {
          // Create embeddings
          const embeddings = await embeddingProvider.embedBatch(
            batch.map(d => d.content)
          );

          // Prepare vectors
          const vectors = batch.map((doc, idx) => ({
            id: doc.id,
            values: embeddings[idx],
            metadata: {
              content: doc.content.slice(0, 2000), // Pinecone metadata limit
              source: doc.source,
              type: doc.type,
              title: doc.title || '',
              category: doc.category || 'general',
              createdAt: doc.createdAt,
            },
          }));

          // Upsert to Pinecone
          await index.upsert(vectors);
          
          migrated += batch.length;
          console.log(`✅ Done (${migrated}/${documents.length})`);
        } catch (err: any) {
          failed += batch.length;
          console.log(`❌ Failed (${failed} errors)`);
          console.error(`   Error: ${err.message}`);
        }
      }

      console.log();
      console.log('-'.repeat(50));
      console.log('📊 MIGRATION SUMMARY');
      console.log('-'.repeat(50));
      console.log(`   Total documents: ${documents.length}`);
      console.log(`   ✅ Migrated: ${migrated}`);
      console.log(`   ❌ Failed: ${failed}`);
      console.log();

      // Get stats
      const stats = await index.describeIndexStats();
      console.log('-'.repeat(50));
      console.log('📈 PINECONE STATS');
      console.log('-'.repeat(50));
      console.log(`   Index: ${pineconeConfig.indexName}`);
      console.log(`   Total vectors: ${stats.totalRecordCount}`);
      console.log(`   Dimension: ${pineconeConfig.embedding.dimension}`);
      console.log(`   Metric: ${pineconeConfig.embedding.metric}`);
      console.log();
    }

    console.log('✅ Migration completed!');
    console.log();

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

async function waitForIndex(pinecone: Pinecone, maxWaitMs = 120000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const indexes = await pinecone.listIndexes();
    const index = indexes.indexes?.find((idx: any) => idx.name === pineconeConfig.indexName);
    if (index?.status?.ready) {
      return;
    }
    process.stdout.write('.');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw new Error('Timeout waiting for Pinecone index creation');
}

async function loadSeedKnowledge(): Promise<DocumentData[]> {
  // Simple seed data for migration
  const seedData = [
    {
      id: 'seed_1',
      content: 'Công nghệ hỗ trợ người khuyết tật (Assistive Technology) là các thiết bị, phần mềm hoặc hệ thống giúp người khuyết tật thực hiện các hoạt động hàng ngày một cách độc lập hơn.',
      source: 'seed:at_basics',
      type: 'text',
      title: 'Giới thiệu về Công nghệ Hỗ trợ',
      category: 'general',
    },
    {
      id: 'seed_2',
      content: 'JAWS (Job Access With Speech) là phần mềm đọc màn hình phổ biến nhất dành cho người khiếm thị. JAWS hỗ trợ nhiều ngôn ngữ bao gồm tiếng Việt.',
      source: 'sample:JAWS',
      type: 'text',
      title: 'Phần mềm đọc màn hình JAWS',
      category: 'vision',
    },
    {
      id: 'seed_3',
      content: 'NVDA (NonVisual Desktop Access) là phần mềm đọc màn hình mã nguồn mở và miễn phí dành cho người khiếm thị trên hệ điều hành Windows.',
      source: 'sample:NVDA',
      type: 'text',
      title: 'Phần mềm đọc màn hình NVDA',
      category: 'vision',
    },
    {
      id: 'seed_4',
      content: 'WCAG 2.1 (Web Content Accessibility Guidelines) là hướng dẫn quốc tế về tiếp cận nội dung web dành cho người khuyết tật. WCAG được phát triển bởi W3C.',
      source: 'sample:WCAG',
      type: 'text',
      title: 'Tiêu chuẩn WCAG 2.1',
      category: 'web_accessibility',
    },
    {
      id: 'seed_5',
      content: 'Xe lăn điện là thiết bị hỗ trợ di chuyển cho người khuyết tật vận động. Xe lăn điện hiện đại có thể điều khiển bằng joystick, điện thoại thông minh, hoặc cử chỉ đầu/mắt.',
      source: 'sample:wheelchair',
      type: 'text',
      title: 'Xe lăn điện',
      category: 'mobility',
    },
  ];

  return seedData.map(doc => ({
    ...doc,
    createdAt: new Date().toISOString(),
  }));
}

// Run migration
migrateToPinecone().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
