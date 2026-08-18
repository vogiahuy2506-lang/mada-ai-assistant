/**
 * Milvus Client for MADA AI Assistant
 * 
 * Vector database client using @zilliz/milvus2-sdk-node
 */

// @ts-nocheck

import { MilvusClient, DataType, MetricType, IndexType } from '@zilliz/milvus2-sdk-node';

export const milvusConfig = {
  address: process.env.MILVUS_ADDRESS || 'localhost:19530',
  collectionName: process.env.MILVUS_COLLECTION_NAME || 'mada_knowledge_base',
  dimension: 768,
  indexType: 'IVF_FLAT' as IndexType,
  metricType: 'COSINE' as MetricType,
  indexParams: {
    nlist: 16,  // Smaller for small datasets; auto-scales when collection grows
  },
  searchParams: {
    nprobe: 8,  // Lower for small nlist
  },
  consistencyLevel: 'Eventually' as const,
  autoCreate: process.env.MILVUS_AUTO_CREATE !== 'false',
};

export function isMilvusConfigured(): boolean {
  return !!milvusConfig.address;
}

export class MilvusVectorClient {
  private client: MilvusClient | null = null;
  private collectionName: string;
  private isConnected = false;

  constructor(collectionName?: string) {
    this.collectionName = collectionName || milvusConfig.collectionName;
  }

  async connect(): Promise<boolean> {
    try {
      this.client = new MilvusClient({
        address: milvusConfig.address,
      });
      
      await this.client.connectPromise;
      this.isConnected = true;
      console.log(`✅ Connected to Milvus at ${milvusConfig.address}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Failed to connect to Milvus: ${error.message}`);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.closeConnection();
      this.isConnected = false;
      this.client = null;
    }
  }

  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  private ensureConnected(): void {
    if (!this.client || !this.isConnected) {
      throw new Error('Milvus client not connected. Call connect() first.');
    }
  }

  async hasCollection(): Promise<boolean> {
    this.ensureConnected();

    try {
      const result: any = await this.client!.listCollections();
      // SDK may return { data: string[] } or { collection_names: [] } or array
      let collections: any[] = [];
      if (Array.isArray(result)) {
        collections = result;
      } else if (Array.isArray(result?.data)) {
        collections = Array.isArray(result.data[0]) ? result.data : result.data.map((n: string) => ({ name: n }));
      } else if (Array.isArray(result?.collection_names)) {
        collections = result.collection_names.map((n: string) => ({ name: n }));
      }
      return collections.some((c: any) => {
        const name = typeof c === 'string' ? c : c?.name;
        return name === this.collectionName;
      });
    } catch (error) {
      console.error('Error checking collection:', error);
      return false;
    }
  }

  async createCollection(): Promise<void> {
    this.ensureConnected();

    const exists = await this.hasCollection();
    if (exists) {
      console.log(`📦 Collection ${this.collectionName} already exists`);
      return;
    }

    try {
      // Create schema — use raw int types (DataType.X constants map to ints in this SDK)
      // 21 = VarChar, 101 = FloatVector
      await this.client!.createCollection({
        collection_name: this.collectionName,
        description: 'MADA AI Knowledge Base Vector Collection',
        fields: [
          {
            name: 'id',
            data_type: 21,
            max_length: 256,
            description: 'Document ID',
            is_primary_key: true,
          },
          {
            name: 'content',
            data_type: 21,
            max_length: 65535,
            description: 'Document content chunk',
          },
          {
            name: 'embedding',
            data_type: 101,
            dim: milvusConfig.dimension,
            description: 'Vector embedding',
          },
          {
            name: 'source',
            data_type: 21,
            max_length: 512,
            description: 'Document source',
          },
          {
            name: 'type',
            data_type: 21,
            max_length: 32,
            description: 'Document type (pdf, web, text, etc)',
          },
          {
            name: 'title',
            data_type: 21,
            max_length: 512,
            description: 'Document title',
          },
          {
            name: 'category',
            data_type: 21,
            max_length: 128,
            description: 'AT category',
          },
          // ⭐ MỚI: Filter fields cho 7 bot MADA
          {
            name: 'madaCategory',
            data_type: 21,
            max_length: 64,
            description: 'MADA category slug (e.g. sensory-hearing)',
          },
          {
            name: 'botId',
            data_type: 21,
            max_length: 64,
            description: 'Bot ID (e.g. bot-hearing)',
          },
          {
            name: 'createdAt',
            data_type: 21,
            max_length: 64,
            description: 'Creation timestamp',
          },
        ],
      });

      console.log(`📦 Created collection: ${this.collectionName}`);

      // Create index on embedding field
      await this.createIndex();

    } catch (error: any) {
      console.error(`❌ Failed to create collection: ${error.message}`);
      throw error;
    }
  }

