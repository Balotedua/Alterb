/**
 * documentStorage.ts — Hybrid Storage layer
 * Images: compressed via Canvas before upload
 * PDFs: uploaded as-is (text already extracted separately)
 * Returns storagePath for vault reference + signed URLs on demand
 */

import { supabase } from '../config/supabase';

const BUCKET = 'documents';

// ── Client-side image compression ────────────────────────────
async function compressImage(file: File, maxDim = 1920, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Compress failed')), 'image/jpeg', quality);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Auto-detect document type from extracted text ─────────────
export function detectDocType(text: string, filename: string): { docType: string; docTypeLabel: string } {
  const t = (text + ' ' + filename).toLowerCase();
  if (/carta\s*d[i']?\s*identit|codice\s*fiscale|passaporto|patente/.test(t))
    return { docType: 'identity', docTypeLabel: 'Documento identità' };
  if (/bolletta|enel|eni\b|snam|hera|edison|a2a|iren|luce\b|gas\b|acqua\b|tari/.test(t))
    return { docType: 'utility_bill', docTypeLabel: 'Bolletta' };
  if (/estratto\s*conto|saldo\s*disponibile|moviment/.test(t))
    return { docType: 'bank_statement', docTypeLabel: 'Estratto conto' };
  if (/contratto|accordo|convenzione|locazione|affitto\b/.test(t))
    return { docType: 'contract', docTypeLabel: 'Contratto' };
  if (/fattura\s*n[°.]?\s*\d|iva\s*\d{2}%/.test(t))
    return { docType: 'invoice', docTypeLabel: 'Fattura' };
  if (/ricevuta|scontrino|pagamento\s*di/.test(t))
    return { docType: 'receipt', docTypeLabel: 'Ricevuta' };
  if (/referto|diagnosi|prescrizione|medico|ospedale/.test(t))
    return { docType: 'medical', docTypeLabel: 'Documento medico' };
  if (/busta\s*paga|cedolino|retribuzione|competenz[ei]\s+del\s+mese|paga\s+base|imponibile\s+prev|LUL\b/.test(t))
    return { docType: 'payslip', docTypeLabel: 'Busta paga' };
  return { docType: 'document', docTypeLabel: 'Documento' };
}

// ── Extract amount from text ──────────────────────────────────
export function extractAmount(text: string): number | null {
  const m = text.match(/(?:totale|importo|da\s+pagare|saldo)[^\d]*(\d+[,.]?\d*)\s*[€e]/i)
    ?? text.match(/(\d+[,.]?\d*)\s*€/);
  if (!m) return null;
  return parseFloat(m[1].replace(',', '.'));
}

// ── Extract issuer name from text ─────────────────────────────
export function extractIssuer(text: string): string | null {
  const m = text.match(/\b(Enel|Eni|Snam|Hera|Edison|A2A|Iren|Tim|Vodafone|Fastweb|Wind|Tre|Poste|UniCredit|Intesa|BNL|Fineco|Mediolanum|INPS|Agenzia\s*Entrate)\b/i);
  return m ? m[1] : null;
}

// ── Upload file to Supabase Storage ──────────────────────────
export interface UploadResult {
  storagePath: string;
  fileSize: number;
  compressedSize: number;
}

export async function uploadDocument(userId: string, file: File): Promise<UploadResult> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${userId}/${timestamp}_${safeName}`;

  let uploadBlob: Blob = file;
  if (file.type.startsWith('image/')) {
    try { uploadBlob = await compressImage(file); } catch { /* keep original */ }
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, uploadBlob, { contentType: file.type, upsert: false });

  if (error) throw new Error(error.message);
  return { storagePath, fileSize: file.size, compressedSize: uploadBlob.size };
}

// ── Get temporary signed URL (default 1h) ────────────────────
export async function getDocumentUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}

// ── Get signed URL with Content-Disposition: attachment ──────
export async function getDocumentDownloadUrl(storagePath: string, filename?: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600, { download: filename ?? true });
  if (error || !data) return null;
  return data.signedUrl;
}

// ── Delete from Storage ───────────────────────────────────────
export async function deleteDocument(storagePath: string): Promise<boolean> {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  return !error;
}
