import React, { useMemo } from 'react';
import { Music as MusicIcon, ArrowLeft, Play, FolderOpen, ChevronRight } from 'lucide-react';
import { Song } from '../types';

interface MusicSectionProps {
  active: boolean;
  folders: Record<string, Song[]>;
  currentFolder: string | null;
  onSelectFolder: (folder: string | null) => void;
  currentSong: Song | null;
  onPlaySong: (song: Song, list: Song[]) => void;
  hasMoreSongs: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

// كانت الارتفاعات بتتحسب بـ Math.random() جوه الـ render مباشرة (يعني
// بتتحسب من جديد مع كل تحديث للوقت أثناء التشغيل). دلوقتي بتتحسب مرة
// واحدة فقط باستخدام useMemo، ومتتغيرش إلا لو الأغنية الحالية اتغيرت.
const EqualizerBars: React.FC<{ seed: string }> = ({ seed }) => {
  const heights = useMemo(
    () => [1, 2, 3, 4, 5].map(() => 30 + Math.random() * 70),
    [seed]
  );
  return (
    <div className="flex gap-1.5 items-end h-8 px-4">
      {heights.map((h, i) => (
        <div key={i} className="w-1.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_#fbbf24]" style={{ height: `${h}%`, animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
};

const MusicSection: React.FC<MusicSectionProps> = ({
  active, folders, currentFolder, onSelectFolder, currentSong, onPlaySong, hasMoreSongs, loadingMore, onLoadMore
}) => {
  return (
    <section className={`${active ? 'block' : 'hidden'} animate-fade-in-up`}>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-16 mt-12 gap-6">
        <h2 className="text-4xl md:text-5xl font-black flex items-center gap-4 drop-shadow-md">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <MusicIcon size={32} />
          </div>
          المكتبة الصوتية
        </h2>
      </div>

      {currentFolder ? (
        <div className="space-y-6 animate-fade-in">
          <button
            onClick={() => onSelectFolder(null)}
            className="inline-flex items-center gap-3 text-white/50 hover:text-white mb-8 transition-all bg-white/5 hover:bg-white/10 px-6 py-3 rounded-full border border-white/10 hover:border-cyan-500/30 group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-bold">رجوع للمجلدات</span>
          </button>
          <div className="flex items-center gap-4 mb-10">
            <h3 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">{currentFolder}</h3>
            <div className="h-px bg-gradient-to-r from-cyan-500/50 to-transparent flex-1" />
          </div>
          <div className="grid gap-4">
            {folders[currentFolder]?.map((song) => (
              <div
                key={song.id}
                onClick={() => onPlaySong(song, folders[currentFolder])}
                className={`flex items-center gap-6 p-4 rounded-3xl cursor-pointer transition-all duration-300 border backdrop-blur-md group ${currentSong?.id === song.id ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_10px_30px_rgba(245,158,11,0.15)] scale-[1.02]' : 'bg-black/40 border-white/5 hover:bg-white/5 hover:border-white/20'}`}
              >
                <div className="relative">
                  <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-cover bg-center shadow-lg transition-transform duration-500 ${currentSong?.id === song.id ? 'scale-105' : 'group-hover:scale-110'}`} style={{ backgroundImage: `url(${song.image})` }} />
                  <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play size={24} className="text-white ml-1 shadow-2xl" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-black text-lg md:text-xl truncate ${currentSong?.id === song.id ? 'text-cyan-400' : 'text-white'}`}>{song.name}</div>
                  <div className="text-xs text-white/40 font-bold uppercase tracking-widest mt-1">المجلد: {currentFolder}</div>
                </div>
                {currentSong?.id === song.id ? (
                  <EqualizerBars seed={song.id} />
                ) : (
                  <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-white/20 group-hover:text-cyan-400 group-hover:border-cyan-500/30 transition-all opacity-50 group-hover:opacity-100">
                    <Play size={20} className="ml-1" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8 animate-fade-in">
          {Object.keys(folders).map(folder => (
            <div
              key={folder}
              onClick={() => onSelectFolder(folder)}
              className="bg-black/40 backdrop-blur-xl border border-white/10 p-8 rounded-[3rem] flex flex-col items-center text-center cursor-pointer hover:-translate-y-2 hover:border-cyan-500/50 transition-all duration-300 group relative overflow-hidden shadow-xl hover:shadow-[0_20px_40px_rgba(245,158,11,0.15)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                <ChevronRight size={24} className="text-cyan-400" />
              </div>
              <div className="w-24 h-24 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-[2rem] flex items-center justify-center text-cyan-400 mb-8 group-hover:scale-110 group-hover:bg-cyan-500 group-hover:text-black transition-all duration-500 shadow-2xl relative z-10">
                <FolderOpen size={48} className="group-hover:animate-bounce" />
              </div>
              <div className="font-black text-2xl mb-3 relative z-10 text-white group-hover:text-cyan-100 transition-colors">{folder}</div>
              <div className="text-xs text-cyan-400/60 font-black uppercase tracking-[0.2em] bg-cyan-500/10 px-4 py-1.5 rounded-full border border-cyan-500/20 relative z-10">{folders[folder].length} ملفات</div>
            </div>
          ))}
        </div>
      )}
      {hasMoreSongs && !currentFolder && (
        <button
          onClick={onLoadMore}
          disabled={loadingMore}
          className="mt-10 w-full py-5 rounded-[2rem] bg-white/5 border border-white/10 text-white/60 font-black hover:bg-white/10 hover:text-white transition-all disabled:opacity-40"
        >
          {loadingMore ? 'جاري التحميل...' : 'تحميل المزيد من الأغاني'}
        </button>
      )}
    </section>
  );
};

export default React.memo(MusicSection);
