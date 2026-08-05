/**
 * OCR Helper — Trích xuất text từ ảnh
 * Sử dụng tesseract.js (chạy local, không cần API key)
 * + sharp để tiền xử lý ảnh (tăng độ chính xác OCR)
 */

import fs from 'fs';
import path from 'path';

let tesseract: any = null;
let sharp: any = null;

async function loadTesseract() {
  if (tesseract) return tesseract;
  try {
    const mod = await import('tesseract.js');
    tesseract = mod.default || mod;
    return tesseract;
  } catch (err) {
    console.error('Failed to load tesseract.js:', err);
    throw new Error('Không thể load tesseract.js. Chạy: npm install tesseract.js');
  }
}

async function loadSharp() {
  if (sharp) return sharp;
  try {
    const mod = await import('sharp');
    sharp = mod.default || mod;
    return mod.default || mod;
  } catch {
    // sharp không bắt buộc — nếu thiếu, bỏ qua preprocessing
    console.warn('sharp not available — OCR sẽ chạy trực tiếp trên ảnh gốc');
    return null;
  }
}

export interface OcrResult {
  text: string;
  confidence: number;
  language: string;
  words: number;
  lines: number;
}

export interface ImageInfo {
  width: number;
  height: number;
  format: string;
  size: number;
  hasText: boolean;
}

/**
 * Lấy metadata của ảnh
 */
export async function getImageInfo(filePath: string): Promise<ImageInfo> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File không tồn tại: ${filePath}`);
  }
  const stat = fs.statSync(filePath);
  const s = await loadSharp();

  if (s) {
    try {
      const meta = await s(filePath).metadata();
      return {
        width: meta.width || 0,
        height: meta.height || 0,
        format: meta.format || 'unknown',
        size: stat.size,
        hasText: false, // sẽ được cập nhật sau khi OCR
      };
    } catch (err) {
      console.warn('sharp metadata failed:', err);
    }
  }

  return {
    width: 0, height: 0, format: path.extname(filePath).slice(1),
    size: stat.size, hasText: false,
  };
}

/**
 * Tiền xử lý ảnh trước khi OCR — tăng độ chính xác:
 * - Resize về chiều rộng tối thiểu 1200px
 * - Chuyển grayscale
 * - Tăng contrast
 * - Sharpen
 */
export async function prepareImageForOcr(inputPath: string): Promise<string> {
  const s = await loadSharp();
  if (!s) return inputPath;

  const outputPath = inputPath.replace(/\.[^.]+$/, '') + '.ocr.png';

  try {
    await s(inputPath)
      .resize({ width: 1600, withoutEnlargement: false })
      .grayscale()
      .normalize()                    // auto contrast
      .sharpen({ sigma: 1.5 })
      .toFile(outputPath);

    console.log(`🖼️  Preprocessed: ${path.basename(inputPath)} → ${path.basename(outputPath)}`);
    return outputPath;
  } catch (err: any) {
    console.warn('Image preprocessing failed, dùng ảnh gốc:', err.message);
    return inputPath;
  }
}

/**
 * Chạy OCR trên ảnh — trả về text + metadata
 */
export async function extractImageText(
  filePath: string,
  lang: string = 'vie+eng'
): Promise<OcrResult> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File không tồn tại: ${filePath}`);
  }

  // Validate magic bytes để chắc chắn là ảnh hợp lệ
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(12);
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);
  const isValidImage =
    (buf[0] === 0xFF && buf[1] === 0xD8) || // JPEG
    (buf[0] === 0x89 && buf[1] === 0x50) || // PNG
    (buf[0] === 0x47 && buf[1] === 0x49) || // GIF
    (buf[0] === 0x52 && buf[1] === 0x49) || // WEBP (RIFF)
    (buf[0] === 0x42 && buf[1] === 0x4D);   // BMP
  if (!isValidImage) {
    throw new Error('File không phải ảnh hợp lệ (JPEG/PNG/WEBP/BMP/GIF mới hỗ trợ OCR)');
  }

  const tess = await loadTesseract();
  const processedPath = await prepareImageForOcr(filePath);

  try {
    const start = Date.now();
    const { data } = await tess.recognize(processedPath, lang, {
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          const pct = Math.round(m.progress * 100);
          process.stdout.write(`\r🔍 OCR: ${pct}%   `);
        }
      },
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n✅ OCR done in ${elapsed}s — confidence: ${data.confidence.toFixed(1)}%`);

    const text = (data.text || '').trim();
    const lines = text.split('\n').filter((l: string) => l.trim()).length;
    const words = data.words?.length || text.split(/\s+/).filter(Boolean).length;

    return {
      text,
      confidence: data.confidence / 100,
      language: lang,
      words,
      lines,
    };
  } catch (err: any) {
    throw new Error(`Lỗi OCR: ${err.message}`);
  } finally {
    // Cleanup file tạm
    if (processedPath !== filePath && fs.existsSync(processedPath)) {
      try { fs.unlinkSync(processedPath); } catch {}
    }
  }
}

/**
 * Trích xuất text từ buffer (dùng cho upload trực tiếp không qua file)
 */
export async function extractImageTextFromBuffer(
  buffer: Buffer,
  filename: string = 'upload.png',
  lang: string = 'vie+eng'
): Promise<OcrResult> {
  const tmpPath = path.join(process.cwd(), 'data', 'uploads', `tmp_${Date.now()}_${filename}`);
  fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
  fs.writeFileSync(tmpPath, buffer);
  try {
    return await extractImageText(tmpPath, lang);
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}
