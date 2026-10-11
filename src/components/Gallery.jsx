import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { apiGet, mediaUrl } from '../lib/api';
import { T, Eyebrow } from '../shared';

export default function Gallery() {
  const [images, setImages] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    apiGet('/api/gallery', { auth: false })
      .then((items) => setImages(items))
      .catch((err) => console.error('failed to load gallery', err));
  }, []);

  useEffect(() => {
    if (images.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % images.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [images.length]);

  if (images.length === 0) return null;

  const active = images[activeIndex] || images[0];
  const move = (step) => setActiveIndex((index) => (index + step + images.length) % images.length);

  return (
    <section id="gallery" className="px-5 md:px-10 py-24 md:py-32" style={{ borderTop: `1px solid ${T.line}` }}>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-7 mb-12">
        <div>
          <Eyebrow color={T.daylight}>Photography</Eyebrow>
          <h2 style={{ fontFamily: "'Fraunces', serif", letterSpacing: '-.02em' }} className="text-4xl md:text-6xl max-w-2xl leading-[1.02]">
            Frames worth keeping.
          </h2>
        </div>
        <p className="text-sm max-w-xs" style={{ color: T.muted }}>
          A moving edit of the people, places, and details we find between takes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-5">
        <div className="relative aspect-[16/10] overflow-hidden rounded-2xl media-dark" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
          <img src={mediaUrl(active.imageUrl)} alt={active.title} className="absolute inset-0 w-full h-full object-cover" />
          {images.length > 1 && (
            <>
              <button onClick={() => move(-1)} title="Previous photograph" aria-label="Previous photograph" className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,.5)', color: '#fff' }}>
                <ChevronLeft size={20} />
              </button>
              <button onClick={() => move(1)} title="Next photograph" aria-label="Next photograph" className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,.5)', color: '#fff' }}>
                <ChevronRight size={20} />
              </button>
            </>
          )}
          <div className="absolute left-5 right-5 bottom-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-lg font-medium">{active.title}</p>
              {active.caption && <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,.72)' }}>{active.caption}</p>}
            </div>
            <span className="text-[10px] shrink-0 px-2.5 py-1 rounded" style={{ background: 'rgba(0,0,0,.55)', fontFamily: "'JetBrains Mono', monospace" }}>
              {String(activeIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 lg:grid-cols-2 gap-3 content-start">
          {images.map((image, index) => (
            <button key={image.id} onClick={() => setActiveIndex(index)} aria-label={`Show ${image.title}`} className="relative aspect-[4/3] overflow-hidden rounded-xl" style={{ border: `1px solid ${index === activeIndex ? T.stream : T.line}`, opacity: index === activeIndex ? 1 : .62 }}>
              <img src={mediaUrl(image.imageUrl)} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}