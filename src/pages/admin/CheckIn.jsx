import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Check, X } from 'lucide-react';
import { apiPost } from '../../lib/api';
import { T } from '../../shared';

export default function CheckIn() {
  const { id } = useParams();
  const scannerRef = useRef(null);
  const [result, setResult] = useState(null); // { ok, message }
  const busyRef = useRef(false);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 260 }, false);
    scannerRef.current = scanner;

    const onScan = async (decodedText) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const data = await apiPost('/api/admin/events/checkin', { qrToken: decodedText });
        setResult({ ok: true, message: `Checked in — ${data.ticket.buyerClient?.name || 'guest'}` });
      } catch (err) {
        setResult({ ok: false, message: err.message });
      } finally {
        setTimeout(() => { busyRef.current = false; }, 1500);
      }
    };

    scanner.render(onScan, () => {});
    return () => { scanner.clear().catch(() => {}); };
  }, []);

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs tracking-[.2em] uppercase mb-2" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>Event #{id}</div>
        <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-3xl">Check-in scanner</h1>
      </div>

      <div className="max-w-md">
        <div id="qr-reader" className="rounded-2xl overflow-hidden mb-5" style={{ border: `1px solid ${T.line}` }} />
        {result && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
            style={{
              background: result.ok ? 'rgba(87,192,122,.12)' : 'rgba(229,98,45,.12)',
              color: result.ok ? '#57C07A' : T.ember,
              border: `1px solid ${result.ok ? 'rgba(87,192,122,.3)' : 'rgba(229,98,45,.3)'}`,
            }}
          >
            {result.ok ? <Check size={16} /> : <X size={16} />} {result.message}
          </div>
        )}
      </div>
    </div>
  );
}
