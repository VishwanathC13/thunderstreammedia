import React, { useEffect, useState } from 'react';
import { Plus, Eye, EyeOff, Trash2, Upload } from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete, mediaUrl, BASE_URL } from '../../lib/api';
import { T, FILTERS } from '../../shared';

const TAGS = FILTERS.filter((f) => f.key !== 'all');

export default function Content() {
  const [items, setItems] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ title: '', client: '', tag: 'video', durationLabel: '', hue: 200, videoPath: '', youtubeUrl: '', thumbnailPath: '' });
  const [uploading, setUploading] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [error, setError] = useState('');

  const load = () => { apiGet('/api/admin/work').then(setItems).catch((err) => console.error(err)); };
  useEffect(load, []);

  // Uploads one file and returns the stored filename.
  const uploadToServer = async (file) => {
    const token = localStorage.getItem('ah_token');
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${BASE_URL}/api/admin/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data.path;
  };

  const uploadFile = async (file) => {
    setUploading(true);
    setError('');
    try {
      const path = await uploadToServer(file);
      setForm((f) => ({ ...f, videoPath: path }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const uploadThumbnail = async (file) => {
    setUploadingThumb(true);
    setError('');
    try {
      const path = await uploadToServer(file);
      setForm((f) => ({ ...f, thumbnailPath: path }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingThumb(false);
    }
  };

  // Set or replace the thumbnail on an existing portfolio item.
  const updateThumbnail = async (item, file) => {
    setError('');
    try {
      const path = await uploadToServer(file);
      await apiPatch(`/api/admin/work/${item.id}`, { thumbnailPath: path });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiPost('/api/admin/work', { ...form, hue: Number(form.hue) });
      setForm({ title: '', client: '', tag: 'video', durationLabel: '', hue: 200, videoPath: '', youtubeUrl: '', thumbnailPath: '' });
      setFormOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const togglePublished = async (item) => {
    await apiPatch(`/api/admin/work/${item.id}`, { published: !item.published });
    load();
  };

  const remove = async (id) => {
    await apiDelete(`/api/admin/work/${id}`);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-xs tracking-[.2em] uppercase mb-2" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>Content</div>
          <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-3xl">Portfolio</h1>
        </div>
        <button onClick={() => setFormOpen((o) => !o)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium" style={{ background: T.stream, color: T.bg }}>
          <Plus size={14} /> Add work item
        </button>
      </div>

      {formOpen && (
        <form onSubmit={submit} className="mb-6 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-3" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
          <input required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          <input required placeholder="Client" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          <select value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }}>
            {TAGS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <input required placeholder="Duration label, e.g. 01:35" value={form.durationLabel} onChange={(e) => setForm({ ...form, durationLabel: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          <input type="number" min="0" max="360" placeholder="Hue (0-360)" value={form.hue} onChange={(e) => setForm({ ...form, hue: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          <input type="url" placeholder="YouTube URL (optional)" value={form.youtubeUrl} onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none md:col-span-2" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          <label className="px-3 py-2.5 rounded-xl text-sm flex items-center gap-2 cursor-pointer" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.muted }}>
            <Upload size={14} />
            {uploading ? 'Uploading…' : form.videoPath ? 'Video attached' : 'Upload video (optional)'}
            <input type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0])} />
          </label>
          <label className="px-3 py-2.5 rounded-xl text-sm flex items-center gap-2 cursor-pointer" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.muted }}>
            <Upload size={14} />
            {uploadingThumb ? 'Uploading…' : form.thumbnailPath ? 'Thumbnail attached' : 'Upload thumbnail (optional)'}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && uploadThumbnail(e.target.files[0])} />
          </label>
          <button type="submit" className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: T.stream, color: T.bg }}>Save</button>
          {error && <div className="md:col-span-3 text-sm" style={{ color: T.ember }}>{error}</div>}
        </form>
      )}

      {!formOpen && error && <div className="mb-4 text-sm" style={{ color: T.ember }}>{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((w) => (
          <div key={w.id} className="rounded-2xl overflow-hidden" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
            <div className="media-dark aspect-video relative" style={{ background: `linear-gradient(150deg, hsl(${w.hue} 42% 22%), ${T.surface} 70%)` }}>
              {w.thumbnailUrl && (
                <img src={mediaUrl(w.thumbnailUrl)} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
              )}
              <span className="absolute top-3 right-3 z-10 text-[10px] px-2 py-1 rounded" style={{ fontFamily: "'JetBrains Mono', monospace", background: 'rgba(0,0,0,.55)' }}>{w.durationLabel}</span>
            </div>
            <div className="p-4">
              <p className="text-sm font-medium">{w.title}</p>
              <p className="text-xs mb-3" style={{ color: T.muted }}>{w.client} · {w.tag}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => togglePublished(w)} className="text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1" style={{ background: w.published ? 'rgba(87,192,122,.14)' : 'var(--wash)', color: w.published ? '#57C07A' : T.muted }}>
                  {w.published ? <Eye size={12} /> : <EyeOff size={12} />} {w.published ? 'Published' : 'Hidden'}
                </button>
                <label className="text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1 cursor-pointer" style={{ background: 'var(--wash)', color: T.muted }}>
                  <Upload size={12} /> {w.thumbnailUrl ? 'Change thumbnail' : 'Add thumbnail'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) updateThumbnail(w, f); }} />
                </label>
                <button onClick={() => remove(w.id)} className="text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(229,98,45,.14)', color: T.ember }}>
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
