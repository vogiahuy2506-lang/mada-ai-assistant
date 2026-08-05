/**
 * MADA AI - RAG Accuracy Testing Suite
 * 
 * Bộ câu hỏi mẫu test QA cho 7 danh mục AT
 * và script kiểm tra độ chính xác RAG
 */

export interface TestQuestion {
  id: string;
  category: string;
  question: string;
  questionEn: string;
  expectedKeywords: string[];
  expectedStandards: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface TestResult {
  questionId: string;
  passed: boolean;
  confidence: number;
  response: string;
  keywordsFound: string[];
  keywordsMissed: string[];
  standardsFound: string[];
  sourcesRetrieved: number;
  responseTime: number;
  feedback?: string;
}

// ============== BỘ CÂU HỎI TEST 7 DANH MỤC ==============

export const QA_TEST_SUITE: TestQuestion[] = [
  // ===== VISION (Thị giác) =====
  {
    id: 'vision-001',
    category: 'vision',
    question: 'Phần mềm đọc màn hình nào tốt nhất cho người khiếm thị?',
    questionEn: 'What is the best screen reader for blind users?',
    expectedKeywords: ['JAWS', 'NVDA', 'VoiceOver', 'screen reader'],
    expectedStandards: ['ISO 9999', 'WCAG'],
    difficulty: 'easy',
  },
  {
    id: 'vision-002',
    category: 'vision',
    question: 'So sánh JAWS và NVDA về giá cả và tính năng',
    questionEn: 'Compare JAWS vs NVDA on price and features',
    expectedKeywords: ['JAWS', 'NVDA', 'free', 'commercial', 'Windows'],
    expectedStandards: ['ISO 9999:24.09'],
    difficulty: 'medium',
  },
  {
    id: 'vision-003',
    category: 'vision',
    question: 'Tiêu chuẩn ISO 9999 cho thiết bị hỗ trợ thị giác là gì?',
    questionEn: 'What is ISO 9999 standard for vision aids?',
    expectedKeywords: ['24.09', '24.12', 'Braille', 'ISO'],
    expectedStandards: ['ISO 9999', 'EN 1332'],
    difficulty: 'hard',
  },
  {
    id: 'vision-004',
    category: 'vision',
    question: 'OrCam MyEye có những tính năng gì?',
    questionEn: 'What are the features of OrCam MyEye?',
    expectedKeywords: ['OrCam', 'camera', 'face recognition', 'text reading', 'Israel'],
    expectedStandards: ['ISO 9999'],
    difficulty: 'medium',
  },
  {
    id: 'vision-005',
    category: 'vision',
    question: 'Màn hình Braille giá bao nhiêu và hoạt động ra sao?',
    questionEn: 'How much does a Braille display cost and how does it work?',
    expectedKeywords: ['Braille', 'display', 'dots', 'cells', 'USB', 'Bluetooth'],
    expectedStandards: ['ISO 9999:24.12'],
    difficulty: 'medium',
  },

  // ===== HEARING (Thính giác) =====
  {
    id: 'hearing-001',
    category: 'hearing',
    question: 'Máy trợ thính có những loại nào?',
    questionEn: 'What types of hearing aids are available?',
    expectedKeywords: ['BTE', 'ITE', 'ITC', 'CIC', 'behind the ear', 'in the ear'],
    expectedStandards: ['ISO 9999:22.06'],
    difficulty: 'easy',
  },
  {
    id: 'hearing-002',
    category: 'hearing',
    question: 'Hệ thống FM cho người điếc hoạt động như thế nào?',
    questionEn: 'How does FM system work for deaf people?',
    expectedKeywords: ['FM', 'microphone', 'transmitter', 'receiver', 'Roger'],
    expectedStandards: ['IEC 60118-4', 'ISO 9999:22.09'],
    difficulty: 'medium',
  },
  {
    id: 'hearing-003',
    category: 'hearing',
    question: 'Phân biệt Closed Caption và Open Caption',
    questionEn: 'Difference between Closed Caption and Open Caption',
    expectedKeywords: ['CC', 'closed', 'open', 'subtitle', 'caption'],
    expectedStandards: ['WCAG', 'EIA-608'],
    difficulty: 'easy',
  },
  {
    id: 'hearing-004',
    category: 'hearing',
    question: 'Video Relay Service (VRS) là gì và ai nên sử dụng?',
    questionEn: 'What is VRS and who should use it?',
    expectedKeywords: ['VRS', 'video', 'interpreter', 'sign language', 'ASL'],
    expectedStandards: ['ADA'],
    difficulty: 'medium',
  },
  {
    id: 'hearing-005',
    category: 'hearing',
    question: 'Thiết bị báo động cho người điếc bao gồm những gì?',
    questionEn: 'What alerting devices are available for deaf people?',
    expectedKeywords: ['alert', 'light', 'vibration', 'smoke', 'doorbell'],
    expectedStandards: ['ISO 9999:22.12'],
    difficulty: 'easy',
  },

  // ===== MOBILITY (Vận động) =====
  {
    id: 'mobility-001',
    category: 'mobility',
    question: 'Xe lăn điện có những loại nào?',
    questionEn: 'What types of electric wheelchairs are there?',
    expectedKeywords: ['electric', 'wheelchair', 'joystick', 'power', 'battery'],
    expectedStandards: ['ISO 9999:12.21', 'ISO 7176'],
    difficulty: 'easy',
  },
  {
    id: 'mobility-002',
    category: 'mobility',
    question: 'Xe lăn leo cầu thang hoạt động ra sao?',
    questionEn: 'How do stair climbing wheelchairs work?',
    expectedKeywords: ['stair', 'climbing', 'Scalamobil', 'iBOT', 'tracks'],
    expectedStandards: ['ISO 9999:12.21.15'],
    difficulty: 'medium',
  },
  {
    id: 'mobility-003',
    category: 'mobility',
    question: 'Nạng nách và nạng quả khác nhau thế nào?',
    questionEn: 'Difference between axillary crutches and forearm crutches',
    expectedKeywords: ['axillary', 'forearm', 'crutch', 'underarm', 'cane'],
    expectedStandards: ['ISO 9999:12.03'],
    difficulty: 'easy',
  },
  {
    id: 'mobility-004',
    category: 'mobility',
    question: 'Thiết bị giả (prosthetics) bao gồm những loại nào?',
    questionEn: 'What types of prosthetics are available?',
    expectedKeywords: ['prosthetic', 'amputation', 'myoelectric', 'cosmetic', 'body-powered'],
    expectedStandards: ['ISO 9999:24.06', 'ISO 10328'],
    difficulty: 'medium',
  },
  {
    id: 'mobility-005',
    category: 'mobility',
    question: 'Microprocessor Knee hoạt động như thế nào?',
    questionEn: 'How does microprocessor knee work?',
    expectedKeywords: ['microprocessor', 'knee', 'C-Leg', 'Rheo', 'Ottobock'],
    expectedStandards: ['ISO 9999'],
    difficulty: 'hard',
  },

  // ===== COGNITION (Nhận thức) =====
  {
    id: 'cognition-001',
    category: 'cognition',
    question: 'Thiết bị hỗ trợ trí nhớ cho người già bao gồm những gì?',
    questionEn: 'What memory aids are available for elderly?',
    expectedKeywords: ['memory', 'reminder', 'calendar', 'medication', 'alarm'],
    expectedStandards: ['ISO 9999:05.15'],
    difficulty: 'easy',
  },
  {
    id: 'cognition-002',
    category: 'cognition',
    question: 'AAC là gì và có những loại nào?',
    questionEn: 'What is AAC and what types are there?',
    expectedKeywords: ['AAC', 'augmentative', 'alternative', 'communication', 'SGD'],
    expectedStandards: ['ISO 9999:05.15.06'],
    difficulty: 'medium',
  },
  {
    id: 'cognition-003',
    category: 'cognition',
    question: 'PECS hoạt động như thế nào?',
    questionEn: 'How does PECS work?',
    expectedKeywords: ['PECS', 'Picture Exchange', 'communication', 'picture', 'symbol'],
    expectedStandards: ['ISO 9999'],
    difficulty: 'medium',
  },
  {
    id: 'cognition-004',
    category: 'cognition',
    question: 'Thiết bị hỗ trợ người bị TBI (chấn thương sọ não)',
    questionEn: 'AT devices for TBI (Traumatic Brain Injury) patients',
    expectedKeywords: ['TBI', 'traumatic', 'brain injury', 'cognitive', 'memory'],
    expectedStandards: ['ISO 9999:05'],
    difficulty: 'hard',
  },
  {
    id: 'cognition-005',
    category: 'cognition',
    question: 'So sánh Tobii Dynavox và Prentke Romich',
    questionEn: 'Compare Tobii Dynavox vs Prentke Romich',
    expectedKeywords: ['Tobii', 'Dynavox', 'Prentke', 'Romich', 'eye-tracking'],
    expectedStandards: ['ISO 9999'],
    difficulty: 'hard',
  },

  // ===== COMMUNICATION (Giao tiếp) =====
  {
    id: 'communication-001',
    category: 'communication',
    question: 'Thiết bị phát âm (SGD) là gì?',
    questionEn: 'What is a Speech Generating Device (SGD)?',
    expectedKeywords: ['SGD', 'speech generating', 'voice output', 'communication'],
    expectedStandards: ['ISO 9999:05.15.06'],
    difficulty: 'easy',
  },
  {
    id: 'communication-002',
    category: 'communication',
    question: 'Ứng dụng AAC trên điện thoại nào tốt nhất?',
    questionEn: 'What are the best AAC apps for smartphones?',
    expectedKeywords: ['AAC', 'app', 'Proloquo2Go', 'TouchChat', 'iOS', 'Android'],
    expectedStandards: ['ISO 9999'],
    difficulty: 'easy',
  },
  {
    id: 'communication-003',
    category: 'communication',
    question: 'Bảng giao tiếp bằng hình ảnh hoạt động ra sao?',
    questionEn: 'How do picture communication boards work?',
    expectedKeywords: ['picture', 'communication board', 'symbol', 'point', 'choose'],
    expectedStandards: ['ISO 9999'],
    difficulty: 'easy',
  },
  {
    id: 'communication-004',
    category: 'communication',
    question: 'Điều khiển bằng mắt (eye-tracking) hoạt động như thế nào?',
    questionEn: 'How does eye-tracking control work?',
    expectedKeywords: ['eye tracking', 'gaze', 'camera', ' Tobii', 'control'],
    expectedStandards: ['ISO 9999'],
    difficulty: 'medium',
  },
  {
    id: 'communication-005',
    category: 'communication',
    question: 'RTT (Real-Time Text) là gì?',
    questionEn: 'What is RTT (Real-Time Text)?',
    expectedKeywords: ['RTT', 'real-time text', 'telephone', 'typing', 'instant'],
    expectedStandards: ['ITU F.703', 'RFC 4103'],
    difficulty: 'medium',
  },

  // ===== DAILY LIVING (Sinh hoạt) =====
  {
    id: 'daily-001',
    category: 'daily_living',
    question: 'Dụng cụ ăn uống cho người khó khớp tay bao gồm những gì?',
    questionEn: 'What eating aids are available for people with hand difficulties?',
    expectedKeywords: ['eating', 'utensil', 'fork', 'spoon', 'grip', 'handle'],
    expectedStandards: ['ISO 9999:09.09'],
    difficulty: 'easy',
  },
  {
    id: 'daily-002',
    category: 'daily_living',
    question: 'Thiết bị an toàn trong nhà tắm cho người già?',
    questionEn: 'Bathroom safety devices for elderly?',
    expectedKeywords: ['bathroom', 'grab bar', 'shower chair', 'handrail', 'non-slip'],
    expectedStandards: ['ISO 9999:09.12'],
    difficulty: 'easy',
  },
  {
    id: 'daily-003',
    category: 'daily_living',
    question: 'Thiết bị nhắc nhở uống thuốc hoạt động ra sao?',
    questionEn: 'How do medication reminder devices work?',
    expectedKeywords: ['medication', 'reminder', 'pill', 'alarm', 'dosette'],
    expectedStandards: ['ISO 9999'],
    difficulty: 'easy',
  },
  {
    id: 'daily-004',
    category: 'daily_living',
    question: 'Thanh vịn giường giúp ích gì cho người khuyết tật?',
    questionEn: 'What are the benefits of bed rails for disabled people?',
    expectedKeywords: ['bed rail', 'grab bar', 'sit up', 'mobility', 'safety'],
    expectedStandards: ['ISO 9999'],
    difficulty: 'easy',
  },
  {
    id: 'daily-005',
    category: 'daily_living',
    question: 'Đồ dùng nhà bếp hỗ trợ người khuyết tật?',
    questionEn: 'Kitchen aids for people with disabilities?',
    expectedKeywords: ['kitchen', 'cooking', 'cutting board', 'can opener', 'adaptive'],
    expectedStandards: ['ISO 9999', 'ADA'],
    difficulty: 'medium',
  },

  // ===== EDUCATION (Giáo dục) =====
  {
    id: 'education-001',
    category: 'education',
    question: 'Phần mềm hỗ trợ học tập cho trẻ khuyết tật?',
    questionEn: 'Learning software for children with disabilities?',
    expectedKeywords: ['learning', 'software', 'education', 'children', 'reading'],
    expectedStandards: ['WCAG', 'UDL'],
    difficulty: 'easy',
  },
  {
    id: 'education-002',
    category: 'education',
    question: 'Tiêu chuẩn WCAG 2.1 có những nguyên tắc gì?',
    questionEn: 'What are the principles of WCAG 2.1?',
    expectedKeywords: ['WCAG', 'POUR', 'perceivable', 'operable', 'understandable', 'robust'],
    expectedStandards: ['WCAG 2.1', 'W3C'],
    difficulty: 'medium',
  },
  {
    id: 'education-003',
    category: 'education',
    question: 'Sách nói (Audiobooks) và sách Braille khác nhau thế nào?',
    questionEn: 'Difference between audiobooks and Braille books?',
    expectedKeywords: ['audiobook', 'Braille', 'blind', 'reading', 'audio'],
    expectedStandards: ['ISO 9999'],
    difficulty: 'easy',
  },
  {
    id: 'education-004',
    category: 'education',
    question: 'Universal Design for Learning (UDL) là gì?',
    questionEn: 'What is Universal Design for Learning (UDL)?',
    expectedKeywords: ['UDL', 'Universal Design', 'learning', 'multiple means', 'engagement'],
    expectedStandards: ['UDL', 'CAST'],
    difficulty: 'medium',
  },
  {
    id: 'education-005',
    category: 'education',
    question: 'Thiết bị hỗ trợ học tiếng Anh cho người khuyết tật?',
    questionEn: 'English learning aids for people with disabilities?',
    expectedKeywords: ['English', 'language learning', 'reading', 'writing', 'communication'],
    expectedStandards: ['WCAG'],
    difficulty: 'medium',
  },

  // ===== STANDARDS (Tiêu chuẩn) =====
  {
    id: 'standards-001',
    category: 'standards',
    question: 'ISO 9999 phân loại thiết bị AT như thế nào?',
    questionEn: 'How does ISO 9999 classify AT products?',
    expectedKeywords: ['ISO 9999', 'classification', 'categories', '05', '12', '22', '24'],
    expectedStandards: ['ISO 9999'],
    difficulty: 'medium',
  },
  {
    id: 'standards-002',
    category: 'standards',
    question: 'WCAG Level A, AA, AAA khác nhau ra sao?',
    questionEn: 'Difference between WCAG Level A, AA, AAA?',
    expectedKeywords: ['Level A', 'Level AA', 'Level AAA', 'compliance', 'accessibility'],
    expectedStandards: ['WCAG 2.1'],
    difficulty: 'medium',
  },
  {
    id: 'standards-003',
    category: 'standards',
    question: 'WHO GATE có những chương trình gì?',
    questionEn: 'What are the WHO GATE programs?',
    expectedKeywords: ['GATE', 'WHO', 'people', 'products', 'provision', 'policy'],
    expectedStandards: ['WHO GATE'],
    difficulty: 'hard',
  },
  {
    id: 'standards-004',
    category: 'standards',
    question: 'Priority Assistive Products List (APL) bao gồm những gì?',
    questionEn: 'What is in the Priority Assistive Products List (APL)?',
    expectedKeywords: ['APL', 'Priority', 'wheelchair', 'hearing aid', '50 products'],
    expectedStandards: ['WHO GATE', 'APL'],
    difficulty: 'hard',
  },
  {
    id: 'standards-005',
    category: 'standards',
    question: 'Pháp luật Việt Nam về hỗ trợ người khuyết tật?',
    questionEn: 'Vietnamese law on disability support?',
    expectedKeywords: ['Luật', 'Người khuyết tật', '2010', 'CRPD', 'Việt Nam'],
    expectedStandards: ['CRPD', 'VN Law'],
    difficulty: 'hard',
  },
];

// ============== RAG ACCURACY TESTING ==============

export async function runRAGAccuracyTest(
  queryFn: (question: string) => Promise<{ response: string; confidence: number; sources: any[] }>
): Promise<{
  totalQuestions: number;
  passedQuestions: number;
  averageConfidence: number;
  averageResponseTime: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];
  let totalConfidence = 0;
  let totalResponseTime = 0;

