import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, ChevronDown, Maximize2 } from 'lucide-react';
import { Song } from '../types';

interface PlayerBarProps {
  currentSong: Song | null;
  isPlaying: boolean;
  audioRef: React.RefObject<HTMLAudioElement>;
  onTogglePlay: (e?: React.MouseEvent) => void;
  onNext: (e?: React.MouseEvent) => void;
  onPrev: (e?: React.MouseEvent) => void;
}

/* ============================================================
   PULSE ORBIT v2 â€” Ø£Ø®Ù ÙˆØ£Ø³Ø±Ø¹ ÙˆØ£Ø¬Ù…Ù„
   ------------------------------------------------------------
   ØªØ­Ø³ÙŠÙ†Ø§Øª Ø§Ù„Ø£Ø¯Ø§Ø¡ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©:
   1) ØµÙØ± Re-render Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„ØªØ´ØºÙŠÙ„: Ø§Ù„ØªÙ‚Ø¯Ù‘Ù… (Ù†Ø³Ø¨Ø© Ø§Ù„Ø´Ø±ÙŠØ·ØŒ Ø§Ù„ÙˆÙ‚ØªØŒ
      Ø§Ù„Ù‚Ù…Ø± Ø¹Ù„Ù‰ Ø§Ù„Ù…Ø¯Ø§Ø±) Ø¨ÙŠØªØ­Ø¯Ø« Ø¹Ø¨Ø± refs + requestAnimationFrame
      Ù…Ø¨Ø§Ø´Ø±Ø© Ø¹Ù„Ù‰ Ø§Ù„Ù€ DOMØŒ Ù…Ù† ØºÙŠØ± setState Ù…Ø¹ ÙƒÙ„ Ù†Ø¨Ø¶Ø© ØµÙˆØª.
   2) Ø­Ù„Ù‚Ø© Ø§Ù„Ù€ 72 Ø¹Ù„Ø§Ù…Ø© Ø¨ØªØ±Ù†Ø¯Ø± Ù…Ø±Ø© ÙˆØ§Ø­Ø¯Ø© (React.memo) ÙˆØ¨ØªØ±Ø³Ù…
      Ù…Ù† Ø¬Ø¯ÙŠØ¯ ÙÙ‚Ø· Ù„Ù…Ø§ Ø¹Ù„Ø§Ù…Ø© Ø¬Ø¯ÙŠØ¯Ø© ØªÙ†ÙˆØ± (72 Ù…Ø±Ø©/Ø£ØºÙ†ÙŠØ©).
   3) Ø´ÙŠÙ„Ù†Ø§ Ø§Ù„Ù€ backdrop-blur-3xl Ùˆ blur(70px) Ø§Ù„ØºØ§Ù„ÙŠØ© ÙˆØ§Ø³ØªØ¨Ø¯Ù„Ù†Ø§Ù‡Ø§
      Ø¨Ø·Ø¨Ù‚Ø§Øª Ø£Ø®Ù (blur-2xl / blur(48px)) Ø¨Ù†ÙØ³ Ø§Ù„Ø´ÙƒÙ„ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ.
   4) Ø´ÙŠÙ„Ù†Ø§ 72 Ø£Ù†ÙŠÙ…ÙŠØ´Ù† breathe Ù…ØªØ²Ø§Ù…Ù†Ø© â€” Ø§Ù„Ø­Ø±ÙƒØ© Ø§Ù„Ù…ØªØ¨Ù‚ÙŠØ© ÙƒÙ„Ù‡Ø§
      transform ÙÙ‚Ø· (GPU) Ø£Ùˆ Ù…Ø¹Ø§Ø¯Ù„ ØµÙˆØªÙŠ Ø®ÙÙŠÙ Ù…Ù† 5 Ø£Ø¹Ù…Ø¯Ø©.
   5) Ø§Ù„Ù…Ø´ØºÙ„ Ø§Ù„Ù…Ù…ØªØ¯ Ù…Ø§ Ø¨ÙŠØªØ¹Ù…Ù„Ù‡ mount Ø¥Ù„Ø§ Ø¨Ø¹Ø¯ Ø£ÙˆÙ„ ÙØªØ­ ÙØ¹Ù„ÙŠ.
   6) Ø£Ù„ÙˆØ§Ù† Ø§Ù„ØºÙ„Ø§Ù Ø¨ØªØªØ®Ø²Ù† ÙÙŠ cache Ù„ØªÙØ§Ø¯ÙŠ Ø¥Ø¹Ø§Ø¯Ø© Ø§Ù„Ø§Ø³ØªØ®Ø±Ø§Ø¬.
   ============================================================ */

