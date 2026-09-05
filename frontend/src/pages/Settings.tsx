import React, { useState, useEffect } from 'react';
import type { SystemSettings, AuditLog } from '../types';
import { api } from '../api';
import { toast, toastSuccess, toastError, confirmAsync } from '../lib/notify';
import { inp, btnP, card } from '../styles/ui';
import { Field } from '../components/ui/Field';
import { SectionTitle } from '../components/ui/SectionTitle';
import { formatIST } from '../lib/time';
import { IconSettings, IconInfo, IconSend, IconChart } from '../icons';

export function Settings({ settings, logs, onRefresh }: { settings: SystemSettings; logs: AuditLog[]; onRefresh: () => void }) {
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [broadcast, setBroadcast] = useState('');
  const [bcastBusy, setBcastBusy] = useState(false);
  useEffect(() => setForm(settings), [settings]);

  const save = async () => {
    setBusy(true);
    try {
      const payload = { ...form, botActive: true };
      let res = await api('/api/settings', { method: 'PUT', body: JSON.stringify(payload) });
      if (!res.ok) res = await api('/api/settings', { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Save failed');
      onRefresh();
      toastSuccess('Saved');
    } catch (e: any) {
      toastError(e.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const sendBroadcast = async () => {
    if (!broadcast.trim()) return toastError('Enter a message');
    if (!(await confirmAsync('Send to all students via the bot?'))) return;
    setBcastBusy(true);
    try {
      const res = await api('/api/broadcast', { method: 'POST', body: JSON.stringify({ message: broadcast.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toastSuccess(`Sent to ${data.sent} students` + (data.failed ? ` (${data.failed} failed)` : ''));
      setBroadcast('');
    } catch (e: any) {
      toastError(e.message || 'Broadcast failed');
    } finally {
      setBcastBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold tracking-tight text-slate-900">Settings</h1>

      <SectionTitle icon={<IconSettings className="w-3.5 h-3.5" />} title="General" sub="System notice shown in the bot" />
      <div className={card + ' p-3.5 space-y-2.5'}>
        <p className="text-[11px] text-slate-500 flex items-start gap-1.5"><IconInfo className="w-3 h-3 mt-0.5 shrink-0" />Bot token & username are set by the developer and cannot be changed here.</p>
        <Field label="System notice"><textarea className={inp} value={form.systemNotice} onChange={(e) => setForm({ ...form, systemNotice: e.target.value })} /></Field>
        <button type="button" className={btnP + ' w-full !py-2'} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      </div>

      <SectionTitle icon={<IconSend className="w-3.5 h-3.5" />} title="Message all students" sub="Sends via Telegram bot to every linked student" />
      <div className={card + ' p-3.5 space-y-2.5'}>
        <textarea className={inp + ' min-h-[80px]'} value={broadcast} onChange={(e) => setBroadcast(e.target.value)} placeholder="Type your announcement…" />
        <button type="button" className={btnP + ' w-full !py-2'} disabled={bcastBusy} onClick={sendBroadcast}>
          {bcastBusy ? 'Sending…' : 'Send to all students'}
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
                  <div className="text-[11px] font-semibold text-slate-700">{l.action.replace(/_/g, ' ')}</div>
                  {l.details && <div className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{l.details}</div>}
                  <div className="text-[9px] text-slate-400 mt-0.5">{formatIST(l.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