  for (const test of QA_TEST_SUITE) {
    const startTime = Date.now();
    
    try {
      const { response, confidence, sources } = await queryFn(test.question);
      const responseTime = Date.now() - startTime;
      
      // Check keywords found
      const keywordsFound = test.expectedKeywords.filter(keyword => 
        response.toLowerCase().includes(keyword.toLowerCase())
      );
      const keywordsMissed = test.expectedKeywords.filter(keyword => 
        !response.toLowerCase().includes(keyword.toLowerCase())
      );

      // Check standards found
      const standardsFound = test.expectedStandards.filter(standard => 
        response.includes(standard)
      );

      // Determine if passed (at least 60% keywords found or high confidence)
      const keywordScore = keywordsFound.length / test.expectedKeywords.length;
      const passed = keywordScore >= 0.6 || confidence >= 85;

      results.push({
        questionId: test.id,
        passed,
        confidence,
        response,
        keywordsFound,
        keywordsMissed,
        standardsFound,
        sourcesRetrieved: sources?.length || 0,
        responseTime,
        feedback: passed ? 'PASS' : `Missing keywords: ${keywordsMissed.join(', ')}`,
      });

      totalConfidence += confidence;
      totalResponseTime += responseTime;
    } catch (error) {
      results.push({
        questionId: test.id,
        passed: false,
        confidence: 0,
        response: '',
        keywordsFound: [],
        keywordsMissed: test.expectedKeywords,
        standardsFound: [],
        sourcesRetrieved: 0,
        responseTime: Date.now() - startTime,
        feedback: `ERROR: ${error}`,
      });
    }
  }

