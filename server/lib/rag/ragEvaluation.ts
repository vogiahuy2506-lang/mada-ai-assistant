/**
 * RAG Evaluation Framework
 * 
 * Metrics:
 * - Precision@K: Proportion of retrieved docs that are relevant
 * - Recall@K: Proportion of relevant docs that are retrieved
 * - NDCG@K: Normalized Discounted Cumulative Gain
 * - MRR: Mean Reciprocal Rank
 * - Hit Rate: Whether at least one relevant doc is in top K
 */

export interface EvalQuery {
  query: string;
  language: 'vi' | 'en' | 'ar' | 'fr';
  expectedTopics: string[];
  relevantDocIds: string[];
}

export interface EvalResult {
  query: string;
  retrievedDocIds: string[];
  expectedDocIds: string[];
  metrics: {
    precisionAt1: number;
    precisionAt3: number;
    precisionAt5: number;
    recallAt1: number;
    recallAt3: number;
    recallAt5: number;
    ndcgAt1: number;
    ndcgAt3: number;
    ndcgAt5: number;
    mrr: number;
    hitRate: number;
  };
}

// Sample evaluation dataset for MADA AT Assistant
export const EVAL_DATASET: EvalQuery[] = [
  {
    query: 'wheelchair for elderly',
    language: 'en',
    expectedTopics: ['wheelchair', 'mobility', 'elderly care'],
    relevantDocIds: [],
  },
  {
    query: 'máy trợ thính giá bao nhiêu',
    language: 'vi',
    expectedTopics: ['hearing aid', 'price', 'assistive device'],
    relevantDocIds: [],
  },
  {
    query: 'software for blind people to read screen',
    language: 'en',
    expectedTopics: ['screen reader', 'JAWS', 'NVDA', 'visual impairment'],
    relevantDocIds: [],
  },
  {
    query: 'thiết bị hỗ trợ người khiếm thị',
    language: 'vi',
    expectedTopics: ['vision aid', 'blind', 'assistive technology'],
    relevantDocIds: [],
  },
  {
    query: 'AAC device for non-verbal child',
    language: 'en',
    expectedTopics: ['AAC', 'communication', 'speech aid', 'child'],
    relevantDocIds: [],
  },
  {
    query: 'appui hearing impaired person',
    language: 'fr',
    expectedTopics: ['hearing aid', 'assistive device'],
    relevantDocIds: [],
  },
  {
    query: 'مثبت للمعاقين حركيا',
    language: 'ar',
    expectedTopics: ['mobility aid', 'wheelchair'],
    relevantDocIds: [],
  },
  {
    query: 'cognitive support tools for dementia patients',
    language: 'en',
    expectedTopics: ['cognitive aid', 'memory', 'dementia'],
    relevantDocIds: [],
  },
];

/**
 * Calculate Precision@K
 */
function precisionAtK(retrieved: string[], relevant: string[], k: number): number {
  if (k === 0) return 0;
  const topK = retrieved.slice(0, k);
  const relevantSet = new Set(relevant);
  const relevantRetrieved = topK.filter(doc => relevantSet.has(doc)).length;
  return relevantRetrieved / k;
}

/**
 * Calculate Recall@K
 */
function recallAtK(retrieved: string[], relevant: string[], k: number): number {
  if (relevant.length === 0) return 0;
  const topK = retrieved.slice(0, k);
  const relevantSet = new Set(relevant);
  const relevantRetrieved = topK.filter(doc => relevantSet.has(doc)).length;
  return relevantRetrieved / relevant.length;
}

/**
 * Calculate DCG (Discounted Cumulative Gain)
 */
function dcgAtK(retrieved: string[], relevant: string[], k: number): number {
  let dcg = 0;
  const relevantSet = new Set(relevant);
  
  for (let i = 0; i < Math.min(k, retrieved.length); i++) {
    const isRelevant = relevantSet.has(retrieved[i]) ? 1 : 0;
    dcg += isRelevant / Math.log2(i + 2); // i+2 because i is 0-indexed
  }
  
  return dcg;
}

/**
 * Calculate NDCG@K (Normalized DCG)
 */
function ndcgAtK(retrieved: string[], relevant: string[], k: number): number {
  const idealRetrieved = [...relevant].sort(() => 0.5 - Math.random()).slice(0, k);
  const actualDCG = dcgAtK(retrieved, relevant, k);
  const idealDCG = dcgAtK(idealRetrieved, relevant, k);
  
  if (idealDCG === 0) return actualDCG === 0 ? 1 : 0;
  return actualDCG / idealDCG;
}

/**
 * Calculate MRR (Mean Reciprocal Rank)
 */
function meanReciprocalRank(retrieved: string[], relevant: string[]): number {
  const relevantSet = new Set(relevant);
  
  for (let i = 0; i < retrieved.length; i++) {
    if (relevantSet.has(retrieved[i])) {
      return 1 / (i + 1);
    }
  }
  
  return 0;
}

/**
 * Calculate Hit Rate at K
 */
function hitRateAtK(retrieved: string[], relevant: string[], k: number): number {
  const topK = retrieved.slice(0, k);
  const relevantSet = new Set(relevant);
  const hasHit = topK.some(doc => relevantSet.has(doc));
  return hasHit ? 1 : 0;
}

