import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TabBar } from './shared';

// ─── Browser fingerprint ──────────────────────────────────────
interface FpData {
  userAgent: string; platform: string; language: string; screen: string;
  timezone: string; cookiesEnabled: boolean; doNotTrack: string;
  cores: number; touchPoints: number; localStorageItems: number;
  connection: string; webgl: string;
}

function collectFingerprint(): FpData {
  let webgl = 'N/A';
  try {
    const gl = document.createElement('canvas').getContext('webgl') as WebGLRenderingContext | null;
    if (gl) webgl = (gl.getParameter(gl.RENDERER) as string) || 'disponibile';
  } catch { /* noop */ }
  let connection = 'N/A';
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nc = (navigator as any).connection;
    if (nc) connection = [nc.effectiveType, nc.downlink ? nc.downlink + 'Mbps' : ''].filter(Boolean).join(' ');
  } catch { /* noop */ }
  return {
    userAgent: navigator.userAgent, platform: navigator.platform,
    language: navigator.language, screen: `${screen.width}×${screen.height} — ${screen.colorDepth}bit`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cookiesEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack === '1' ? 'Attivo' : navigator.doNotTrack === '0' ? 'Disattivato' : 'Non impostato',
    cores: navigator.hardwareConcurrency || 0, touchPoints: navigator.maxTouchPoints || 0,
    localStorageItems: (() => { try { return localStorage.length; } catch { return 0; } })(),
    connection, webgl,
  };
}

const FP_ITEMS: { key: keyof FpData; label: string; risk: 'high' | 'mid' | 'low'; fmt?: (v: unknown) => string }[] = [
  { key: 'userAgent',         label: 'Browser / OS',       risk: 'high' },
  { key: 'webgl',             label: 'GPU (WebGL)',         risk: 'high' },
  { key: 'screen',            label: 'Schermo',            risk: 'mid'  },
  { key: 'timezone',          label: 'Fuso orario',        risk: 'mid'  },
  { key: 'language',          label: 'Lingua',             risk: 'mid'  },
  { key: 'platform',          label: 'Piattaforma',        risk: 'mid'  },
  { key: 'connection',        label: 'Connessione',        risk: 'low'  },
  { key: 'cores',             label: 'CPU cores',          risk: 'low'  },
  { key: 'cookiesEnabled',    label: 'Cookie',             risk: 'low', fmt: v => v ? 'Abilitati' : 'Disabilitati' },
  { key: 'doNotTrack',        label: 'Do Not Track',       risk: 'low'  },
  { key: 'localStorageItems', label: 'localStorage items', risk: 'low', fmt: v => String(v) },
  { key: 'touchPoints',       label: 'Touch points',       risk: 'low'  },
];

const RISK_COLOR = { high: '#f87171', mid: '#fb923c', low: '#34d399' } as const;
const RISK_LABEL = { high: 'alta esposizione', mid: 'media', low: 'bassa' } as const;

// ─── WebRTC Leak Test ─────────────────────────────────────────
interface IpInfo { ip: string; city: string; country_name: string; org: string; }
interface WebRtcResult { webrtcIPs: string[]; publicIP: string; hasLeak: boolean; ipInfo: IpInfo | null; }

const PRIVATE_IP_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;

async function runWebRtcTest(): Promise<WebRtcResult> {
  let ipInfo: IpInfo | null = null;
  try {
    const r = await fetch('https://ipapi.co/json/');
    if (r.ok) ipInfo = await r.json();
  } catch { /* noop */ }

  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  const ips = new Set<string>();

  await new Promise<void>(resolve => {
    pc.onicecandidate = e => {
      if (!e.candidate) { resolve(); return; }
      const m = e.candidate.candidate.match(/(\d{1,3}\.){3}\d{1,3}/);
      if (m) ips.add(m[0]);
    };
    pc.createDataChannel('');
    pc.createOffer().then(o => pc.setLocalDescription(o)).catch(() => resolve());
    setTimeout(resolve, 3500);
  });
  pc.close();

  const publicIP = ipInfo?.ip ?? '';
  const webrtcIPs = [...ips];
  const hasLeak = webrtcIPs.some(ip => !PRIVATE_IP_RE.test(ip) && ip !== publicIP && publicIP !== '');
  return { webrtcIPs, publicIP, hasLeak, ipInfo };
}

