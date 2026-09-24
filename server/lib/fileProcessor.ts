/**
 * File Processor — Xử lý file đính kèm cho chat endpoint
 * Decode base64 → gọi parser phù hợp → trả về text
 * 
 * Hỗ trợ:
 * - PDF: pdfjs-dist + OCR fallback (tesseract.js)
 * - DOCX/DOC: mammoth
 * - XLSX/XLS/CSV: xlsx
 * - TXT/MD: fs.readFileSync
 * - Audio: transcription (Whisper API hoặc fallback)
 * - Image: OCR (tesseract.js)
 * - Other files: metadata extraction
 */

import fs from 'fs';
import path from 'path';
import { parsePDFFile, parseDocxFile, parseExcelFile, parseCSVFile } from './rag/fileParsers';
import { extractImageTextFromBuffer } from './rag/ocrHelper';

// ============ TEMP FILE HELPERS ============

const TMP_DIR = path.join(process.cwd(), 'data', 'uploads');
fs.mkdirSync(TMP_DIR, { recursive: true });

function bufferToTempFile(buffer: Buffer, ext: string): string {
  const tmpPath = path.join(TMP_DIR, `upload_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
  fs.writeFileSync(tmpPath, buffer);
  return tmpPath;
}

function cleanupTempFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {}
}

function base64ToBuffer(base64: string): Buffer {
  // Handle data URL format (e.g., data:application/pdf;base64,...)
  const parts = base64.split(',');
  const data = parts[parts.length - 1];
  return Buffer.from(data, 'base64');
}

function getExtensionFromMime(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
    'text/plain': 'txt',
    'text/markdown': 'md',
    'text/csv': 'csv',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'audio/aac': 'aac',
    'audio/mp4': 'm4a',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'application/zip': 'zip',
    'application/x-rar-compressed': 'rar',
  };
  return mimeMap[mimeType] || 'bin';
}

// ============ FILE PARSING ============

export interface ParseResult {
  success: boolean;
  text?: string;
  extractedText?: string; // alias for text
  type: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'image' | 'audio' | 'video' | 'other';
  filename: string;
  fileSizeBytes: number;
  error?: string;
  confidence?: number;
  pages?: number;
  lines?: number;
  transcriptionLanguage?: string;
}

/**
 * Parse một file từ base64 string
 * Trả về text đã trích xuất + metadata
 */
export async function parseAttachment(
  filename: string,
  mimeType: string,
  base64Data: string
): Promise<ParseResult> {
  const buffer = base64ToBuffer(base64Data);
  const ext = getExtensionFromMime(mimeType) || filename.split('.').pop()?.toLowerCase() || 'bin';

  console.log(`📎 Processing attachment: ${filename} (${mimeType}, ${(buffer.length / 1024).toFixed(1)}KB)`);

  try {
    // ===== IMAGE: OCR =====
    if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff'].includes(ext)) {
      const ocrResult = await extractImageTextFromBuffer(buffer, filename, 'vie+eng');
      return {
        success: true,
        text: ocrResult.text,
        extractedText: ocrResult.text,
        type: 'image',
        filename,
        fileSizeBytes: buffer.length,
        confidence: ocrResult.confidence,
        lines: ocrResult.lines,
      };
    }

    // ===== PDF =====
    if (mimeType === 'application/pdf' || ext === 'pdf') {
      const tmpPath = bufferToTempFile(buffer, 'pdf');
      try {
        const text = await parsePDFFile(tmpPath);
        return {
          success: true,
          text,
          extractedText: text,
          type: 'pdf',
          filename,
          fileSizeBytes: buffer.length,
          lines: text.split('\n').filter(l => l.trim()).length,
        };
      } finally {
        cleanupTempFile(tmpPath);
      }
    }

    // ===== DOCX =====
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword' ||
      ext === 'docx' || ext === 'doc'
    ) {
      const tmpPath = bufferToTempFile(buffer, ext === 'docx' || ext === 'doc' ? ext : 'docx');
      try {
        const text = await parseDocxFile(tmpPath);
        return {
          success: true,
          text,
          extractedText: text,
          type: 'docx',
          filename,
          fileSizeBytes: buffer.length,
          lines: text.split('\n').filter(l => l.trim()).length,
        };
      } finally {
        cleanupTempFile(tmpPath);
      }
    }

    // ===== EXCEL =====
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel' ||
      ext === 'xlsx' || ext === 'xls'
    ) {
      const tmpPath = bufferToTempFile(buffer, ext);
      try {
        const text = await parseExcelFile(tmpPath);
        return {
          success: true,
          text,
          extractedText: text,
          type: 'xlsx',
          filename,
          fileSizeBytes: buffer.length,
          lines: text.split('\n').filter(l => l.trim()).length,
        };
      } finally {
        cleanupTempFile(tmpPath);
      }
    }

    // ===== CSV =====
    if (mimeType === 'text/csv' || ext === 'csv') {
      const tmpPath = bufferToTempFile(buffer, 'csv');
      try {
        const text = await parseCSVFile(tmpPath);
        return {
          success: true,
          text,
          extractedText: text,
          type: 'csv',
          filename,
          fileSizeBytes: buffer.length,
          lines: text.split('\n').filter(l => l.trim()).length,
        };
      } finally {
        cleanupTempFile(tmpPath);
      }
    }

    // ===== TEXT FILES =====
    if (mimeType.startsWith('text/') || ['txt', 'md', 'markdown'].includes(ext)) {
      const text = buffer.toString('utf-8');
      return {
        success: true,
        text,
        extractedText: text,
        type: 'txt',
        filename,
        fileSizeBytes: buffer.length,
        lines: text.split('\n').filter(l => l.trim()).length,
      };
    }

    // ===== AUDIO: Transcription =====
    if (
      mimeType.startsWith('audio/') ||
      ['mp3', 'wav', 'ogg', 'webm', 'aac', 'm4a', 'flac'].includes(ext)
    ) {
      const transcription = await transcribeAudio(buffer, filename, mimeType, ext);
      return {
        success: transcription.success,
        text: transcription.text,
        extractedText: transcription.text,
        type: 'audio',
        filename,
        fileSizeBytes: buffer.length,
        transcriptionLanguage: transcription.language,
        error: transcription.error,
      };
    }

    // ===== VIDEO: Extract audio track for transcription =====
    if (
      mimeType.startsWith('video/') ||
      ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)
    ) {
      // For video, try to extract audio and transcribe
      const result = await transcribeVideoAudio(buffer, filename, ext);
      return {
        success: result.success,
        text: result.text,
        extractedText: result.text,
        type: 'video',
        filename,
        fileSizeBytes: buffer.length,
        transcriptionLanguage: result.language,
        error: result.error,
      };
    }

    // ===== OTHER FILES: Try to extract text or return metadata =====
    // Try ZIP archives (contains text/code)
    if (mimeType === 'application/zip' || mimeType === 'application/x-rar-compressed' || ext === 'zip' || ext === 'rar') {
      return {
        success: false,
        type: 'other',
        filename,
        fileSizeBytes: buffer.length,
        error: `Không thể đọc nội dung file nén (${ext}). Vui lòng giải nén và gửi lại file riêng lẻ.`,
      };
    }

    // For unknown types, try to detect encoding
    try {
      const text = buffer.toString('utf-8');
      const hasReadableText = /[a-zA-Z\u00C0-\u024F\u1EA0-\u1EF9]{10,}/.test(text);
      if (hasReadableText) {
        return {
          success: true,
          text,
          extractedText: text,
          type: 'other',
          filename,
          fileSizeBytes: buffer.length,
        };
      }
    } catch {}

    return {
      success: false,
      type: 'other',
      filename,
      fileSizeBytes: buffer.length,
      error: `Định dạng file "${ext}" chưa được hỗ trợ để trích xuất nội dung. Hiện tại hỗ trợ: PDF, DOCX, XLSX, CSV, TXT, Ảnh (OCR), Audio (transcription).`,
    };
  } catch (err: any) {
    console.error(`❌ Failed to parse ${filename}:`, err);
    return {
      success: false,
      type: 'other',
      filename,
      fileSizeBytes: buffer.length,
      error: `Lỗi xử lý file: ${err.message}`,
    };
  }
}

// ============ AUDIO TRANSCRIPTION ============

async function transcribeAudio(
  buffer: Buffer,
  filename: string,
  _mimeType: string,
  ext: string
): Promise<{ success: boolean; text?: string; language?: string; error?: string }> {
  // Check for OpenAI Whisper API key
  const whisperApiKey = process.env.OPENAI_API_KEY || process.env.WHISPER_API_KEY;

  if (whisperApiKey) {
    try {
      return await transcribeWithWhisperAPI(buffer, filename, whisperApiKey);
    } catch (err) {
      console.warn('Whisper API failed, trying fallback:', err);
    }
  }

  // Fallback: Use vosk or coqui for local transcription
  return await transcribeWithLocalModel(buffer, filename, ext);
}

async function transcribeWithWhisperAPI(
  buffer: Buffer,
  filename: string,
  apiKey: string
): Promise<{ success: boolean; text?: string; language?: string; error?: string }> {
  const tmpPath = path.join(TMP_DIR, `audio_${Date.now()}_${filename}`);
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(tmpPath, buffer);

  try {
    // Use native FormData with Blob (Node.js 18+ supports Blob)
    const form = new FormData();
    // Create a Blob from the buffer with the appropriate MIME type
    const audioBlob = new Blob([buffer as BlobPart], { type: 'audio/mpeg' });
    const safeFilename = filename.endsWith('.mp3') ? filename : `${filename}.mp3`;
    // @ts-ignore - Node.js 20+ FormData accepts Blob with filename option
    form.append('file', audioBlob, { filename: safeFilename, type: 'audio/mpeg' });
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');
    form.append('language', 'vi'); // Default to Vietnamese

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form as any,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Whisper API error ${response.status}: ${errText}`);
    }

    const result = await response.json() as { text: string; language?: string };
    console.log(`🎤 Audio transcribed (${result.language || 'auto'}): ${result.text.length} chars`);

    return {
      success: true,
      text: result.text,
      language: result.language || 'vi',
    };
  } finally {
    cleanupTempFile(tmpPath);
  }
}

