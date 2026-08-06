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
    nlist: 1024,
  },
  searchParams: {
    nprobe: 20,
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
      const collections = await this.client!.listCollections();
      const collectionNames = collections.map((c: any) => c.name);
      return collectionNames.includes(this.collectionName);
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
      // Create schema
      await this.client!.createCollection({
        collection_name: this.collectionName,
        description: 'MADA AI Knowledge Base Vector Collection',
        fields: [
          {
            name: 'id',
            data_type: DataType.VarChar,
            max_length: 256,
            description: 'Document ID',
            is_primary_key: true,
          },
          {
            name: 'content',
            data_type: DataType.VarChar,
            max_length: 65535,
            description: 'Document content chunk',
          },
          {
            name: 'embedding',
            data_type: DataType.FloatVector,
            dimension: milvusConfig.dimension,
            description: 'Vector embedding',
          },
          {
            name: 'source',
            data_type: DataType.VarChar,
            max_length: 512,
            description: 'Document source',
          },
          {
            name: 'type',
            data_type: DataType.VarChar,
            max_length: 32,
            description: 'Document type (pdf, web, text, etc)',
          },
          {
            name: 'title',
            data_type: DataType.VarChar,
            max_length: 512,
            description: 'Document title',
          },
          {
            name: 'category',
            data_type: DataType.VarChar,
            max_length: 128,
            description: 'AT category',
          },
          {
            name: 'createdAt',
            data_type: DataType.VarChar,
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
    topK: number = 5
  ): Promise<Array<{
    id: string;
    content: string;
    source: string;
    type: string;
    title: string;
    category: string;
    distance: number;
  }>> {
    this.ensureConnected();

    try {
      const results = await this.client!.search({
        collection_name: this.collectionName,
        vector: queryEmbedding,
        limit: topK,
        output_fields: ['id', 'content', 'source', 'type', 'title', 'category'],
        params: milvusConfig.searchParams,
      });

      return results.map((match: any) => ({
        id: match.id,
        content: match.entity?.content || '',
        source: match.entity?.source || '',
        type: match.entity?.type || 'text',
        title: match.entity?.title || '',
        category: match.entity?.category || 'general',
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