// ─── Password check ───────────────────────────────────────────
async function sha1hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function checkPassword(pwd: string): Promise<number> {
  const hash = await sha1hex(pwd);
  const prefix = hash.slice(0, 5);
  const r = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`).catch(() => null);
  if (!r?.ok) return -1;
  const text = await r.text();
  const suffix = hash.slice(5);
  const line = text.split('\n').find(l => l.startsWith(suffix));
  return line ? parseInt(line.split(':')[1], 10) : 0;
}

// ─── PDF generation ───────────────────────────────────────────
function generateReport(fp: FpData) {
  const date = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  const fpRows = FP_ITEMS.map(item => {
    const raw = fp[item.key];
    const val = item.fmt ? item.fmt(raw) : String(raw);
    const risk = RISK_COLOR[item.risk];
    return `<div class="fp-item"><div class="fp-label">${item.label}<span class="risk" style="background:${risk}22;color:${risk}">${RISK_LABEL[item.risk]}</span></div><div class="fp-value">${val}</div></div>`;
  }).join('');
  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Rapporto Privacy — Alter OS</title><style>
    *{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:48px 40px;color:#1a1a2e;line-height:1.6}
    h1{font-size:26px;color:#7c3aed;margin:0 0 4px}.date{color:#888;font-size:12px;margin-bottom:40px;letter-spacing:.04em}
    h2{font-size:13px;text-transform:uppercase;letter-spacing:.1em;border-bottom:2px solid #7c3aed;padding-bottom:10px;margin:36px 0 18px;color:#7c3aed}
    .fp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fp-item{background:#f8f7ff;padding:12px 16px;border-radius:8px}
    .fp-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:4px;display:flex;align-items:center;gap:8px}
    .risk{font-size:9px;padding:2px 6px;border-radius:20px;font-weight:500}.fp-value{font-size:12px;font-weight:500;word-break:break-all;color:#1a1a2e}
    .footer{margin-top:52px;border-top:1px solid #eee;padding-top:18px;font-size:11px;color:#aaa}.footer strong{color:#888}
    @media print{body{padding:20px}}
  </style></head><body>
    <h1>Rapporto Privacy Digitale</h1><div class="date">Generato il ${date} · Alter OS Ghost Protocol</div>
    <h2>Impronta Digitale Browser</h2><div class="fp-grid">${fpRows}</div>
    <div class="footer">Questo report è stato generato localmente da Alter OS. I dati non vengono trasmessi a nessun server esterno.<br><strong>Diritto all'oblio:</strong> Ai sensi dell'Art. 17 GDPR hai il diritto di richiedere l'eliminazione dei tuoi dati personali da qualsiasi piattaforma.</div>
  </body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 900);
}

// ─── Component ────────────────────────────────────────────────
const TABS = ['Ombra', 'Scan', 'Rapporto'];

export default function PrivacyRenderer({ color }: { entries: unknown[]; color: string }) {
  const [tab,          setTab]          = useState('Ombra');
  const [fp,           setFp]           = useState<FpData | null>(null);

  // scan state
  const [scanPwd,      setScanPwd]      = useState('');
  const [pwdLoading,   setPwdLoading]   = useState(false);
  const [pwdCount,     setPwdCount]     = useState<number | null>(null);

  // webrtc state
  const [webrtcResult,  setWebrtcResult]  = useState<WebRtcResult | null>(null);
  const [webrtcLoading, setWebrtcLoading] = useState(false);

  useEffect(() => { setFp(collectFingerprint()); }, []);

  const runWebRtc = async () => {
    setWebrtcLoading(true); setWebrtcResult(null);
    const res = await runWebRtcTest();
    setWebrtcResult(res); setWebrtcLoading(false);
  };

  const runPwdCheck = async () => {
    if (!scanPwd) return;
    setPwdLoading(true); setPwdCount(null);
    const n = await checkPassword(scanPwd);
    setPwdCount(n); setPwdLoading(false);
  };

  return (
    <div>
      <TabBar tabs={TABS} active={tab} color={color} onChange={setTab} />

      {/* ── Ombra ── */}
      {tab === 'Ombra' && (
        <div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '0 0 16px', letterSpacing: '.03em' }}>
            Questi dati vengono trasmessi ai siti che visiti senza che tu li condivida esplicitamente.
          </p>
          {fp && FP_ITEMS.map(item => {
            const raw = fp[item.key];
            const val = item.fmt ? item.fmt(raw) : String(raw);
            const rc = RISK_COLOR[item.risk];
            return (
              <motion.div key={item.key} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', marginBottom: 5, borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: `1px solid ${rc}18` }}>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{item.label}</span>
                    <span style={{ fontSize: 8, color: rc, background: `${rc}18`, padding: '1px 6px', borderRadius: 20, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>{RISK_LABEL[item.risk]}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', wordBreak: 'break-all', lineHeight: 1.4 }}>{val}</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Scan ── */}
      {tab === 'Scan' && (
        <div>
          {/* WebRTC Leak Test */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.09em', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>WebRTC Leak Test</div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '0 0 12px', lineHeight: 1.5 }}>
              Verifica se il tuo IP reale viene esposto dai siti web, anche con una VPN attiva.
            </p>
            <motion.button onClick={runWebRtc} disabled={webrtcLoading}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              style={{ width: '100%', padding: '11px', borderRadius: 9, background: color, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff', opacity: webrtcLoading ? 0.6 : 1, marginBottom: 12 }}>
              {webrtcLoading ? 'Analisi in corso…' : webrtcResult ? 'Ripeti test' : 'Avvia test'}
            </motion.button>

            <AnimatePresence>
              {webrtcResult && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  {/* IP info cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    {[
                      { label: 'IP Pubblico', value: webrtcResult.publicIP || '—' },
                      { label: 'Posizione', value: webrtcResult.ipInfo ? `${webrtcResult.ipInfo.city}, ${webrtcResult.ipInfo.country_name}` : '—' },
                      { label: 'Provider', value: webrtcResult.ipInfo?.org?.replace(/^AS\d+\s*/, '') || '—' },
                      { label: 'IP via WebRTC', value: webrtcResult.webrtcIPs.filter(ip => !PRIVATE_IP_RE.test(ip)).join(', ') || webrtcResult.webrtcIPs[0] || '—' },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ padding: '10px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', wordBreak: 'break-all', fontWeight: 500 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  {/* Leak verdict */}
                  <div style={{ padding: '12px 14px', borderRadius: 10, background: webrtcResult.hasLeak ? 'rgba(248,113,113,0.07)' : 'rgba(52,211,153,0.07)', border: `1px solid ${webrtcResult.hasLeak ? 'rgba(248,113,113,0.2)' : 'rgba(52,211,153,0.2)'}` }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: webrtcResult.hasLeak ? '#f87171' : '#34d399', marginBottom: 4 }}>
                      {webrtcResult.hasLeak ? '⚠ Leak rilevato' : '✓ Nessun leak'}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                      {webrtcResult.hasLeak
                        ? 'Il tuo IP reale è visibile ai siti web nonostante la VPN. Disabilita WebRTC nel browser o usa un\'estensione come WebRTC Leak Shield.'
                        : 'Il tuo IP reale non risulta esposto tramite WebRTC.'}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* divider */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '4px 0 20px' }} />

          {/* Password check */}
          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.09em', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>Sicurezza Password</div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '0 0 12px', lineHeight: 1.5 }}>
              Controlla se una password è stata trovata in database di violazioni. La password non viene mai inviata.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input value={scanPwd} onChange={e => setScanPwd(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runPwdCheck()}
                type="password" placeholder="Inserisci una password…"
                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '10px 14px', color: '#f0f0f0', fontSize: 13, outline: 'none' }} />
              <motion.button onClick={runPwdCheck} disabled={pwdLoading || !scanPwd}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                style={{ padding: '10px 16px', borderRadius: 9, background: color, border: 'none', cursor: scanPwd ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600, color: '#fff', opacity: (pwdLoading || !scanPwd) ? 0.5 : 1 }}>
                {pwdLoading ? '…' : 'Verifica'}
              </motion.button>
            </div>

            <AnimatePresence>
              {pwdCount !== null && pwdCount >= 0 && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ padding: '12px 14px', borderRadius: 10, background: pwdCount > 0 ? 'rgba(248,113,113,0.07)' : 'rgba(52,211,153,0.07)', border: `1px solid ${pwdCount > 0 ? 'rgba(248,113,113,0.2)' : 'rgba(52,211,153,0.2)'}` }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: pwdCount > 0 ? '#f87171' : '#34d399', marginBottom: 4 }}>
                    {pwdCount > 0 ? '⚠ Password compromessa' : '✓ Password sicura'}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                    {pwdCount > 0
                      ? <>Trovata in <strong style={{ color: '#f87171' }}>{pwdCount.toLocaleString()}</strong> violazioni di dati. Cambiala ovunque la usi.</>
                      : 'Non trovata in nessun database di violazioni conosciuto.'}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── Rapporto ── */}
      {tab === 'Rapporto' && (
        <div>
          <div style={{ padding: '18px', borderRadius: 12, marginBottom: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
            Il report include la tua impronta digitale browser. Generato <strong style={{ color: 'rgba(255,255,255,0.75)' }}>localmente</strong> — nessun dato inviato a server esterni.
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <div style={{ flex: 1, padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f87171', letterSpacing: '-0.03em' }}>{FP_ITEMS.filter(f => f.risk === 'high').length}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 4 }}>dati ad alta esposizione</div>
            </div>
            <div style={{ flex: 1, padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fb923c', letterSpacing: '-0.03em' }}>{FP_ITEMS.filter(f => f.risk === 'mid').length}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 4 }}>esposizione media</div>
            </div>
          </div>
          <motion.button onClick={() => fp && generateReport(fp)} disabled={!fp}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            style={{ width: '100%', padding: '14px', borderRadius: 12, background: color, border: 'none', cursor: fp ? 'pointer' : 'not-allowed', opacity: fp ? 1 : 0.5, fontSize: 13, fontWeight: 600, color: '#fff', letterSpacing: '.04em' }}>
            Genera Report PDF
          </motion.button>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 8, letterSpacing: '.03em' }}>
            Si apre in una nuova tab · Usa "Stampa" → "Salva come PDF"
          </div>
          <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 10, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.09em', color: '#f87171', marginBottom: 8, fontWeight: 600 }}>Art. 17 GDPR — Diritto all'oblio</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              Hai il diritto di richiedere l'eliminazione di tutti i tuoi dati personali da qualsiasi piattaforma digitale. Le aziende hanno 30 giorni per rispondere.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
