import dotenv from 'dotenv';
dotenv.config();

import { rerankService } from '../server/lib/rag/rerankService';

const N = parseInt(process.argv[2] || '33', 10);
const items = Array.from({ length: N }, (_, i) => ({
  id: 'doc' + i,
  content: `Tài liệu ${i} về công nghệ hỗ trợ. ` + 'Nội dung mô tả chi tiết về thiết bị và phương pháp sử dụng. '.repeat(12),
}));

(async () => {
  const r: any = await rerankService.rerank('máy trợ thính nào phù hợp cho người bị điếc nhẹ', items, { topN: 10 });
  console.log('N=', N, 'RESULT len=', r.length);
  console.log('top5:', JSON.stringify(r.slice(0, 5).map((x: any) => ({ id: x.item.id, s: x.rerankScore }))));
  process.exit(0);
})();
