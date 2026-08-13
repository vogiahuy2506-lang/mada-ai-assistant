/**
 * MADA AI - Performance Test Suite
 * 
 * Test API response time < 2s và performance metrics
 */

const API_BASE_URL = process.env.API_URL || 'http://localhost:3001';

interface PerformanceResult {
  endpoint: string;
  method: string;
  responseTime: number;
  status: number;
  passed: boolean;
  threshold: number;
}

interface PerformanceReport {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  averageResponseTime: number;
  results: PerformanceResult[];
}

// Threshold: 2000ms = 2 seconds
const RESPONSE_TIME_THRESHOLD = 2000;

// ============== TEST CASES ==============

const PERFORMANCE_TESTS = [
  // Chat API Tests (main endpoint)
  {
    name: 'Chat API - Vietnamese Query',
    endpoint: '/api/chat',
    method: 'POST',
    body: { message: 'Máy trợ thính có những loại nào?', language: 'vi', sessionId: 'perf-test-session' }
  },
  {
    name: 'Chat API - English Query',
    endpoint: '/api/chat',
    method: 'POST',
    body: { message: 'What types of hearing aids are available?', language: 'en', sessionId: 'perf-test-session' }
  },
  {
    name: 'Chat API - Category Filter',
    endpoint: '/api/chat',
    method: 'POST',
    body: { message: 'Tôi cần xe lăn điện', language: 'vi', category: 'mobility', sessionId: 'perf-test-session' }
  },
  
  // Recommendation API Tests (using actual /api/recommend endpoint)
  {
    name: 'Recommendation API - AT Consultation',
    endpoint: '/api/recommend',
    method: 'POST',
    body: { 
      category: 'vision',
      userNeeds: 'screen reader',
      symptoms: ['blindness'],
      language: 'vi'
    }
  },
  {
    name: 'Recommendation API - English',
    endpoint: '/api/recommend',
    method: 'POST',
    body: { 
      category: 'hearing',
      userNeeds: 'hearing aid',
      symptoms: ['deafness'],
      language: 'en'
    }
  },
  
  // Health Check
  {
    name: 'Health Check',
    endpoint: '/api/health',
    method: 'GET'
  },
  
  // Knowledge Base
  {
    name: 'Knowledge Base Stats',
    endpoint: '/api/kb/stats',
    method: 'GET'
  },
  
  // Knowledge Base Categories
  {
    name: 'Knowledge Base Categories',
    endpoint: '/api/kb/categories',
    method: 'GET'
  },
];

// ============== TEST RUNNER ==============

async function runSingleTest(test: typeof PERFORMANCE_TESTS[0]): Promise<PerformanceResult> {
  const startTime = Date.now();
  let status = 0;
  
  try {
    const options: RequestInit = {
      method: test.method,
      headers: { 'Content-Type': 'application/json' },
    };
    
    if (test.body) {
      options.body = JSON.stringify(test.body);
    }
    
    const response = await fetch(`${API_BASE_URL}${test.endpoint}`, options);
    status = response.status;
    
    // Ensure we wait for full response
    await response.json();
    
    const responseTime = Date.now() - startTime;
    
    return {
      endpoint: test.endpoint,
      method: test.method,
      responseTime,
      status,
      passed: responseTime < RESPONSE_TIME_THRESHOLD,
      threshold: RESPONSE_TIME_THRESHOLD,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      endpoint: test.endpoint,
      method: test.method,
      responseTime,
      status,
      passed: false,
      threshold: RESPONSE_TIME_THRESHOLD,
    };
  }
}

export async function runPerformanceTests(): Promise<PerformanceReport> {
  console.log('\n🚀 Starting Performance Tests...');
  console.log(`📊 Target: Response time < ${RESPONSE_TIME_THRESHOLD}ms\n`);
  
  const results: PerformanceResult[] = [];
  
  for (const test of PERFORMANCE_TESTS) {
    const result = await runSingleTest(test);
    results.push(result);
    
    const statusIcon = result.passed ? '✅' : '❌';
    const statusText = result.passed ? 'PASS' : 'FAIL';
    
    console.log(
      `${statusIcon} ${test.name.padEnd(40)} ${result.responseTime.toString().padStart(5)}ms ${statusText}`
    );
  }
  
  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  const averageResponseTime = Math.round(
    results.reduce((acc, r) => acc + r.responseTime, 0) / results.length
  );
  
  return {
    timestamp: new Date().toISOString(),
    totalTests,
    passedTests,
    failedTests: totalTests - passedTests,
    averageResponseTime,
    results,
  };
}

