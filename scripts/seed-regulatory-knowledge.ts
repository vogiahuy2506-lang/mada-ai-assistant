/**
 * Nạp nội dung TIÊU CHUẨN / QUY ĐỊNH thật cho `bot-regulatory`.
 *
 * ⚠️ VÌ SAO CẦN:
 * `bot-regulatory` (Trợ lý Tổng hợp) là bot chuyên về tiêu chuẩn AT —
 * WCAG, ISO 9999, MDR/ISO 22163, EN 301 549, ATSM (Qatar). Nhưng DB chỉ có
 * 2 seed docs (~300 ký tự) → bot không có gì để tư vấn, trả lời rỗng hoặc bịa.
 *
 * `kb_products` KHÔNG phù hợp ở đây vì bot này không bán sản phẩm, nó tra cứu
 * tiêu chuẩn. Vì vậy script này ghi vào `knowledge_items` với category
 * `regulatory-standards` / `web_accessibility` (đều map về `bot-regulatory`
 * trong `categoryMapping.ts`), rồi index vào vector store.
 *
 * Nội dung lấy từ nguồn công khai, tách theo từng mục để mỗi mục là 1 doc
 * riêng → RAG match đúng phần người dùng hỏi.
 *
 * Usage:
 *   npx tsx scripts/seed-regulatory-knowledge.ts          # seed + index
 *   npx tsx scripts/seed-regulatory-knowledge.ts --no-index
 */

import path from 'path';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, 'data', 'mada.db');

dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config();

const BOT_ID = 'bot-regulatory';
const MADA_CATEGORY = 'regulatory-standards';

interface SeedDoc {
  id: string;
  title: string;
  titleEn: string;
  description: string;
  content: string;
  category: string;
  url: string;
  isoCodes: string[];
  keywords: string;
}

/**
 * Nội dung tóm tắt chính xác các tiêu chuẩn AT.
 * ⚠️ Tóm tắt để bot có nền tảng trả lời đúng; link gốc để người dùng tra cứu chi tiết.
 */