async function transcribeWithLocalModel(
  buffer: Buffer,
  filename: string,
  _ext: string
): Promise<{ success: boolean; text?: string; language?: string; error?: string }> {
  // Try using faster-whisper or whisper.cpp if available
  const tmpPath = path.join(TMP_DIR, `audio_${Date.now()}_${filename}`);
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(tmpPath, buffer);

  try {
    // Note: For local transcription, install @huggingface/transformers or whisper.cpp CLI
    // For now, we rely on Whisper API (with API key) or whisper.cpp CLI if available

    // Try whisper.cpp via CLI
    let whisperCppAvailable = false;
    try {
      const { execSync } = await import('child_process');
      execSync('which whisper.cpp/main 2>/dev/null || which whisper 2>/dev/null || echo "not found"', {
        stdio: 'pipe',
      });
      whisperCppAvailable = true;
    } catch {}

    if (whisperCppAvailable) {
      const { execSync } = await import('child_process');
      execSync(
        `whisper "${tmpPath}" --model small --language Vietnamese --output-txt 2>&1`,
        { maxBuffer: 10 * 1024 * 1024, encoding: 'utf-8' }
      );

      const outputFile = tmpPath.replace(/\.[^.]+$/, '.txt');
      if (fs.existsSync(outputFile)) {
        const text = fs.readFileSync(outputFile, 'utf-8');
        return { success: true, text: text.trim(), language: 'vi' };
      }
    }

    // Final fallback: ffmpeg to extract audio info + return message
    let ffmpegAvailable = false;
    try {
      const { execSync } = await import('child_process');
      execSync('ffmpeg -version 2>&1', { stdio: 'pipe' });
      ffmpegAvailable = true;
    } catch {}

    if (ffmpegAvailable) {
      const { execSync } = await import('child_process');
      const info = execSync(
        `ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 "${tmpPath}" 2>&1`,
        { encoding: 'utf-8', maxBuffer: 1024 * 1024 }
      );

      const durationMatch = info.match(/duration=(\d+\.?\d*)/);
      const duration = durationMatch ? parseFloat(durationMatch[1]) : 0;

      if (duration > 0 && duration < 60) {
        // Short audio - maybe can transcribe with a simpler method
        return {
          success: false,
          error: `File audio "${filename}" (${Math.round(duration)}s) cần API key để transcription. Vui lòng thêm OPENAI_API_KEY hoặc WHISPER_API_KEY vào file .env để bật tính năng này.`,
        };
      }

      return {
        success: false,
        error: `File audio "${filename}" (${Math.round(duration)}s) quá dài để xử lý không có API key. Vui lòng thêm OPENAI_API_KEY vào .env để bật transcription.`,
      };
    }

    return {
      success: false,
      error: `Không tìm thấy công cụ transcription. Vui lòng thêm OPENAI_API_KEY vào file .env để bật tính năng chuyển audio thành text.`,
    };
  } finally {
    cleanupTempFile(tmpPath);
  }
}