/**
 * Evaluate a single query result
 */
export function evaluateQueryResult(retrievedDocIds: string[], expectedDocIds: string[]): EvalResult['metrics'] {
  return {
    precisionAt1: precisionAtK(retrievedDocIds, expectedDocIds, 1),
    precisionAt3: precisionAtK(retrievedDocIds, expectedDocIds, 3),
    precisionAt5: precisionAtK(retrievedDocIds, expectedDocIds, 5),
    recallAt1: recallAtK(retrievedDocIds, expectedDocIds, 1),
    recallAt3: recallAtK(retrievedDocIds, expectedDocIds, 3),
    recallAt5: recallAtK(retrievedDocIds, expectedDocIds, 5),
    ndcgAt1: ndcgAtK(retrievedDocIds, expectedDocIds, 1),
    ndcgAt3: ndcgAtK(retrievedDocIds, expectedDocIds, 3),
    ndcgAt5: ndcgAtK(retrievedDocIds, expectedDocIds, 5),
    mrr: meanReciprocalRank(retrievedDocIds, expectedDocIds),
    hitRate: hitRateAtK(retrievedDocIds, expectedDocIds, 5),
  };
}

/**
 * Aggregate metrics across multiple queries
 */
export function aggregateMetrics(results: EvalResult[]): {
  avgMetrics: EvalResult['metrics'];
  queryCount: number;
  coverageByLanguage: Record<string, number>;
} {
  if (results.length === 0) {
    return {
      avgMetrics: {
        precisionAt1: 0, precisionAt3: 0, precisionAt5: 0,
        recallAt1: 0, recallAt3: 0, recallAt5: 0,
        ndcgAt1: 0, ndcgAt3: 0, ndcgAt5: 0,
        mrr: 0, hitRate: 0,
      },
      queryCount: 0,
      coverageByLanguage: {},
    };
  }

  const metricKeys = Object.keys(results[0].metrics) as (keyof EvalResult['metrics'])[];
  const avgMetrics: any = {};
  
  for (const key of metricKeys) {
    const sum = results.reduce((acc, r) => acc + r.metrics[key], 0);
    avgMetrics[key] = sum / results.length;
  }

  // Coverage by language
  const coverageByLanguage: Record<string, number> = {};
  for (const result of results) {
    const lang = (result as any).language || 'unknown';
    coverageByLanguage[lang] = (coverageByLanguage[lang] || 0) + 1;
  }

  return { avgMetrics, queryCount: results.length, coverageByLanguage };
}

/**
 * RAG Evaluator class for running evaluations
 */
export class RAGEvaluator {
  private dataset: EvalQuery[];

  constructor(dataset?: EvalQuery[]) {
    this.dataset = dataset || EVAL_DATASET;
  }

  /**
   * Run evaluation with a search function
   */
  async evaluate(
    searchFn: (query: string, topK: number) => Promise<Array<{ id: string; content: string; metadata: any }>>
  ): Promise<{
    results: EvalResult[];
    aggregated: ReturnType<typeof aggregateMetrics>;
  }> {
    const results: EvalResult[] = [];

    console.log(`🔬 Starting RAG evaluation with ${this.dataset.length} test queries...`);

    for (const query of this.dataset) {
      try {
        const retrieved = await searchFn(query.query, 10);
        const retrievedDocIds = retrieved.map(d => d.id || d.metadata?.itemId || d.metadata?.source || '');
        
        const metrics = evaluateQueryResult(retrievedDocIds, query.relevantDocIds);
        
        results.push({
          query: query.query,
          retrievedDocIds,
          expectedDocIds: query.relevantDocIds,
          metrics,
        });

        console.log(`  ✅ "${query.query.slice(0, 40)}..." - P@5: ${metrics.precisionAt5.toFixed(2)}, R@5: ${metrics.recallAt5.toFixed(2)}`);
      } catch (error) {
        console.error(`  ❌ Failed to evaluate query "${query.query}":`, error);
      }
    }

    const aggregated = aggregateMetrics(results);
    
    console.log('\n📊 Evaluation Results:');
    console.log(`   Precision@5:  ${(aggregated.avgMetrics.precisionAt5 * 100).toFixed(1)}%`);
    console.log(`   Recall@5:    ${(aggregated.avgMetrics.recallAt5 * 100).toFixed(1)}%`);
    console.log(`   NDCG@5:      ${(aggregated.avgMetrics.ndcgAt5 * 100).toFixed(1)}%`);
    console.log(`   MRR:         ${(aggregated.avgMetrics.mrr * 100).toFixed(1)}%`);
    console.log(`   Hit Rate@5:  ${(aggregated.avgMetrics.hitRate * 100).toFixed(1)}%`);

    return { results, aggregated };
  }
}

// Example usage:
/*
import { RAGEvaluator, EVAL_DATASET } from './ragEvaluation';
import { vectorStore } from './rag/vectorStore';

const evaluator = new RAGEvaluator(EVAL_DATASET);

const results = await evaluator.evaluate(async (query, topK) => {
  const searchResults = await vectorStore.hybridSearch(query, topK);
  return searchResults.map(r => ({
    id: r.metadata?.itemId || r.metadata?.source || '',
    content: r.content,
    metadata: r.metadata,
  }));
});
*/