type RGB = [number, number, number];

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=600';
const FALLBACK_A: RGB = [245, 158, 11];
const FALLBACK_B: RGB = [194, 65, 12];
const TICKS = 72;

const KEYFRAMES = `
@keyframes pb-spin { to { transform: rotate(360deg); } }
@keyframes pb-drift {
  from { transform: scale(1.15) translate3d(-2%, -2%, 0); }
  to   { transform: scale(1.3) translate3d(2%, 2%, 0); }
}
@keyframes pb-float-a {
  from { transform: translate3d(-4%, -3%, 0); }
  to   { transform: translate3d(8%, 7%, 0); }
}
@keyframes pb-float-b {
  from { transform: translate3d(4%, 3%, 0); }
  to   { transform: translate3d(-8%, -7%, 0); }
}
@keyframes pb-ripple {
  0%   { transform: scale(1);   opacity: 0.55; }
  100% { transform: scale(1.7); opacity: 0; }
}
@keyframes pb-swap-in {
  from { opacity: 0; transform: translateY(10px) scale(0.97); }
  to   { opacity: 1; transform: none; }
}
@keyframes pb-eq {
  0%, 100% { transform: scaleY(0.35); }
  50%      { transform: scaleY(1); }
}
@media (prefers-reduced-motion: reduce) {
  .pb-anim { animation: none !important; }
}
`;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const formatTime = (seconds: number) => {
  const s = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const rgbToHsl = ([r, g, b]: RGB): [number, number, number] => {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
};

const hslToRgb = (h: number, s: number, l: number): RGB => {
  const hh = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (hh < 60) { r = c; g = x; }
  else if (hh < 120) { r = x; g = c; }
  else if (hh < 180) { g = c; b = x; }
  else if (hh < 240) { g = x; b = c; }
  else if (hh < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
};

// === Cache: Ù†ÙØ³ Ø§Ù„ØºÙ„Ø§Ù = Ù†ÙØ³ Ø§Ù„Ø£Ù„ÙˆØ§Ù†ØŒ Ø¨Ø¯ÙˆÙ† Ø¥Ø¹Ø§Ø¯Ø© Ø§Ø³ØªØ®Ø±Ø§Ø¬ ===
const colorCache = new Map<string, { a: RGB; b: RGB }>();

const useAccentColors = (src: string) => {
  const [colors, setColors] = useState<{ a: RGB; b: RGB }>(() =>
    colorCache.get(src) ?? { a: FALLBACK_A, b: FALLBACK_B }
  );

  useEffect(() => {
    const cached = colorCache.get(src);
    if (cached) { setColors(cached); return; }
    let cancelled = false;
    const useFallback = () => {
      if (!cancelled) setColors({ a: FALLBACK_A, b: FALLBACK_B });
    };

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const size = 24;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return useFallback();
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let r = 0, g = 0, b = 0, total = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue;
          const max = Math.max(data[i], data[i + 1], data[i + 2]);
          const min = Math.min(data[i], data[i + 1], data[i + 2]);
          const sat = max === 0 ? 0 : (max - min) / max;
          const lum = (max + min) / 510;
          const weight = 0.02 + sat * sat * (1 - Math.abs(lum - 0.55));
          r += data[i] * weight;
          g += data[i + 1] * weight;
          b += data[i + 2] * weight;
          total += weight;
        }
        if (total === 0) return useFallback();

        const [h, s, l] = rgbToHsl([r / total, g / total, b / total]);
        if (s < 0.08) return useFallback();

        const result = {
          a: hslToRgb(h, clamp(s * 1.15, 0.6, 0.95), clamp(l, 0.5, 0.62)),
          b: hslToRgb(h + 35, clamp(s, 0.55, 0.9), 0.4),
        };
        colorCache.set(src, result);
        if (!cancelled) setColors(result);
      } catch {
        useFallback();
      }
    };
    img.onerror = useFallback;
    img.src = src;

    return () => { cancelled = true; };
  }, [src]);

  return colors;
};

/* ============================================================
   Ø­Ù„Ù‚Ø© Ø§Ù„Ù…Ø¯Ø§Ø±: 72 Ø¹Ù„Ø§Ù…Ø© ØªÙØ±Ø³Ù… Ù…Ø±Ø© ÙˆØ§Ø­Ø¯Ø© (React.memo).
   Ø¹Ù„Ø§Ù…Ø© Ø¬Ø¯ÙŠØ¯Ø© ØªÙ†ÙˆØ± ÙÙ‚Ø· => Ø±Ù†Ø¯Ø± Ø®ÙÙŠÙ Ø¬Ø¯Ø§Ù‹ (72 Ù…Ø±Ø© Ø¨Ø§Ù„Ø£ØºÙ†ÙŠØ©).
   ============================================================ */
