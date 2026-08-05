/**
 * File parsers cho PDF và DOCX
 * Tuần 1 — Task 2: Web Scraper Pipeline
 */

import fs from 'fs';

// pdf-parse có một quirk: nó tự động chạy test khi import
// workaround: import default và handle lỗi gracefully
let pdfParse: any = null;
let mammoth: any = null;

async function loadPdfParse() {
  if (pdfParse) return pdfParse;
  try {
    const mod = await import('pdf-parse');
    pdfParse = (mod as any).default || mod;
    return pdfParse;
  } catch (err) {
    console.error('Failed to load pdf-parse:', err);
    throw new Error('Không thể load pdf-parse. Chạy: npm install pdf-parse');
  }
}

async function loadMammoth() {
  if (mammoth) return mammoth;
  try {
    const mod = await import('mammoth');
    mammoth = (mod as any).default || mod;
    return mammoth;
  } catch (err) {
    console.error('Failed to load mammoth:', err);
    throw new Error('Không thể load mammoth. Chạy: npm install mammoth');
  }
}

/**
 * Parse PDF file (nhận đường dẫn tuyệt đối)
 * Trả về text đã được clean
 */
export async function parsePDFFile(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File không tồn tại: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  const parse = await loadPdfParse();

  try {
    const data = await parse(buffer, { max: 0 });
    let text = data.text || '';

    // Cleanup: gộp whitespace thừa, giữ cấu trúc dòng
    text = text
      .replace(/[ \t]+/g, ' ')           // nhiều space → 1 space
      .replace(/\n[ \t]+/g, '\n')         // trim leading whitespace
      .replace(/[ \t]+\n/g, '\n')         // trim trailing whitespace
      .replace(/\n{3,}/g, '\n\n')         // nhiều blank line → 2
      .trim();

    console.log(`📄 PDF parsed: ${text.length} chars from ${path(filePath)}`);
    return text;
  } catch (err: any) {
    throw new Error(`Lỗi parse PDF: ${err.message}`);
  }
}

function path(p: string): string {
  return p.split(/[/\\]/).pop() || p;
}

/**
 * Parse DOCX file
 */
export async function parseDocxFile(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File không tồn tại: ${filePath}`);
  }

  const m = await loadMammoth();

  try {
    // extractRawText giữ text thuần (không kèm HTML)
    const result = await m.extractRawText({ path: filePath });
    let text = result.value || '';

    // Cleanup
    text = text
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    console.log(`📝 DOCX parsed: ${text.length} chars from ${path(filePath)}`);
    return text;
  } catch (err: any) {
    throw new Error(`Lỗi parse DOCX: ${err.message}`);
  }
}

/**
 * Detect MIME type từ extension
 */
export function detectFileType(filename: string): 'pdf' | 'docx' | 'txt' | 'image' | 'unknown' {
  const ext = filename.toLowerCase().split('.').pop() || '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx' || ext === 'doc') return 'docx';
  if (ext === 'txt' || ext === 'md') return 'txt';
  if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'gif'].includes(ext)) return 'image';
  return 'unknown';
}