// ============ VIDEO TRANSCRIPTION ============

async function transcribeVideoAudio(
  buffer: Buffer,
  filename: string,
  _ext: string
): Promise<{ success: boolean; text?: string; language?: string; error?: string }> {
  // Check for OpenAI Whisper API key
  const whisperApiKey = process.env.OPENAI_API_KEY || process.env.WHISPER_API_KEY;

  if (!whisperApiKey) {
    // Try ffmpeg to extract audio
    let ffmpegAvailable = false;
    try {
      const { execSync } = await import('child_process');
      execSync('ffmpeg -version 2>&1', { stdio: 'pipe' });
      ffmpegAvailable = true;
    } catch {}

    if (ffmpegAvailable) {
      const { execSync } = await import('child_process');
      const tmpDir = TMP_DIR;
      const tmpVideoPath = path.join(tmpDir, `video_${Date.now()}_${filename}`);
      const tmpAudioPath = path.join(tmpDir, `audio_${Date.now()}_${Date.now()}.mp3`);
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(tmpVideoPath, buffer);

      try {
        // Extract audio from video
        execSync(
          `ffmpeg -i "${tmpVideoPath}" -vn -acodec libmp3lame -q:a 2 "${tmpAudioPath}" -y 2>&1`,
          { stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 }
        );

        if (fs.existsSync(tmpAudioPath)) {
          const audioBuffer = fs.readFileSync(tmpAudioPath);
          return await transcribeAudio(audioBuffer, `${filename}.mp3`, 'audio/mpeg', 'mp3');
        }
      } catch (e) {
        console.warn('Video audio extraction failed:', e);
      } finally {
        cleanupTempFile(tmpVideoPath);
        cleanupTempFile(tmpAudioPath);
      }
    }

    return {
      success: false,
      error: `Video "${filename}" cần API key để trích xuất và chuyển audio thành text. Vui lòng thêm OPENAI_API_KEY vào file .env.`,
    };
  }

  // Use Whisper API - extract audio first
  let ffmpegAvailable = false;
  try {
    const { execSync } = await import('child_process');
    execSync('ffmpeg -version 2>&1', { stdio: 'pipe' });
    ffmpegAvailable = true;
  } catch {}

  if (!ffmpegAvailable) {
    return {
      success: false,
      error: `ffmpeg không có sẵn để trích xuất audio từ video "${filename}".`,
    };
  }

  const { execSync } = await import('child_process');
  const tmpDir = TMP_DIR;
  const tmpVideoPath = path.join(tmpDir, `video_${Date.now()}_${filename}`);
  const tmpAudioPath = path.join(tmpDir, `audio_${Date.now()}.mp3`);
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(tmpVideoPath, buffer);

  try {
    execSync(
      `ffmpeg -i "${tmpVideoPath}" -vn -acodec libmp3lame -q:a 2 "${tmpAudioPath}" -y 2>&1`,
      { stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 }
    );

    if (fs.existsSync(tmpAudioPath)) {
      const audioBuffer = fs.readFileSync(tmpAudioPath);
      return await transcribeWithWhisperAPI(audioBuffer, `${filename}.mp3`, whisperApiKey);
    }

    return {
      success: false,
      error: `Không thể trích xuất audio từ video "${filename}".`,
    };
  } catch (e: any) {
    return {
      success: false,
      error: `Lỗi xử lý video: ${e.message}`,
    };
  } finally {
    cleanupTempFile(tmpVideoPath);
    cleanupTempFile(tmpAudioPath);
  }
}