interface OrbitRingProps {
  progressRef: React.MutableRefObject<number>;
  accentA: RGB;
}

const OrbitRing = React.memo<OrbitRingProps>(({ progressRef, accentA }) => {
  const [litCount, setLitCount] = useState(0);

  useEffect(() => {
    let raf = 0;
    let lastLit = -1;
    const tick = () => {
      const lit = Math.floor(((progressRef.current ?? 0) / 100) * TICKS);
      if (lit !== lastLit) {
        lastLit = lit;
        setLitCount(lit);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progressRef]);

  return (
    <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" aria-hidden="true">
      {Array.from({ length: TICKS }, (_, i) => {
        const major = i % 6 === 0;
        const lit = i < litCount;
        return (
          <line
            key={i}
            x1={100}
            y1={2}
            x2={100}
            y2={major ? 14 : 9}
            transform={`rotate(${(i / TICKS) * 360} 100 100)`}
            strokeWidth={major ? 2.2 : 1.6}
            strokeLinecap="round"
            style={{
              stroke: lit ? `rgb(${accentA.join(',')})` : 'rgba(255,255,255,0.16)',
              transition: 'stroke 300ms ease',
            }}
          />
        );
      })}
    </svg>
  );
});

const PlayerBar: React.FC<PlayerBarProps> = ({ currentSong, isPlaying, audioRef, onTogglePlay, onNext, onPrev }) => {
  // === ØµÙØ± Re-render Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„ØªØ´ØºÙŠÙ„ ===
  // Ø§Ù„ØªÙ‚Ø¯Ù‘Ù… ÙƒÙ„Ù‡ Ø¹Ø¨Ø± refs + rAF: Ø§Ù„Ø´Ø±ÙŠØ· ÙˆØ§Ù„ÙˆÙ‚Øª ÙˆØ§Ù„Ù‚Ù…Ø± Ø¨ÙŠØªØ­Ø¯Ø«ÙˆØ§
  // Ù…Ø¨Ø§Ø´Ø±Ø© Ø¹Ù„Ù‰ Ø§Ù„Ù€ DOM Ø¨Ø¯ÙˆÙ† Ø£ÙŠ setState Ø£Ø«Ù†Ø§Ø¡ "timeupdate".
  const [volume, setVolume] = useState(0.8);
  const [isExpanded, setIsExpanded] = useState(false);
  const [duration, setDuration] = useState(0);
  const [hasMountedExpanded, setHasMountedExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const progressRef = useRef(0);
  const draggingRef = useRef(false);
  const lastRatioRef = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const barFillRef = useRef<HTMLDivElement>(null);
  const ringKnobRef = useRef<SVGGElement>(null);
  const timeLabelRef = useRef<HTMLSpanElement>(null);
  const ringSliderRef = useRef<HTMLDivElement>(null);

  const cover = currentSong?.image || DEFAULT_COVER;
  const { a: accentA, b: accentB } = useAccentColors(cover);
  const themeVars = {
    '--pb-a': accentA.join(','),
    '--pb-b': accentB.join(','),
  } as React.CSSProperties;

  const openExpanded = () => {
    setHasMountedExpanded(true);
    requestAnimationFrame(() => setIsExpanded(true));
  };

  // --- rAF ÙˆØ§Ø­Ø¯ ÙŠØ­Ø¯Ù‘Ø« ÙƒÙ„ Ø¹Ù†Ø§ØµØ± Ø§Ù„ØªÙ‚Ø¯Ù‘Ù… Ù…Ø¨Ø§Ø´Ø±Ø© Ø¹Ù„Ù‰ Ø§Ù„Ù€ DOM ---
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const audio = audioRef.current;
      if (audio && audio.duration) {
        const p = (audio.currentTime / audio.duration) * 100;
        progressRef.current = p;
        if (barFillRef.current) barFillRef.current.style.width = `${p}%`;
        if (ringKnobRef.current) ringKnobRef.current.style.transform = `rotate(${p * 3.6}deg)`;
        if (timeLabelRef.current) timeLabelRef.current.textContent = formatTime(audio.currentTime);
        if (ringSliderRef.current) ringSliderRef.current.setAttribute('aria-valuenow', String(Math.round(p)));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [audioRef]);

  // --- Ù†Ø­ØªØ§Ø¬ ÙÙ‚Ø· "duration" Ù…Ù† Ø§Ù„Ù€ metadata (Ø¨Ø¯ÙˆÙ† timeupdate) ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleDuration = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    audio.addEventListener('loadedmetadata', handleDuration);
    audio.addEventListener('durationchange', handleDuration);
    handleDuration();
    return () => {
      audio.removeEventListener('loadedmetadata', handleDuration);
      audio.removeEventListener('durationchange', handleDuration);
    };
  }, [audioRef]);

  // --- Ù…Ù†Ø¹ ØªÙ…Ø±ÙŠØ± Ø§Ù„ØµÙØ­Ø© Ù„Ù…Ø§ Ø§Ù„Ù…Ø´ØºÙ„ Ø§Ù„Ù…Ù…ØªØ¯ Ù…ÙØªÙˆØ­ ---
  useEffect(() => {
    document.documentElement.style.overflow = isExpanded ? 'hidden' : '';
    return () => { document.documentElement.style.overflow = ''; };
  }, [isExpanded]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume, audioRef]);

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percentage = clamp((rect.right - e.clientX) / rect.width, 0, 1);
    audio.currentTime = percentage * audio.duration;
    progressRef.current = percentage * 100;
  };

  const seekToRatio = useCallback((ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const r = clamp(ratio, 0, 1);
    audio.currentTime = r * audio.duration;
    progressRef.current = r * 100;
  }, [audioRef]);

  const ratioFromPointer = (clientX: number, clientY: number, avoidWrap: boolean): number => {
    const el = stageRef.current;
    if (!el) return lastRatioRef.current;
    const rect = el.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;
    let ratio = deg / 360;
    if (avoidWrap) {
      const prev = lastRatioRef.current;
      if (prev > 0.75 && ratio < 0.25) ratio = 1;
      else if (prev < 0.25 && ratio > 0.75) ratio = 0;
    }
    return ratio;
  };

  const handleRingDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setIsDragging(true);
    const r = ratioFromPointer(e.clientX, e.clientY, false);
    lastRatioRef.current = r;
    seekToRatio(r);
  };

  const handleRingMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const r = ratioFromPointer(e.clientX, e.clientY, true);
    lastRatioRef.current = r;
    seekToRatio(r);
  };

  const handleRingUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };

  const handleRingKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      audio.currentTime = Math.max(0, audio.currentTime - 5);
      e.preventDefault();
    }
  };

  const stageSize = 'min(80vw, 44dvh, 440px)';

  return (
    <>
      {/* --- Premium Mini Bar --- */}
      <div
        onClick={() => openExpanded()}
        className={`fixed bottom-[88px] md:bottom-6 left-2 right-2 md:left-4 md:right-6 lg:left-[296px] rounded-2xl md:rounded-[1.75rem] z-[100] border border-white/10 flex items-center justify-between px-3 md:px-6 shadow-2xl transition-shadow duration-500 cursor-pointer overflow-visible
          ${isPlaying ? 'shadow-[0_16px_36px_rgba(0,0,0,0.55)] ring-1 ring-white/15' : 'shadow-[0_16px_36px_rgba(0,0,0,0.5)]'}
          backdrop-blur-2xl bg-black/60
        `}
        style={{ height: 'clamp(64px, 10vw, 88px)', ...themeVars }}
      >
        {/* Progress Bar Layer â€” ÙŠØ­Ø¯Ø« Ø¹Ø¨Ø± rAF Ø¨Ø¯ÙˆÙ† re-render */}
        <div
          className="absolute -top-3 left-8 right-8 h-3 cursor-pointer group z-20 py-1"
          onClick={(e) => onSeek(e)}
        >
          <div className="w-full h-1 group-hover:h-2 bg-white/10 rounded-full overflow-hidden relative transition-all duration-300">
            <div
              ref={barFillRef}
              className="absolute top-0 right-0 h-full rounded-full bg-gradient-to-l from-cyan-400 to-purple-500"
              style={{ width: '0%' }}
            />
          </div>
        </div>

        {/* Player Left: Info */}
        <div className="flex items-center gap-2 md:gap-5 flex-1 z-10 min-w-0">
          <div className="relative flex-shrink-0">
            <div
              className={`absolute -inset-1 rounded-2xl transition-opacity duration-700 ${isPlaying ? 'opacity-90' : 'opacity-0'}`}
              style={{ background: 'radial-gradient(circle, rgba(var(--pb-a),0.45), transparent 70%)' }}
            />
            <div
              className={`w-10 h-10 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-xl md:rounded-2xl bg-cover bg-center border border-white/10 shadow-lg transition-transform duration-700 relative z-10 ${isPlaying ? 'scale-110 rotate-3' : ''}`}
              style={{ backgroundImage: `url(${cover})` }}
            />
          </div>
          <div className="overflow-hidden min-w-0">
            <div className="font-black text-xs md:text-base lg:text-lg truncate max-w-[90px] sm:max-w-[140px] md:max-w-[250px] drop-shadow-md text-white">{currentSong?.name || "Ø§ÙƒØªØ´Ù Ø§Ù„Ù…ÙˆØ³ÙŠÙ‚Ù‰"}</div>
            <div className="text-[9px] md:text-xs uppercase font-bold text-cyan-400 tracking-widest opacity-80 mt-0.5 truncate">{currentSong?.folder || "READY TO PLAY"}</div>
          </div>
          {/* Ù…Ø¤Ø´Ø± Ù…Ø¹Ø§Ø¯Ù„ ØµÙˆØªÙŠ Ø®ÙÙŠÙ (transform ÙÙ‚Ø·) */}
          <div className="hidden md:flex items-end gap-[3px] h-4 ml-1" aria-hidden="true">
            {[0.9, 0.6, 1, 0.45, 0.75].map((d, i) => (
              <span
                key={i}
                className={`w-[3px] h-full rounded-full origin-bottom ${isPlaying ? 'pb-anim' : ''}`}
                style={{
                  background: 'rgb(var(--pb-a))',
                  animation: isPlaying ? `pb-eq 1s ease-in-out ${i * 0.12}s infinite` : undefined,
                  transform: isPlaying ? undefined : 'scaleY(0.3)',
                  opacity: isPlaying ? 0.9 : 0.35,
                }}
              />
            ))}
          </div>
        </div>

        {/* Player Center: Controls */}
        <div className="flex items-center justify-center gap-2 md:gap-6 lg:gap-8 z-10 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={(e) => onPrev(e)} className="text-white/40 hover:text-white hover:scale-110 transition-all transform active:scale-95 p-1 md:p-2 hidden xs:block" aria-label="Ø§Ù„Ø³Ø§Ø¨Ù‚"><SkipBack size={20} className="md:w-6 md:h-6" /></button>
          <button
            onClick={(e) => onTogglePlay(e)}
            className="w-10 h-10 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full bg-white text-black flex items-center justify-center shadow-[0_10px_20px_rgba(255,255,255,0.2)] hover:scale-110 active:scale-95 transition-all duration-300"
            aria-label="ØªØ´ØºÙŠÙ„/Ø§ÙŠÙ‚Ø§Ù"
          >
            {isPlaying ? <Pause size={20} fill="currentColor" className="md:w-6 md:h-6" /> : <Play size={20} fill="currentColor" className="ml-0.5 md:ml-1 md:w-6 md:h-6" />}
          </button>
          <button onClick={(e) => onNext(e)} className="text-white/40 hover:text-white hover:scale-110 transition-all transform active:scale-95 p-1 md:p-2" aria-label="Ø§Ù„ØªØ§Ù„ÙŠ"><SkipForward size={20} className="md:w-6 md:h-6" /></button>
        </div>

        {/* Player Right: Volume / Expand */}
        <div className="flex items-center justify-end flex-shrink-0 z-10 gap-2 md:gap-4 ml-2 md:ml-0">
          <div className="hidden lg:flex items-center gap-3 bg-white/5 p-2 rounded-full border border-white/5 pr-4" onClick={e => e.stopPropagation()}>
            <Volume2 size={18} className="text-white/60 hover:text-cyan-400 transition-colors" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              className="w-20 h-1 accent-cyan-400 bg-white/10 rounded-full cursor-pointer"
              aria-label="Ù…Ø³ØªÙˆÙ‰ Ø§Ù„ØµÙˆØª"
            />
          </div>
          <button className="text-white/40 hover:text-white hover:scale-110 transition-all p-1.5 md:p-2 bg-white/5 rounded-full backdrop-blur-md border border-white/5" aria-label="ØªÙƒØ¨ÙŠØ± Ø§Ù„Ù…Ø´ØºÙ„">
            <Maximize2 size={16} className="md:w-5 md:h-5" />
          </button>
        </div>
      </div>

      {/* --- Full Screen Expanded Player : PULSE ORBIT v2 --- */}
      {hasMountedExpanded && (
        <div
          className={`fixed inset-0 z-[200] flex flex-col overflow-hidden transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-[100%] opacity-0 pointer-events-none'}`}
          style={themeVars}
          aria-hidden={!isExpanded}
        >
          <style>{KEYFRAMES}</style>

          {/* Atmosphere: ØºÙ„Ø§Ù Ù…Ø·Ù…ÙˆØ³ (blur Ø£Ø®Ù) + Ø´ÙÙ‚ Ø¨Ù„ÙˆÙ†ÙŠ */}
          <div className="absolute inset-0 bg-black z-0" />
          <div
            className="pb-anim absolute inset-[-15%] z-0 opacity-50"
            style={{
              backgroundImage: `url(${cover})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(48px) saturate(1.6)',
              animation: 'pb-drift 40s ease-in-out infinite alternate',
              animationPlayState: isPlaying ? 'running' : 'paused',
            }}
          />
          <div
            className="pb-anim absolute z-0 rounded-full pointer-events-none will-change-transform"
            style={{
              width: '70vmax',
              height: '70vmax',
              top: '-28vmax',
              left: '-22vmax',
              background: 'radial-gradient(circle, rgba(var(--pb-a),0.32), transparent 65%)',
              animation: 'pb-float-a 18s ease-in-out infinite alternate',
              animationPlayState: isPlaying ? 'running' : 'paused',
            }}
          />
          <div
            className="pb-anim absolute z-0 rounded-full pointer-events-none will-change-transform"
            style={{
              width: '65vmax',
              height: '65vmax',
              bottom: '-30vmax',
              right: '-22vmax',
              background: 'radial-gradient(circle, rgba(var(--pb-b),0.30), transparent 65%)',
              animation: 'pb-float-b 22s ease-in-out infinite alternate',
              animationPlayState: isPlaying ? 'running' : 'paused',
            }}
          />
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/40 via-transparent to-black/85 pointer-events-none" />

          {/* Header */}
          <div
            className="relative z-10 flex items-center justify-between px-5 pb-2"
            style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}
          >
            <button
              onClick={() => setIsExpanded(false)}
              className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white hover:bg-white/20 active:scale-90 transition-all shadow-xl"
              aria-label="Ø¥ØºÙ„Ø§Ù‚"
            >
              <ChevronDown size={26} />
            </button>
            <div className="flex flex-col items-center gap-1">
              <div className="text-[10px] md:text-xs font-black tracking-[0.3em] text-white/40 uppercase">Playing From</div>
              <div className="text-sm md:text-base font-bold tracking-widest" style={{ color: 'rgb(var(--pb-a))' }}>
                {currentSong?.folder || "LIBRARY"}
              </div>
            </div>
            <div className="w-12 h-12" /> {/* Spacer */}
          </div>

          {/* Main Content */}
          <div
            className="relative z-10 flex-1 overflow-y-auto outline-none"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            <div className="min-h-full flex flex-col items-center justify-center gap-4 md:gap-6 px-4 py-3">

              {/* ===== Ø§Ù„Ù…Ø¯Ø§Ø±: Ø§Ù„Ø­Ù„Ù‚Ø© + Ø§Ù„Ø£Ø³Ø·ÙˆØ§Ù†Ø© ===== */}
              <div
                ref={stageRef}
                dir="ltr"
                className="relative shrink-0 select-none"
                style={{ width: stageSize, height: stageSize }}
              >
                {/* Ù‡Ø§Ù„Ø© Ø«Ø§Ø¨ØªØ© Ø®Ù„Ù Ø§Ù„Ø£Ø³Ø·ÙˆØ§Ù†Ø© */}
                <div
                  className="absolute inset-[6%] rounded-full pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle, rgba(var(--pb-a),0.55), transparent 68%)',
                    filter: 'blur(28px)',
                    opacity: isPlaying ? 0.85 : 0.25,
                    transition: 'opacity 1s ease',
                  }}
                />

                {/* Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ø³Ø­Ø¨ */}
                <div
                  ref={ringSliderRef}
                  role="slider"
                  tabIndex={0}
                  aria-label="Ù…ÙˆØ¶Ø¹ Ø§Ù„ØªØ´ØºÙŠÙ„"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={0}
                  className="absolute inset-0 rounded-full cursor-pointer outline-none"
                  style={{ touchAction: 'none' }}
                  onPointerDown={handleRingDown}
                  onPointerMove={handleRingMove}
                  onPointerUp={handleRingUp}
                  onPointerCancel={handleRingUp}
                  onKeyDown={handleRingKey}
                />

                {/* Ø¹Ù„Ø§Ù…Ø§Øª Ø§Ù„Ù…Ø¯Ø§Ø± (ØªØ±Ù†Ø¯Ø± Ù…Ø±Ø© ÙˆØ§Ø­Ø¯Ø© ÙÙ‚Ø·) */}
                <OrbitRing progressRef={progressRef} accentA={accentA} />

                {/* Ø§Ù„Ù‚Ù…Ø± â€” ÙŠØªØ­Ø±Ùƒ Ø¹Ø¨Ø± rAF Ù…Ø¨Ø§Ø´Ø±Ø© Ø¨Ø¯ÙˆÙ† re-render */}
                <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" aria-hidden="true">
                  <g
                    ref={ringKnobRef}
                    style={{ transformOrigin: '100px 100px', transform: 'rotate(0deg)' }}
                  >
                    <circle
                      cx={100}
                      cy={6}
                      r={isDragging ? 7.5 : 5.5}
                      fill="#ffffff"
                      style={{ filter: 'drop-shadow(0 0 6px rgb(var(--pb-a)))', transition: 'r 200ms ease' }}
                    />
                    <circle cx={100} cy={6} r={2.2} fill="rgb(var(--pb-a))" />
                  </g>
                </svg>

                {/* Ø§Ù„Ø£Ø³Ø·ÙˆØ§Ù†Ø©: Ø¶ØºØ·Ø© = ØªØ´ØºÙŠÙ„ / Ø¥ÙŠÙ‚Ø§Ù */}
                <div
                  role="button"
                  aria-label="ØªØ´ØºÙŠÙ„/Ø§ÙŠÙ‚Ø§Ù"
                  onClick={(e) => onTogglePlay(e)}
                  className="absolute rounded-full cursor-pointer"
                  style={{
                    inset: '13%',
                    transform: isPlaying ? 'scale(1)' : 'scale(0.94)',
                    transition: 'transform 1s cubic-bezier(0.16,1,0.3,1), box-shadow 1s ease',
                    boxShadow: isPlaying
                      ? '0 30px 70px rgba(0,0,0,0.85), 0 0 60px rgba(var(--pb-a),0.25)'
                      : '0 20px 40px rgba(0,0,0,0.7)',
                  }}
                >
                  {/* Ø§Ù„Ø¬Ø²Ø¡ Ø§Ù„Ù„ÙŠ Ø¨ÙŠÙ„Ù */}
                  <div
                    className="pb-anim absolute inset-0 rounded-full will-change-transform"
                    style={{
                      animation: 'pb-spin 16s linear infinite',
                      animationPlayState: isPlaying ? 'running' : 'paused',
                      background:
                        'repeating-radial-gradient(circle at center, #0a0a0a 0px, #0a0a0a 2px, #171717 2.6px, #0a0a0a 3.6px)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div
                      key={currentSong?.id ?? 'no-song'}
                      className="pb-anim absolute rounded-full bg-cover bg-center"
                      style={{
                        inset: '29%',
                        backgroundImage: `url(${cover})`,
                        boxShadow: '0 0 0 4px rgba(var(--pb-a),0.9), 0 0 0 7px #0a0a0a',
                        animation: 'pb-swap-in 0.8s cubic-bezier(0.16,1,0.3,1) both',
                      }}
                    />
                    <div
                      className="absolute rounded-full bg-black border border-white/20"
                      style={{ left: '47.5%', top: '47.5%', width: '5%', height: '5%' }}
                    />
                  </div>

                  {/* Ù„Ù…Ø¹Ø© Ø²Ø¬Ø§Ø¬ÙŠØ© Ø«Ø§Ø¨ØªØ© */}
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                      background:
                        'conic-gradient(from 30deg, transparent 0deg, rgba(255,255,255,0.10) 35deg, transparent 70deg, transparent 180deg, rgba(255,255,255,0.07) 215deg, transparent 250deg)',
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 30px rgba(0,0,0,0.6)',
                    }}
                  />

                  {/* Ø£ÙŠÙ‚ÙˆÙ†Ø© Ø§Ù„ØªØ´ØºÙŠÙ„ ÙˆÙ‚Øª Ø§Ù„Ø¥ÙŠÙ‚Ø§Ù */}
                  <div
                    className="absolute rounded-full flex items-center justify-center bg-black/45 backdrop-blur-md border border-white/20 text-white pointer-events-none"
                    style={{
                      inset: '36%',
                      opacity: isPlaying ? 0 : 1,
                      transform: isPlaying ? 'scale(0.6)' : 'scale(1)',
                      transition: 'opacity 0.4s ease, transform 0.4s ease',
                    }}
                  >
                    <Play size={26} fill="currentColor" className="ml-0.5" />
                  </div>
                </div>
              </div>

              {/* ===== Ø§Ø³Ù… Ø§Ù„Ø£ØºÙ†ÙŠØ© ===== */}
              <div
                key={`title-${currentSong?.id ?? 'no-song'}`}
                className="pb-anim flex flex-col items-center gap-2 max-w-full text-center"
                style={{ animation: 'pb-swap-in 0.7s cubic-bezier(0.16,1,0.3,1) both' }}
              >
                <h2
                  className="font-black text-white tracking-tighter drop-shadow-2xl leading-tight px-4"
                  style={{ fontSize: 'clamp(1.4rem, 5vw, 3.2rem)' }}
                >
                  {currentSong?.name || "Ø§Ø®ØªØ± Ø£ØºÙ†ÙŠØ© Ù„Ù„Ø¨Ø¯Ø¡"}
                </h2>
                <div className="flex items-center gap-3 flex-wrap justify-center">
                  <span className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-white/60 text-xs font-bold uppercase tracking-widest">High Quality</span>
                  <span className="font-bold uppercase tracking-[0.2em] text-sm" style={{ color: 'rgb(var(--pb-a))' }}>AHMED PULSE</span>
                </div>
              </div>

              {/* Ø§Ù„ÙˆÙ‚Øª â€” ÙŠØ­Ø¯Ø« Ø¹Ø¨Ø± rAF Ø¨Ø¯ÙˆÙ† re-render */}
              <div dir="ltr" className="flex items-center gap-2 font-mono text-xs tabular-nums text-white/45">
                <span ref={timeLabelRef} className="text-white/90">0:00</span>
                <span>/</span>
                <span>{formatTime(duration)}</span>
              </div>

              {/* ===== Ø´Ø±ÙŠØ· Ø§Ù„ØªØ­ÙƒÙ… Ø§Ù„Ø²Ø¬Ø§Ø¬ÙŠ ===== */}
              <div className="relative flex items-center justify-center gap-4 md:gap-8 rounded-[2.5rem] border border-white/10 bg-white/[0.06] backdrop-blur-2xl px-5 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                <button
                  onClick={(e) => onPrev(e)}
                  className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
                  aria-label="Ø§Ù„Ø³Ø§Ø¨Ù‚"
                >
                  <SkipBack size={26} />
                </button>

                <div className="relative">
                  {isPlaying && (
                    <>
                      <span
                        className="pb-anim absolute inset-0 rounded-full pointer-events-none border-2"
                        style={{ borderColor: 'rgba(var(--pb-a),0.6)', animation: 'pb-ripple 2.2s ease-out infinite' }}
                      />
                      <span
                        className="pb-anim absolute inset-0 rounded-full pointer-events-none border-2"
                        style={{ borderColor: 'rgba(var(--pb-a),0.6)', animation: 'pb-ripple 2.2s ease-out 1.1s infinite' }}
                      />
                    </>
                  )}
                  <button
                    onClick={(e) => onTogglePlay(e)}
                    className="relative rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform duration-300"
                    style={{
                      width: 'clamp(76px, 20vw, 96px)',
                      height: 'clamp(76px, 20vw, 96px)',
                      boxShadow: '0 0 40px rgba(var(--pb-a),0.55), 0 12px 30px rgba(0,0,0,0.5)',
                    }}
                    aria-label="ØªØ´ØºÙŠÙ„/Ø§ÙŠÙ‚Ø§Ù"
                  >
                    {isPlaying ? <Pause size={38} fill="currentColor" /> : <Play size={38} fill="currentColor" className="ml-1" />}
                  </button>
                </div>

                <button
                  onClick={(e) => onNext(e)}
                  className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
                  aria-label="Ø§Ù„ØªØ§Ù„ÙŠ"
                >
                  <SkipForward size={26} />
                </button>
              </div>

              {/* Ø§Ù„ØµÙˆØª (Ù„Ù„Ø´Ø§Ø´Ø§Øª Ø§Ù„ÙƒØ¨ÙŠØ±Ø©) */}
              <div className="hidden md:flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-4 py-2 backdrop-blur-xl">
                <Volume2 size={18} className="text-white/60" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={e => setVolume(parseFloat(e.target.value))}
                  className="w-40 h-1 rounded-full cursor-pointer"
                  style={{ accentColor: 'rgb(var(--pb-a))' }}
                  aria-label="Ù…Ø³ØªÙˆÙ‰ Ø§Ù„ØµÙˆØª"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default React.memo(PlayerBar);
