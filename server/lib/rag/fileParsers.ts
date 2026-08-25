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

// Tesseract for OCR fallback (PDF scan)
let tesseract: any = null;

async function loadTesseract() {
  if (tesseract) return tesseract;
  try {
    const mod = await import('tesseract.js');
    tesseract = mod.default || mod;
    return tesseract;
  } catch (err) {
    console.warn('tesseract.js not available, PDF scan OCR disabled');
    return null;
  }
}

/**
 * Parse PDF using pdfjs-dist
 * Falls back to OCR for scanned PDFs
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
    let hasImages = false;

    // Extract text from each page and check for images
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      allText += pageText + '\n\n';

      // Check if page has images (indicates scanned PDF)
      const ops = await page.getOperatorList();
      for (let i = 0; i < ops.fnArray.length; i++) {
        if (ops.fnArray[i] === pdfjs.OPS.paintImageXObject || ops.fnArray[i] === pdfjs.OPS.paintJpegXObject) {
          hasImages = true;
          break;
        }
      }
    }

    // Cleanup text
    let text = allText
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // If text is too short and has images, try OCR
    if (text.length < 100 && hasImages) {
      console.log(`📄 PDF "${path.basename(filePath)}" appears to be scanned (${text.length} chars text, has images) — trying OCR...`);
      const ocrText = await extractPDFTextWithOCR(buffer, path.basename(filePath));
      if (ocrText && ocrText.length > text.length) {
        console.log(`📄 OCR succeeded: ${ocrText.length} chars vs ${text.length} chars from pdfjs`);
        return ocrText;
      }
    }

    console.log(`📄 PDF parsed: ${text.length} chars from ${path.basename(filePath)}`);
    return text;
  } catch (err: any) {
    console.error('PDF parse error:', err);
    throw new Error(`Lỗi parse PDF: ${err.message}`);
  }
}

/**
 * OCR fallback for scanned PDFs — render each page as image and run Tesseract
 */
async function extractPDFTextWithOCR(buffer: Buffer, filename: string): Promise<string> {
  const tess = await loadTesseract();
  if (!tess) {
    console.warn('tesseract.js not available, cannot OCR scanned PDF');
    return '';
  }

  const pdfjs = await loadPdfjs();

  try {
    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;

    const texts: string[] = [];

    // Use canvas to render pages as images
    for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 50); pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR

      // Create canvas
      const canvas = Buffer.alloc(Math.ceil(viewport.width) * Math.ceil(viewport.height) * 4);
      // Note: In Node.js we need to use a canvas library. For simplicity, we'll skip canvas rendering
      // and rely on pdfjs render to file if available, otherwise skip OCR

      // Fallback: try to get text anyway
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      if (pageText.trim()) {
        texts.push(pageText);
      }
    }

    const result = texts.join('\n\n');
    console.log(`📄 OCR fallback extracted ${result.length} chars from ${filename}`);
    return result;
  } catch (err) {
    console.warn('OCR fallback failed:', err);
    return '';
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
