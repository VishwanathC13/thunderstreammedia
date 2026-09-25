import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Calendar, Check, X, ExternalLink } from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete, BASE_URL } from '../../lib/api';
import { T } from '../../shared';

const ROLES = ['OWNER', 'SALES', 'EDITOR', 'FINANCE'];
const INTEGRATION_LABELS = {
  zoom: 'Zoom', teams: 'Microsoft Teams', webex: 'Webex', whatsapp: 'WhatsApp Business API',
  email: 'SendGrid (email)', razorpay: 'Razorpay', googleCalendar: 'Google Calendar',
  geoip: 'GeoIP blocking', storage: 'Media storage',
};

function StatusPill({ enabled }) {
  return (
    <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: enabled ? 'rgba(87,192,122,.14)' : 'var(--wash)', color: enabled ? '#57C07A' : T.muted }}>
      {enabled ? 'Live' : 'Mocked'}
    </span>
  );
}

export default function Settings() {
  const [users, setUsers] = useState([]);
  const [integrations, setIntegrations] = useState({});
  const [georules, setGeorules] = useState([]);
  const [capacity, setCapacity] = useState(null);
  const [capacitySaving, setCapacitySaving] = useState(false);
  const [userForm, setUserForm] = useState({ email: '', name: '', password: '', role: 'SALES' });
  const [ruleForm, setRuleForm] = useState({ mode: 'BLOCK', countryCode: '' });
  const [error, setError] = useState('');
  const [calendarStatus, setCalendarStatus] = useState(null);
  const [calendarNotice, setCalendarNotice] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadCalendarStatus = () => apiGet('/api/admin/google-calendar/status').then(setCalendarStatus).catch((err) => console.error(err));

  useEffect(() => {
    apiGet('/api/admin/users').then(setUsers).catch((err) => console.error(err));
    apiGet('/api/admin/integrations/status').then(setIntegrations).catch((err) => console.error(err));
    apiGet('/api/admin/georules').then(setGeorules).catch((err) => console.error(err));
    apiGet('/api/admin/settings').then((c) => setCapacity(c.maxBookingsPerDay)).catch((err) => console.error(err));
    loadCalendarStatus();

    const params = new URLSearchParams(window.location.search);
    if (params.get('calendar') === 'connected') {
      setCalendarNotice({ ok: true, message: 'Google Calendar connected.' });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('calendar') === 'error') {
      setCalendarNotice({ ok: false, message: params.get('reason') || 'Failed to connect Google Calendar.' });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const connectGoogleCalendar = () => {
    const token = localStorage.getItem('ah_token');
    window.location.href = `${BASE_URL}/api/admin/google-calendar/connect?token=${encodeURIComponent(token)}`;
  };

  const disconnectGoogleCalendar = async () => {
    setDisconnecting(true);
    try {
      await apiPost('/api/admin/google-calendar/disconnect');
      await loadCalendarStatus();
      apiGet('/api/admin/integrations/status').then(setIntegrations);
    } finally {
      setDisconnecting(false);
    }
  };

  const saveCapacity = async () => {
    setCapacitySaving(true);
    try {
      const updated = await apiPatch('/api/admin/settings', { maxBookingsPerDay: Number(capacity) });
      setCapacity(updated.maxBookingsPerDay);
    } catch (err) {
      setError(err.message);
    } finally {
      setCapacitySaving(false);
    }
  };

  const addUser = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiPost('/api/admin/users', userForm);
      setUserForm({ email: '', name: '', password: '', role: 'SALES' });
      apiGet('/api/admin/users').then(setUsers);
    } catch (err) {
      setError(err.message);
    }
  };

  const addRule = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiPost('/api/admin/georules', ruleForm);
      setRuleForm({ mode: 'BLOCK', countryCode: '' });
      apiGet('/api/admin/georules').then(setGeorules);
    } catch (err) {
      setError(err.message);
    }
  };

  const removeRule = async (id) => {
    await apiDelete(`/api/admin/georules/${id}`);
    apiGet('/api/admin/georules').then(setGeorules);
  };

  return (
    <div className="space-y-10">
      <div>
        <div className="text-xs tracking-[.2em] uppercase mb-2" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>Settings</div>
        <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-3xl">Studio settings</h1>
      </div>

      <section>
        <h2 className="text-lg mb-4">Integration status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(integrations).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
              <span className="text-sm">{INTEGRATION_LABELS[key] || key}</span>
              <StatusPill enabled={val.enabled} />
            </div>
          ))}
        </div>
        <p className="text-xs mt-3" style={{ color: T.muted }}>
          "Mocked" integrations run the full flow with realistic fake responses — add real API credentials to server/.env to go live.
        </p>
      </section>

      <section>
        <h2 className="text-lg mb-4">Booking capacity</h2>
        <div className="rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
          <div>
            <p className="text-sm mb-1">Max bookings per day</p>
            <p className="text-xs" style={{ color: T.muted }}>
              How many jobs your crews can run on the same date before it's shown as fully booked to customers.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={50}
              value={capacity ?? ''}
              onChange={(e) => setCapacity(e.target.value)}
              className="w-20 px-3 py-2.5 rounded-xl text-sm text-center outline-none"
              style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }}
            />
            <button
              onClick={saveCapacity}
              disabled={capacitySaving || capacity === null}
              className="px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ background: T.stream, color: T.bg }}
            >
              {capacitySaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg mb-4">Google Calendar</h2>
        {calendarNotice && (
          <div
            className="mb-3 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
            style={{
              background: calendarNotice.ok ? 'rgba(87,192,122,.12)' : 'rgba(229,98,45,.12)',
              color: calendarNotice.ok ? '#57C07A' : T.ember,
            }}
          >
            {calendarNotice.ok ? <Check size={14} /> : <X size={14} />} {calendarNotice.message}
          </div>
        )}
        <div className="rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
          <div className="flex items-center gap-3">
            <Calendar size={18} style={{ color: T.muted }} />
            <div>
              {calendarStatus?.connected ? (
                <>
                  <p className="text-sm mb-0.5">Connected as {calendarStatus.email}</p>
                  <p className="text-xs" style={{ color: T.muted }}>Confirmed bookings can sync to this calendar from Bookings & Calendar.</p>
                </>
              ) : (
                <>
                  <p className="text-sm mb-0.5">Not connected</p>
                  <p className="text-xs" style={{ color: T.muted }}>
                    {calendarStatus && !calendarStatus.configured
                      ? 'Server is missing GOOGLE_OAUTH_CLIENT_ID / SECRET — add those to server/.env first.'
                      : 'Connect a Google account to sync confirmed bookings onto its calendar.'}
                  </p>
                </>
              )}
            </div>
          </div>
          {calendarStatus?.connected ? (
            <button
              onClick={disconnectGoogleCalendar}
              disabled={disconnecting}
              className="px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ background: 'rgba(229,98,45,.14)', color: T.ember }}
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          ) : (
            <button
              onClick={connectGoogleCalendar}
              disabled={calendarStatus && !calendarStatus.configured}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40"
              style={{ background: T.stream, color: T.bg }}
            >
              Connect Google Calendar <ExternalLink size={13} />
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg mb-4">Users</h2>
        <form onSubmit={addUser} className="rounded-2xl p-5 grid grid-cols-1 md:grid-cols-5 gap-3 mb-4" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
          <input required placeholder="Name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          <input required type="email" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          <input required type="password" placeholder="Password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button type="submit" className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5" style={{ background: T.stream, color: T.bg }}>
            <Plus size={14} /> Add
          </button>
        </form>
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.line}` }}>
          <table className="w-full text-sm">
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderTop: `1px solid ${T.line}` }}>
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3" style={{ color: T.muted }}>{u.email}</td>
                  <td className="px-4 py-3" style={{ color: T.muted }}>{u.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg mb-4">Geoblocking rules</h2>
        <form onSubmit={addRule} className="rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-3 mb-4" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
          <select value={ruleForm.mode} onChange={(e) => setRuleForm({ ...ruleForm, mode: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }}>
            <option value="BLOCK">Block</option>
            <option value="ALLOW">Allow only</option>
          </select>
          <input required placeholder="Country code, e.g. CN" maxLength={2} value={ruleForm.countryCode} onChange={(e) => setRuleForm({ ...ruleForm, countryCode: e.target.value.toUpperCase() })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          <button type="submit" className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: T.stream, color: T.bg }}>Add rule</button>
        </form>
        {error && <p className="text-sm mb-3" style={{ color: T.ember }}>{error}</p>}
        <div className="space-y-2">
          {georules.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
              <span className="text-sm">{r.mode === 'BLOCK' ? 'Blocking' : 'Allowing only'} {r.countryCode} ({r.scope})</span>
              <button onClick={() => removeRule(r.id)} style={{ color: T.ember }}><Trash2 size={14} /></button>
            </div>
          ))}
          {georules.length === 0 && <p style={{ color: T.muted }} className="text-sm">No rules — all traffic allowed (fail-open default).</p>}
        </div>
      </section>
    </div>
  );
}
