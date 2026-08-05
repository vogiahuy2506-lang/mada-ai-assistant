/**
 * MADA AI - Run QA Tests
 * 
 * Script để chạy RAG Accuracy Tests
 */

import { QA_TEST_SUITE, runRAGAccuracyTest, printTestReport } from './qa-test-suite';

const API_URL = process.env.API_URL || 'http://localhost:3001';

async function queryRAG(question: string) {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      message: question,
      language: 'vi'
    }),
  });
  
  const data = await response.json();
  return {
    response: data.data?.answer || '',
    confidence: data.data?.confidence || 0,
    sources: data.data?.sources || [],
  };
}

async function main() {
  console.log('\n🚀 Starting MADA AI RAG Accuracy Tests...\n');
  console.log(`📡 API URL: ${API_URL}`);
  console.log(`📝 Total Questions: ${QA_TEST_SUITE.length}`);
  console.log('');
  
  const report = await runRAGAccuracyTest(queryRAG);
  printTestReport(report);
  
  // Save report to file
  const fs = await import('fs');
  const reportPath = `./data/test-reports/report-${Date.now()}.json`;
  fs.mkdirSync('./data/test-reports', { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Report saved to: ${reportPath}`);
}

main().catch(console.error);
