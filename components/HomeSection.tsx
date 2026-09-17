import React from 'react';
import { Play, Sparkles, ChevronRight, Zap, CheckCircle, Heart } from 'lucide-react';
import { Song, DiaryPost, TabId } from '../types';
import VisitorBadge from './VisitorBadge';
import VisitorIdentity from './VisitorIdentity';

interface HomeSectionProps {
  active: boolean;
  welcome: string;
  heroSong?: Song;
  featuredSongs: Song[];
  latestDiaries: DiaryPost[];
  onPlaySong: (song: Song, list: Song[]) => void;
  onGoToTab: (tab: TabId) => void;
  visitorCount: number;
  showVisitorCount: boolean;
  isAdmin: boolean;
  visitorId: string;
}

const HomeSection: React.FC<HomeSectionProps> = ({
  active, welcome, heroSong, featuredSongs, latestDiaries,
  onPlaySong, onGoToTab, visitorCount, showVisitorCount, isAdmin, visitorId
}) => {
  return (
    <section className={`${active ? 'block' : 'hidden'} animate-fade-in`}>
      {/* Hero Section */}
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center mt-12 md:mt-24 mb-32 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 blur-[150px] rounded-full pointer-events-none" />

        <h2 className="relative z-10 text-6xl md:text-8xl lg:text-[7rem] font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-cyan-100 to-cyan-500 drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)] leading-[1.1] px-4 arabic-text-container animate-fade-in-up mb-12">
          {welcome}
        </h2>

        {heroSong && (
          <div className="animate-fade-in-up flex flex-col items-center gap-8 relative z-20" style={{ animationDelay: '0.2s' }}>
            <div className="relative group cursor-pointer" onClick={() => onPlaySong(heroSong, [heroSong])}>
              <div className="absolute -inset-4 bg-gradient-to-r from-cyan-400 to-purple-600 rounded-full blur-2xl opacity-20 group-hover:opacity-40 group-hover:rotate-45 transition-all duration-1000"></div>
              <img
                src={heroSong.image}
                alt={heroSong.name}
                loading="lazy"
                className="w-48 h-48 md:w-64 md:h-64 rounded-full object-cover border-4 border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative z-10 group-hover:scale-105 transition-transform duration-700 ease-out"
              />
              <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 scale-75 group-hover:scale-100">
                <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-full p-6 shadow-2xl">
                  <Play fill="white" className="w-10 h-10 text-white ml-2 drop-shadow-md" />
                </div>
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-4xl md:text-6xl font-black text-white mb-4 drop-shadow-[0_5px_15px_rgba(0,0,0,1)] tracking-tight">
                {heroSong.name}
              </h2>
              <div className="inline-flex items-center gap-3 bg-black/40 backdrop-blur-xl px-6 py-2 rounded-full border border-white/10 shadow-2xl">
                <Sparkles size={16} className="text-yellow-400" />
                <span className="text-cyan-400 text-sm md:text-base font-black uppercase tracking-[0.2em]">
                  {heroSong.folder}
                </span>
              </div>
            </div>

            <button
              onClick={() => onPlaySong(heroSong, [heroSong])}
              className="relative overflow-hidden bg-white text-black px-12 py-5 rounded-full font-black text-lg hover:scale-105 active:scale-95 transition-all duration-300 shadow-[0_20px_40px_rgba(255,255,255,0.1)] group flex items-center gap-3 mt-4 hover:shadow-cyan-500/20"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full duration-1000 transition-transform" />
              <Play size={24} fill="currentColor" /> استمع الآن
            </button>
          </div>
        )}

        <div className="md:hidden mt-16 w-full max-w-sm px-4 space-y-4">
          <VisitorBadge count={visitorCount} visible={showVisitorCount || isAdmin} />
          <VisitorIdentity visitorId={visitorId} />
        </div>
      </div>

      {/* Featured Songs Carousel */}
      <div className="mb-20">
        <div className="flex items-center justify-between mb-8 px-4 md:px-2">
          <h3 className="text-3xl font-black flex items-center gap-3 drop-shadow-md">
            <Sparkles className="text-yellow-400 animate-pulse" /> مختارات صوتية
          </h3>
          <button onClick={() => onGoToTab('music')} className="text-cyan-400 text-sm font-bold flex items-center gap-1 hover:text-white transition-colors group">
            عرض الكل <ChevronRight size={16} className="group-hover:-translate-x-1 transition-transform" />
          </button>
        </div>
        <div className="carousel-container flex gap-6 overflow-x-auto no-scrollbar pb-8 px-4 md:px-2 snap-x snap-mandatory">
          {featuredSongs.map(song => (
            <div
              key={song.id}
              onClick={() => onPlaySong(song, featuredSongs)}
              className="carousel-item flex-shrink-0 w-64 md:w-80 bg-black/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden group cursor-pointer hover:border-cyan-500/50 hover:shadow-[0_15px_30px_rgba(245,158,11,0.15)] transition-all duration-500 snap-center"
            >
              <div className="relative aspect-square m-3 rounded-[2rem] overflow-hidden">
                <div className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-110" style={{ backgroundImage: `url(${song.image})` }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-20 h-20 rounded-full bg-cyan-500/90 backdrop-blur-sm flex items-center justify-center text-black shadow-[0_10px_20px_rgba(0,0,0,0.5)] scale-75 group-hover:scale-100 transition-transform duration-500">
                    <Play fill="currentColor" size={32} className="ml-2" />
                  </div>
                </div>
              </div>
              <div className="p-6 pt-2">
                <div className="font-black text-xl truncate mb-1 text-white group-hover:text-cyan-400 transition-colors">{song.name}</div>
                <div className="text-sm text-white/40 font-bold uppercase tracking-widest">{song.folder}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Community Highlights */}
      <div className="mb-20">
        <div className="flex items-center justify-between mb-8 px-4 md:px-2">
          <h3 className="text-3xl font-black flex items-center gap-3 drop-shadow-md">
            <Zap className="text-purple-400" /> نبض المجتمع
          </h3>
          <button onClick={() => onGoToTab('diaries')} className="text-cyan-400 text-sm font-bold flex items-center gap-1 hover:text-white transition-colors group">
            انضم إلينا <ChevronRight size={16} className="group-hover:-translate-x-1 transition-transform" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 md:px-2">
          {latestDiaries.map(post => (
            <div
              key={post.id}
              className="bg-black/40 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] hover:bg-white/5 hover:border-purple-500/30 transition-all duration-500 flex flex-col gap-6 group hover:shadow-[0_10px_30px_rgba(176,83,46,0.1)] relative overflow-hidden"
            >
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 blur-[40px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center font-black text-lg text-white shadow-lg">
                  {post.name[0]}
                </div>
                <div className="flex-1">
                  <div className="font-black text-base flex items-center gap-2 text-white group-hover:text-cyan-100 transition-colors">{post.name} {post.verified && <CheckCircle size={16} className="text-cyan-400" />}</div>
                  <div className="text-xs font-bold text-white/30 uppercase tracking-widest mt-1">{post.date}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-red-500/10 transition-colors">
                  <Heart size={18} className="text-white/20 group-hover:text-red-400 transition-colors" />
                </div>
              </div>
              <p className="text-base text-white/70 line-clamp-4 leading-relaxed relative z-10">{post.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// مغلف بـ React.memo: القسم ده مش محتاج currentSong/isPlaying أصلاً،
// فمش بيتأثر لا بتغيير الأغنية ولا بتحديثات الوقت أثناء التشغيل.
export default React.memo(HomeSection);