// ============== PRINT REPORT ==============

export function printPerformanceReport(report: PerformanceReport): void {
  const passRate = ((report.passedTests / report.totalTests) * 100).toFixed(1);
  const status = report.failedTests === 0 ? '✅ ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED';
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 MADA AI - PERFORMANCE TEST REPORT');
  console.log('='.repeat(70));
  
  console.log(`\n⏱️  Timestamp: ${report.timestamp}`);
  console.log(`📈 Total Tests: ${report.totalTests}`);
  console.log(`✅ Passed: ${report.passedTests}`);
  console.log(`❌ Failed: ${report.failedTests}`);
  console.log(`📊 Pass Rate: ${passRate}%`);
  console.log(`⚡ Average Response Time: ${report.averageResponseTime}ms`);
  
  console.log('\n' + '-'.repeat(70));
  console.log('📋 DETAILED RESULTS:');
  console.log('-'.repeat(70));
  
  // Group by category
  const chatTests = report.results.filter(r => r.endpoint.includes('/chat'));
  const ragTests = report.results.filter(r => r.endpoint.includes('/rag'));
  const recommendTests = report.results.filter(r => r.endpoint.includes('/recommend'));
  const otherTests = report.results.filter(r => 
    !r.endpoint.includes('/chat') && 
    !r.endpoint.includes('/rag') && 
    !r.endpoint.includes('/recommend')
  );
  
  const printCategory = (name: string, tests: PerformanceResult[]) => {
    if (tests.length === 0) return;
    console.log(`\n${name}:`);
    tests.forEach(t => {
      const icon = t.passed ? '✅' : '❌';
      const bar = '█'.repeat(Math.min(Math.floor(t.responseTime / 100), 20));
      console.log(`  ${icon} ${t.responseTime.toString().padStart(5)}ms | ${bar} ${t.endpoint}`);
    });
  };
  
  printCategory('💬 Chat API', chatTests);
  printCategory('🔍 RAG Search', ragTests);
  printCategory('🎯 Recommendations', recommendTests);
  printCategory('🏥 Other', otherTests);
  
  // Failed tests details
  const failed = report.results.filter(r => !r.passed);
  if (failed.length > 0) {
    console.log('\n' + '!'.repeat(70));
    console.log('⚠️  FAILED TESTS (Response time >= 2000ms):');
    console.log('!'.repeat(70));
    failed.forEach(t => {
      console.log(`  ❌ ${t.endpoint} - ${t.responseTime}ms (threshold: ${t.threshold}ms)`);
    });
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(status);
  console.log('='.repeat(70) + '\n');
}

// ============== BENCHMARK MODE ==============

export async function runBenchmark(iterations: number = 10): Promise<void> {
  console.log(`\n🎯 Running benchmark with ${iterations} iterations...\n`);
  
  const chatTimes: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const result = await runSingleTest(PERFORMANCE_TESTS[0]); // Chat API test
    chatTimes.push(result.responseTime);
    process.stdout.write(`\r  Progress: ${i + 1}/${iterations} - Last: ${result.responseTime}ms`);
  }
  
  console.log('\n\n📊 Chat API Benchmark Results:');
  console.log(`  Min: ${Math.min(...chatTimes)}ms`);
  console.log(`  Max: ${Math.max(...chatTimes)}ms`);
  console.log(`  Avg: ${Math.round(chatTimes.reduce((a, b) => a + b, 0) / chatTimes.length)}ms`);
  console.log(`  Median: ${chatTimes.sort((a, b) => a - b)[Math.floor(chatTimes.length / 2)]}ms`);
}

// ============== MAIN ==============

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--benchmark')) {
    const iterations = parseInt(args[args.indexOf('--benchmark') + 1] || '10');
    await runBenchmark(iterations);
  } else {
    const report = await runPerformanceTests();
    printPerformanceReport(report);
    
    // Exit with error code if any test failed
    process.exit(report.failedTests > 0 ? 1 : 0);
  }
}

main().catch(console.error);