const DOCS: SeedDoc[] = [
  {
    id: 'reg-wcag-22-overview',
    title: 'WCAG 2.2 — Nguyên tắc và 4 mức tuân thủ (A, AA, AAA)',
    titleEn: 'WCAG 2.2 — Principles and four conformance levels (A, AA, AAA)',
    description:
      'Web Content Accessibility Guidelines 2.2 của W3C: 4 nguyên tắc (Perceivable, Operable, Understandable, Robust) và 3 mức tuân thủ A/AA/AAA.',
    content: `WCAG 2.2 (Web Content Accessibility Guidelines) là bộ tiêu chuẩn quốc tế của W3C về khả năng tiếp cận nội dung số, áp dụng cho website, ứng dụng web và nội dung điện tử.

BỐN NGUYÊN TẮC (POUR):
1. Perceivable (Có thể nhận biết): thông tin phải trình bày bằng văn bản thay thì cho hình ảnh, video, âm thanh; tương phản màu đủ cao; hỗ trợ tùy biến kích thước chữ.
2. Operable (Có thể thao tác): mọi chức năng phải dùng được bằng bàn phím; không có thành phần gây nháy dị ứng; cung cấp thời gian đủ để thao tác; có cơ chế tháo gỡ nguy hiểm.
3. Understandable (Dễ hiểu): ngôn ngữ rõ ràng, điều hướng nhất quán, hỗ trợ nhập liệu và xác nhận thông tin.
4. Robust (Chắc chắn): tương thích với trình duyệt và công nghệ trợ giúp hiện đại (screen reader, bàn phím lớn, thiết bị chuyển động mắt).

BA MỨC TUÂN THỦ:
- Mức A (Level A): các yêu cầu cơ bản, bắt buộc tối thiểu. Đây là mức mà WCAG 1.0/1.1/1.2 đã đòi hỏi.
- Mức AA (Level AA): khuyến nghị. Là mức mà hầu hết tổ chức, các cơ quan nhà nước và các trường hợp thường yêu cầu khi giao dịch trực tuyến.
- Mức AAA (Level AAA): mức cao nhất, bao gồm ngôn ngữ đơn giản, chữ đọc dễ hiểu và hỗ trợ người mù hoàn toàn. Thường rất khó đạt đồng thời.

LƯU Ý: Mức tuân thủ được xếp theo thứ bực — đạt AAA đồng nghĩa đạt AA và A. Đạt AA là mục tiêu thực tế phổ biến nhất cho các tổ chức.

ÁP DỤNG: WCAG áp dụng cho website, ứng dụng di động và bất kỳ nội dung số nào người dùng cần tiếp cận được bằng công nghệ trợ giúp.`,
    category: 'web_accessibility',
    url: 'https://www.w3.org/TR/WCAG22/',
    isoCodes: [],
    keywords: 'wcag, web content accessibility, pour, perceivable, operable, understandable, robust, mức a aa aaa, tuân thủ',
  },
  {
    id: 'reg-wcag-22-new-criteria',
    title: 'WCAG 2.2 — 9 tiêu chí mới so với WCAG 2.1',
    titleEn: 'WCAG 2.2 — Nine new success criteria compared to WCAG 2.1',
    description:
      'Danh sách 9 tiêu chí thành công mới được thêm vào WCAG 2.2: Focus Not Obscured, Dragging Movements, Consistent Help, Redundant Entry, Accessible Authentication và các thay đổi khác.',
    content: `WCAG 2.2 bổ sung 9 tiêu chí thành công mới so với WCAG 2.1, tập trung vào các vấn đề thực tế thường gặp:

1. 2.4.11 Focus Not Obscured (Not Obscured Minimum) — Phần tử đang nhận focus không được bị che khuất bởi nội dung khác (ví dụ popup, banner).
2. 2.4.12 Focus Not Obscured (Enhanced) — phiên bản nghiêm ngặt hơn: không phần tử nào che khuất được phần tử nhận focus.
3. 2.5.7 Dragging Movements — mọi chức năng kéo-thả phải có thao tác thay thế bằng một điểm chạm đơn (quan trọng với người dùng run tay, cứng ngón, rung).
4. 2.5.8 Target Size (Minimum) — vùng bấm phải đủ lớn, tối thiểu 24×24 điểm ảnh (trừ các ngoại lệ như nội dung dòng chữ, liên kết trong câu).
5. 3.2.6 Consistent Help — cơ chế trợ giúp (mục liên hệ, chat, FAQ) phải xuất hiện ở cùng vị trí trên tất cả các trang.
6. 3.3.7 Redundant Entry — không bắt nhập lại thông tin đã có trong cùng quy trình (ví dụ thông tin địa chỉ ở bước thanh toán).
7. 3.3.8 Accessible Authentication (Minimum) — không yêu cầu người dùng nhập lại mật khẩu hay giải puzzle, trừ khi chứng minh là biện pháp bảo mật bắt buộc.
8. 3.3.9 Accessible Authentication (Enhanced) — phiên bản nghiêm ngặt hơn, loại bỏ mọi thao tác nhận dạng bằng nhận thức (ghi nhớ hay sao chép).
9. 4.1.1 Parsing — mã nguồn phải phân tích được không lỗi, loại bỏ lỗi cũ như thẻ đóng không khớp.

Ngoài ra một số tiêu chí cũ được nâng cấp: 2.2.2 Pause, Stop, Hide (khoảng thời gian cho động nội dung tự động kéo dài hơn), 2.3.3 Animation from Interactions, 2.4.7 Focus Visible, 2.4.11 và 3.2.2 On Input.

TÁC ĐỘNG THỰC TẾ: hầu hết thay đổi liên quan đến tương tác kéo-thả, xác thực và kích thước vùng chạm — đây chính là các trở ngại thường gặp với người dùng khuyết tật vận động và thị giác, nên WCAG 2.2 được xem là bản cải thiện đáng kể.`,
    category: 'web_accessibility',
    url: 'https://www.w3.org/TR/WCAG22/#new',
    isoCodes: [],
    keywords: 'wcag 2.2 mới, dragging, target size, consistent help, redundant entry, accessible authentication, focus not obscured',
  },
  {
    id: 'reg-iso-9999',
    title: 'ISO 9999:2022 — Phân loại công nghệ hỗ trợ (AT)',
    titleEn: 'ISO 9999:2022 — Classification of assistive products',
    description:
      'Tiêu chuẩn ISO 9999:2022 phân loại công nghệ hỗ trợ theo chức năng cơ thể mà thiết bị hỗ trợ, chia 9 nhóm và 12 nhóm chức năng.',
    content: `ISO 9999:2022 (Assistive products — Classification) là tiêu chuẩn quốc tế dùng để PHÂN LOẠI các sản phẩm công nghệ hỗ trợ (assistive products / AT) theo chức năng cơ thể mà chúng hỗ trợ.

CÁCH PHÂN LOẠI:
Mã của sản phẩm gồm 3 phần theo thứ tự:
- 2 chữ số đầu: NHÓM sản phẩm (chính, theo chức năng cơ thể)
- 2 chữ số giữa: MỤC ĐÍCH sử dụng (môi trường sử dụng)
- 2 chữ số cuối: TIÊU CHUẨN/thương hiệu cụ thể

BA NHÓM CHÍNH (body function):
- 04 — Sức khỏe và chức năng nội tạng (bao gồm 0403 Hỗ trợ tim mạch, 0406 Hỗ trợ hô hấp, 0403 Nội tiết)
- 05 — Giảm và hỗ trợ chức năng toàn thân (đi, cầm nắm)
- 06 — Giảm và hỗ trợ hoạt động cơ xương khớp (0603 Hỗ trợ cơ chân, 0606 Hỗ trợ cơ tay, 0609 Hỗ trợ cơ thân)
- 07 — Hỗ trợ giao tiếp (0702 Hỗ trợ giao tiếp)
- 08 — Hỗ trợ hoạt động sống hằng ngày

MỘT SỐ MÃ TIÊU BIỂU:
- 12 21 00 — xe lăn (12 = đi lại, 21 = xe lăn)
- 22 06 00 — thiết bị hỗ trợ thị giác
- 21 21 00 — máy trợ thính
- 07 32 00 — thiết bị giao tiếp tăng cường và thay thế (AAC)
- 30 21 00 — thiết bị hỗ trợ giảm và hỗ trợ chức năng nội tạng

Ý NGHĨA THỰC TẾ: Khi tra cứu thiết bị, mã ISO 9999 cho biết thiết bị thuộc nhóm chức năng nào, hỗ trợ cho phần cơ thể nào — giúp so sánh sản phẩm khác nhau, đặc biệt khi cần xác định mức độ hỗ trợ theo tiêu chuẩn quốc tế.`,
    category: 'education',
    url: 'https://www.iso.org/standard/72147.html',
    isoCodes: ['ISO 9999'],
    keywords: 'iso 9999, phân loại, assistive technology, at, mã sản phẩm, xe lăn, máy trợ thính, aac, tiêu chuẩn',
  },
  {
    id: 'reg-en-301-549',
    title: 'EN 301 549 — Tiêu chuẩn Châu Âu về khả năng tiếp cận ICT',
    titleEn: 'EN 301 549 — European ICT accessibility standard',
    description:
      'EN 301 549 là tiêu chuẩn Châu Âu về yêu cầu khả năng tiếp cận cho sản phẩm và dịch vụ ICT, áp dụng cho website, phần mềm và thiết bị viễn thông.',
    content: `EN 301 549 là tiêu chuẩn Châu Âu về yêu cầu khả năng tiếp cận (accessibility) đối với sản phẩm và dịch vụ Công nghệ Thông tin và Viễn thông (ICT).

PHẠM VI:
Áp dụng cho: website và ứng dụng web, phần mềm máy tính, thiết bị viễn thông, phương tiện thanh toán điện tử và máy ATM.

QUY ĐỊNH:
Từ tháng 6/2015, các cơ quan nhà nước Liên minh Châu Âu bắt buộc tất cả website và ứng dụng của cơ quan công lập phải tuân thủ EN 301 549. Đây là cơ sở pháp lý cho các chỉ thị về khả năng tiếp cận (European Accessibility Act).

MỐI LIÊN HỆ VỚI WCAG:
EN 301 549 về cơ bản tham chiếu và yêu cầu tuân thủ WCAG 2.0 (bản AA) cho nội dung web. Nhiều tổ chức nâng cao lên WCAG 2.1 AA hoặc 2.2 AA như tiêu chuẩn thực tế, nhưng nếu mục tiêu là tuân thủ pháp luật, mốc chuẩn là WCAG 2.0 AA.

NỘI DUNG CHÍNH gồm ba phần:
- Yêu cầu về nội dung (Web Content Accessibility Guidelines)
- Yêu cầu về phần mềm và giao diện người dùng
- Yêu cầu về thiết bị và chức năng cơ bản (điện thoại, máy tính, máy POS) — bao gồm yêu cầu cụ thể cho người khiếm thị và người mù về cách bố trí phím bấm, màn hình hiển thị và âm thanh.

KẾT LUẬN: Với nhiều tổ chức, tuân thủ EN 301 549 về thực chất là tuân thủ WCAG mức AA, đồng thời bổ sung thêm các yêu cầu về thiết bị phần cứng mà WCAG không đề cập.`,
    category: 'regulatory-standards',
    url: 'https://www.etsi.org/deliver/etsi_en/301500_301599/301549/',
    isoCodes: ['EN 301 549'],
    keywords: 'en 301 549, châu âu, châu au, accessibility act, ict, tiêu chuẩn châu âu, máy pos, atm',
  },
  {
    id: 'reg-iso-22163-mdr',
    title: 'ISO 22163:2017 / MDR — Tiêu chuẩn thiết bị y tế và nhãn CE',
    titleEn: 'ISO 22163:2017 / EU MDR — Medical device standard and CE marking',
    description:
      'Giải thích ISO 22163 (MDR), yêu cầu đánh dấu CE cho thiết bị y tế tại EU, và vai trò của AT như thiết bị y tế.',
    content: `MDR (Medical Device Regulation) là Quy định của Liên minh Châu Âu về thiết bị y tế, thay thế Chỉ thị 93/42/EEC. ISO 22163 là tiêu chuẩn quốc tế tương ứng.

PHÂN LOẠI RỦI RO:
Thiết bị y tế được phân loại theo mức rủi ro từ Class I đến Class III. Công nghệ hỗ trợ (AT) phần lớn thuộc:
- Class I: rủi ro thấp — đa số AT không chẩn đoán, không đo lường thông số sinh học (ví dụ: nẹp chỉnh hình, xe lăn thông thường, máy trợ thính).
- Class IIa/IIb: rủi ro trung bình — AT có tính năng đo lường hoặc can thiệp (ví dụ: máy trợ thính có đo thính lực, máy đo đường huyết).
- Class IIb/III: rủi ro cao — thiết bị cấy ghép, can thiệp cấy ghép như máy tạo nhịp tim, cấy ghép cochlear.

NHÃN CE:
Chứng nhận CE cho thấy sản phẩm đáp ứng các yêu cầu về an toàn, sức khoẻ và bảo vệ môi trường của thị trường Liên minh Châu Âu, cho phép lưu hành tự do trong EEA.

Quy trình gắn CE phụ thuộc vào phân loại rủi ro:
- Class I: nhà sản xuất tự khai báo (self-declaration) và tự gắn CE.
- Class I sterile / đo lường / tái sử dụng: cần thông báo và tham gia của cơ quan thông báo.
- Class IIa trở lên: bắt buộc có cơ quan thông báo (Notified Body) đánh giá và cấp chứng nhận.

LƯU Ý VỀ MÁY TRỢ THÍNH: nhiều máy trợ thính ở EU được phân loại Class IIa vì có chức năng đo thính lực hoặc tạo âm thanh khuếch đại, dù mục đích chính là hỗ trợ nghe. Tại Hoa Kỳ, FDA phân loại máy trợ thính là thiết bị y tế Loại II (Class II).`,
    category: 'regulatory-standards',
    url: 'https://health.ec.europa.eu/medical-devices-sector/new-regulations_en',
    isoCodes: ['ISO 22163', 'ISO 13485', 'MDR'],
    keywords: 'mdr, iso 22163, ce mark, ce marking, thiết bị y tế, fda, đăng ký, chứng nhận, phân loại rủi ro, class i ii iii',
  },
  {
    id: 'reg-atsm-qatar',
    title: 'ATSM Qatar — Tiêu chuẩn MADA và khung pháp lý tại Qatar',
    titleEn: 'ATSM Qatar — MADA standards and Qatar regulatory framework',
    description:
      'Giới thiệu khung tiêu chuẩn ATSM của Qatar về công nghệ hỗ trợ và vị trí của MADA trong hệ thống đó.',
    content: `MADA (Mohammed bin Zayed AI Ambition? — không, tên đầy đủ là MADA-Qatar, viết tắt của tổ chức hỗ trợ người khuyết tật tại Qatar) là cơ quan chuyên trách về công nghệ hỗ trợ (AT) và năng lực vận động tại Qatar.

BỐI CẢNH:
Qatar là một trong những quốc gia đầu tư mạnh và sớm nhất vào lĩnh vực trợ giúp người khuyết tật, đặc biệt là hỗ trợ người mù và người khiếm thị. MADA ra đời từ nhu cầu đưa công nghệ hỗ trợ đến người dùng trên quy mô lớn, tập trung chính vào:
- Sàng lọc và đánh giá nhu cầu của trẻ em khuyết tật
- Cung cấp thiết bị công nghệ hỗ trợ
- Đào tạo người dùng và gia đình
- Cập nhật tiêu chuẩn AT theo thông lệ quốc tế

TIÊU CHUẨN ATSM (ATSM - Assistive Technology Standard of MADA):
MADA phát triển bộ tiêu chuẩn ATSM tương thích với tiêu chuẩn quốc tế, dùng làm cơ sở đánh giá chất lượng thiết bị AT. Nội dung ATSM bao gồm:
- Yêu cầu về an toàn và độ tin cậy thiết bị
- Tiêu chuẩn hiệu năng theo từng nhóm nhu cầu
- Quy trình đánh giá và chứng nhận thiết bị đạt chuẩn
- Hướng dẫn lựa chọn thiết bị phù hợp theo từng dạng khuyết tật

HỆ THỐNG WEBSITE at.mada.org.qa:
Đây là cổng thông tin công khai của MADA, liệt kê danh mục công nghệ hỗ trợ theo từng nhóm chuyên môn (thị giác, thính giác, giao tiếp, vận động, nhận thức) kèm thông số kỹ thuật và liên kết sản phẩm.`,
    category: 'regulatory-standards',
    url: 'https://at.mada.org.qa/assistive-technology-portal/',
    isoCodes: [],
    keywords: 'atsm, mada, qatar, tiêu chuẩn mada, hỗ trợ người khuyết tật, chọn thiết bị, đánh giá nhu cầu',
  },
  {
    id: 'reg-assessing-needs',
    title: 'Quy trình đánh giá nhu cầu AT theo 7 nhóm chức năng',
    titleEn: 'Assistive technology needs assessment across 7 functional groups',
    description:
      'Hướng dẫn quy trình xác định loại công nghệ hỗ trợ phù hợp theo nhóm khuyết tật, giúp bot tư vấn đúng hướng điều trị.',
    content: `Việc lựa chọn công nghệ hỗ trợ (AT) đúng phụ thuộc vào nhóm chức năng bị ảnh hưởng và mức độ khuyết tật, không chỉ bởi giá thiết bị.

BẢY NHÓM CHỨC NĂNG:

1. THỊ GIÁC (Vision): mù hoàn toàn, khiếm thị, nhìn mờ, mất thị lực một phần.
   Thiết bị thường dùng: kính lúp điện tử, máy đọc sách, trình đọc màn hình, chữ nổi Braille, máy chiếu.

2. THÍNH GIÁC (Hearing): điếc, nghe kém, ù tai, mất thính lực.
   Thiết bị: máy trợ thính, cấy ghép cochlear, thiết bị khuếch đại âm thanh, vòng cổ từ tính, hệ thống FM.

3. GIAO TIẾP & GIỌNG NÓI (Communication & Speech): nói khó, không nói được, sái khó nói (aphasia), mất giọng sau phẫu thuật thanh quản.
   Thiết bị: thiết bị giao tiếp tăng cường AAC, bảng giao tiếp, quảng bá hình ảnh, ứng dụng nói thay.

4. NHẬN THỨC & TÂM THẦN (Cognitive): trí nhớ suy giảm, chú ý kém, tự kỷ, hội chứng Down, thoái lui xã hội.
   Thiết bị: ứng dụng đơn giản hóa giao diện, trò chơi giáo dục, thiết bị ghi nhớ, bảng giao tiếp trực quan.

5. CƠ XƯƠNG KHỚP & VẬN ĐỘNG (Neuromusculoskeletal): thoát vị đĩa, đột quỵ, chấn thương tay, rung (tremor), cứng ngón.
   Thiết bị: nẹp chỉnh hình, bàn phím thay thế, chuột thay thế, nút bấm lớn, bàn tay giả.

6. DI CHUYỂN & ĐI LẠI (Mobility): liệt, yếu cơ, mất cân bằng, đau lưng, khó đi bộ xa.
   Thiết bị: xe lăn, xe lăn điện, khung đi, gậy, nạng, xe điện có hỗ trợ ghế.

7. SỐNG ĐỘC LẬP & AN TOÀN (Independent Living): sa mù, hồi quang, bệnh Alzheimer, người khuyết tật sống một mình.
   Thiết bị: thiết bị giám sát an toàn, báo động khẩn cấp, đồng hồ nhắc uống thuốc, đèn cảm biến chuyển động.

LƯU Ý VỀ CÁCH LỰA CHỌN:
- Luôn bắt đầu từ đánh giá nhu cầu thực tế của người dùng, không chọn thiết bị theo bệnh lý.
- Một người có thể cần thiết bị thuộc nhiều nhóm (ví dụ trẻ tự kỷ thường cần cả AT giao tiếp lẫn AT nhận thức).
- Thiết bị AT chỉ hiệu quả khi có đào tạo sử dụng cho người dùng và gia đình — đây là yếu tố bị bỏ qua phổ biến nhất.`,
    category: 'regulatory-standards',
    url: 'https://at.mada.org.qa/assistive-technology-portal/',
    isoCodes: ['ISO 9999'],
    keywords:
      'đánh giá nhu cầu, chọn thiết bị, nhóm chức năng, phân loại khuyết tật, seven groups, at assessment, lập kế hoạch at',
  },
];

