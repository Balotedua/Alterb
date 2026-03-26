/**
 * documentOcr.ts — L0 document ingestion (zero API cost)
 * Supports: PDF (pdfjs-dist), images (tesseract.js), plain text
 */

// Vite bundles the worker file and returns the correct URL for any environment
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export interface OcrResult {
  text: string;
  pageCount?: number;
  confidence?: number; // 0-100, only for image OCR
  mimeType: string;
}

// ── PDF extraction via pdfjs-dist ─────────────────────────────
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// iOS Safari non supporta Web Worker ES module → crea Blob URL same-origin
let resolvedWorkerSrc: string | null = null;
async function getWorkerSrc(): Promise<string> {
  if (resolvedWorkerSrc) return resolvedWorkerSrc;
  if (isIOS) {
    try {
      const resp = await fetch(pdfWorkerUrl);
      const text = await resp.text();
      resolvedWorkerSrc = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
      return resolvedWorkerSrc;
    } catch {
      // fallback: prova URL diretto
    }
  }
  resolvedWorkerSrc = pdfWorkerUrl;
  return resolvedWorkerSrc;
}

async function extractPdf(file: File): Promise<OcrResult> {
  const pdfjsLib = await import('pdfjs-dist');

  pdfjsLib.GlobalWorkerOptions.workerSrc = await getWorkerSrc();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableRange: isIOS,
    disableStream: isIOS,
    disableAutoFetch: isIOS,
  }).promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => (item.str as string | undefined) ?? '')
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (pageText) pageTexts.push(pageText);
  }

  const digitalText = pageTexts.join('\n\n');

  // If no digital text found, the PDF is likely scanned — fallback to OCR
  if (!digitalText.trim()) {
    return extractPdfViaOcr(pdf, file.name);
  }

  return {
    text: digitalText,
    pageCount: pdf.numPages,
    mimeType: 'application/pdf',
  };
}

// ── PDF OCR fallback: render each page to canvas → Tesseract ──
async function extractPdfViaOcr(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf: any,
  _filename: string
): Promise<OcrResult> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('ita+eng');

  const pageTexts: string[] = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 }); // higher scale = better OCR
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport }).promise;

      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob((b) => b ? res(b) : rej(new Error('Rendering pagina PDF fallito')), 'image/png')
      );
      const { data } = await worker.recognize(blob);
      if (data.text.trim()) pageTexts.push(data.text.trim());
    }
  } finally {
    await worker.terminate();
  }

  return {
    text: pageTexts.join('\n\n'),
    pageCount: pdf.numPages,
    mimeType: 'application/pdf',
  };
}

// ── Image OCR via tesseract.js ────────────────────────────────
async function extractImage(file: File): Promise<OcrResult> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('ita+eng');

  try {
    const { data } = await worker.recognize(file);
    return {
      text: data.text.trim(),
      confidence: Math.round(data.confidence),
      mimeType: file.type,
    };
  } finally {
    await worker.terminate();
  }
}

// ── Plain text ────────────────────────────────────────────────
async function extractText(file: File): Promise<OcrResult> {
  const text = await file.text();
  return { text: text.trim(), mimeType: file.type };
}

// ── XLSX extraction via SheetJS ───────────────────────────────
async function extractXlsx(file: File): Promise<OcrResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = await import('xlsx') as any;
  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const text: string = XLSX.utils.sheet_to_csv(ws);
  return {
    text,
    mimeType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

// ── Public entry point ────────────────────────────────────────
export async function extractDocument(file: File): Promise<OcrResult> {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return extractPdf(file);
  }
  if (type.startsWith('image/')) {
    return extractImage(file);
  }
  if (type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
    return extractText(file);
  }
  if (
    type.includes('spreadsheetml') || type.includes('excel') ||
    name.endsWith('.xlsx') || name.endsWith('.xls')
  ) {
    return extractXlsx(file);
  }

  throw new Error(`Formato non supportato: ${file.type || name}`);
}

export function isDocumentFile(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === 'application/pdf' ||
    name.endsWith('.pdf') ||
    type.startsWith('image/') ||
    type.startsWith('text/') ||
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    type.includes('spreadsheetml') || type.includes('excel') ||
    name.endsWith('.xlsx') || name.endsWith('.xls')
  );
}

export function isFinanceFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls');
}
