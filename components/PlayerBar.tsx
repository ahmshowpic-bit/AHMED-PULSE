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
   PULSE ORBIT — المشغل الممتد
   ------------------------------------------------------------
   • الأسطوانة (الغلاف) بتلف في المركز، وحواليها "مدار" من 72 علامة.
   • العلامات بتنور بلون الأغنية أثناء التقدم، والقمر الصغير (Knob)
     بيتسحب على الحلقة للتقديم/التأخير.
   • ألوان الواجهة كلها بتتستخرج من غلاف الأغنية (وبترجع للذهبي لو
     الصورة مش بتسمح بالقراءة بسبب CORS).
   ============================================================ */

type RGB = [number, number, number];

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=600';
const FALLBACK_A: RGB = [245, 158, 11];
const FALLBACK_B: RGB = [194, 65, 12];
const TICKS = 72;

const KEYFRAMES = `
@keyframes pb-spin { to { transform: rotate(360deg); } }
@keyframes pb-float-a {
  from { transform: translate3d(-6%, -4%, 0) scale(1); }
  to   { transform: translate3d(12%, 10%, 0) scale(1.25); }
}
@keyframes pb-float-b {
  from { transform: translate3d(6%, 4%, 0) scale(1.1); }
  to   { transform: translate3d(-12%, -10%, 0) scale(0.9); }
}
@keyframes pb-breathe { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
@keyframes pb-swap-in {
  from { opacity: 0; transform: translateY(12px) scale(0.96); filter: blur(6px); }
  to   { opacity: 1; transform: none; filter: none; }
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
  const [isDragging, setIsDragging] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const lastRatioRef = useRef(0);

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

  // --- تحكم المدار (الحلقة الدائرية) ---
  const seekToRatio = useCallback((ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const r = clamp(ratio, 0, 1);
    audio.currentTime = r * audio.duration;
    setProgress(r * 100);
  }, [audioRef]);

  // يحول مكان الإصبع إلى نسبة من 0 إلى 1 (0 = أعلى الحلقة، باتجاه عقارب الساعة)
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

  const currentTime = (progress / 100) * duration;
  const litCount = Math.ceil((progress / 100) * TICKS);
  // الحركات بتشتغل بس لما المشغل الممتد مفتوح والأغنية شغالة
  const isActive = isExpanded && isPlaying;
  const stageSize = 'min(80vw, 44dvh, 440px)';

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

      {/* --- Full Screen Expanded Player : PULSE ORBIT --- */}
      <div
        className={`fixed inset-0 z-[200] flex flex-col overflow-hidden transition-[transform,opacity,visibility] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${isExpanded ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-[100%] opacity-0 pointer-events-none'}`}
        style={themeVars}
        aria-hidden={!isExpanded}
      >
        <style>{KEYFRAMES}</style>

        {/* Atmosphere: غلاف الأغنية مطموس + شفق بلوني */}
        <div className="absolute inset-0 bg-black z-0" />
        <div
          className="absolute inset-0 z-0 opacity-45"
          style={{
            backgroundImage: `url(${cover})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(40px) saturate(1.6)',
            transform: 'scale(1.15)',
          }}
        />
        <div
          className="pb-anim absolute z-0 rounded-full pointer-events-none"
          style={{
            width: '60vmax',
            height: '60vmax',
            top: '-24vmax',
            left: '-20vmax',
            background: 'radial-gradient(circle, rgba(var(--pb-a),0.32), transparent 65%)',
            animation: 'pb-float-a 18s ease-in-out infinite alternate',
            animationPlayState: isActive ? 'running' : 'paused',
          }}
        />
        <div
          className="pb-anim absolute z-0 rounded-full pointer-events-none"
          style={{
            width: '56vmax',
            height: '56vmax',
            bottom: '-26vmax',
            right: '-20vmax',
            background: 'radial-gradient(circle, rgba(var(--pb-b),0.30), transparent 65%)',
            animation: 'pb-float-b 22s ease-in-out infinite alternate',
            animationPlayState: isActive ? 'running' : 'paused',
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
            className="w-12 h-12 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white hover:bg-white/20 active:scale-90 transition-all shadow-xl"
            aria-label="إغلاق"
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

            {/* ===== المدار: الحلقة + الأسطوانة ===== */}
            <div
              ref={stageRef}
              dir="ltr"
              className="relative shrink-0 select-none"
              style={{ width: stageSize, height: stageSize }}
            >
              {/* هالة تتنفس خلف الأسطوانة */}
              <div
                className="absolute inset-[6%] rounded-full pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, rgba(var(--pb-a),0.55), transparent 68%)',
                  opacity: isPlaying ? 0.85 : 0.25,
                  transition: 'opacity 1s ease',
                }}
              />

              {/* منطقة السحب (تحت الأسطوانة) */}
              <div
                role="slider"
                tabIndex={0}
                aria-label="موضع التشغيل"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
                className="absolute inset-0 rounded-full cursor-pointer outline-none"
                style={{ touchAction: 'none' }}
                onPointerDown={handleRingDown}
                onPointerMove={handleRingMove}
                onPointerUp={handleRingUp}
                onPointerCancel={handleRingUp}
                onKeyDown={handleRingKey}
              />

              {/* علامات المدار + القمر */}
              <svg
                viewBox="0 0 200 200"
                className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                aria-hidden="true"
              >
                {Array.from({ length: TICKS }, (_, i) => {
                  const major = i % 6 === 0;
                  const lit = i < litCount;
                  // النبض محصور في آخر 8 علامات منورة (ذيل الشهاب)
                  const tail = isActive && lit && i >= litCount - 8;
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
                      className={tail ? 'pb-anim' : undefined}
                      style={{
                        stroke: lit ? 'rgb(var(--pb-a))' : 'rgba(255,255,255,0.16)',
                        animation: tail ? `pb-breathe 1.6s ease-in-out ${(litCount - 1 - i) * 0.12}s infinite` : undefined,
                      }}
                    />
                  );
                })}
                <g
                  style={{
                    transform: `rotate(${progress * 3.6}deg)`,
                    transformOrigin: '100px 100px',
                    transition: isDragging ? 'none' : 'transform 250ms linear',
                  }}
                >
                  <circle
                    cx={100}
                    cy={6}
                    r={isDragging ? 13 : 10}
                    style={{ fill: 'rgba(var(--pb-a),0.35)' }}
                  />
                  <circle cx={100} cy={6} r={isDragging ? 7.5 : 5.5} fill="#ffffff" />
                  <circle cx={100} cy={6} r={2.2} fill="rgb(var(--pb-a))" />
                </g>
              </svg>

              {/* الأسطوانة: ضغطة عليها = تشغيل / إيقاف */}
              <div
                role="button"
                aria-label="تشغيل/ايقاف"
                onClick={(e) => onTogglePlay(e)}
                className="absolute rounded-full cursor-pointer"
                style={{
                  inset: '13%',
                  transform: isPlaying ? 'scale(1)' : 'scale(0.94)',
                  transition: 'transform 1s cubic-bezier(0.16,1,0.3,1)',
                  boxShadow: '0 30px 70px rgba(0,0,0,0.85)',
                }}
              >
                {/* الجزء اللي بيلف */}
                <div
                  className="pb-anim absolute inset-0 rounded-full"
                  style={{
                    animation: 'pb-spin 16s linear infinite',
                    animationPlayState: isActive ? 'running' : 'paused',
                    willChange: 'transform',
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

                {/* لمعة زجاجية ثابتة (مش بتلف) */}
                <div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background:
                      'conic-gradient(from 30deg, transparent 0deg, rgba(255,255,255,0.10) 35deg, transparent 70deg, transparent 180deg, rgba(255,255,255,0.07) 215deg, transparent 250deg)',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 30px rgba(0,0,0,0.6)',
                  }}
                />

                {/* أيقونة التشغيل تظهر وقت الإيقاف */}
                <div
                  className="absolute rounded-full flex items-center justify-center bg-black/55 border border-white/20 text-white pointer-events-none"
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

            {/* ===== اسم الأغنية ===== */}
            <div
              key={`title-${currentSong?.id ?? 'no-song'}`}
              className="pb-anim flex flex-col items-center gap-2 max-w-full text-center"
              style={{ animation: 'pb-swap-in 0.7s cubic-bezier(0.16,1,0.3,1) both' }}
            >
              <h2
                className="font-black text-white tracking-tighter drop-shadow-2xl leading-tight px-4"
                style={{ fontSize: 'clamp(1.4rem, 5vw, 3.2rem)' }}
              >
                {currentSong?.name || "اختر أغنية للبدء"}
              </h2>
              <div className="flex items-center gap-3 flex-wrap justify-center">
                <span className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-white/60 text-xs font-bold uppercase tracking-widest">High Quality</span>
                <span className="font-bold uppercase tracking-[0.2em] text-sm" style={{ color: 'rgb(var(--pb-a))' }}>AHMED PULSE</span>
              </div>
            </div>

            {/* الوقت */}
            <div dir="ltr" className="flex items-center gap-2 font-mono text-xs tabular-nums text-white/45">
              <span className="text-white/90">{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* ===== شريط التحكم الزجاجي ===== */}
            <div className="relative flex items-center justify-center gap-4 md:gap-8 rounded-[2.5rem] border border-white/10 bg-black/35 px-5 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              <button
                onClick={(e) => onPrev(e)}
                className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
                aria-label="السابق"
              >
                <SkipBack size={26} style={{ transform: 'scaleX(-1)' }} />
              </button>

              <button
                onClick={(e) => onTogglePlay(e)}
                className="rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform duration-300"
                style={{
                  width: 'clamp(76px, 20vw, 96px)',
                  height: 'clamp(76px, 20vw, 96px)',
                  boxShadow: '0 0 40px rgba(var(--pb-a),0.55), 0 12px 30px rgba(0,0,0,0.5)',
                }}
                aria-label="تشغيل/ايقاف"
              >
                {isPlaying ? <Pause size={38} fill="currentColor" /> : <Play size={38} fill="currentColor" className="ml-1" />}
              </button>

              <button
                onClick={(e) => onNext(e)}
                className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
                aria-label="التالي"
              >
                <SkipForward size={26} style={{ transform: 'scaleX(-1)' }} />
              </button>
            </div>

            {/* الصوت (للشاشات الكبيرة) */}
            <div className="hidden md:flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-4 py-2">
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
                aria-label="مستوى الصوت"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default React.memo(PlayerBar);
