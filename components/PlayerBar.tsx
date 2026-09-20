import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume1, Volume2, ChevronDown, Maximize2, Repeat } from 'lucide-react';
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
   NOW PLAYING — المشغل الممتد (بروح واجهة تشغيل الآيفون)
   ------------------------------------------------------------
   • الغلاف هو البطل: بيكبر وقت التشغيل ويصغّر بنط "سبرينج" وقت الإيقاف.
   • اسحب الغلاف يمين/شمال = أغنية تالية/سابقة، وضغطة عليه = تشغيل/إيقاف.
   • شريط التقدم بيتخن وقت اللمس ومعاه فقاعة الوقت أثناء السحب.
   • اسحب الشريط العلوي لتحت عشان تقفل المشغل.
   • ألوان الخلفية بتتاخد من غلاف الأغنية (وبترجع للذهبي لو CORS منع).
   ============================================================ */

type RGB = [number, number, number];

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=600';
const FALLBACK_A: RGB = [245, 158, 11];
const FALLBACK_B: RGB = [194, 65, 12];

const PLAYER_CSS = `
@keyframes pb-swap-in {
  from { opacity: 0; transform: scale(0.96); filter: blur(6px); }
  to   { opacity: 1; transform: none; filter: none; }
}
@keyframes pb-eq { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
.pb-range { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 9999px; outline: none; cursor: pointer; transition: height .2s ease; }
.pb-range:hover, .pb-range:active { height: 10px; }
.pb-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 0; height: 0; }
.pb-range::-moz-range-thumb { width: 0; height: 0; border: 0; background: transparent; }
.pb-range::-moz-range-track { background: transparent; }
@media (prefers-reduced-motion: reduce) { .pb-anim { animation: none !important; } }
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

// يستخرج لونين رئيسيين من غلاف الأغنية. لو المتصفح منع قراءة الصورة (CORS)
// أو الصورة رمادية، بيرجع للألوان الذهبية الافتراضية للموقع.
const useAccentColors = (src: string) => {
  const [colors, setColors] = useState<{ a: RGB; b: RGB }>({ a: FALLBACK_A, b: FALLBACK_B });

  useEffect(() => {
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

        if (!cancelled) {
          setColors({
            a: hslToRgb(h, clamp(s * 1.15, 0.6, 0.95), clamp(l, 0.5, 0.62)),
            b: hslToRgb(h + 35, clamp(s, 0.55, 0.9), 0.4),
          });
        }
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

const PlayerBar: React.FC<PlayerBarProps> = ({ currentSong, isPlaying, audioRef, onTogglePlay, onNext, onPrev }) => {
  // === أهم تعديل في الأداء ===
  // "progress" و"volume" و"isExpanded" أصبحت حالة محلية بالكامل جوه
  // الكومبوننت ده، ومنفصلة عن باقي الموقع. الاستماع لحدث "timeupdate"
  // بيحصل هنا مباشرة على عنصر الصوت، فمع كل نبضة أثناء التشغيل (اللي كانت
  // بتحصل عدة مرات في الثانية) بيتعاد رسم المشغل بس، مش السايد بار ولا
  // قوائم الأغاني ولا أي حاجة تانية في الصفحة.
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isExpanded, setIsExpanded] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [loop, setLoop] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [swipeX, setSwipeX] = useState(0);

  const barRef = useRef<HTMLDivElement>(null);
  const scrubbingRef = useRef(false);
  const sheetStartYRef = useRef<number | null>(null);
  const swipeRef = useRef<{ x: number; moved: boolean } | null>(null);

  const cover = currentSong?.image || DEFAULT_COVER;
  const { a: accentA, b: accentB } = useAccentColors(cover);
  const themeVars = {
    '--pb-a': accentA.join(','),
    '--pb-b': accentB.join(','),
  } as React.CSSProperties;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    const handleDuration = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleDuration);
    audio.addEventListener('durationchange', handleDuration);
    handleDuration();
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleDuration);
      audio.removeEventListener('durationchange', handleDuration);
    };
  }, [audioRef]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume, audioRef]);

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!audioRef.current || !audioRef.current.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    let percentage = (rect.right - e.clientX) / rect.width;
    percentage = Math.max(0, Math.min(1, percentage));
    audioRef.current.currentTime = percentage * audioRef.current.duration;
  };

  // --- شريط التقدم الكبير (سحب ولمس) ---
  const seekToRatio = useCallback((ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const r = clamp(ratio, 0, 1);
    audio.currentTime = r * audio.duration;
    setProgress(r * 100);
  }, [audioRef]);

  // الشريط بيتملى من اليمين (زي الشريط الصغير وباقي الموقع)
  const ratioFromBar = (clientX: number): number => {
    const el = barRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return clamp((rect.right - clientX) / rect.width, 0, 1);
  };

  const handleBarDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    scrubbingRef.current = true;
    setIsScrubbing(true);
    seekToRatio(ratioFromBar(e.clientX));
  };
  const handleBarMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return;
    seekToRatio(ratioFromBar(e.clientX));
  };
  const handleBarUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    setIsScrubbing(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };
  const handleBarKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    // الاتجاه معكوس لأن الشريط بيتملى من اليمين
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
      e.preventDefault();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      audio.currentTime = Math.max(0, audio.currentTime - 5);
      e.preventDefault();
    }
  };

  // --- الغلاف: ضغطة = تشغيل/إيقاف، سحب يمين/شمال = التالي/السابق ---
  const handleArtDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    swipeRef.current = { x: e.clientX, moved: false };
  };
  const handleArtMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = swipeRef.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 8) s.moved = true;
    if (s.moved) setSwipeX(dx);
  };
  const handleArtUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = swipeRef.current;
    swipeRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    setSwipeX(0);
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 70) {
      if (dx < 0) onNext(); else onPrev();
    } else if (!s.moved) {
      onTogglePlay();
    }
  };
  const handleArtCancel = () => {
    swipeRef.current = null;
    setSwipeX(0);
  };
  const handleArtKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTogglePlay();
    }
  };

  // --- اسحب الشريط العلوي لتحت لإغلاق المشغل ---
  const handleSheetDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    sheetStartYRef.current = e.clientY;
  };
  const handleSheetMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (sheetStartYRef.current === null) return;
    setDragY(Math.max(0, e.clientY - sheetStartYRef.current));
  };
  const handleSheetUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (sheetStartYRef.current === null) return;
    const dy = Math.max(0, e.clientY - sheetStartYRef.current);
    sheetStartYRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    setDragY(0);
    if (dy > 110) setIsExpanded(false);
  };

  const toggleLoop = () => {
    const next = !loop;
    setLoop(next);
    if (audioRef.current) audioRef.current.loop = next;
  };

  const currentTime = (progress / 100) * duration;
  const remaining = Math.max(0, duration - currentTime);
  const isActive = isExpanded && isPlaying;
  const artSize = 'min(86vw, 40dvh, 440px)';
  const volPct = Math.round(volume * 100);

  return (
    <>
      {/* --- Premium Media Player Bar --- */}
      <div
        onClick={() => setIsExpanded(true)}
        className={`fixed bottom-[88px] md:bottom-6 left-2 right-2 md:left-4 md:right-6 lg:left-[296px] rounded-2xl md:rounded-[2rem] z-[100] border border-white/10 flex items-center justify-between px-3 md:px-6 shadow-2xl transition-all duration-500 cursor-pointer overflow-visible
          ${isPlaying ? 'shadow-[0_20px_40px_rgba(245,158,11,0.15)] ring-1 ring-cyan-500/30' : 'shadow-[0_20px_40px_rgba(0,0,0,0.5)] bg-black/40'}
          backdrop-blur-3xl bg-black/60
        `}
        style={{ height: 'clamp(64px, 10vw, 88px)' }}
      >
        {/* Progress Bar Layer */}
        <div
          className="absolute -top-3 left-8 right-8 h-3 cursor-pointer group z-20 py-1"
          onClick={(e) => onSeek(e)}
        >
          <div className="w-full h-1 group-hover:h-2 bg-white/10 rounded-full overflow-hidden relative transition-all duration-300">
            <div
              className="absolute top-0 right-0 h-full bg-gradient-to-l from-cyan-400 to-purple-500 shadow-[0_0_10px_#fbbf24] transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Player Left: Info */}
        <div className="flex items-center gap-2 md:gap-5 flex-1 z-10 min-w-0">
          <div className="relative group flex-shrink-0">
            <div className={`absolute inset-0 bg-cyan-400 blur-md rounded-xl md:rounded-2xl opacity-0 transition-opacity ${isPlaying ? 'opacity-30' : ''}`} />
            <div
              className={`w-10 h-10 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-xl md:rounded-2xl bg-cover bg-center border border-white/10 shadow-lg transition-transform duration-700 relative z-10 ${isPlaying ? 'scale-110 rotate-3 shadow-[0_10px_20px_rgba(0,0,0,0.5)]' : ''}`}
              style={{ backgroundImage: `url(${currentSong?.image || "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=400"})` }}
            />
          </div>
          <div className="overflow-hidden min-w-0">
            <div className="font-black text-xs md:text-base lg:text-lg truncate max-w-[90px] sm:max-w-[140px] md:max-w-[250px] drop-shadow-md text-white">{currentSong?.name || "اكتشف الموسيقى"}</div>
            <div className="text-[9px] md:text-xs uppercase font-bold text-cyan-400 tracking-widest opacity-80 mt-0.5 truncate">{currentSong?.folder || "READY TO PLAY"}</div>
          </div>
        </div>

        {/* Player Center: Controls */}
        <div className="flex items-center justify-center gap-2 md:gap-6 lg:gap-8 z-10 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={(e) => onPrev(e)} className="text-white/40 hover:text-white hover:scale-110 transition-all transform active:scale-95 p-1 md:p-2 hidden xs:block" aria-label="السابق"><SkipBack size={20} className="md:w-6 md:h-6" /></button>
          <button
            onClick={(e) => onTogglePlay(e)}
            className="w-10 h-10 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full bg-white text-black flex items-center justify-center shadow-[0_10px_20px_rgba(255,255,255,0.2)] hover:scale-110 hover:shadow-[0_15px_30px_rgba(255,255,255,0.3)] active:scale-95 transition-all duration-300"
            aria-label="تشغيل/ايقاف"
          >
            {isPlaying ? <Pause size={20} fill="currentColor" className="md:w-6 md:h-6" /> : <Play size={20} fill="currentColor" className="ml-0.5 md:ml-1 md:w-6 md:h-6" />}
          </button>
          <button onClick={(e) => onNext(e)} className="text-white/40 hover:text-white hover:scale-110 transition-all transform active:scale-95 p-1 md:p-2" aria-label="التالي"><SkipForward size={20} className="md:w-6 md:h-6" /></button>
        </div>

        {/* Player Right: Volume / Expand Icon */}
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
            />
          </div>
          <button className="text-white/40 hover:text-white hover:scale-110 transition-all p-1.5 md:p-2 bg-white/5 rounded-full backdrop-blur-md border border-white/5">
            <Maximize2 size={16} className="md:w-5 md:h-5" />
          </button>
        </div>
      </div>

      {/* --- Full Screen Expanded Player : NOW PLAYING --- */}
      <div
        className={`fixed inset-0 z-[200] flex flex-col overflow-hidden transition-[transform,opacity,visibility] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${isExpanded ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-[100%] opacity-0 pointer-events-none'}`}
        style={{
          ...themeVars,
          ...(dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : {}),
        }}
        aria-hidden={!isExpanded}
      >
        <style>{PLAYER_CSS}</style>

        {/* Atmosphere: لون الغلاف بيتدرج لأسود */}
        <div className="absolute inset-0 bg-black z-0" />
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${cover})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(40px) saturate(1.5)',
            transform: 'scale(1.3)',
            opacity: 0.55,
          }}
        />
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, rgba(var(--pb-b),0.35) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.94) 100%)',
          }}
        />

        {/* Header: اسحبه لتحت للإغلاق */}
        <div
          className="relative z-10 shrink-0 select-none"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))', touchAction: 'none' }}
          onPointerDown={handleSheetDown}
          onPointerMove={handleSheetMove}
          onPointerUp={handleSheetUp}
          onPointerCancel={handleSheetUp}
        >
          <div className="mx-auto mt-1 mb-3 h-1.5 w-11 rounded-full bg-white/30" />
          <div className="flex items-center justify-between px-5 pb-2">
            <button
              onClick={() => setIsExpanded(false)}
              className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white hover:bg-white/20 active:scale-90 transition-all"
              aria-label="إغلاق"
            >
              <ChevronDown size={22} />
            </button>
            <div className="flex flex-col items-center gap-0.5">
              <div className="text-[10px] font-black tracking-[0.3em] text-white/40 uppercase">Playing From</div>
              <div className="text-sm font-bold tracking-widest" style={{ color: 'rgb(var(--pb-a))' }}>
                {currentSong?.folder || "LIBRARY"}
              </div>
            </div>
            <div className="w-10 h-10" /> {/* Spacer */}
          </div>
        </div>

        {/* Main Content */}
        <div
          className="relative z-10 flex-1 overflow-y-auto outline-none"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <div className="min-h-full mx-auto w-full max-w-[460px] px-6 flex flex-col justify-center gap-5 py-2">

            {/* ===== الغلاف ===== */}
            <div className="relative shrink-0 mx-auto" style={{ width: artSize, height: artSize }}>
              {/* ظل ملوّن بلون الغلاف تحته */}
              <div
                className="absolute inset-0 rounded-[28px] pointer-events-none"
                style={{
                  backgroundImage: `url(${cover})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'blur(26px) saturate(1.4)',
                  opacity: isPlaying ? 0.65 : 0.3,
                  transform: `translateY(6%) scale(${isPlaying ? 0.92 : 0.78})`,
                  transition: 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.34,1.56,0.64,1)',
                }}
              />
              <div
                role="button"
                tabIndex={0}
                aria-label="تشغيل/ايقاف"
                onKeyDown={handleArtKey}
                onPointerDown={handleArtDown}
                onPointerMove={handleArtMove}
                onPointerUp={handleArtUp}
                onPointerCancel={handleArtCancel}
                className="relative w-full h-full rounded-[28px] cursor-pointer outline-none select-none"
                style={{
                  touchAction: 'pan-y',
                  transform: `translateX(${swipeX}px) rotate(${swipeX / 30}deg) scale(${isPlaying ? 1 : 0.84})`,
                  transition: swipeX !== 0 ? 'none' : 'transform 0.6s cubic-bezier(0.34,1.56,0.64,1)',
                  boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                }}
              >
                <div
                  key={currentSong?.id ?? 'no-song'}
                  className="pb-anim absolute inset-0 rounded-[28px] bg-cover bg-center border border-white/10"
                  style={{
                    backgroundImage: `url(${cover})`,
                    animation: 'pb-swap-in 0.6s cubic-bezier(0.16,1,0.3,1) both',
                  }}
                />
              </div>
            </div>

            {/* ===== الاسم + مؤشر الإيقاع ===== */}
            <div className="flex items-center justify-between gap-3">
              <div
                key={`title-${currentSong?.id ?? 'no-song'}`}
                className="pb-anim min-w-0"
                style={{ animation: 'pb-swap-in 0.6s cubic-bezier(0.16,1,0.3,1) both' }}
              >
                <h2
                  className="font-black text-white truncate leading-tight tracking-tight"
                  style={{ fontSize: 'clamp(1.4rem, 6vw, 2rem)' }}
                >
                  {currentSong?.name || "اختر أغنية للبدء"}
                </h2>
                <div className="text-base font-semibold text-white/60 truncate mt-0.5">
                  {currentSong?.folder || "AHMED PULSE"}
                </div>
              </div>
              <div className="flex items-end gap-[3px] h-5 shrink-0" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="pb-anim w-[3px] h-full rounded-full"
                    style={{
                      background: 'rgb(var(--pb-a))',
                      transformOrigin: 'bottom',
                      transform: isActive ? undefined : 'scaleY(0.3)',
                      animation: isActive ? `pb-eq ${0.7 + i * 0.16}s ease-in-out ${-i * 0.2}s infinite` : undefined,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* ===== شريط التقدم ===== */}
            <div>
              <div
                ref={barRef}
                dir="rtl"
                role="slider"
                tabIndex={0}
                aria-label="موضع التشغيل"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
                className="relative py-3 cursor-pointer outline-none"
                style={{ touchAction: 'none' }}
                onPointerDown={handleBarDown}
                onPointerMove={handleBarMove}
                onPointerUp={handleBarUp}
                onPointerCancel={handleBarUp}
                onKeyDown={handleBarKey}
              >
                <div
                  className="relative w-full rounded-full bg-white/20 overflow-hidden"
                  style={{ height: isScrubbing ? 12 : 6, transition: 'height 0.2s ease' }}
                >
                  <div
                    className="absolute top-0 right-0 h-full rounded-full bg-white"
                    style={{ width: `${progress}%`, transition: isScrubbing ? 'none' : 'width 200ms linear' }}
                  />
                </div>
                {/* المقبض + فقاعة الوقت (بتظهر وقت السحب بس) */}
                <div
                  className="absolute top-1/2 pointer-events-none"
                  style={{
                    right: `${progress}%`,
                    transform: 'translate(50%, -50%)',
                    opacity: isScrubbing ? 1 : 0,
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-lg" />
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-white text-black text-xs font-bold tabular-nums whitespace-nowrap">
                    <span dir="ltr">{formatTime(currentTime)}</span>
                  </div>
                </div>
              </div>
              <div dir="rtl" className="flex items-center justify-between text-xs font-medium tabular-nums text-white/55 -mt-1">
                <span dir="ltr">{formatTime(currentTime)}</span>
                <span dir="ltr">-{formatTime(remaining)}</span>
              </div>
            </div>

            {/* ===== أزرار التحكم ===== */}
            <div className="flex items-center justify-center gap-8 md:gap-12">
              <button
                onClick={(e) => onPrev(e)}
                className="w-16 h-16 flex items-center justify-center text-white active:scale-90 active:opacity-70 transition-all"
                aria-label="السابق"
              >
                <SkipBack size={34} fill="currentColor" style={{ transform: 'scaleX(-1)' }} />
              </button>
              <button
                onClick={(e) => onTogglePlay(e)}
                className="rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-90 transition-transform duration-300"
                style={{
                  width: 'clamp(76px, 20vw, 88px)',
                  height: 'clamp(76px, 20vw, 88px)',
                  boxShadow: '0 0 40px rgba(var(--pb-a),0.45), 0 12px 30px rgba(0,0,0,0.5)',
                }}
                aria-label="تشغيل/ايقاف"
              >
                {isPlaying ? <Pause size={38} fill="currentColor" /> : <Play size={38} fill="currentColor" className="ml-1" />}
              </button>
              <button
                onClick={(e) => onNext(e)}
                className="w-16 h-16 flex items-center justify-center text-white active:scale-90 active:opacity-70 transition-all"
                aria-label="التالي"
              >
                <SkipForward size={34} fill="currentColor" style={{ transform: 'scaleX(-1)' }} />
              </button>
            </div>

            {/* ===== الصوت ===== */}
            <div dir="rtl" className="flex items-center gap-3 text-white/60">
              <Volume1 size={18} className="shrink-0" />
              <input
                type="range"
                dir="rtl"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                className="pb-range"
                style={{
                  background: `linear-gradient(to left, #ffffff ${volPct}%, rgba(255,255,255,0.22) ${volPct}%)`,
                }}
                aria-label="مستوى الصوت"
              />
              <Volume2 size={18} className="shrink-0" />
            </div>

            {/* ===== شرائح صغيرة ===== */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={toggleLoop}
                aria-pressed={loop}
                className="flex items-center gap-1.5 px-4 h-9 rounded-full text-xs font-bold border transition-colors active:scale-95"
                style={
                  loop
                    ? { background: 'rgba(var(--pb-a),0.22)', borderColor: 'rgba(var(--pb-a),0.6)', color: 'rgb(var(--pb-a))' }
                    : { background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)' }
                }
              >
                <Repeat size={15} />
                تكرار
              </button>
              <span className="flex items-center px-4 h-9 rounded-full text-xs font-bold uppercase tracking-widest border border-white/10 bg-white/[0.08] text-white/60">
                Ahmed Pulse · High Quality
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default React.memo(PlayerBar);
