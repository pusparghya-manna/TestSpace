import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { SectionTitle } from '../components/ui/SectionTitle';
import { btnP, card, inp } from '../styles/ui';
import { IconChart, IconSend } from '../icons';
import { formatIST } from '../lib/time';
import { toastError, toastSuccess } from '../lib/notify';

export function Settings(_props?: any) {
  const [broadcast, setBroadcast] = useState('');
  const [bcastBusy, setBcastBusy] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api('/api/audit-logs');
        const data = await res.json().catch(() => ({}));
        if (res.ok) setLogs(data.logs || []);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const sendBroadcast = async () => {
    const message = broadcast.trim();
    if (!message) {
      toastError('Type a message first');
      return;
    }
    setBcastBusy(true);
    try {
      const res = await api('/api/broadcast', { method: 'POST', body: JSON.stringify({ message }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      toastSuccess(`Message sent to ${data.sent || 0} student(s)`);
      setBroadcast('');
    } catch (e: any) {
      toastError(e.message || 'Failed to send');
    } finally {
      setBcastBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold tracking-tight text-slate-900">Settings</h1>

      <SectionTitle icon={<IconSend className="w-3.5 h-3.5" />} title="Send message to students" sub="Send message to students" />
      <div className={card + ' p-3.5 space-y-2.5'}>
        <textarea
          className={inp + ' min-h-[80px]'}
          value={broadcast}
          onChange={(e) => setBroadcast(e.target.value)}
          placeholder="Type your announcement…"
        />
        <button type="button" className={btnP + ' w-full !py-2'} disabled={bcastBusy} onClick={sendBroadcast}>
          {bcastBusy ? 'Sending…' : 'Send message to students'}
        </button>
      </div>

      {logs.length > 0 && (
        <>
          <SectionTitle icon={<IconChart className="w-3.5 h-3.5" />} title="Audit log" sub="Recent activity" />
          <div className={card + ' divide-y divide-slate-100'}>
            {logs.map((l) => (
              <div key={l.id} className="p-2.5 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold text-slate-700">
                    {String(l.action || '').replace(/_/g, ' ')}
                  </div>
                  {l.details && (
                    <div className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{l.details}</div>
                  )}
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    {formatIST(l.timestamp || l.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
export default Settings;
