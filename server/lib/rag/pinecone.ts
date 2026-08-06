/**
 * Pinecone Configuration for MADA AI Assistant
 * 
 * Hướng dẫn setup:
 * 1. Đăng ký tài khoản tại https://www.pinecone.io/
 * 2. Tạo Index mới với cấu hình:
 *    - Name: "mada-knowledge-base"
 *    - Dimension: 768 (cho Gemini text-embedding-004)
 *    - Metric: cosine
 * 3. Copy API Key từ Pinecone Dashboard
 * 4. Thêm vào .env: PINECONE_API_KEY=your_key_here
 */

export const pineconeConfig = {
  // Pinecone Index configuration
  indexName: process.env.PINECONE_INDEX_NAME || 'mada-knowledge-base',
  
  // API Key từ Pinecone Dashboard
  apiKey: process.env.PINECONE_API_KEY || '',
  
  // Environment (server region)
  // Ví dụ: us-east-1, eu-west-1, etc.
  environment: process.env.PINECONE_ENVIRONMENT || 'us-east-1',
  
  // Embedding configuration
  embedding: {
    // Dimension phải khớp với Pinecone Index
    // Gemini text-embedding-004: 768 dimensions
    dimension: 768,
    
    // Metric: 'cosine' | 'euclidean' | 'dotproduct'
    metric: 'cosine' as const,
  },
  
  // Cloud provider
  cloud: process.env.PINECONE_CLOUD || 'aws' as 'aws' | 'gcp' | 'azure',
};

// Kiểm tra xem Pinecone đã được cấu hình chưa
export function isPineconeConfigured(): boolean {
  return !!pineconeConfig.apiKey && !!pineconeConfig.indexName;
}
