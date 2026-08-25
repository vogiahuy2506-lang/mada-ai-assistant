/**
 * File parsers cho PDF, DOCX, Excel, và Text
 */

import fs from 'fs';
import path from 'path';

// PDF.js for PDF parsing
let pdfjsLib: any = null;

async function loadPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  try {
    pdfjsLib = await import('pdfjs-dist');
    return pdfjsLib;
  } catch (err) {
    console.error('Failed to load pdfjs-dist:', err);
    throw new Error('Không thể load pdfjs-dist');
  }
}

// Mammoth for DOCX parsing
let mammoth: any = null;
// XLSX for Excel parsing
let XLSX: any = null;

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

async function loadXLSX() {
  if (XLSX) return XLSX;
  try {
    const mod = await import('xlsx');
    XLSX = mod.default || mod;
    if (typeof XLSX.readFile !== 'function') {
      XLSX = mod;
    }
    return XLSX;
  } catch (err) {
    console.error('Failed to load xlsx:', err);
    throw new Error('Không thể load xlsx');
  }
}

/**
 * Parse PDF using pdfjs-dist
 */
export async function parsePDFFile(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File không tồn tại: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);

  try {
    const pdfjs = await loadPdfjs();
    
    // Load PDF document
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    
    const pdf = await loadingTask.promise;
    let allText = '';

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      allText += pageText + '\n\n';
    }

    // Cleanup
    let text = allText
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
 * Parse Excel file (xlsx, xls, csv)
 */
export async function parseExcelFile(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File không tồn tại: ${filePath}`);
  }

  const xlsx = await loadXLSX();
  const ext = path.extname(filePath).toLowerCase();

  try {
    const workbook = xlsx.readFile(filePath);
    let allText = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      allText.push(`=== SHEET: ${sheetName} ===`);

      for (const row of data) {
        // Filter out completely empty rows
        if (row.some(cell => cell !== '')) {
          // Convert row to readable text
          const rowText = row.map(cell => {
            if (cell === null || cell === undefined || cell === '') return '';
            // Handle numbers, dates, etc.
            if (typeof cell === 'number') return cell.toString();
            if (typeof cell === 'boolean') return cell ? 'Có' : 'Không';
            return String(cell).trim();
          }).filter(Boolean).join(' | ');

          if (rowText) {
            allText.push(rowText);
          }
        }
      }

      allText.push(''); // Blank line between sheets
    }

    const text = allText.join('\n').trim();
    console.log(`📊 Excel parsed: ${text.length} chars from ${path.basename(filePath)} (${workbook.SheetNames.length} sheets)`);
    return text;
  } catch (err: any) {
    console.error('Excel parse error:', err);
    throw new Error(`Lỗi parse Excel: ${err.message}`);
  }
}

/**
 * Parse CSV file
 */
export async function parseCSVFile(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File không tồn tại: ${filePath}`);
  }

  const xlsx = await loadXLSX();

  try {
    // Read as CSV using xlsx
    const workbook = xlsx.readFile(filePath, { type: 'file' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_csv(sheet);

    const text = data
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    console.log(`📋 CSV parsed: ${text.length} chars from ${path.basename(filePath)}`);
    return text;
  } catch (err: any) {
    console.error('CSV parse error:', err);
    throw new Error(`Lỗi parse CSV: ${err.message}`);
  }
}

/**
 * Detect MIME type từ extension
 */
export function detectFileType(filename: string): 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'image' | 'unknown' {
  const ext = filename.toLowerCase().split('.').pop() || '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx' || ext === 'doc') return 'docx';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'csv') return 'csv';
  if (ext === 'txt' || ext === 'md') return 'txt';
  if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'gif'].includes(ext)) return 'image';
  return 'unknown';
}

/**
 * Parse any supported file based on extension
 */
export async function parseAnyFile(filePath: string, originalFilename?: string): Promise<string> {
  const filename = originalFilename || path.basename(filePath);
  const fileType = detectFileType(filename);

  switch (fileType) {
    case 'pdf':
      return parsePDFFile(filePath);
    case 'docx':
      return parseDocxFile(filePath);
    case 'xlsx':
      return parseExcelFile(filePath);
    case 'csv':
      return parseCSVFile(filePath);
    case 'txt':
      return fs.readFileSync(filePath, 'utf-8');
    case 'image':
      // For images, return placeholder - they'll be processed by OCR
      return '[Hình ảnh - cần OCR để đọc nội dung]';
    default:
      throw new Error(`Định dạng file không được hỗ trợ: ${filename}`);
  }
}