  const passedQuestions = results.filter(r => r.passed).length;

  return {
    totalQuestions: QA_TEST_SUITE.length,
    passedQuestions,
    averageConfidence: Math.round(totalConfidence / QA_TEST_SUITE.length),
    averageResponseTime: Math.round(totalResponseTime / QA_TEST_SUITE.length),
    results,
  };
}

// ============== PRINT TEST REPORT ==============

export function printTestReport(report: {
  totalQuestions: number;
  passedQuestions: number;
  averageConfidence: number;
  averageResponseTime: number;
  results: TestResult[];
}): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 MADA AI - RAG ACCURACY TEST REPORT');
  console.log('='.repeat(60));
  
  console.log('\n📈 OVERALL METRICS:');
  console.log(`   Total Questions: ${report.totalQuestions}`);
  console.log(`   Passed: ${report.passedQuestions}/${report.totalQuestions}`);
  console.log(`   Pass Rate: ${(report.passedQuestions / report.totalQuestions * 100).toFixed(1)}%`);
  console.log(`   Average Confidence: ${report.averageConfidence}%`);
  console.log(`   Average Response Time: ${report.averageResponseTime}ms`);
  
  console.log('\n📋 DETAILED RESULTS:');
  report.results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    console.log(`\n${status} ${result.questionId} (${result.confidence}%) - ${result.responseTime}ms`);
    if (result.keywordsFound.length > 0) {
      console.log(`   Found: ${result.keywordsFound.join(', ')}`);
    }
    if (result.keywordsMissed.length > 0) {
      console.log(`   Missed: ${result.keywordsMissed.join(', ')}`);
    }
  });
  
  console.log('\n' + '='.repeat(60));
  
  // Performance assessment
  const passRate = report.passedQuestions / report.totalQuestions;
  if (passRate >= 0.9) {
    console.log('🎉 EXCELLENT! RAG system is performing very well.');
  } else if (passRate >= 0.7) {
    console.log('👍 GOOD! RAG system meets acceptable standards.');
  } else if (passRate >= 0.5) {
    console.log('⚠️ NEEDS IMPROVEMENT. Consider adding more data or optimizing.');
  } else {
    console.log('❌ CRITICAL! RAG system requires significant improvements.');
  }
  
  if (report.averageResponseTime < 1000) {
    console.log('⚡ RESPONSE TIME: Excellent (< 1s)');
  } else if (report.averageResponseTime < 2000) {
    console.log('⚡ RESPONSE TIME: Good (< 2s)');
  } else {
    console.log('⚡ RESPONSE TIME: Needs optimization (> 2s)');
  }
  
  console.log('='.repeat(60) + '\n');
}
