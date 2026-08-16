// @ts-nocheck
require('dotenv').config({ path: '../.env' });
const module1 = require('./lib/rag/vectorStore');

(async () => {
  // Force init as Pinecone
  try {
    await module1.vectorStore.initialize();
  } catch (e) {
    console.log('init error:', e.message);
  }

  console.log('activeDbProvider:', module1.vectorStore['activeDbProvider']);
  console.log('isInitialized:', module1.vectorStore['isInitialized']);
  console.log('inMemoryStore.size:', module1.vectorStore['inMemoryStore'].size);

  // Try getStats with full error capture
  try {
    const stats = await module1.vectorStore.getStats();
    console.log('getStats OK:', JSON.stringify(stats));
  } catch (e) {
    console.log('getStats FAIL:');
    console.log('  message:', e.message);
    console.log('  stack:', e.stack?.split('\n').slice(0, 5).join('\n'));
  }
})();