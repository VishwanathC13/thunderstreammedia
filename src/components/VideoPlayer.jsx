import React, { useRef, useState, useEffect, useMemo } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, Volume1, VolumeX, Maximize, Minimize, X, Radio, Settings, Check } from 'lucide-react';
import { T } from '../shared';

const isHlsSource = (src) => typeof src === 'string' && src.includes('.m3u8');

// Real streams can expose messy/duplicate renditions (e.g. 270p, 432p,
// three separate "1080p" variants). Collapse whatever the manifest
// actually offers down to this fixed, familiar ladder — one HLS level
// picked per bucket (nearest by height), buckets with nothing close
// enough just don't appear.
const QUALITY_LADDER = [240, 360, 480, 720, 1080];

function buildQualityOptions(levels) {
  const byBucket = new Map();
  levels.forEach((level, levelIndex) => {
    if (!level.height) return;
    let nearest = QUALITY_LADDER[0];
    let bestDiff = Infinity;
    for (const bucket of QUALITY_LADDER) {
      const diff = Math.abs(level.height - bucket);
      if (diff < bestDiff) {
        bestDiff = diff;
        nearest = bucket;
      }
    }
    const existing = byBucket.get(nearest);
    if (!existing || Math.abs(level.height - nearest) < Math.abs(existing.level.height - nearest)) {
      byBucket.set(nearest, { levelIndex, level, label: `${nearest}p` });
    }
  });
  return QUALITY_LADDER.filter((b) => byBucket.has(b)).map((b) => byBucket.get(b));
}