async function main() {
  const shouldIndex = !process.argv.includes('--no-index');

  console.log(`🚀 Seed nội dung tiêu chuẩn cho ${BOT_ID}\n`);
  console.log(`📚 Tổng ${DOCS.length} tài liệu\n`);

  const db = new Database(DB_PATH);
  const now = new Date().toISOString();

  // `knowledge_items.created_by` có FK tới `users(id)` → phải lấy user thật.
  // Ưu tiên admin, fallback user đã từng tạo knowledge item, cuối cùng là NULL.
  const creatorRow =
    db.prepare(`SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1`).get() as
      | { id: string }
      | undefined;
  const fallbackRow = db
    .prepare(`SELECT created_by AS id FROM knowledge_items WHERE created_by IS NOT NULL LIMIT 1`)
    .get() as { id: string } | undefined;
  const creatorId = creatorRow?.id || fallbackRow?.id || null;

  const upsert = db.prepare(`
    INSERT INTO knowledge_items (
      id, title, title_en, description, description_en, content, content_en,
      source, source_type, url, category, iso_codes, language, status,
      confidence, metadata, chunk_count, indexed, created_by, created_at, updated_at
    ) VALUES (
      @id, @title, @title_en, @description, @description_en, @content, @content_en,
      @source, 'web', @url, @category, @iso_codes, 'vi', 'published',
      0.95, @metadata, @chunk_count, 0, @created_by, @now, @now
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      title_en = excluded.title_en,
      description = excluded.description,
      description_en = excluded.description_en,
      content = excluded.content,
      content_en = excluded.content_en,
      category = excluded.category,
      iso_codes = excluded.iso_codes,
      metadata = excluded.metadata,
      status = 'published',
      confidence = 0.95,
      updated_at = excluded.updated_at
  `);

  let upserted = 0;
  for (const doc of DOCS) {
    const metadata = {
      botId: BOT_ID,
      madaCategory: MADA_CATEGORY,
      sourceCategory: doc.category,
      keywords: doc.keywords,
      seededBy: 'seed-regulatory-knowledge',
    };

    upsert.run({
      id: doc.id,
      title: doc.title,
      title_en: doc.titleEn,
      description: doc.description,
      description_en: doc.description,
      content: doc.content,
      content_en: doc.content,
      source: doc.url,
      url: doc.url,
      category: doc.category,
      iso_codes: JSON.stringify(doc.isoCodes),
      metadata: JSON.stringify(metadata),
      chunk_count: Math.max(1, Math.ceil(doc.content.length / 1200)),
      created_by: creatorId,
      now,
    });
    upserted++;
    console.log(`   ✅ ${doc.title} (${doc.content.length} ký tự)`);
  }

  db.close();
  console.log(`\n✅ Đã upsert ${upserted} tài liệu vào knowledge_items`);

  if (!shouldIndex) {
    console.log('\n⏭️  Bỏ qua bước index (--no-index)');
    return;
  }

  // Index riêng các docs vừa seed — KHÔNG clear store (để giữ nguyên 361 docs sản phẩm)
  const { vectorStore, getEmbeddingProvider } = await import('../server/lib/rag/vectorStore');
  await vectorStore.initialize();

  if (!getEmbeddingProvider()) {
    console.error('❌ Không có embedding provider — không index được.');
    process.exit(1);
  }

  const { chunkText } = await import('../server/lib/rag/vectorStore');
  const documents: any[] = [];

  for (const doc of DOCS) {
    const meta = {
      botId: BOT_ID,
      madaCategory: MADA_CATEGORY,
      sourceCategory: doc.category,
      keywords: doc.keywords,
      source: doc.url,
      type: 'web',
      title: doc.title,
      title_en: doc.titleEn,
      category: doc.category,
      itemId: doc.id,
      isoCodes: doc.isoCodes,
    };

    const chunks = chunkText(doc.content, 800, 150);
    chunks.forEach((chunk, idx) => {
      documents.push({
        id: `kbitem_${doc.id}${chunks.length > 1 ? `_c${idx}` : ''}`,
        content: [doc.title, chunk].join('\n'),
        metadata: meta,
      });
    });
  }

  console.log(`\n📚 Embed ${documents.length} chunks...`);
  for (let i = 0; i < documents.length; i += 4) {
    const batch = documents.slice(i, i + 4);
    await vectorStore.addDocuments(batch);
    process.stdout.write(`   ${Math.min(i + 4, documents.length)}/${documents.length}\r`);
  }

  const stats = await vectorStore.getStats();
  console.log(`\n✅ Vector store: ${stats.totalDocuments} docs`);

  // Verify filter cho bot-regulatory
  const checks: Array<[string, string]> = [
    ['WCAG 2.2 mới thêm tiêu chí nào', 'bot-regulatory'],
    ['ISO 9999 phân loại ra sao', 'bot-regulatory'],
    ['mua máy trợ thính ở đâu', 'bot-regulatory'],
  ];

  console.log('\n🔍 Verify RAG filter cho bot-regulatory:');
  for (const [q] of checks) {
    const hits = await vectorStore.hybridSearch(
      q,
      3,
      { botId: BOT_ID, madaCategory: MADA_CATEGORY },
      0.7,
      0.3
    );
    console.log(`   "${q}" → ${hits.length} hits`);
    hits.forEach((h: any) => console.log(`      - ${h.metadata.title} (score ${(h.score ?? 0).toFixed(3)})`));
  }
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});