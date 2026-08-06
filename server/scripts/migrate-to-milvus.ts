/**
 * Milvus Migration Script
 * 
 * Migrate existing knowledge base to Milvus vector database
 * 
 * Usage:
 *   npm run milvus:migrate
 *   npx tsx server/scripts/migrate-to-milvus.ts
 */

import path from 'path';
import fs from 'fs';
import { milvusClient, milvusConfig, isMilvusConfigured } from '../lib/rag/milvus';
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

async function migrateToMilvus() {
  console.log('='.repeat(50));
  console.log('   MILVUS MIGRATION SCRIPT');
  console.log('='.repeat(50));
  console.log();

  // Check if Milvus is configured
  if (!isMilvusConfigured()) {
    console.error('❌ Milvus is not configured');
    console.log('Please set MILVUS_ADDRESS in your .env file');
    console.log('Or run: ./scripts/setup-milvus.sh start');
    process.exit(1);
  }

  // Connect to Milvus
  console.log(`🔌 Connecting to Milvus at ${milvusConfig.address}...`);
  const connected = await milvusClient.connect();
  
  if (!connected) {
    console.error('❌ Failed to connect to Milvus');
    console.log('Make sure Milvus Docker is running:');
    console.log('  ./scripts/setup-milvus.sh status');
    process.exit(1);
  }

  console.log('✅ Connected to Milvus');
  console.log();

  // Drop existing collection if requested
  const args = process.argv.slice(2);
  if (args.includes('--force')) {
    console.log('🗑️  Dropping existing collection (--force flag detected)...');
    await milvusClient.dropCollection();
  }

  // Create collection
  console.log('📦 Creating collection...');
  await milvusClient.createCollection();
  await milvusClient.loadCollection();
  console.log('✅ Collection ready');
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
    const batchSize = 50;
    let migrated = 0;
    let failed = 0;

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(documents.length / batchSize);

      process.stdout.write(`   Batch ${batchNum}/${totalBatches}: Migrating ${batch.length} documents... `);

      try {
        // Create embeddings
        const vectors = await Promise.all(
          batch.map(async (doc) => {
            const embedding = await embeddingProvider.embed(doc.content);
            return {
              id: doc.id,
              content: doc.content.slice(0, 10000), // Truncate for Milvus
              embedding,
              source: doc.source,
              type: doc.type,
              title: doc.title || '',
              category: doc.category || 'general',
            };
          })
        );

        // Insert to Milvus
        await milvusClient.insert(vectors);
        
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

    // Flush to ensure data is persisted
    console.log('💾 Flushing data to Milvus...');
    await milvusClient.flush();
    console.log('✅ Data flushed');
    console.log();

    // Get stats
    const stats = await milvusClient.getCollectionStats();
    console.log('-'.repeat(50));
    console.log('📈 MILVUS STATS');
    console.log('-'.repeat(50));
    console.log(`   Collection: ${milvusConfig.collectionName}`);
    console.log(`   Documents: ${stats.rowCount}`);
    console.log(`   Index: ${milvusConfig.indexType}`);
    console.log(`   Metric: ${milvusConfig.metricType}`);
    console.log();
  }

  // Cleanup
  console.log('🔌 Disconnecting from Milvus...');
  await milvusClient.disconnect();
  console.log('✅ Done!');
  console.log();
  console.log('='.repeat(50));
  console.log('   MIGRATION COMPLETED');
  console.log('='.repeat(50));
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
migrateToMilvus().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