// Renders both on-demand clips (mp4/etc, native <video>) and live streams
// (.m3u8 HLS, via hls.js — native <video> only understands HLS in Safari).
// `inline` embeds the player directly in the page flow (event livestream
// section); the default lightbox mode is a fixed modal (Work-grid click
// to play).
export default function VideoPlayer({ src, poster, youtubeUrl, title, live = false, inline = false, onClose }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  // Browsers block autoplay-with-sound; live streams autoplay, so they
  // need to start muted for that to actually succeed. The viewer can
  // unmute with one click once playback has started.
  const [muted, setMuted] = useState(live);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [streamError, setStreamError] = useState(false);
  const [levels, setLevels] = useState([]); // HLS quality levels, if any
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 = Auto
  const [activeLevel, setActiveLevel] = useState(null); // resolved level while in Auto
  const [qualityOpen, setQualityOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    setStreamError(false);
    setLevels([]);
    setCurrentLevel(-1);
    setActiveLevel(null);

    if (isHlsSource(src)) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(v);
        hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
          setLevels(data.levels || []);
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, data) => {
          setActiveLevel(data.level);
        });
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data?.fatal) setStreamError(true);
        });
        return () => hls.destroy();
      }
      if (v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = src; // native HLS (Safari) — no per-level control available here
      } else {
        setStreamError(true);
      }
    } else {
      v.src = src;
    }
  }, [src]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setProgress(v.currentTime);
    const onMeta = () => setDuration(v.duration);
    const onEnd = () => setPlaying(false);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('ended', onEnd);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('ended', onEnd);
    };
  }, [src]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) v.pause(); else v.play();
    setPlaying(!playing);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const changeVolume = (e) => {
    const v = videoRef.current;
    if (!v) return;
    const val = Number(e.target.value);
    v.volume = val;
    setVolume(val);
    v.muted = val === 0;
    setMuted(val === 0);
  };

  const selectQuality = (index) => {
    if (hlsRef.current) hlsRef.current.currentLevel = index;
    setCurrentLevel(index);
    setQualityOpen(false);
  };

  const seek = (e) => {
    const v = videoRef.current;
    if (!v || !duration || live) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    v.currentTime = ratio * duration;
  };

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      containerRef.current?.requestFullscreen?.();
    }
  };

  const fmt = (t) => {
    if (!Number.isFinite(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const qualityOptions = useMemo(() => buildQualityOptions(levels), [levels]);
  const activeOption = qualityOptions.find((o) => o.levelIndex === (currentLevel === -1 ? activeLevel : currentLevel));
  const qualityButtonLabel = currentLevel === -1
    ? (activeOption ? `Auto (${activeOption.label})` : 'Auto')
    : (activeOption?.label ?? 'Auto');
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const player = (
    <div ref={containerRef} className="media-dark w-full rounded-2xl overflow-hidden relative" style={{ background: T.surface }} onClick={(e) => e.stopPropagation()}>
      {onClose && (
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,.5)', color: T.text }}>
          <X size={16} />
        </button>
      )}
      {live && !streamError && (
        <span
          className="absolute top-4 left-4 z-10 text-[10px] px-2.5 py-1.5 rounded-full flex items-center gap-1.5"
          style={{ background: 'rgba(240,54,42,.85)', color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#fff', animation: 'pulseDot 1.4s ease-in-out infinite' }} />
          LIVE
        </span>
      )}
      {youtubeUrl ? (
        <iframe
          src={youtubeUrl}
          title={title}
          className="w-full aspect-video block"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : streamError ? (
        <div className="w-full aspect-video flex flex-col items-center justify-center gap-2" style={{ background: '#000', color: T.muted }}>
          <Radio size={22} />
          <p className="text-sm">Stream isn't live yet — check back at showtime.</p>
        </div>
      ) : (
        <video
          ref={videoRef}
          poster={poster}
          muted={muted}
          className="w-full aspect-video block"
          style={{ background: '#000', outline: 'none' }}
          onClick={togglePlay}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          autoPlay={live}
          playsInline
        />
      )}
      <div className="p-4 flex items-center gap-4 flex-wrap" style={{ borderTop: `1px solid ${T.line}` }}>
        <button onClick={togglePlay} style={{ color: T.text }}>
          {playing ? <Pause size={18} /> : <Play size={18} fill={T.text} />}
        </button>
        {live ? (
          <div className="flex-1 text-xs" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>Broadcasting live</div>
        ) : (
          <>
            <div className="flex-1 h-1.5 rounded-full cursor-pointer" style={{ background: T.line }} onClick={seek}>
              <div className="h-full rounded-full" style={{ width: `${duration ? (progress / duration) * 100 : 0}%`, background: T.stream }} />
            </div>
            <span className="text-xs tabular-nums" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(progress)} / {fmt(duration)}</span>
          </>
        )}

        <div className="flex items-center gap-2">
          <button onClick={toggleMute} style={{ color: T.text }}>
            <VolumeIcon size={16} />
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={changeVolume}
            className="w-16 accent-current"
            style={{ accentColor: T.stream }}
          />
        </div>

        {qualityOptions.length > 1 && (
          <div className="relative">
            <button
              onClick={() => setQualityOpen((o) => !o)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full"
              style={{ background: 'var(--wash)', color: T.text }}
            >
              <Settings size={13} /> {qualityButtonLabel}
            </button>
            {qualityOpen && (
              <div
                className="absolute bottom-full right-0 mb-2 rounded-xl overflow-hidden text-xs min-w-[9rem] z-20"
                style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, boxShadow: '0 20px 50px rgba(0,0,0,.5)' }}
              >
                <button
                  onClick={() => selectQuality(-1)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[var(--wash)]"
                  style={{ color: currentLevel === -1 ? T.stream : T.text }}
                >
                  Auto {currentLevel === -1 && <Check size={12} />}
                </button>
                {qualityOptions.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => selectQuality(opt.levelIndex)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[var(--wash)]"
                    style={{ color: currentLevel === opt.levelIndex ? T.stream : T.text }}
                  >
                    {opt.label} {currentLevel === opt.levelIndex && <Check size={12} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button onClick={toggleFullscreen} style={{ color: T.text }}>
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
      </div>
      {title && <div className="px-4 pb-3 text-sm" style={{ color: T.muted }}>{title}</div>}
    </div>
  );

  if (inline) return player;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-5"
      style={{ background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div className="w-full max-w-3xl">{player}</div>
    </div>
  );
}
