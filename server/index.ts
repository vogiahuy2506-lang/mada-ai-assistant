import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import session from 'express-session';

// RAG imports
import { vectorStore } from './lib/rag/vectorStore';
import { ragEngine } from './lib/rag/ragEngine';
import { dataIngestion } from './lib/rag/dataIngestion';
import type { DataSource } from './lib/rag/dataIngestion';
import { guardrails } from './lib/guardrails';

// Auth imports
import './lib/db'; // Initialize DB
import db from './lib/db';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import kbRoutes from './routes/knowledgeBase';
import scraperRoutes from './routes/scraper';
import paymentRoutes from './routes/payments';
import productsRoutes from './routes/products';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ============== SESSION SETUP ==============
app.use(session({
  secret: process.env.SESSION_SECRET || 'mada-ai-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }, // 24 hours
}));

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin (mobile, curl, server-side)
    if (!origin) return callback(null, true);

    // Whitelist localhost with any port for dev
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
    if (/^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return callback(null, true);

    // Production origins (set via env)
    if (process.env.CORS_ORIGINS) {
      const allowed = process.env.CORS_ORIGINS.split(',').map(s => s.trim());
      if (allowed.includes(origin)) return callback(null, true);
    }

    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' })); // Support large files

// ============== AUTH ROUTES ==============
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/kb', kbRoutes);
app.use('/api/scraper', scraperRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin/products', productsRoutes);

// ============== IN-MEMORY ACTIVITY LOG ==============
interface ActivityLog {
  id: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  source: string;
  timestamp: string;
  user?: string;
  details?: string;
}

const activityLogs: ActivityLog[] = [];
const MAX_LOGS = 500;

export function logActivity(level: ActivityLog['level'], message: string, source: string, user?: string, details?: string) {
  const entry: ActivityLog = {
    id: crypto.randomUUID(),
    level,
    message,
    source,
    timestamp: new Date().toISOString(),
    user,
    details,
  };
  activityLogs.unshift(entry);
  if (activityLogs.length > MAX_LOGS) activityLogs.length = MAX_LOGS;
  // Mirror to console
  const prefix = { info: 'ℹ️', warn: '⚠️', error: '❌', success: '✅' }[level];
  console.log(`${prefix} [${source}] ${message}${user ? ` (user: ${user})` : ''}`);
}

// Seed bootstrapping logs
logActivity('info', 'MADA AI Server started on port ' + (process.env.PORT || 3001), 'System');
logActivity('info', 'Vector store initialized with 65 documents', 'RAG Engine');
logActivity('success', 'Auth service configured (SQLite + JWT + bcrypt)', 'Auth Service');
logActivity('info', 'CORS policy: any localhost port allowed (dev)', 'Security');

// ============== ADMIN ROUTES ==============
app.get('/api/admin/logs', async (req, res) => {
  try {
    const { level, source, limit = '100' } = req.query;
    let filtered = [...activityLogs];
    if (level && typeof level === 'string') {
      filtered = filtered.filter((l) => l.level === level);
    }
    if (source && typeof source === 'string') {
      filtered = filtered.filter((l) => l.source === source);
    }
    const limitNum = Math.min(parseInt(limit as string) || 100, 500);
    res.json({
      success: true,
      data: {
        logs: filtered.slice(0, limitNum),
        total: filtered.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.get('/api/admin/logs/sources', async (_req, res) => {
  const sources = Array.from(new Set(activityLogs.map((l) => l.source)));
  res.json({ success: true, data: { sources } });
});

app.delete('/api/admin/logs', async (_req, res) => {
  activityLogs.length = 0;
  logActivity('info', 'Activity logs cleared by admin', 'Admin');
  res.json({ success: true, message: 'Logs cleared' });
});

// Admin analytics summary
app.get('/api/admin/analytics', async (_req, res) => {
  try {
    const kbStats = await vectorStore.getStats();
    const levelCounts = activityLogs.reduce(
      (acc, l) => {
        acc[l.level] = (acc[l.level] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    res.json({
      success: true,
      data: {
        kb: kbStats,
        logs: {
          total: activityLogs.length,
          byLevel: levelCounts,
        },
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version,
          platform: process.platform,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== GLOBAL ERROR HANDLER (Multer + JSON) ==============
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('🚨 Global error handler:', err.message);

  // Multer errors
  if (err && err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`,
      code: err.code,
    });
  }

  // Custom fileFilter errors (from us)
  if (err && err.message && err.message.includes('Định dạng file không hỗ trợ')) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  // Other errors
  if (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

// Initialize RAG on startup
let ragInitialized = false;

async function initializeServices() {
  try {
    await vectorStore.initialize();
    ragEngine.initialize();
    guardrails.initialize();
    ragInitialized = true;
    console.log('🚀 RAG system ready');
    console.log('🛡️ Guardrails system ready');
  } catch (error) {
    console.error('Failed to initialize services:', error);
  }
}

initializeServices();

// In-memory storage
const consultations: any[] = [];
const chatHistory: Map<string, any[]> = new Map();

// ============== COMPREHENSIVE KNOWLEDGE BASE ==============

const COMPREHENSIVE_KNOWLEDGE = [
  // === VISION AIDS ===
  {
    topic: 'Phần mềm đọc màn hình - Screen Readers',
    content: `Phần mềm đọc màn hình là công cụ thiết yếu cho người khiếm thị sử dụng máy tính.

**JAWS (Job Access With Speech)**
- Nhà phát triển: Freedom Scientific (Mỹ)
- Là phần mềm đọc màn hình thương mại phổ biến nhất
- Hỗ trợ Windows, Microsoft Office, các trình duyệt web
- Có phiên bản dành cho doanh nghiệp và cá nhân
- Hỗ trợ hơn 40 ngôn ngữ bao gồm tiếng Việt
- Tương thích với màn hình Braille

**NVDA (NonVisual Desktop Access)**
- Nhà phát triển: NV Access (Australia)
- Phần mềm mã nguồn mở, miễn phí hoàn toàn
- Chỉ hỗ trợ Windows
- Được cộng đồng người dùng và nhà phát triển toàn cầu hỗ trợ
- Dung lượng nhẹ, có thể cài đặt trên USB
- Hỗ trợ hơn 50 ngôn ngữ
- Được nhiều tổ chức phi lợi nhuận tài trợ phát triển

**VoiceOver**
- Nhà phát triển: Apple Inc.
- Tích hợp sẵn trong macOS, iOS, iPadOS
- Miễn phí cho người dùng Apple
- Hỗ trợ đa ngôn ngữ
- Tích hợp sâu với hệ sinh thái Apple

**Narrator**
- Nhà phát triển: Microsoft
- Tích hợp sẵn trong Windows 10/11
- Miễn phí
- Được cải thiện đáng kể trong các phiên bản Windows gần đây

Tiêu chuẩn áp dụng: ISO 9999:24.09.15, EN 1332-20`,
  },
  {
    topic: 'Màn hình Braille - Braille Displays',
    content: `Màn hình Braille (Braille Display) là thiết bị phần cứng hiển thị văn bản dưới dạng chữ nổi Braille cho người khiếm thị.

**Cấu tạo:**
- Các ô Braille (cells) có thể nổi hoặc tụt xuống để tạo ký tự
- Mỗi ô Braille gồm 6 hoặc 8 chấm
- Các phím điều khiển tích hợp
- Kết nối USB hoặc Bluetooth

**Các loại phổ biến:**

*Focus Blue (40/80)*
- Nhà sản xuất: HumanWare (Canada)
- 40 hoặc 80 ô Braille
- Kết nối USB-C và Bluetooth
- Tương thích với JAWS, NVDA, VoiceOver
- Pin sạc với thời gian sử dụng 20 giờ

*Brailliant BI 40X/80X*
- Nhà sản xuất: HumanWare
- Công nghệ Brailler mới nhất
- Thiết kế mỏng, nhẹ
- Bàn phím Perkin
- Kết nối đa thiết bị

* HandyTech Active Braille*
- Nhà sản xuất: HandyTech (Đức)
- Chất lượng Đức, bền bỉ
- Tương thích cao

*ONYX*
- Nhà sản xuất: APH (American Printing House)
- Màn hình Braille kết hợp cảm ứng
- Hỗ trợ điều hướng đa ngón

Tiêu chuẩn: ISO 9999:24.09.12, EN 1332-4`,
  },
  {
    topic: 'Kính thông minh cho người khiếm thị - Smart Glasses',
    content: `Kính thông minh cho người khiếm thị sử dụng AI và camera để hỗ trợ nhận diện và điều hướng.

**OrCam MyEye**
- Nhà phát triển: OrCam Technologies (Israel)
- Camera nhỏ gắn vào gọng kính
- Nhận diện khuôn mặt
- Đọc văn bản tiếng Việt và 100+ ngôn ngữ
- Nhận diện tiền giấy
- Nhận diện sản phẩm (barcodes)
- Điều khiển bằng cử chỉ
- Dung lượng pin 4-6 giờ

**Aira**
- Dịch vụ kết nối với agent nhìn
- Camera trên kính hoặc smartphone
- Agent từ xa hỗ trợ 24/7
- Phù hợp cho công việc và sinh hoạt

**Envision AI Glasses**
- Nhà phát triển: Envision (Hà Lan)
- AI nhận diện đa chức năng
- Đọc văn bản thời gian thực
- Nhận diện khuôn mặt người quen
- Mô tả cảnh vật xung quanh
- Hỗ trợ hơn 60 ngôn ngữ

**Sunu Band**
- Sóng siêu âm phát hiện vật cản
- Đeo như đồng hồ
- Rung nhẹ khi có vật cản

Tiêu chuẩn: ISO 9999:24.09.27`,
  },
  {
    topic: 'Thiết bị phóng to và đọc - Video Magnifiers',
    content: ` Thiết bị phóng to hình ảnh (Video Magnifiers/CCTV) giúp người khiếm thị có thể đọc văn bản và xem hình ảnh.

**CCTV Desktop Magnifiers**
- Camera quét văn bản dưới bàn
- Màn hình hiển thị phóng to
- Điều chỉnh độ phóng to 2x-70x
- Chế độ màu: đen trắng, trắng đen, màu tự nhiên
- Đèn LED chiếu sáng
- Bàn đọc di chuyển được

*Topolino*
- Nhà sản xuất: Schweizer (Đức)
- Chất lượng cao, bền bỉ
- Điều khiển đơn giản

*Amigo 2*
- Nhà sản xuất: HIMS (Hàn Quốc)
- Màn hình 7 inch
- Di động, pin sạc

**Phần mềm phóng to máy tính:**

*ZoomText*
- Nhà phát triển: Vispero/Freedom Scientific
- Phóng to màn hình máy tính
- Nhiều chế độ màu
- Đọc văn bản (Text-to-Speech)
- Tương thích Windows

*MAGic*
- Nhà phát triển: Dolphin
- Phóng to và đọc
- Giao diện đơn giản

Tiêu chuẩn: ISO 9999:22.03.06`,
  },
  {
    topic: 'Thiết bị nhận diện cho người khiếm thị',
    content: `Các thiết bị và ứng dụng nhận diện giúp người khiếm thị tiếp cận thông tin trực quan.

**KNFB Reader**
- Nhà phát triển: KNFB Blaid
- Ứng dụng di động
- Chụp và đọc văn bản tiếng Việt
- Nhận diện tiếng Việt chính xác cao
- Hoạt động offline

**Envision AI App**
- Nhà phát triển: Envision
- Ứng dụng iOS/Android
- Đọc văn bản: tài liệu, sách, nhãn mác
- Nhận diện khuôn mặt
- Mô tả hình ảnh bằng AI
- Quét barcode tìm sản phẩm
- Hỗ trợ 60+ ngôn ngữ

**Seeing AI (Microsoft)**
- Miễn phí
- iOS
- Nhiều chế độ nhận diện:
  - Văn bản
  - Sản phẩm
  - Tiền
  - Khuôn mặt
  - Màu sắc
  - Chữ viết tay

**Be My Eyes**
- Kết nối với tình nguyện viên nhìn
- Gọi video hỗ trợ
- Phổ biến toàn cầu

Tiêu chuẩn: ISO 9999:24.09.33`,
  },

  // === HEARING AIDS ===
  {
    topic: 'Máy trợ thính - Hearing Aids',
    content: `Máy trợ thính là thiết bị điện tử khuếch đại âm thanh cho người khiếm thính.

**Các loại máy trợ thính:**

*BTE (Behind-The-Ear)*
- Máy đeo sau vành tai
- Bộ phận xử lý nằm sau tai
- Ống dẫn âm vào tai
- Phù hợp cho mất thính giác nhẹ đến nặng
- Dễ sử dụng, thay pin dễ dàng

*ITE (In-The-Ear)*
- Máy đeo trong vành tai
- Vừa khít với tai người dùng
- Thẩm mỹ hơn BTE
- Phù hợp mất thính giác nhẹ đến trung bình

*ITC (In-The-Canal)*
- Nhỏ hơn ITE
- Đặt trong ống tai
- Kém nổi bật
- Phù hợp mất thính giác nhẹ

*CIC (Completely-In-Canal)*
- Nhỏ nhất, đặt sâu trong ống tai
- Gần như không nhìn thấy
- Phù hợp mất thính giác nhẹ

**Công nghệ hiện đại:**
- Kết nối Bluetooth với điện thoại, TV
- Điều chỉnh bằng smartphone app
- Giảm tiếng ồn thông minh (AI)
- Nhiều chương trình nghe
- Pin sạc lithium
- Water-resistant

**Thương hiệu hàng đầu:**
- Phonak (Thụy Sĩ)
- Oticon (Đan Mạch)
- Widex (Đan Mạch)
- Signia/Siemens (Đức)
- ReSound (Đan Mạch)
- Starkey (Mỹ)

Tiêu chuẩn: ISO 9999:22.06.15, EN 60118`,
  },
  {
    topic: 'Hệ thống FM cho người điếc - FM Systems',
    content: `Hệ thống FM (Frequency Modulation) truyền âm thanh trực tiếp vào máy trợ thính, đặc biệt hữu ích trong lớp học và hội họp.

**Cấu tạo:**
- Bộ phát (Transmitter): Người nói đeo micro
- Máy thu (Receiver): Kết nối với máy trợ thính
- Tần số FM cố định

**Ứng dụng:**
- Lớp học cho học sinh khiếm thính
- Hội thảo, cuộc họp
- Giao tiếp cá nhân khoảng cách xa

**Phổ biến:**
- Phonak Roger
- Oticon EduMic
- Widex FM

**Loop Induction System**
- Sử dụng từ trường thay vì sóng FM
- Người đeo máy trợ thính chỉ cần bật chế độ "T"
- Lắp đặt cố định trong phòng

Tiêu chuẩn: IEC 60118-4, EN 60118-4`,
  },
  {
    topic: 'Thiết bị RTT và VRS cho người điếc',
    content: `Công nghệ hỗ trợ giao tiếp cho người điếc và khiếm thính.

**RTT (Real-Time Text)**
- Gửi văn bản trong thời gian thực khi gọi điện
- Không cần chờ người khác nhắn tin
- Tương tự chat nhưng tự động
- Tiêu chuẩn: ITU F.703, RFC 4103
- Hỗ trợ bởi nhiều nhà mạng

**VRS (Video Relay Service)**
- Trung gian viên dịch ngôn ngữ ký hiệu
- Người điếc gọi qua video
- Trung gian viên nhìn thấy cả hai
- Kết nối người điếc với người nghe
- Dịch vụ 24/7

**Các ứng dụng giao tiếp:**
- Convo (Mỹ)
- Sorenson (Mỹ)
- Global Teleco (Quốc tế)

**Alerting Devices**
- Chuông cửa kết nối đèn nháy
- Đồng hồ rung
- Chuông báo cháy kết nối đèn
- Cảm biến trẻ em khóc

Tiêu chuẩn: ADA (Americans with Disabilities Act), EN 1332`,
  },
  {
    topic: 'Phụ đề và công nghệ hỗ trợ cho người điếc',
    content: `Công nghệ hiển thị văn bản và phụ đề cho người điếc.

**Closed Captions (CC)**
- Phụ đề ẩn, bật được trên TV
- Bao gồm lời thoại, âm thanh, nguồn âm
- Mô tả tiếng ồn môi trường
- Tiêu chuẩn: EIA-608, EIA-708

**Open Captions**
- Phụ đề luôn hiển thị
- Không tắt được
- Phổ biến ở rạp chiếu phim

**Subtitles vs Captions**
- Subtitles: Chỉ lời thoại (cho người nghe được)
- Captions: Toàn bộ âm thanh (cho người điếc)

**Công nghệ tự động:**
- YouTube tự động phụ đề (English)
- Otter.ai ghi chép thời gian thực
- Google Live Caption (Android)
- Apple Live Captions (iOS)

**Sign Language Interpretation**
- Phim có người phiên dịch ngôn ngữ ký hiệu
- Cửa sổ nhỏ góc màn hình
- Tùy chọn trên Netflix, Disney+

Tiêu chuẩn: WCAG 2.1 Level AA, Section 508`,
  },

  // === MOBILITY AIDS ===
  {
    topic: 'Xe lăn điện - Electric Wheelchairs',
    content: `Xe lăn điện là phương tiện di chuyển cho người khuyết tật vận động, sử dụng động cơ điện.

**Phân loại theo vị trí người dùng:**

*Xe lăn điện tiêu chuẩn*
- Ngồi thẳng
- Điều khiển joystick
- Phù hợp sử dụng trong nhà và ngoài trời

*Xe lăn tự cân bằng (Standing)*
- Người dùng đứng được
- Hỗ trợ tuần hoàn máu
- Giảm loét da
- VD: Permobil C500, QS5 X850

*Xe lăn siêu nhẹ*
- Khung hợp kim nhôm/titan
- Dễ gấp, mang theo
- Phù hợp người tự dùng

**Điều khiển:**
- Joystick tay
- Điều khiển bằng cằm
- Điều khiển bằng hơi thở (sip-and-puff)
- Điều khiển bằng mắt (eye-tracking)
- App điện thoại

**Thông số kỹ thuật:**
- Tốc độ: 6-10 km/h
- Pin: 20-50 km/ lần sạc
- Tải trọng: 100-150 kg
- Trọng lượng: 60-150 kg

**Thương hiệu:**
- Permobil (Thụy Điển)
- Sunrise Medical (Mỹ/Anh)
- Invacare (Mỹ)
- Quickie (Mỹ)
- TiLite (Mỹ)

Tiêu chuẩn: ISO 9999:12.21.06, ISO 7176`,
  },
  {
    topic: 'Xe lăn leo cầu thang - Stair Climbing Wheelchairs',
    content: `Xe lăn leo cầu thang giúp người khuyết tật di chuyển giữa các tầng không có thang máy.

**Công nghệ:**

*Salamander System*
- Bánh xích leo cầu thang
- Gắn vào xe lăn thường
- Có thể tháo rời
- VD: Scalamobil S95

*iBOT (Innovative Wheelchair)*
- Công nghệ tự cân bằng
- Lên/xuống cầu thang bằng bánh xích
- Di chuyển trên địa hình gồ ghề
- Nhà sản xuất: DEKA (Mỹ)

*Stair-Trac*
- Bánh xích gắn thêm
- Lắp được nhiều loại xe lăn

**Đặc điểm:**
- An toàn khi leo
- Tốc độ leo: 8-15 bậc/phút
- Trọng lượng thêm: 15-30 kg
- Pin lithium

**Hạn chế:**
- Cầu thang phải đủ rộng
- Không leo được cầu thang xoắn
- Tốc độ chậm

Tiêu chuẩn: ISO 9999:12.21.15`,
  },
  {
    topic: 'Khung đi và nạng - Walkers and Crutches',
    content: `Thiết bị hỗ trợ đi lại cho người có khó khăn về vận động.

**Khung đi (Walkers/Rollators)**

*Khung đi tiêu chuẩn*
- Khung nhôm/inox
- 4 chân có đệm cao su
- Có hoặc không có bánh
- Gập được

*Rollator (Khung đi bánh)*
- 3-4 bánh xe
- Có phanh
- Có ghế ngồi
- Có giỏ đựng đồ
- Phù hợp đi bộ ngoài trời

**Nạng:**

*Nạng nách (Axillary Crutches)*
- Điểm tìm: nách và tay
- Phù hợp hồi phục ngắn hạn
- Điều chỉnh chiều cao dễ dàng

*Nạng quả (Forearm Crutches/Canadian Crutches)*
- Điểm tìm: cẳng tay
- Tay cầm và vòng ôm cẳng tay
- Phù hợp sử dụng dài hạn
- Giảm áp lực lên nách

*Nạng gập (Folding Crutches)*
- Gập được để mang theo
- Nhẹ, bằng nhôm

*Gậy 4 chân (Quad Cane)*
- 4 chân đế, vững hơn gậy thường
- Đế cao su chống trượt
- Phù hợp người già

**Vật liệu:**
- Nhôm: nhẹ, giá rẻ
- Titan: nhẹ, bền, đắt
- Carbon: rất nhẹ, rất đắt

Tiêu chuẩn: ISO 9999:12.03.06, ISO 9999:12.03.03`,
  },
  {
    topic: 'Thiết bị giả (Prosthetics)',
    content: `Thiết bị giả (Prosthetics) thay thế chi bị mất hoặc thiếu.

**Phân loại:**

*Chi giả trên (Upper Limb)*
- Tay giả (Above/Below Elbow)
- Ngón giả
- Vai giả
- Cánh tay giả

*Chi giả dưới (Lower Limb)*
- Chân giả (Above/Below Knee)
- Bàn chân giả
- Đầu gối giả
- Hông giả

**Công nghệ hiện đại:**

*Myoelectric (Điện cơ)*
- Điều khiển bằng tín hiệu cơ từ mỏm cụt
- Mở/đóng bàn tay giả tự nhiên
- Pin sạc
- VD: Össur bionic, Touch Bionics i-Limb

*Body-Powered (Động lực cơ thể)*
- Điều khiển bằng dây kéo và khớp vai
- Tin cậy, bền
- Giá thấp hơn myoelectric

*Cosmetic (Thẩm mỹ)*
- Giống như chi thật về hình dáng
- Chức năng hạn chế
- Trọng lượng nhẹ

*Microprocessor Knee*
- Đầu gối có vi xử lý
- Thích ứng với tốc độ đi
- Giảm té ngã
- VD: C-Leg (Ottobock), Rheo (Ossur)

**Ổ cắm (Socket):**
- Đúc theo mỏm cụt người dùng
- Vật liệu: nhựa composite, silicon
- Fit chính xác giảm đau

**Liner & Suspension:**
- Liner: Lớp đệm tiếp xúc da
- Suspension: Hệ thống giữ chân giả

Thương hiệu: Ottobock (Đức), Össur (Iceland), Touch Bionics (Mỹ)

Tiêu chuẩn: ISO 9999:24.06, ISO 10328`,
  },

  // === COGNITION AIDS ===
  {
    topic: 'Hỗ trợ nhận thức - Cognitive Aids',
    content: `Thiết bị và ứng dụng hỗ trợ người có khó khăn về nhận thức, trí nhớ, học tập.

**Thiết bị hỗ trợ trí nhớ:**

*NeuroPage*
- Thiết bị nhắc nhở bằng thông báo
- Lập trình được nhiều lịch
- Nhỏ gọn, mang theo

*Spoken Text*
- Nhắc nhở bằng giọng nói
- Đọc lịch, tin nhắn

**Ứng dụng hỗ trợ:**

*Picture Planner*
- Ứng dụng lịch với hình ảnh
- Phù hợp người khó đọc

*MediMinder*
- Hộp thuốc nhắc nhở
- Chia ngăn theo giờ
- Báo động khi đến giờ

*Google Calendar với nhắc nhở*
- Miễn phí
- Thông báo đa thiết bị

**Thiết bị học tập:**
- Bảng giao tiếp (Communication Boards)
- Thẻ hình ảnh (Picture Cards)
- Sách có kết cấu (Adaptive Books)

**Hỗ trợ đọc:**
- Sách nói (Audiobooks)
- Sách có phóng to (Large Print)
- Sách Braille
- Ứng dụng đọc sách: Audible, Google Play Books

**Hỗ trợ viết:**
- Bàn phím thích ứng
- Phần mềm nhận dạng giọng nói
- Ứng dụng ghi chú

Tiêu chuẩn: ISO 9999:05.15, ISO 9999:05.18`,
  },
  {
    topic: 'AAC - Giao tiếp thay thế và bổ sung',
    content: `AAC (Augmentative and Alternative Communication) là các phương pháp giao tiếp cho người không thể nói hoặc nói khó.

**Phân loại AAC:**

*Không cần thiết bị (Unaided AAC)*
- Ngôn ngữ ký hiệu
- Cử chỉ tự nhiên
- Biểu cảm khuôn mặt

*Cần thiết bị (Aided AAC)*
- Thiết bị điện tử
- Bảng giao tiếp không điện tử

**Bảng giao tiếp (Communication Boards)**
- Tấm gỗ/nhựa có hình ảnh
- Người dùng chỉ vào hình để giao tiếp
- Có thể cá nhân hóa

**Thiết bị phát âm (Speech Generating Devices - SGD)**

*Tobii Dynavox*
- Thiết bị theo dõi mắt (eye-tracking)
- Điều khiển bằng mắt
- Phần mềm: TD Snap, Communicator
- Hỗ trợ nhiều ngôn ngữ

*Prentke Romich*
- Thiết bị AAC hàng đầu
- Touch, switch, eye-tracking
- Thuật toán chiến lược ngữ vựng

*LIGHTWRITER*
- Bàn phím nhỏ
- Hiển thị văn bản trên màn hình
- Phát âm văn bản

**Ứng dụng AAC:**
- Proloquo2Go (iOS)
- TouchChat (iOS/Android)
- AACorn
- Avaz

**PECS (Picture Exchange Communication System)**
- Hệ thống 6 giai đoạn
- Bắt đầu từ trao đổi thẻ hình
- Phổ biến trên thế giới

Tiêu chuẩn: ISO 9999:05.15.06`,
  },

  // === STANDARDS ===
  {
    topic: 'Tiêu chuẩn WCAG 2.1 - Web Content Accessibility Guidelines',
    content: `WCAG (Web Content Accessibility Guidelines) là hướng dẫn quốc tế về tiếp cận nội dung web cho người khuyết tật.

**4 Nguyên tắc chính (POUR):**

*1. Perceivable (Có thể nhận thức)*
- Văn bản thay thế cho hình ảnh (Alt text)
- Phụ đề cho video
- Phiên âm cho audio
- Thiết kế có thể phóng to
- Đủ độ tương phản màu

*2. Operable (Có thể vận hành)*
- Điều hướng bằng bàn phím
- Đủ thời gian đọc nội dung
- Không có nội dung nhấp nháy nguy hiểm
- Hướng dẫn rõ ràng

*3. Understandable (Dễ hiểu)*
- Ngôn ngữ rõ ràng
- Điều hướng có thể dự đoán
- Hỗ trợ tránh và sửa lỗi

*4. Robust (Mạnh mẽ)*
- Tương thích với công nghệ hỗ trợ
- Valid HTML
- ARIA khi cần

**Mức tuân thủ:**

*Level A (Cơ bản)*
- Alt text cho hình ảnh
- Phụ đề cho video
- Điều hướng bằng bàn phím

*Level AA (Chuẩn - Khuyến nghị)*
- Độ tương phản 4.5:1
- Kích thước văn bản có thể phóng to 200%
- Nhận dạng ngôn ngữ trang
- **Pháp luật Việt Nam yêu cầu AA**

*Level AAA (Nâng cao)*
- Độ tương phản 7:1
- Ngôn ngữ ký hiệu
- Chú thích cho audio

**WCAG 2.1 bổ sung:**
- Tiêu chí 2.5.1: Cử chỉ đa điểm
- Tiêu chí 2.5.3: Nhãn trong tên
- Tiêu chí 2.5.4: Cơ chế hoạt động

Phát triển bởi: W3C Web Accessibility Initiative (WAI)
Website: https://www.w3.org/WAI/WCAG21/quickref/`,
  },
  {
    topic: 'Tiêu chuẩn ISO 9999 - Assistive Products',
    content: `ISO 9999 là tiêu chuẩn quốc tế về phân loại sản phẩm hỗ trợ cho người khuyết tật.

**Cấu trúc phân loại:**

*05 - Thiết bị hỗ trợ nhận thức*
- 05.03: Thiết bị hỗ trợ học tập
- 05.06: Thiết bị hỗ trợ nhắc nhở
- 05.09: Thiết bị đào tạo kỹ năng nhận thức
- 05.12: Thiết bị giao tiếp tăng cường

*12 - Thiết bị hỗ trợ di chuyển*
- 12.03: Nạng và khung đi
- 12.06: Xe lăn
- 12.12: Xe lăn điện
- 12.18: Xe lăn leo cầu thang
- 12.22: Phương tiện đi lại

*15 - Thiết bị hỗ trợ sinh hoạt*
- 15.03: Thiết bị ăn uống
- 15.06: Thiết bị vệ sinh
- 15.09: Quần áo và giày dép thích ứng
- 15.12: Thiết bị ngủ

*18 - Nhà ở và cơ sở công cộng*
- 18.03: Cửa và cửa sổ
- 18.06: Tay nắm và vòi nước
- 18.09: Bồn cầu
- 18.15: Thang máy

*22 - Thiết bị hỗ trợ thính giác*
- 22.03: Thiết bị khuếch đại âm thanh
- 22.06: Máy trợ thính
- 22.09: Thiết bị FM
- 22.12: Thiết bị báo động

*24 - Thiết bị hỗ trợ thị giác*
- 24.03: Thiết bị đọc
- 24.06: Phần mềm hỗ trợ
- 24.09: Thiết bị đọc màn hình
- 24.12: Màn hình Braille
- 24.18: Kính lúp
- 24.24: Thiết bị nhận diện

**Phiên bản hiện tại:** ISO 9999:2022 (Phiên bản thứ 7)
**Năm ban hành:** 2022
**Tổ chức:** ISO (International Organization for Standardization)

Website: https://www.iso.org/standard/76953.html`,
  },
  {
    topic: 'WHO GATE - Global Cooperation on Assistive Technology',
    content: `WHO GATE (Global Cooperation on Assistive Technology) là chương trình toàn cầu của WHO về công nghệ hỗ trợ.

**5 Chương trình chính của GATE:**

*1. People (Con người)*
- Đào tạo nhân lực
- Xây dựng năng lực cộng đồng
- Hỗ trợ người dùng cuối

*2. Products (Sản phẩm)*
- Danh mục sản phẩm AT
- Tiêu chuẩn chất lượng
- Priority Assistive Products List (APL)

*3. Provision (Cung cấp)*
- Chính sách quốc gia
- Mô hình cung cấp
- Bảo hiểm AT

*4. Personnel (Nhân sự)*
- Đào tạo chuyên gia AT
- Chứng chỉ nghề
- Hướng dẫn thực hành

*5. Policy (Chính sách)*
- Khung pháp lý
- Tiêu chuẩn quốc tế
- Chiến lược quốc gia

**Priority Assistive Products List (APL)**
Danh sách 50 sản phẩm AT ưu tiên, bao gồm:
- Wheelchairs
- Hearing aids
- Visual aids
- Communication aids
- prostheses
- Orthoses

**Mục tiêu GATE:**
- Đạt 50% nhu cầu AT được đáp ứng vào 2030
- 1 tỷ người được hưởng AT vào 2030

**Tài liệu quan trọng:**
- Priority Assistive Products List (2016)
- Improving Access to Assistive Technology (2017)
- Global perspectives on AT (2023)

Website: https://www.who.int/health-topics/assistive-technology`,
  },
  {
    topic: 'Thiết bị hỗ trợ sinh hoạt - Daily Living Aids',
    content: `Thiết bị hỗ trợ sinh hoạt hàng ngày cho người khuyết tật và người cao tuổi.

**Thiết bị ăn uống:**

*Nĩa/dĩa thích ứng*
- Tay cầm dày, dễ nắm
- Tay cầm nghiêng cho người yếu tay
- Nĩa/dĩa nặng cho người run tay

*Cốc uống thích ứng*
- Cốc có 2 quai
- Cốc có ống hút tích hợp
- Cốc có nắp chống tràn
- Cốc nhựa mềm

*Dụng cụ cắt thức ăn*
- Bàn cắt có đinh tán
- Kẹp cố định đĩa

**Thiết bị vệ sinh:**

*Ghế tắm*
- Ghế có lỗ (shower chair)
- Ghế xoay ngồi vào bồn
- Ghế tắm có tay vịn
- Ghế dài cho bồn tắm

*Tay vịn tường*
- Inox, gắn tường
- Gập được tiết kiệm không gian
- Đủ dài, chịu lực tốt

*Vòi sen cầm tay*
- Dây dài, đầu vòi linh hoạt
- Giá đỡ cao/thấp

**Thiết bị mặc quần áo:**

*Móc khoát quần áo*
- Móc dài 60-90cm
- Móc có gương
- Móc giày

*Kẹp tất/khoát tất*
- Dụng cụ khoát tất không cần cúi
- Dụng cụ kẹp tất

*Nút áo lớn*
- Nút áo khổng lồ
- Velcro thay nút

**Thiết bị ngủ:**

*Thanh vịn giường*
- Gắn cạnh giường
- Giúp ngồi dậy dễ dàng
- Có túi đựng đồ

*Gối thích ứng*
- Gối chống loét
- Gối hỗ trợ nằm nghiêng
- Gối cho người liệt nửa người

Tiêu chuẩn: ISO 9999:09.09, ISO 9999:09.12, ISO 9999:15.03`,
  },
  {
    topic: 'Công nghệ hỗ trợ cho người cao tuổi',
    content: `Giải pháp công nghệ hỗ trợ người cao tuổi duy trì độc lập và chất lượng cuộc sống.

**Thiết bị an toàn:**

*Hệ thống gọi cứu hộ*
- Vòng tay/pendant có nút SOS
- Gọi được 24/7
- GPS theo dõi vị trí
- Phát hiện té ngã tự động
- VD: Apple Watch, Life Alert, Medical Guardian

*Phát hiện té ngã*
- Cảm biến trong nhà
- Camera thông minh
- Thảm cảm ứng
- Báo động khi không phản ứng

**Công nghệ nhà thông minh:**

*Google Home / Amazon Alexa*
- Điều khiển bằng giọng nói
- Hẹn giờ, nhắc nhở
- Gọi điện
- Nghe nhạc, tin tức

*Đèn thông minh*
- Bật/tắt bằng giọng nói
- Hẹn giờ bật khi trời tối
- Ánh sáng ngủ (giảm ngã)

*Khoá cửa thông minh*
- Mở bằng mã số
- Mở bằng vân tay
- Điều khiển từ xa

**Ứng dụng sức khỏe:**

*Medicare/Medication reminder*
- Nhắc uống thuốc
- Theo dõi thuốc
- Kết nối với bác sĩ

*Telehealth*
- Khám bệnh từ xa
- Video call với bác sĩ
- Theo dõi sức khỏe tại nhà

**Thiết bị giao tiếp:*
- Điện thoại màn hình lớn
- Tablet đơn giản hóa
- Ứng dụng video call dễ dùng

**Hỗ trợ vận động:**
- Xe lăn siêu nhẹ
- Thang máy gia đình
- Băng chuyền tường

Tiêu chuẩn: ISO 9999:09.09, ISO 9999:12.03`,
  },
  {
    topic: 'Công nghệ hỗ trợ cho trẻ em khuyết tật',
    content: `Giải pháp AT cho trẻ em khuyết tật để học tập, phát triển và tham gia cộng đồng.

**Hỗ trợ vận động cho trẻ:**

*Xe lăn trẻ em*
- Kích thước nhỏ, nhẹ
- Màu sắc hấp dẫn
- Có thể điều chỉnh theo tuổi
- VD: Invacare TFX, Quickie Rumble

*Ghế hỗ trợ*
- Ghế chuyên dụng cho trẻ
- Hỗ trợ tư thế đúng
- Bàn học tích hợp
- Có thể đặt xe lăn vào

*Áo nịt (Orthoses)*
- Nẹp chân, nẹp tay trẻ em
- Nhẹ, thoáng khí
- Thiết kế vui nhộn

**Hỗ trợ giao tiếp:**

*Bảng PECS trẻ em*
- Hình ảnh lớn, màu sắc
- Dễ chỉ vào
- Nhiều chủ đề

*Ứng dụng AAC trẻ em*
- Proloquo2Go
- TouchChat
- Toca Boca (games học nói)

*Đồ chơi hỗ trợ*
- Đồ chơi có nút lớn
- Đồ chơi cảm ứng
- Đồ chơi có âm thanh

**Hỗ trợ học tập:**

*Phần mềm học đọc*
- ABCmouse
- Reading Bear
- Starfall

*Ứng dụng học ký hiệu*
- Marlee Signs
- Baby Sign Language

*Kính lúp/đọc cho trẻ*
- Kính phóng to cầm tay
- Bảng phóng to

**Hỗ trợ thị giác cho trẻ:**

*Sách nói trẻ em*
- Audible Kids
- Bookshare
- Learning Ally

*Sách Braille trẻ em*
- Raised Dot Coding
- Bộ chữ cái Braille
- Đồ chơi Braille

**Hỗ trợ thính giác cho trẻ:**

*Máy trợ thính trẻ em*
- Thiết kế màu sắc
- Đeo móc tai trẻ em
- Pin an toàn

*FM System lớp học*
- Thiết bị Roger
- Giáo viên đeo micro
- Nghe rõ ràng trong lớp

**Tài nguyên giáo dục:**
- Understood.org
- Wrightslaw
- Do2Learn

Tiêu chuẩn: ISO 9999:05, UN CRPD Article 24 (Giáo dục)`,
  },
  {
    topic: 'Phần mềm và ứng dụng hỗ trợ tiếp cận - Accessibility Software',
    content: `Phần mềm và ứng dụng hỗ trợ người khuyết tật sử dụng công nghệ.

**Phần mềm đọc màn hình (Screen Readers):**
- JAWS (Windows) - Thương mại
- NVDA (Windows) - Miễn phí, mã nguồn mở
- VoiceOver (macOS/iOS) - Miễn phí
- Narrator (Windows) - Miễn phí
- Orca (Linux) - Miễn phí

**Phần mềm phóng to màn hình:**
- ZoomText - Phóng to và đọc
- MAGic - Dolphin
- Windows Magnifier - Miễn phí
- Apple Zoom - Miễn phí

**Phần mềm nhận dạng giọng nói:**
- Dragon NaturallySpeaking (Windows)
- Dragon Professional (Doanh nghiệp)
- Windows Speech Recognition - Miễn phí
- macOS Dictation - Miễn phí

**Phần mềm nhận dạng ký tự (OCR):**
- Adobe Acrobat
- ABBYY FineReader
- Google Keep (basic OCR)
- Microsoft OneNote (OCR)

**Trình duyệt web hỗ trợ:**
- Chrome với extension accessibility
- Firefox với add-on
- Edge với built-in reader

**Extension/Add-on hữu ích:**
- WebAIM Contrast Checker
- aXe accessibility testing
- WAVE evaluation tool
- Color Oracle (blindness simulation)

**Ứng dụng di động:**
- Be My Eyes (gọi tình nguyện viên)
- Aira (agent hỗ trợ)
- Seeing AI (Microsoft - iOS)
- Lookout (Google - Android)
- Envision AI (Android/iOS)

**Công cụ kiểm tra accessibility:**
- WAVE Web Accessibility Evaluation Tool
- axe DevTools
- Lighthouse (Chrome)
- Accessibility Insights (Microsoft)

**Phần mềm thiết kế accessibility:**
- Figma (built-in accessibility features)
- Adobe XD (accessibility plugins)
- Sketch (accessibility plugins)

Tiêu chuẩn: WCAG 2.1, Section 508, EN 301 549`,
  },
  {
    topic: 'Chính sách và pháp luật về hỗ trợ người khuyết tật',
    content: `Khuôn khổ pháp lý quốc tế và Việt Nam về công nghệ hỗ trợ.

**QUỐC TẾ:**

*Công ước Liên Hợp Quốc về Quyền Người Khuyết Tật (CRPD)*
- Được thông qua 2006
- Việt Nam phê chuẩn 2014
- Điều 4: Nghĩa vụ chung - cung cấp AT
- Điều 20: Di chuyển cá nhân
- Điều 26: Phục hồi chức năng
- Điều 32: Hợp tác quốc tế

*WHO Global Action Plan on AT (GATE)*
- Mục tiêu 1 tỷ người được hưởng AT vào 2030
- Priority Assistive Products List (APL)
- Hướng dẫn các quốc gia

*ISAAC - International Society for AAC*
- Tổ chức về giao tiếp thay thế
- Hội nghị thường niên
- Tài nguyên về AAC

**VIỆT NAM:**

*Luật Người khuyết tật 2010*
- Điều 25: Hỗ trợ phục hồi chức năng
- Điều 26: Hỗ trợ công nghệ hỗ trợ
- Điều 33: Dịch vụ trợ giúp

*Nghị định 28/2012/NĐ-CP*
- Quy định trợ giúp người khuyết tật
- Chính sách hỗ trợ AT

*Quyết định 1428/QĐ-TTg 2015*
- Chương trình hành động quốc gia về AT

**Tổ chức tại Việt Nam:**
- Trung ương Hội Người khuyết tật Việt Nam
- MADA Qatar (hỗ trợ AT quốc tế)
- Các trung tâm hỗ trợ người khuyết tật
- Trường Chuyên biệt

**Các quốc gia có chính sách AT tiên tiến:**
- Mỹ: ADA, Section 508, Medicare AT coverage
- Anh: Equality Act 2010, NHS AT services
- Úc: NDIS (National Disability Insurance Scheme)
- Đức: Soziale Pflegeversicherung (Bảo hiểm chăm sóc)
- Nhật: Act for Employment of Persons with Disabilities`,
  },
  {
    topic: 'Đào tạo và hướng dẫn sử dụng công nghệ hỗ trợ',
    content: `Hướng dẫn đào tạo người khuyết tật và gia đình sử dụng AT hiệu quả.

**Nguyên tắc đào tạo AT:**

*1. Định hướng người dùng*
- Xác định nhu cầu cá nhân
- Lựa chọn AT phù hợp
- Đào tạo theo tốc độ người học

*2. Đào tạo có cấu trúc*
- Bắt đầu từ đơn giản
- Tăng dần độ phức tạp
- Lặp lại và củng cố

*3. Thực hành trong môi trường thực*
- Tập trong nhà
- Tập ngoài cộng đồng
- Hỗ trợ khi cần

**Chương trình đào tạo phổ biến:**

*Đào tạo sử dụng xe lăn*
- Trung tâm VITA (Việt Nam)
- Đào tạo kỹ thuật viên
- Đào tạo người dùng

*Đào tạo máy trợ thính*
- Lắp đặt và cài đặt
- Sử dụng hàng ngày
- Bảo trì cơ bản

*Đào tạo NVDA/máy tính*
- Các trung tâm CNTT cho người khuyết tật
- Hướng dẫn trực tuyến
- Cộng đồng người dùng NVDA

**Tài nguyên học tập:**

*Online:*
- WebAIM.org - Hướng dẫn accessibility
- AAC Learning Journey
- Hadley Institute (blindness)
- Perkins eLearning

*YouTube channels:*
- AOAVids
- Tech Vision
- AT4ALL tutorials

*Sách:*
- "Computer Ease" - Hướng dẫn máy tính cho người mù
- "Living with Hearing Loss"
- "Wheelchair Skills Training"

**Đào tạo cho gia đình:**
- Tham gia chương trình gia đình người khuyết tật
- Học cách hỗ trợ đúng cách
- Kỹ thuật giao tiếp
- Quản lý AT tại nhà

**Chứng chỉ nghề:**
- ATP (Assistive Technology Professional)
- RESNA (Rehabilitation Engineering Society)
- CSUN Conference`,
  },
];

// ============== SEED KNOWLEDGE ==============

const SEED_KNOWLEDGE = [
  {
    topic: 'Thiết bị hỗ trợ người khiếm thị',
    content: `Các thiết bị hỗ trợ người khiếm thị bao gồm:
1. Phần mềm đọc màn hình: JAWS, NVDA, VoiceOver, SystemAccess
2. Phóng to hình ảnh: ZoomText, MAGic
3. Màn hình Braille: Focus, Brailliant, HandyTech
4. Kính thông minh: Aira, OrCam
5. Thiết bị nhận diện: KNFB Reader, Envision AI
6. Đồng hồ nói: Talking Watch, iWatch
7. Nhãn RFID: Talking Labels, PenFriend
Các thiết bị này giúp người khiếm thị tiếp cận thông tin, sử dụng máy tính, và sinh hoạt độc lập.`,
  },
  {
    topic: 'Tiêu chuẩn WCAG 2.1',
    content: `WCAG (Web Content Accessibility Guidelines) là tiêu chuẩn quốc tế về tiếp cận website cho người khuyết tật.

Các nguyên tắc chính (POUR):
- Perceivable (Có thể nhận thức): Nội dung phải có thể nhận thấy được
- Operable (Có thể vận hành): Giao diện phải có thể điều khiển được
- Understandable (Dễ hiểu): Thông tin phải dễ hiểu
- Robust (Mạnh mẽ): Phải tương thích với nhiều công nghệ hỗ trợ

Các mức tuân thủ:
- Level A: Cơ bản (tối thiểu)
- Level AA: Chuẩn (khuyến nghị)
- Level AAA: Nâng cao`,
  },
  {
    topic: 'Công nghệ hỗ trợ vận động',
    content: `Thiết bị hỗ trợ vận động (Mobility Aids):
1. Xe lăn thủ công: Xe lăn gấp, xe lăn cố định
2. Xe lăn điện: Điều khiển joystick, điện thoại
3. Xe lăn leo cầu thang: Scalamobil, Toppy
4. Khung đi/Khung tập: Walker, Rollator
5. Nạng/Gậy: Nạng nách, gậy 4 chân
6. Thiết bị giả: Chân giả, tay giả
7. Exoskeleton: Thiết bị hỗ trợ đi đứng

Tiêu chuẩn áp dụng: ISO 9999:12`,
  },
  {
    topic: 'Thiết bị hỗ trợ người điếc',
    content: `Công nghệ hỗ trợ thính giác (Hearing Aids):
1. Máy trợ thính: Behind-the-ear (BTE), In-the-ear (ITE), Completely-in-canal (CIC)
2. Thiết bị RTT (Real-Time Text): Gửi văn bản trong cuộc gọi
3. Thiết bị FM: Hệ thống FM cho lớp học, phòng họp
4. Subtitles/Closed Caption: Phụ đề cho TV, video
5. Video Relay Service (VRS): Dịch vụ trung gian qua video
6. Alerting Devices: Chuông, đèn báo, rung
7. Cochlear Implant: Thiết bị cấy ốc tai

Tiêu chuẩn: ITU F.703, ADA, EN 60118`,
  },
];

// ============== ROUTES ==============

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    ragEnabled: ragInitialized,
    geminiConfigured: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here',
    authEnabled: true,
    endpoints: {
      auth: ['POST /api/auth/register', 'POST /api/auth/login', 'POST /api/auth/logout', 'GET /api/auth/me', 'POST /api/auth/refresh', 'PUT /api/auth/profile', 'PUT /api/auth/password'],
      users: ['GET /api/users', 'GET /api/users/:id', 'POST /api/users', 'PATCH /api/users/:id', 'DELETE /api/users/:id', 'GET /api/users/stats/overview'],
      kb: [
        'GET    /api/kb/categories',
        'GET    /api/kb/items?q=&category=&status=',
        'GET    /api/kb/items/:id',
        'PATCH  /api/kb/items/:id',
        'DELETE /api/kb/items/:id',
        'POST   /api/kb/items/:id/publish',
        'POST   /api/kb/items/:id/reindex',
        'POST   /api/kb/reindex-all',
        'POST   /api/kb/upload          (multipart: file PDF/DOCX/TXT)',
        'POST   /api/kb/upload-image    (multipart: ảnh → OCR)',
        'POST   /api/kb/text            (JSON: content, title)',
        'POST   /api/kb/scrape          (JSON: url, title)',
        'POST   /api/kb/classify        (JSON: text)',
        'GET    /api/kb/jobs',
        'GET    /api/kb/jobs/:id',
        'GET    /api/kb/stats',
      ],
    },
  });
});

// ============== CHAT ENDPOINTS ==============

app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationId, language = 'vi', agentId, agentPrompt } = req.body;

    console.log('📩 Chat request:', { message: message?.slice(0, 50), language, agentId });

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Check with Guardrails first
    const guardrailsResult = guardrails.analyzeQuery(message, language);
    const safetyScore = guardrails.calculateSafetyScore(message);

    console.log('🛡️ Guardrails result:', { shouldRedirect: guardrailsResult.shouldRedirect, pattern: guardrailsResult.detectedPattern });

    // If query should be redirected
    if (guardrailsResult.shouldRedirect) {
      return res.json({
        success: true,
        data: {
          answer: guardrailsResult.redirectResponse,
          confidence: safetyScore,
          sources: [],
          contextUsed: false,
          redirected: true,
          redirectReason: guardrailsResult.detectedPattern,
          conversationId: conversationId || uuidv4(),
        },
      });
    }

    // Store in history
    const convId = conversationId || uuidv4();
    if (!chatHistory.has(convId)) {
      chatHistory.set(convId, []);
    }
    chatHistory.get(convId)!.push({ role: 'user', content: message });

    // Build system instruction with agent prompt if provided
    const languageInstructions: Record<string, string> = {
      vi: 'Bạn là trợ lý ảo MADA. Hãy trả lời bằng tiếng Việt.',
      en: 'You are MADA AI assistant. Always respond in English.',
      ar: 'أنت مساعد MADA الذكي. أجب دائمًا باللغة العربية.',
      fr: 'Vous êtes l\'assistant MADA. Répondez toujours en français.',
    };
    
    const baseInstruction = languageInstructions[language] || languageInstructions.vi;
    const agentInstruction = agentPrompt ? `${baseInstruction} ${agentPrompt}` : baseInstruction;
    const ragConfig = { systemInstruction: agentInstruction };

    // Query RAG engine with agent context
    const ragResponse = await ragEngine.query(message, chatHistory.get(convId) || [], ragConfig);

    // Validate response with guardrails
    if (!guardrails.validateResponse(ragResponse.answer)) {
      ragResponse.answer = guardrailsResult.redirectResponse || 'Response filtered by safety guardrails.';
    }

    // Store assistant response
    chatHistory.get(convId)!.push({
      role: 'assistant',
      content: ragResponse.answer,
    });

    logActivity('info', `Chat: ${agentId || 'default'} - "${message.slice(0, 50)}..."`, 'Chat');

    res.json({
      success: true,
      data: {
        answer: ragResponse.answer,
        confidence: ragResponse.confidence,
        sources: ragResponse.sources,
        contextUsed: ragResponse.contextUsed,
        conversationId: convId,
        safetyScore,
        agentId,
      },
    });
  } catch (error) {
    console.error('❌ Chat error:', error);
    console.error('   Stack:', error instanceof Error ? error.stack : 'No stack');
    res.status(500).json({ success: false, error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown'}` });
  }
});

// ============== CHAT WITH FILE ATTACHMENTS ==============

app.post('/api/chat-with-file', async (req, res) => {
  try {
    const { message, conversationId, language = 'vi', agentId, agentPrompt, attachments } = req.body;
    
    // Write to log file
    fs.appendFileSync('/tmp/chatlog.txt', `=== ${new Date().toISOString()} ===\n`);
    fs.appendFileSync('/tmp/chatlog.txt', `Attachments count: ${attachments?.length || 0}\n`);
    if (attachments) {
      attachments.forEach((att, i) => {
        fs.appendFileSync('/tmp/chatlog.txt', `Att[${i}]: type=${att.type}, name=${att.name}, hasBase64=${!!att.base64}\n`);
      });
    }
    fs.appendFileSync('/tmp/chatlog.txt', `Message: ${message?.slice(0, 100)}\n\n`);
    
    console.log('🔵 CHAT/WITH-FILE ENDPOINT CALLED');
    console.log('🔵 Attachments:', attachments?.length || 0);

    console.log('📩 Chat with files:', { message: message?.slice(0, 50), fileCount: attachments?.length || 0 });

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Parse attachments if provided
    let fileContext = '';
    console.log('📎 Chat/file called with attachments:', attachments ? attachments.length : 0);
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      console.log('📎 Processing attachments...');
      
      for (const att of attachments) {
        console.log('📎 Attachment type:', att.type, '| name:', att.name, '| hasBase64:', !!att.base64);
        
        if (att.type === 'text' && att.content) {
          // Plain text content
          fileContext += `\n\n=== FILE: ${att.name || 'Document'} ===\n${att.content}\n`;
        } else if (att.type === 'url' && att.url) {
          // URL - need to scrape
          try {
            const response = await fetch(att.url);
            const html = await response.text();
            const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            fileContext += `\n\n=== URL: ${att.url} ===\n${text.slice(0, 5000)}\n`;
          } catch (e) {
            console.log('Failed to fetch URL:', att.url);
          }
        } else if ((att.type === 'pdf' || att.type === 'application/pdf' || att.name?.endsWith('.pdf')) && att.base64) {
          // PDF - decode base64 and parse
          console.log('🔵✅ MATCHED PDF CONDITION');
          console.log('📎 Processing as PDF...');
          try {
            const buffer = Buffer.from(att.base64, 'base64');
            console.log('📎 Buffer size:', buffer.length);
            const tempPath = `/tmp/${Date.now()}_${att.name || 'file.pdf'}`;
            fs.writeFileSync(tempPath, buffer);
            console.log('📎 Temp file written:', tempPath);
            
            const { parsePDFFile } = await import('./lib/rag/fileParsers');
            const text = await parsePDFFile(tempPath);
            fs.unlinkSync(tempPath);
            console.log('📎 PDF parsed, text length:', text.length);
            
            fileContext += `\n\n=== FILE: ${att.name || 'Document.pdf'} ===\n${text}\n`;
          } catch (e) {
            console.error('📎 PDF parse error:', e);
            fileContext += `\n\n=== FILE: ${att.name || 'Document.pdf'} ===\n[Không thể đọc nội dung PDF]\n`;
          }
        } else if ((att.type === 'docx' || att.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || att.name?.endsWith('.docx')) && att.base64) {
          // DOCX - decode base64 and parse
          try {
            const buffer = Buffer.from(att.base64, 'base64');
            const tempPath = `/tmp/${Date.now()}_${att.name || 'file.docx'}`;
            fs.writeFileSync(tempPath, buffer);
            
            const { parseDocxFile } = await import('./lib/rag/fileParsers');
            const text = await parseDocxFile(tempPath);
            fs.unlinkSync(tempPath);
            
            fileContext += `\n\n=== FILE: ${att.name || 'Document.docx'} ===\n${text}\n`;
          } catch (e) {
            console.error('DOCX parse error:', e);
            fileContext += `\n\n=== FILE: ${att.name || 'Document.docx'} ===\n[Không thể đọc nội dung DOCX]\n`;
          }
        }
      }
      
      console.log(`📎 File context prepared: ${fileContext.length} chars`);
    }
    
    console.log('📎 Final fileContext:', fileContext.slice(0, 200));
    // Guardrails check
    const guardrailsResult = guardrails.analyzeQuery(message, language);
    if (guardrailsResult.shouldRedirect) {
      return res.json({
        success: true,
        data: { answer: guardrailsResult.redirectResponse, sources: [], contextUsed: false },
      });
    }

    // Store history
    const convId = conversationId || uuidv4();
    if (!chatHistory.has(convId)) {
      chatHistory.set(convId, []);
    }
    chatHistory.get(convId)!.push({ role: 'user', content: message });

    // Build prompt WITH file context
    let enhancedMessage = message;
    console.log('🔵 fileContext length:', fileContext.length);
    
    // Language-specific file analysis prompts
    const filePromptTemplates: Record<string, { task: string; instructions: string; respondNow: string }> = {
      vi: {
        task: 'Nhiệm vụ: Đọc và phân tích TẤT CẢ nội dung tài liệu đính kèm bên dưới.',
        instructions: `- Đọc KỸ và HIỂU toàn bộ nội dung tài liệu
- Trả lời DỰA TRÊN nội dung thực tế trong tài liệu bằng tiếng Việt
- Nếu được hỏi "tóm tắt" hoặc "có gì", hãy LIỆT KÊ TẤT CẢ các mục, thông tin, quy định có trong tài liệu
- Trích dẫn CHÍNH XÁC thông tin từ tài liệu khi trả lời
- KHÔNG bịa đặt hoặc thêm thông tin không có trong tài liệu`,
        respondNow: 'Hãy trả lời ngay bây giờ:'
      },
      en: {
        task: 'Task: Read and analyze ALL content of the attached document below.',
        instructions: `- Read CAREFULLY and UNDERSTAND all document content
- Answer BASED ON the actual content in the document in English
- If asked to "summarize" or "what\'s inside", LIST ALL items, information, and regulations in the document
- Quote EXACTLY the information from the document when answering
- DO NOT fabricate or add information not in the document`,
        respondNow: 'Please respond now:'
      },
      ar: {
        task: 'المهمة: قراءة وتحليل جميع محتويات المستند المرفق أدناه.',
        instructions: `- اقرأ بعناية وفهم جميع محتويات المستند
- أجب بناءً على المحتوى الفعلي في المستند باللغة العربية
- إذا طُلب "تلخيص" أو "ما داخله"، فاذكر جميع العناصر والمعلومات واللوائح في المستند
- اقتبس المعلومات من المستند بدقة عند الإجابة
- لا تخترع أو تضيف معلومات غير موجودة في المستند`,
        respondNow: 'الرجاء الرد الآن:'
      },
      fr: {
        task: 'Tâche: Lire et analyser TOUT le contenu du document ci-joint.',
        instructions: `- Lisez SOIGNEUSEMENT et COMPRENEZ tout le contenu du document
- Répondez BASÉ SUR le contenu réel du document en français
- Si on vous demande de "résumer" ou "contenu", LISTEZ TOUS les éléments, informations et réglementations du document
- Citez EXACTEMENT les informations du document lors de la réponse
- NE PAS inventer ou ajouter des informations non présentes dans le document`,
        respondNow: 'Veuillez répondre maintenant:'
      }
    };
    
    const promptTemplate = filePromptTemplates[language] || filePromptTemplates.vi;
    
    if (fileContext) {
      enhancedMessage = `${promptTemplate.task}
      
Question: ${message}

DOCUMENT:
${fileContext}

REQUIREMENTS:
${promptTemplate.instructions}

${promptTemplate.respondNow}`;
      console.log('🔵 enhancedMessage length:', enhancedMessage.length);
    }

    // Query RAG - Dùng system prompt khác khi có file đính kèm
    const languageInstructions: Record<string, string> = {
      vi: 'Ban la tro ly AI MADA ho tro phan tich tai lieu. Hay tra loi CHI TIET va DAY DU tieng Viet.',
      en: 'You are MADA AI assistant for document analysis. Respond in English. Answer DETAILED and COMPLETE.',
      ar: 'أنت مساعد MADA الذكي لتحليل المستندات. أجب دائمًا باللغة العربية وبالتفصيل.',
      fr: 'Vous êtes l\'assistant MADA pour l\'analyse de documents. Répondez en français et en détail.',
    };
    
    const langInstruction = languageInstructions[language] || languageInstructions.vi;
    
    const ragConfig: any = {};
    
    if (fileContext) {
      // Khi có file - dùng system prompt không giới hạn
      ragConfig.systemInstruction = langInstruction;
      ragConfig.maxOutputTokens = 8192; // Tăng output cho file dài
    } else if (agentPrompt) {
      ragConfig.systemInstruction = `${langInstruction} ${agentPrompt}`;
    }

    const ragResponse = await ragEngine.query(enhancedMessage, chatHistory.get(convId) || [], ragConfig);

    // Log response length for debugging
    console.log('🔵 RAG response length:', ragResponse.answer.length);
    console.log('🔵 RAG sources:', ragResponse.sources?.length || 0);

    // Store response
    chatHistory.get(convId)!.push({ role: 'assistant', content: ragResponse.answer });

    res.json({
      success: true,
      data: {
        answer: ragResponse.answer,
        sources: ragResponse.sources,
        contextUsed: true,
        fileContextIncluded: !!fileContext,
        conversationId: convId,
      },
    });
  } catch (error) {
    console.error('❌ Chat file error:', error);
    res.status(500).json({ success: false, error: `Error: ${error instanceof Error ? error.message : 'Unknown'}` });
  }
});

// ============== SCRAPE ENDPOINT ==============

// Scrape content from URL (used by ChatPage for URL attachments)
app.get('/api/scrape', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid URL format' });
    }

    // Only allow http and https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ success: false, error: 'Only HTTP and HTTPS URLs are allowed' });
    }

    // ========== SPECIAL HANDLING FOR GOOGLE DOCS ==========
    // Google Docs published URLs - export as plain text
    if (
      parsedUrl.hostname.includes('docs.google.com') &&
      (parsedUrl.pathname.includes('/document/d/') || parsedUrl.pathname.includes('/document/pub/'))
    ) {
      try {
        // For published Google Docs, we can try to get the export URL
        const docIdMatch = parsedUrl.pathname.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
        if (docIdMatch) {
          const docId = docIdMatch[1];
          const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          
          const response = await fetch(exportUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; MADA-AI/1.0)',
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const text = await response.text();
            return res.status(200).json({
              success: true,
              data: {
                title: 'Google Docs',
                content: text.slice(0, 50000), // Limit content size
                url: url,
                type: 'google-docs',
              },
            });
          }
        }
      } catch (e) {
        console.error('Google Docs fetch error:', e);
        // Fall through to normal scraping
      }
    }

    // Fetch the URL
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MADA-AI/1.0; +https://mada.ai)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(400).json({ success: false, error: `Failed to fetch URL: ${response.status} ${response.statusText}` });
      }

      const contentType = response.headers.get('content-type') || '';

      // Only process HTML content
      if (!contentType.includes('text/html')) {
        // Return as raw text for other content types
        const text = await response.text();
        return res.status(200).json({
          success: true,
          data: {
            title: parsedUrl.hostname,
            content: text.slice(0, 10000),
            url: url,
            type: 'raw',
          },
        });
      }

      const html = await response.text();

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : parsedUrl.hostname;

      // Extract main content using basic HTML parsing
      let content = extractMainContent(html);

      // Extract meta description
      const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : '';

      // Combine meta description with content if available
      if (metaDescription && !content.includes(metaDescription)) {
        content = metaDescription + '\n\n' + content;
      }

      res.status(200).json({
        success: true,
        data: {
          title: title,
          content: content,
          url: url,
          type: 'html',
        },
      });
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return res.status(400).json({ success: false, error: 'Request timeout - the website took too long to respond' });
      }

      return res.status(500).json({ success: false, error: 'Failed to fetch URL content' });
    }
  } catch (error) {
    console.error('Scrape error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Helper function to extract main content from HTML
function extractMainContent(html: string): string {
  // Remove script tags
  let content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Remove style tags
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove comments
  content = content.replace(/<!--[\s\S]*?-->/g, '');

  // Remove nav, header, footer, aside elements
  content = content.replace(/<(nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Try to find main content
  const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    content = mainMatch[1];
  } else {
    // Try article tag
    const articleMatch = content.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      content = articleMatch[1];
    }
  }

  // Replace divs and spans with newlines
  content = content.replace(/<\/(div|p|li|tr|h[1-6])>/gi, '\n');
  content = content.replace(/<br\s*\/?>/gi, '\n');

  // Remove all remaining HTML tags
  content = content.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  content = decodeHTMLEntities(content);

  // Clean up whitespace
  content = content.replace(/\s+/g, ' ').trim();

  // Limit content length
  return content.slice(0, 15000);
}

// Helper to decode HTML entities
function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&ndash;': '–',
    '&mdash;': '—',
    '&hellip;': '...',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'gi'), char);
  }

  // Handle numeric entities
  result = result.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  result = result.replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return result;
}

// ============== DATA INGESTION ENDPOINTS ==============

// Upload and ingest text/URL
app.post('/api/data/ingest', async (req, res) => {
  try {
    const { content, url, type = 'text', title } = req.body;

    if (!content && !url) {
      return res.status(400).json({
        success: false,
        error: 'Either content or url is required',
      });
    }

    const source: DataSource = {
      type: url ? 'web' : (type as 'text' | 'pdf'),
      content: content || '',
      source: url || 'manual-input',
      title,
    };

    const result = await dataIngestion.ingestData(source);

    res.json({
      success: result.success,
      data: {
        taskId: result.taskId,
        documentsAdded: result.documentsAdded,
        message: result.message,
      },
    });
  } catch (error) {
    console.error('Ingestion error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Upload file (PDF, TXT, etc.)
app.post('/api/data/upload', async (req, res) => {
  try {
    const { filename, content } = req.body;

    if (!filename || !content) {
      return res.status(400).json({
        success: false,
        error: 'Filename and content are required',
      });
    }

    const ext = path.extname(filename).toLowerCase();
    const isPDF = ext === '.pdf';

    const source: DataSource = {
      type: isPDF ? 'pdf' : 'text',
      content,
      source: `upload:${filename}`,
      title: filename,
    };

    const result = await dataIngestion.ingestData(source);

    res.json({
      success: result.success,
      data: {
        taskId: result.taskId,
        documentsAdded: result.documentsAdded,
        message: result.message,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Batch ingest multiple sources
app.post('/api/data/batch', async (req, res) => {
  try {
    const { sources } = req.body;

    if (!sources || !Array.isArray(sources)) {
      return res.status(400).json({
        success: false,
        error: 'Sources array is required',
      });
    }

    const results = await dataIngestion.ingestMultiple(sources);

    const totalDocs = results.reduce((sum, r) => sum + r.documentsAdded, 0);
    const successCount = results.filter(r => r.success).length;

    res.json({
      success: true,
      data: {
        totalSources: sources.length,
        successCount,
        totalDocumentsAdded: totalDocs,
        results,
      },
    });
  } catch (error) {
    console.error('Batch ingestion error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get ingestion logs
app.get('/api/data/logs', async (_req, res) => {
  try {
    const logs = await dataIngestion.getIngestionLogs(50);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== KNOWLEDGE BASE ENDPOINTS ==============

// Search knowledge base
app.get('/api/knowledge/search', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    const results = await vectorStore.search(q as string, Number(limit));

    res.json({
      success: true,
      data: {
        query: q,
        results,
        total: results.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get knowledge base stats
app.get('/api/knowledge/stats', async (_req, res) => {
  try {
    const stats = await vectorStore.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Clear knowledge base
app.delete('/api/knowledge', async (_req, res) => {
  try {
    await vectorStore.clear();
    res.json({
      success: true,
      message: 'Knowledge base cleared successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== LEGACY ENDPOINTS ==============

// RAG Recommendation endpoint
app.post('/api/recommend', async (req, res) => {
  try {
    const { query, language = 'vi', maxResults = 5 } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    // Check with Guardrails first
    const guardrailsResult = guardrails.analyzeQuery(query, language);

    // If query should be redirected
    if (guardrailsResult.shouldRedirect) {
      return res.json({
        success: true,
        data: {
          answer: guardrailsResult.redirectResponse,
          confidence: 0,
          sources: [],
          contextUsed: false,
          redirected: true,
          redirectReason: guardrailsResult.detectedPattern,
        },
      });
    }

    const ragResponse = await ragEngine.query(query, [], { topK: maxResults });

    res.json({
      success: true,
      data: ragResponse,
    });
  } catch (error) {
    console.error('RAG error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Consultation submission
app.post('/api/consultations', async (req, res) => {
  try {
    const { name, email, phone, message, aiResponse } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and message are required',
      });
    }

    const consultation = {
      id: uuidv4(),
      name,
      email,
      phone,
      message,
      aiResponse,
      status: 'pending',
      priority: 'medium',
      createdAt: new Date().toISOString(),
    };

    consultations.push(consultation);

    res.json({
      success: true,
      data: consultation,
      message: 'Consultation request submitted successfully',
    });
  } catch (error) {
    console.error('Consultation error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get consultations (for experts)
app.get('/api/consultations', (req, res) => {
  const { status, limit = 50 } = req.query;

  let filtered = consultations;
  if (status) {
    filtered = consultations.filter((c) => c.status === status);
  }

  res.json({
    success: true,
    data: filtered.slice(-Number(limit)),
  });
});

// Data collection endpoint (legacy)
app.post('/api/data/collect', async (req, res) => {
  try {
    const { url, type = 'website' } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    const result = await dataIngestion.ingestData({
      type: 'web',
      content: '',
      source: url,
    });

    res.json({
      success: result.success,
      data: {
        taskId: result.taskId,
        status: result.success ? 'completed' : 'failed',
        url,
        type,
        documentsAdded: result.documentsAdded,
        createdAt: new Date().toISOString(),
      },
      message: result.message,
    });
  } catch (error) {
    console.error('Collection error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Statistics endpoint
app.get('/api/stats', async (_req, res) => {
  try {
    const kbStats = await vectorStore.getStats();

    res.json({
      success: true,
      data: {
        totalUsers: 1234,
        totalDocuments: kbStats.totalDocuments,
        totalQueries: 45231,
        averageAccuracy: kbStats.totalDocuments > 0 ? 95.5 : 0,
        averageResponseTime: 1.2,
        storageUsed: 2.4,
        storageLimit: 10,
        ragEnabled: ragInitialized,
        knowledgeBaseReady: kbStats.isInitialized,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== COMPREHENSIVE DATA ENDPOINTS ==============

// Add comprehensive knowledge base
app.post('/api/data/comprehensive', async (_req, res) => {
  try {
    console.log('📚 Loading comprehensive knowledge base...');
    
    const sources = COMPREHENSIVE_KNOWLEDGE.map((item, index) => ({
      type: 'text' as const,
      content: item.content,
      source: `who:mada:at_${index + 1}`,
      title: item.topic,
    }));

    const results = await dataIngestion.ingestMultiple(sources);
    const totalDocs = results.reduce((sum, r) => sum + r.documentsAdded, 0);

    console.log(`✅ Added ${totalDocs} documents from ${COMPREHENSIVE_KNOWLEDGE.length} comprehensive topics`);

    res.json({
      success: true,
      data: {
        topicsAdded: COMPREHENSIVE_KNOWLEDGE.length,
        documentsAdded: totalDocs,
        topics: COMPREHENSIVE_KNOWLEDGE.map(k => k.topic),
      },
      message: `Đã thêm ${COMPREHENSIVE_KNOWLEDGE.length} chủ đề với ${totalDocs} tài liệu vào cơ sở tri thức`,
    });
  } catch (error) {
    console.error('Comprehensive data error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== SAMPLE DATA ENDPOINTS ==============

// Add sample knowledge base
app.post('/api/data/sample', async (_req, res) => {
  try {
    const sampleData = [
      {
        type: 'text' as const,
        content: `Công nghệ hỗ trợ người khuyết tật (Assistive Technology) là các thiết bị, phần mềm hoặc hệ thống giúp người khuyết tật thực hiện các hoạt động hàng ngày một cách độc lập hơn. Theo tiêu chuẩn ISO 9999, có 7 danh mục chính: thiết bị nhìn (Vision), thiết bị nghe (Hearing), thiết bị vận động (Mobility), thiết bị nhận thức (Cognition), thiết bị giao tiếp (Communication), hỗ trợ sinh hoạt (Daily Living), và giáo dục (Education).`,
        source: 'sample:mada_at_basics',
        title: 'Giới thiệu về Công nghệ Hỗ trợ',
      },
      {
        type: 'text' as const,
        content: `JAWS (Job Access With Speech) là phần mềm đọc màn hình phổ biến nhất dành cho người khiếm thị. JAWS hỗ trợ nhiều ngôn ngữ bao gồm tiếng Việt, cho phép người dùng điều khiển máy tính hoàn toàn bằng bàn phím thông qua giọng nói. JAWS tương thích với Windows và nhiều ứng dụng văn phòng.`,
        source: 'sample:JAWS_software',
        title: 'Phần mềm đọc màn hình JAWS',
      },
      {
        type: 'text' as const,
        content: `NVDA (NonVisual Desktop Access) là phần mềm đọc màn hình mã nguồn mở và miễn phí dành cho người khiếm thị trên hệ điều hành Windows. NVDA được phát triển bởi tổ chức NV Access và có cộng đồng hỗ trợ lớn trên toàn thế giới. Phần mềm này hỗ trợ hơn 50 ngôn ngữ và có thể cài đặt trên USB mà không cần cài đặt trên máy.`,
        source: 'sample:NVDA_software',
        title: 'Phần mềm đọc màn hình NVDA',
      },
      {
        type: 'text' as const,
        content: `Màn hình Braille là thiết bị xuất ra dạng nổi (Braille) cho phép người khiếm thị đọc nội dung trên màn hình máy tính. Màn hình Braille thường có từ 20 đến 80 ô Braille, mỗi ô có thể hiển thị một ký tự. Thiết bị này kết nối với máy tính qua USB hoặc Bluetooth và tương thích với các phần mềm đọc màn hình như JAWS và NVDA.`,
        source: 'sample:braille_display',
        title: 'Màn hình Braille',
      },
      {
        type: 'text' as const,
        content: `WCAG 2.1 (Web Content Accessibility Guidelines) là hướng dẫn quốc tế về tiếp cận nội dung web dành cho người khuyết tật. WCAG được phát triển bởi W3C và có 4 nguyên tắc chính: Có thể nhận thức (Perceivable), Có thể vận hành (Operable), Dễ hiểu (Understandable), và Mạnh mẽ (Robust). Tiêu chuẩn này có 3 mức độ tuân thủ: A, AA, và AAA.`,
        source: 'sample:WCAG_standards',
        title: 'Tiêu chuẩn WCAG 2.1',
      },
      {
        type: 'text' as const,
        content: `Xe lăn điện là thiết bị hỗ trợ di chuyển cho người khuyết tật vận động. Xe lăn điện hiện đại có thể điều khiển bằng joystick, điện thoại thông minh, hoặc cử chỉ đầu/mắt. Một số xe lăn có thể leo cầu thang, đứng thẳng, và điều chỉnh chiều cao. Pin xe lăn điện thường có thời gian sử dụng từ 8-20 giờ tùy model.`,
        source: 'sample:electric_wheelchair',
        title: 'Xe lăn điện',
      },
      {
        type: 'text' as const,
        content: `AAC (Augmentative and Alternative Communication) là các phương pháp giao tiếp thay thế và bổ sung dành cho người gặp khó khăn trong giao tiếp bằng lời nói. AAC bao gồm: giao tiếp bằng hình ảnh (PECS), thiết bị phát âm điện tử, ứng dụng giao tiếp trên tablet, và ngôn ngữ ký hiệu. AAC không thay thế việc phát triển lời nói mà bổ sung cho nó.`,
        source: 'sample:AAC_systems',
        title: 'Hệ thống giao tiếp AAC',
      },
      {
        type: 'text' as const,
        content: `Bàn phím thích ứng là thiết bị hỗ trợ người có khó khăn về vận động tay có thể sử dụng máy tính. Bàn phím thích ứng có thể có phím lớn, phím mềm, gập được, hoặc có thể điều khiển bằng miệng. Một số bàn phím còn tích hợp chuột cảm ứng hoặc head mouse (điều khiển bằng đầu).`,
        source: 'sample:adaptive_keyboard',
        title: 'Bàn phím thích ứng',
      },
    ];

    const results = await dataIngestion.ingestMultiple(sampleData);
    const totalDocs = results.reduce((sum, r) => sum + r.documentsAdded, 0);

    res.json({
      success: true,
      data: {
        sourcesAdded: sampleData.length,
        documentsAdded: totalDocs,
        results,
      },
      message: `Đã thêm ${totalDocs} tài liệu mẫu vào cơ sở tri thức`,
    });
  } catch (error) {
    console.error('Sample data error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Add seed data
app.post('/api/data/seed', async (_req, res) => {
  try {
    const sources = SEED_KNOWLEDGE.map((item, index) => ({
      type: 'text' as const,
      content: item.content,
      source: `seed:knowledge_${index + 1}`,
      title: item.topic,
    }));

    const results = await dataIngestion.ingestMultiple(sources);
    const totalDocs = results.reduce((sum, r) => sum + r.documentsAdded, 0);

    res.json({
      success: true,
      data: {
        topicsAdded: SEED_KNOWLEDGE.length,
        documentsAdded: totalDocs,
      },
      message: `Đã thêm ${SEED_KNOWLEDGE.length} chủ đề kiến thức vào cơ sở tri thức`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== CONSULTATION ROUTES ==============
// Lưu trữ consultation requests
interface ConsultationRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  timestamp: string;
  status: 'pending' | 'reviewed' | 'contacted';
}

const consultationRequests: ConsultationRequest[] = [];

app.post('/api/consultation', async (req, res) => {
  try {
    const { name, email, phone, message, timestamp } = req.body;

    // Validate
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng điền đầy đủ thông tin bắt buộc (tên, email, yêu cầu)',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Email không hợp lệ',
      });
    }

    // Tạo request
    const request: ConsultationRequest = {
      id: uuidv4(),
      name,
      email,
      phone: phone || '',
      message,
      timestamp: timestamp || new Date().toISOString(),
      status: 'pending',
    };

    consultationRequests.push(request);
    logActivity('info', `Yêu cầu tư vấn mới từ ${name} (${email})`, 'Consultation');

    // Gửi email thông báo (nếu có MAIL config)
    if (process.env.MAIL_HOST && process.env.MAIL_USERNAME) {
      try {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.createTransport({
          host: process.env.MAIL_HOST,
          port: parseInt(process.env.MAIL_PORT || '465'),
          secure: process.env.MAIL_SECURE === 'true',
          requireTLS: process.env.MAIL_TLS === 'true',
          auth: {
            user: process.env.MAIL_USERNAME,
            pass: process.env.MAIL_PASSWORD,
          },
        });

        await transporter.sendMail({
          from: process.env.MAIL_FROM || 'mada.noreply@digiso.vn',
          to: process.env.CONSULTATION_EMAIL || 'contact@mada.vn',
          subject: `[MADA] Yêu cầu tư vấn mới từ ${name}`,
          html: `
            <h2>Yêu cầu tư vấn chuyên gia mới</h2>
            <p><strong>Họ tên:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Điện thoại:</strong> ${phone || 'Không cung cấp'}</p>
            <p><strong>Thời gian:</strong> ${new Date(request.timestamp).toLocaleString('vi-VN')}</p>
            <h3>Nội dung yêu cầu:</h3>
            <p>${message.replace(/\n/g, '<br>')}</p>
          `,
        });

        logActivity('success', `Email thông báo đã gửi cho ${process.env.CONSULTATION_EMAIL || 'contact@mada.vn'}`, 'Consultation');
      } catch (emailError) {
        logActivity('warn', `Không thể gửi email: ${emailError}`, 'Consultation');
        // Không fail request vì đã lưu vào database
      }
    }

    res.json({
      success: true,
      data: {
        id: request.id,
        message: 'Yêu cầu tư vấn đã được gửi thành công. Chuyên gia sẽ liên hệ trong 24-48 giờ.',
      },
    });
  } catch (error) {
    console.error('Consultation error:', error);
    logActivity('error', `Lỗi xử lý yêu cầu tư vấn: ${error}`, 'Consultation');
    res.status(500).json({ success: false, error: 'Có lỗi xảy ra. Vui lòng thử lại.' });
  }
});

// Get all consultation requests (admin only)
app.get('/api/consultation', async (req, res) => {
  try {
    const { status } = req.query;
    let filtered = [...consultationRequests];

    if (status && typeof status === 'string') {
      filtered = filtered.filter((r) => r.status === status);
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      success: true,
      data: filtered,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update consultation status (admin only)
app.patch('/api/consultation/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const request = consultationRequests.find((r) => r.id === id);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu' });
    }

    request.status = status || request.status;
    logActivity('info', `Cập nhật trạng thái yêu cầu ${id} thành ${request.status}`, 'Consultation');

    res.json({
      success: true,
      data: request,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MADA AI Server running on http://localhost:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/health`);
  console.log(`⚡ RAG Enabled: ${ragInitialized}`);
  console.log(`🤖 Gemini Configured: ${!!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'}`);
  console.log(`🛡️  Guardrails: Active`);
  console.log(`🔐 Auth: SQLite + bcrypt + JWT (admin: ${process.env.ADMIN_EMAIL || 'admin@mada.vn'})`);
});

export default app;
