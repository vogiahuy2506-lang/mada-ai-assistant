/**
 * File parsers cho PDF và DOCX
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Mammoth for DOCX parsing
let mammoth: any = null;

async function loadMammoth() {
  if (mammoth) return mammoth;
  try {
    const mod = await import('mammoth');
    mammoth = (mod as any).default || mod;
    return mammoth;
  } catch (err) {
    console.error('Failed to load mammoth:', err);
    throw new Error('Không thể load mammoth');
  }
}

/**
 * Parse PDF using pdf-parse
 */
export async function parsePDFFile(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File không tồn tại: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);

  try {
    const pdfParse = require('pdf-parse');
    const parseFn = typeof pdfParse === 'function' ? pdfParse : (pdfParse.default || pdfParse);
    
    const data = await parseFn(buffer, { max: 0 });
    let text = data.text || '';

    // Cleanup
    text = text
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    console.log(`📄 PDF parsed: ${text.length} chars from ${path.basename(filePath)}`);
    return text;
  } catch (err: any) {
    console.error('PDF parse error:', err);
    throw new Error(`Lỗi parse PDF: ${err.message}`);
  }
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
    const result = await m.extractRawText({ path: filePath });
    let text = result.value || '';

    // Cleanup
    text = text
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    console.log(`📝 DOCX parsed: ${text.length} chars from ${path.basename(filePath)}`);
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
