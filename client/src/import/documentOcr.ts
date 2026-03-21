/**
 * documentOcr.ts — L0 document ingestion (zero API cost)
 * Supports: PDF (pdfjs-dist), images (tesseract.js), plain text
 */

export interface OcrResult {
  text: string;
  pageCount?: number;
  confidence?: number; // 0-100, only for image OCR
  mimeType: string;
}

// ── PDF extraction via pdfjs-dist ─────────────────────────────
async function extractPdf(file: File): Promise<OcrResult> {
  const pdfjsLib = await import('pdfjs-dist');

  // Use the bundled worker via CDN (avoids Vite worker issues)
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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

      const blob = await new Promise<Blob>((res) =>
        canvas.toBlob((b) => res(b!), 'image/png')
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
    name.endsWith('.md')
  );
}
