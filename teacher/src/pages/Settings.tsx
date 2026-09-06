import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Field } from '../components/ui/Field';
import { SectionTitle } from '../components/ui/SectionTitle';
import { btnP, card, inp } from '../styles/ui';
import { IconChart, IconInfo, IconSettings } from '../icons';
import { formatIST } from '../lib/time';
import { toastError, toastSuccess } from '../lib/notify';

export default function Settings() {
  const [form, setForm] = useState<any>({ systemNotice: '', allowPractice: true, maintenanceMode: false });
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api('/api/settings');
        const data = await res.json().catch(() => ({}));
        if (res.ok) setForm((f: any) => ({ ...f, ...data }));
      } catch {
        /* ignore */
      }
      try {
        const res = await api('/api/audit-logs');
        const data = await res.json().catch(() => ({}));
        if (res.ok) setLogs(data.logs || []);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        systemNotice: form.systemNotice || '',
        allowPractice: form.allowPractice !== false,
        maintenanceMode: !!form.maintenanceMode,
      };
      const res = await api('/api/settings', { method: 'PUT', body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setForm((f: any) => ({ ...f, ...data }));
      toastSuccess('Settings saved');
    } catch (e: any) {
      toastError(e.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold tracking-tight text-slate-900">Settings</h1>

      <SectionTitle icon={<IconSettings className="w-3.5 h-3.5" />} title="General" sub="Notices and exam preferences" />
      <div className={card + ' p-3.5 space-y-2.5'}>
        <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
          <IconInfo className="w-3 h-3 mt-0.5 shrink-0" />
          Students sign in on the web app with email and password. There is no Telegram bot to configure.
        </p>
        <Field label="System notice">
          <textarea
            className={inp}
            value={form.systemNotice || ''}
            onChange={(e) => setForm({ ...form, systemNotice: e.target.value })}
            placeholder="Optional message shown to students"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.allowPractice !== false}
            onChange={(e) => setForm({ ...form, allowPractice: e.target.checked })}
          />
          Allow practice attempts
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={!!form.maintenanceMode}
            onChange={(e) => setForm({ ...form, maintenanceMode: e.target.checked })}
          />
          Maintenance mode
        </label>
        <button type="button" className={btnP + ' w-full !py-2'} disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save'}
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
                  <div className="text-[11px] font-semibold text-slate-700">{String(l.action || '').replace(/_/g, ' ')}</div>
                  {l.details && <div className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{l.details}</div>}
                  <div className="text-[9px] text-slate-400 mt-0.5">{formatIST(l.timestamp || l.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