  async createIndex(): Promise<void> {
    this.ensureConnected();

    try {
      await this.client!.createIndex({
        collection_name: this.collectionName,
        field_name: 'embedding',
        index_type: milvusConfig.indexType,
        metric_type: milvusConfig.metricType,
        params: milvusConfig.indexParams,
      });

      console.log(`🔍 Created index on embedding field (${milvusConfig.indexType})`);
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('🔍 Index already exists');
      } else {
        throw error;
      }
    }
  }

  async loadCollection(): Promise<void> {
    this.ensureConnected();

    try {
      await this.client!.loadCollection({
        collection_name: this.collectionName,
      });
      console.log(`📂 Loaded collection: ${this.collectionName}`);
    } catch (error: any) {
      console.error(`❌ Failed to load collection: ${error.message}`);
      throw error;
    }
  }

  async insert(vectors: Array<{
    id: string;
    content: string;
    embedding: number[];
    source: string;
    type: string;
    title?: string;
    category?: string;
    madaCategory?: string;
    botId?: string;
  }>): Promise<number> {
    this.ensureConnected();

    if (vectors.length === 0) return 0;

    try {
      const data = vectors.map(v => ({
        id: v.id,
        content: v.content,
        embedding: v.embedding,
        source: v.source || '',
        type: v.type || 'text',
        title: v.title || '',
        category: v.category || 'general',
        madaCategory: v.madaCategory || '',
        botId: v.botId || '',
        createdAt: new Date().toISOString(),
      }));

      const result = await this.client!.insert({
        collection_name: this.collectionName,
        data,
      });

      console.log(`✅ Inserted ${vectors.length} vectors to Milvus`);
      return vectors.length;
    } catch (error: any) {
      console.error(`❌ Failed to insert vectors: ${error.message}`);
      throw error;
    }
  }

  async search(
    queryEmbedding: number[],
    topK: number = 5,
    filter?: { botId?: string; madaCategory?: string }
  ): Promise<Array<{
    id: string;
    content: string;
    source: string;
    type: string;
    title: string;
    category: string;
    madaCategory?: string;
    botId?: string;
    distance: number;
  }>> {
    this.ensureConnected();

    try {
      // ⭐ MỚI: Build Milvus filter expression
      let expr: string | undefined;
      const conditions: string[] = [];
      if (filter?.botId) {
        conditions.push(`botId == "${filter.botId}"`);
      }
      if (filter?.madaCategory) {
        conditions.push(`madaCategory == "${filter.madaCategory}"`);
      }
      if (conditions.length > 0) {
        expr = conditions.join(' && ');
      }

      const rawResults = await this.client!.search({
        collection_name: this.collectionName,
        vector: queryEmbedding,
        limit: topK,
        output_fields: ['id', 'content', 'source', 'type', 'title', 'category', 'madaCategory', 'botId', 'thumbnailUrl', 'galleryImages'],
        params: milvusConfig.searchParams,
        ...(expr ? { expr } : {}),
      });

      // Handle different SDK response formats
      // New SDK: { results: [...] }  |  Old SDK: [...]
      const resultsArr = Array.isArray(rawResults) ? rawResults : (rawResults?.results || []);

      return resultsArr.map((match: any) => ({
        id: match.id,
        content: match.entity?.content || match.content || '',
        source: match.entity?.source || match.source || '',
        type: match.entity?.type || match.type || 'text',
        title: match.entity?.title || match.title || '',
        category: match.entity?.category || match.category || 'general',
        madaCategory: match.entity?.madaCategory || match.madaCategory || '',
        botId: match.entity?.botId || match.botId || '',
        thumbnailUrl: match.entity?.thumbnailUrl || match.thumbnailUrl || '',
        galleryImages: match.entity?.galleryImages || match.galleryImages || '',
        distance: match.distance || 0,
      }));
    } catch (error: any) {
      console.error(`❌ Search failed: ${error.message}`);
      throw error;
    }
  }

  async deleteById(ids: string[]): Promise<void> {
    this.ensureConnected();

    if (ids.length === 0) return;

    try {
      await this.client!.delete({
        collection_name: this.collectionName,
        pks: ids,
        partition_name: undefined,
      });
      console.log(`🗑️ Deleted ${ids.length} vectors from Milvus`);
    } catch (error: any) {
      console.error(`❌ Failed to delete vectors: ${error.message}`);
      throw error;
    }
  }

  async getCollectionStats(): Promise<{
    rowCount: number;
    indexStatus: string;
    collections: string[];
  }> {
    this.ensureConnected();

    try {
      const stats = await this.client!.getCollectionStats({
        collection_name: this.collectionName,
      });

      return {
        rowCount: stats.row_count || 0,
        indexStatus: 'ready',
        collections: [],
      };
    } catch (error: any) {
      console.error(`❌ Failed to get stats: ${error.message}`);
      return {
        rowCount: 0,
        indexStatus: 'unknown',
        collections: [],
      };
    }
  }

  async flush(): Promise<void> {
    this.ensureConnected();

    try {
      await this.client!.flush({
        collection_names: [this.collectionName],
      });
    } catch (error) {
      console.error('Flush error:', error);
    }
  }

  async dropCollection(): Promise<void> {
    this.ensureConnected();

    try {
      await this.client!.dropCollection({
        collection_name: this.collectionName,
      });
      console.log(`🗑️ Dropped collection: ${this.collectionName}`);
    } catch (error: any) {
      if (!error.message?.includes('not exist')) {
        throw error;
      }
    }
  }
}

// Singleton instance
export const milvusClient = new MilvusVectorClient();
