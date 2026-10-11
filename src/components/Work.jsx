import React, { useEffect, useState } from 'react';
import { T } from '../shared';
import { apiGet, mediaUrl } from '../lib/api';
import { Play } from 'lucide-react';
import VideoPlayer from './VideoPlayer';

export default function Work({ filter }) {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    apiGet('/api/work', { auth: false }).then(setItems).catch((err) => console.error('failed to load work items', err));
  }, []);

  const filtered = filter === 'all' ? items : items.filter((w) => w.tag === filter);
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 reveal">
        {filtered.map((w) => (
          <div
            key={w.id}
            onClick={() => (w.videoUrl || w.youtubeEmbedUrl) && setActive(w)}
            className="workcard media-dark group relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer"
            style={{ border: `1px solid ${T.line}` }}
          >
            <div
              className="zoomer absolute inset-0"
              style={{
                background: `linear-gradient(150deg, hsl(${w.hue} 42% 22%), ${T.surface} 70%)`,
                transition: "transform .7s cubic-bezier(.2,.7,.2,1)",
              }}
            >
              {w.thumbnailUrl && (
                <img
                  src={mediaUrl(w.thumbnailUrl)}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
            </div>
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,.78) 8%, transparent 62%)" }} />

            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 group-hover:scale-110"
                style={{ background: "rgba(245,242,236,.10)", backdropFilter: "blur(6px)", border: "1px solid rgba(245,242,236,.2)" }}
              >
                <Play size={18} fill={T.text} style={{ marginLeft: 2 }} />
              </div>
            </div>

            <span
              className="absolute top-4 right-4 text-[10px] px-2.5 py-1 rounded"
              style={{ fontFamily: "'JetBrains Mono', monospace", background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)" }}
            >
              {w.durationLabel}
            </span>

            <div className="absolute bottom-0 left-0 right-0 p-5">
              <div className="h-[3px] w-full rounded-full mb-4 overflow-hidden" style={{ background: "rgba(255,255,255,.16)" }}>
                <div className="scrubfill h-full w-0 rounded-full" style={{ background: T.stream }} />
              </div>
              <p className="text-base font-medium leading-snug">{w.title}</p>
              <p className="text-xs mt-0.5" style={{ color: T.muted }}>{w.client}</p>
            </div>
          </div>
        ))}
      </div>
      {active && (
        <VideoPlayer
          src={mediaUrl(active.videoUrl)}
          poster={mediaUrl(active.thumbnailUrl) || undefined}
          youtubeUrl={active.youtubeEmbedUrl}
          title={active.title}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}
