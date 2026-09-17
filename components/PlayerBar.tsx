import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
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

      {/* --- Full Screen Expanded Player --- */}
      <div
        className={`fixed inset-0 z-[200] flex flex-col transition-transformers duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-[100%] opacity-0 pointer-events-none'}`}
      >
        <div className="absolute inset-0 bg-black/80 backdrop-blur-[50px] z-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80 z-0" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] md:w-[40vw] md:h-[40vw] bg-cyan-500/20 blur-[100px] rounded-full z-0 opacity-50" />

        {/* Header */}
        <div className="p-8 flex justify-between items-center relative z-10">
          <button
            onClick={() => setIsExpanded(false)}
            className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-lg flex items-center justify-center text-white hover:bg-white/20 border border-white/10 hover:scale-110 active:scale-95 transition-all shadow-xl"
            aria-label="إغلاق"
          >
            <ChevronDown size={32} />
          </button>
          <div className="flex flex-col items-center gap-1">
            <div className="text-[10px] md:text-xs font-black tracking-[0.3em] text-white/40 uppercase">Playing From</div>
            <div className="text-sm md:text-base font-bold text-cyan-400 tracking-widest">{currentSong?.folder || "LIBRARY"}</div>
          </div>
          <button className="w-14 h-14" /> {/* Spacer */}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-6 outline-none relative z-10 pb-16 md:pb-20 overflow-y-auto">
          <div className="relative group mb-6 md:mb-10">
            <div className={`absolute -inset-4 md:-inset-8 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-[2rem] md:rounded-[3rem] blur-3xl transition-opacity duration-1000 ${isPlaying ? 'opacity-30 group-hover:opacity-50' : 'opacity-0'}`} />
            <div
              className={`rounded-[2rem] md:rounded-[3rem] bg-cover bg-center shadow-[0_30px_60px_rgba(0,0,0,0.8)] border border-white/10 transition-transform duration-1000 relative z-10 ${isPlaying ? 'scale-100' : 'scale-95 grayscale-[20%]'}`}
              style={{
                backgroundImage: `url(${currentSong?.image || "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=600"})`,
                width: 'clamp(240px, 60vw, 420px)',
                height: 'clamp(240px, 60vw, 420px)',
              }}
            />
          </div>

          <h2 className="font-black text-white mb-3 tracking-tighter drop-shadow-2xl text-center px-4 leading-tight"
            style={{ fontSize: 'clamp(1.5rem, 5vw, 4rem)' }}
          >{currentSong?.name || "اختر أغنية للبدء"}</h2>

          <div className="flex items-center gap-3 md:gap-4 mb-8 md:mb-12 flex-wrap justify-center">
            <span className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-white/60 text-xs font-bold uppercase tracking-widest">High Quality</span>
            <span className="text-cyan-400 font-bold uppercase tracking-[0.2em] text-sm">AHMED PULSE</span>
          </div>

          {/* Progress */}
          <div className="w-full max-w-xl md:max-w-3xl mb-8 md:mb-14 px-4" onClick={onSeek}>
            <div className="h-2 md:h-3 bg-white/10 rounded-full overflow-hidden relative cursor-pointer group shadow-inner">
              <div
                className="absolute top-0 right-0 h-full bg-gradient-to-l from-cyan-400 via-blue-500 to-purple-600 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-6 md:gap-10 lg:gap-16">
            <button onClick={(e) => onPrev(e)} className="text-white/30 hover:text-white hover:scale-110 active:scale-95 transition-all p-3 md:p-4"><SkipBack size={32} className="md:w-10 md:h-10" /></button>
            <button
              onClick={(e) => onTogglePlay(e)}
              className="rounded-full bg-white text-black flex items-center justify-center shadow-[0_20px_50px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all duration-300"
              style={{ width: 'clamp(80px, 15vw, 112px)', height: 'clamp(80px, 15vw, 112px)' }}
            >
              {isPlaying ? <Pause size={40} fill="currentColor" className="md:w-12 md:h-12" /> : <Play size={40} fill="currentColor" className="ml-1 md:ml-2 md:w-12 md:h-12" />}
            </button>
            <button onClick={(e) => onNext(e)} className="text-white/30 hover:text-white hover:scale-110 active:scale-95 transition-all p-3 md:p-4"><SkipForward size={32} className="md:w-10 md:h-10" /></button>
          </div>
        </div>
      </div>
    </>
  );
};

export default React.memo(PlayerBar);
