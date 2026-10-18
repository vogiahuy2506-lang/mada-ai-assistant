/**
 * Sync script để chạy trên production
 * Copy file production-sync.json lên VPS trước, sau đó chạy script này
 * 
 * Cách dùng:
 * 1. Copy production-sync.json lên VPS (thư mục project)
 * 2. cd ~/mada-ai-assistant
 * 3. npm run sync-data
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'mada.db');
const SYNC_FILE = path.join(process.cwd(), 'production-sync.json');

console.log('🔄 MADA AI Data Sync Script');
console.log('============================\n');

// Check if sync file exists
if (!fs.existsSync(SYNC_FILE)) {
  console.error('❌ Error: production-sync.json not found!');
  console.log('   Copy the file from local machine to VPS first.');
  console.log('   Path expected:', SYNC_FILE);
  process.exit(1);
}

// Load sync data
const syncData = JSON.parse(fs.readFileSync(SYNC_FILE, 'utf8'));

console.log('📊 Data to sync:');
console.log('   - Products:', syncData.products?.length || 0);
console.log('   - Categories:', syncData.categories?.length || 0);
console.log('   - Knowledge Items:', syncData.knowledge_items?.length || 0);
console.log('   - Admin Agents:', syncData.admin_agents?.length || 0);
console.log('   - Admin Prompts:', syncData.admin_prompts?.length || 0);
console.log('   - Prompt Templates:', syncData.prompt_templates?.length || 0);
console.log('   - Permissions:', syncData.permissions?.length || 0);
console.log('   - Suggested Questions:', syncData.suggested_questions?.length || 0);
console.log('');

// Ensure data directory exists
fs.mkdirSync(DATA_DIR, { recursive: true });

// Open database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('📁 Database:', DB_PATH);
console.log('');

// Helper function to safely insert or update
function upsert(table, data, primaryKey = 'id') {
  if (!data || data.length === 0) return 0;
  
  const columns = Object.keys(data[0]);
  const placeholders = columns.map(() => '?').join(', ');
  const updateCols = columns.filter(c => c !== primaryKey).map(c => c + ' = excluded.' + c).join(', ');
  
  let count = 0;
  const insertStmt = db.prepare(`
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT(${primaryKey}) DO UPDATE SET ${updateCols}
  `);
  
  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      const values = columns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return null;
        if (typeof val === 'object') return JSON.stringify(val);
        return val;
      });
      try {
        insertStmt.run(...values);
        count++;
      } catch (e) {
        console.warn(`   ⚠️ Error inserting into ${table}:`, e.message);
      }
    }
  });
  
  insertMany(data);
  return count;
}

// Sync each table
const results = [];

try {
  // 1. Sync Categories
  if (syncData.categories?.length > 0) {
    const count = upsert('kb_categories', syncData.categories);
    results.push({ table: 'kb_categories', count });
    console.log(`✅ kb_categories: ${count} rows`);
  }
  
  // 2. Sync Products
  if (syncData.products?.length > 0) {
    const count = upsert('kb_products', syncData.products);
    results.push({ table: 'kb_products', count });
    console.log(`✅ kb_products: ${count} rows`);
  }
  
  // 3. Sync Knowledge Items
  if (syncData.knowledge_items?.length > 0) {
    const count = upsert('knowledge_items', syncData.knowledge_items);
    results.push({ table: 'knowledge_items', count });
    console.log(`✅ knowledge_items: ${count} rows`);
  }
  
  // 4. Sync Admin Agents
  if (syncData.admin_agents?.length > 0) {
    const count = upsert('admin_agents', syncData.admin_agents);
    results.push({ table: 'admin_agents', count });
    console.log(`✅ admin_agents: ${count} rows`);
  }
  
  // 5. Sync Admin Prompts
  if (syncData.admin_prompts?.length > 0) {
    const count = upsert('admin_prompts', syncData.admin_prompts);
    results.push({ table: 'admin_prompts', count });
    console.log(`✅ admin_prompts: ${count} rows`);
  }
  
  // 6. Sync Prompt Templates
  if (syncData.prompt_templates?.length > 0) {
    const count = upsert('prompt_templates', syncData.prompt_templates);
    results.push({ table: 'prompt_templates', count });
    console.log(`✅ prompt_templates: ${count} rows`);
  }
  
  // 7. Sync Permissions
  if (syncData.permissions?.length > 0) {
    const count = upsert('permissions', syncData.permissions);
    results.push({ table: 'permissions', count });
    console.log(`✅ permissions: ${count} rows`);
  }
  
  // 8. Sync Suggested Questions
  if (syncData.suggested_questions?.length > 0) {
    const count = upsert('suggested_questions', syncData.suggested_questions);
    results.push({ table: 'suggested_questions', count });
    console.log(`✅ suggested_questions: ${count} rows`);
  }
  
  console.log('\n🎉 Sync completed successfully!');
  
} catch (e) {
  console.error('\n❌ Sync error:', e.message);
  process.exit(1);
} finally {
  db.close();
}

// Print summary
console.log('\n📋 Summary:');
console.log('   Total tables synced:', results.length);
console.log('   Total rows synced:', results.reduce((sum, r) => sum + r.count, 0));
console.log('\n🔄 Restart PM2 to apply changes:');
console.log('   pm2 restart mada-ai');
