import { analyzeConsultProgress, detectAskedQuestions, detectAnsweredQuestions } from '../src/lib/consultCore';

const Q = {
  needHelp: '*Bạn cần tôi giúp gì hôm nay?*',
  age: '*Năm nay bạn bao nhiêu tuổi rồi?*',
  condition:
    '*Bạn gặp tình trạng như thế nào? Hãy diễn đạt cụ thể tình trạng bạn gặp phải để tôi có thể hiểu rõ hơn về vấn đề của bạn nhé.*',
  duration:
    '*Bạn đã gặp tình trạng này bao lâu rồi? Bạn thuộc mức nào: nhẹ (hơi ảnh hưởng cuộc sống), trung bình (ảnh hưởng đến sinh hoạt hằng ngày), hay nặng (ảnh hưởng lớn đến khả năng sinh hoạt và giao tiếp)?*',
};

const hist: any[] = [
  { role: 'user', content: 'tôi bị ù tai nặng' },
  { role: 'assistant', content: 'Dạ, tôi ghi nhận triệu chứng của bạn.\n\n' + Q.age },
  { role: 'user', content: '45 tuổi' },
  { role: 'assistant', content: Q.condition },
  { role: 'user', content: 'khó nghe' },
];

for (const m of hist) {
  if (m.role === 'assistant') {
    console.log('ASSISTANT asked:', [...detectAskedQuestions([m.content])], '|', m.content.slice(0, 60));
  } else {
    console.log('USER:', m.content);
  }
}
console.log('regex answered (all user):', [...detectAnsweredQuestions(hist.filter(m=>m.role==='user').map(m=>m.content))]);
const p = analyzeConsultProgress(hist);
console.log('=> answered:', [...p.answered], 'asked:', [...p.asked], 'missing:', p.missing, 'completed:', p.completed);
