import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Home, 
  Music as MusicIcon, 
  Users, 
  Mail, 
  Settings, 
  LogOut, 
  Shield, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  Heart, 
  Send, 
  ChevronRight, 
  MoreHorizontal,
  FolderOpen,
  Fingerprint,
  CheckCircle,
  Trash2,
  ArrowLeft,
  Sparkles,
  Zap,
  Download,
  ChevronDown,
  Maximize2,
  BarChart3 // أيقونة بديلة للمعادل الصوتي في القوائم
} from 'lucide-react';
import { 
  db, auth, googleProvider, ADMIN_EMAIL, 
  ref, onValue, push, update, remove, runTransaction, 
  signInWithPopup, signOut, onAuthStateChanged, User 
} from './firebase';
import { Song, DiaryPost, ContactMessage, CustomPage, AppSettings, TabId } from './types';

// --- Visualizer Component (المعادل الصوتي) ---
const MusicVisualizer: React.FC<{ isPlaying: boolean; color?: string }> = ({ isPlaying, color = "bg-cyan-400" }) => {
  return (
    <div className="flex items-end gap-[2px] h-4 mx-2">
      {[1, 2, 3, 4].map((bar) => (
        <div
          key={bar}
          className={`w-1 rounded-t-sm transition-all duration-300 ${color} ${isPlaying ? 'animate-music-bar' : 'h-[2px]'}`}
          style={{ 
            animationDelay: `${bar * 0.1}s`,
            height: isPlaying ? undefined : '20%' 
          }}
        />
      ))}
    </div>
  );
};

// --- Components defined outside ---
const VisitorBadge: React.FC<{ count: number; visible: boolean }> = ({ count, visible }) => {
  if (!visible) return null;
  return (
    <div className="visitor-box bg-white/5 backdrop-blur-md border border-white/10 p-3 rounded-xl flex items-center gap-3 transition-all duration-300 hover:bg-white/10">
      <div className="p-2 bg-cyan-500/20 rounded-lg text-cyan-400">
        <Users size={16} />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">الزيارات</span>
        <span className="font-mono text-white font-black text-lg leading-none tracking-widest">
          {count.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminTab, setAdminTab] = useState('inbox');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  
  // Data State
  const [settings, setSettings] = useState<AppSettings>({
    welcome: "AHMED PULSE | ULTIMATE",
    heroMode: true,
    heroImg: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=1920",
    heroType: 'image',
    bgFit: 'cover',
    animType: 'zoom-in',
    showVisitorCount: true,
    bgFilter: 'mode-vivid',
    visitorCount: 0,
    defaultSongId: ""
  });
  const [songs, setSongs] = useState<Song[]>([]);
  const [customPages, setCustomPages] = useState<CustomPage[]>([]);
  const [diaries, setDiaries] = useState<DiaryPost[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  
  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [volume, setVolume] = useState(0.8);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Inputs
  const [diaryName, setDiaryName] = useState('');
  const [diaryMsg, setDiaryMsg] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactMsg, setContactMsg] = useState('');

  // Admin Inputs
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongUrl, setNewSongUrl] = useState('');
  const [newSongImg, setNewSongImg] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('new');
  const [newFolderName, setNewFolderName] = useState('');

  const heroSong = useMemo(() => songs.find(s => s.id === settings.defaultSongId), [songs, settings.defaultSongId]);

  // Install Prompt
  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  // Firebase Logic (Preserved)
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAdmin(u?.email === ADMIN_EMAIL);
    });
    const unsubSettings = onValue(ref(db, 'settings'), (snap) => {
      if (snap.exists()) setSettings(prev => ({ ...prev, ...snap.val() }));
    });
    if (!sessionStorage.getItem('visited')) {
      runTransaction(ref(db, 'settings/visitorCount'), (c) => (c || 0) + 1).catch(console.error);
      sessionStorage.setItem('visited', 'true');
    }
    const unsubMusic = onValue(ref(db, 'music'), (snap) => {
      const data: Song[] = [];
      snap.forEach((child) => data.push({ id: child.key!, ...child.val() }));
      setSongs(data);
    });
    const unsubDiaries = onValue(ref(db, 'diaries'), (snap) => {
      const data: DiaryPost[] = [];
      snap.forEach((child) => data.push({ id: child.key!, ...child.val() }));
      setDiaries(data.reverse());
    });
    const unsubPages = onValue(ref(db, 'custom_pages'), (snap) => {
      const data: CustomPage[] = [];
      snap.forEach((child) => data.push({ id: child.key!, ...child.val() }));
      setCustomPages(data);
    });
    const unsubInbox = onValue(ref(db, 'inbox'), (snap) => {
      const data: ContactMessage[] = [];
      snap.forEach((child) => data.push({ id: child.key!, ...child.val() }));
      setMessages(data);
    });
    return () => { unsubAuth(); unsubSettings(); unsubMusic(); unsubDiaries(); unsubPages(); unsubInbox(); };
  }, []);

  useEffect(() => {
    if (heroSong && !currentSong && audioRef.current) {
        setCurrentSong(heroSong);
        setPlaylist([heroSong]);
        audioRef.current.src = heroSong.url;
    }
  }, [heroSong]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      if (!audioRef.current.src && songs.length > 0) playSong(songs[0], songs);
      else audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  const playSong = (song: Song, list: Song[]) => {
    if (!audioRef.current) return;
    setCurrentSong(song);
    setPlaylist(list);
    audioRef.current.src = song.url;
    audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
  };

  const nextSong = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentSong || playlist.length === 0) return;
    const currentIndex = playlist.findIndex(s => s.id === currentSong.id);
    const nextIndex = (currentIndex + 1) % playlist.length;
    playSong(playlist[nextIndex], playlist);
  };

  const prevSong = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentSong || playlist.length === 0) return;
    const currentIndex = playlist.findIndex(s => s.id === currentSong.id);
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playSong(playlist[prevIndex], playlist);
  };

  const onTimeUpdate = () => {
    if (!audioRef.current) return;
    const { currentTime, duration } = audioRef.current;
    if (duration) setProgress((currentTime / duration) * 100);
  };

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!audioRef.current || !audioRef.current.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    audioRef.current.currentTime = percentage * audioRef.current.duration;
  };

  const folders = useMemo(() => {
    const map: Record<string, Song[]> = {};
    songs.forEach(s => {
      const f = s.folder || "منوعات";
      if (!map[f]) map[f] = [];
      map[f].push(s);
    });
    return map;
  }, [songs]);

  const featuredSongs = useMemo(() => songs.slice(0, 5), [songs]);
  const latestDiaries = useMemo(() => diaries.slice(0, 6), [diaries]);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user.email !== ADMIN_EMAIL) { await signOut(auth); alert("وصول مقيد للمسؤول فقط."); }
    } catch (e) { console.error(e); alert("فشل تسجيل الدخول."); }
  };

  const postDiaryEntry = () => {
    if (!diaryMsg.trim()) return;
    const postData = {
      name: (isAdmin && confirm("نشر كمسؤول؟")) ? "AHMED PULSE" : (diaryName || "مجهول"),
      text: diaryMsg,
      verified: isAdmin,
      date: new Date().toLocaleDateString('ar-EG'),
      likes: 0
    };
    push(ref(db, 'diaries'), postData).catch(() => alert("فشل النشر."));
    setDiaryMsg('');
  };

  const likePost = (id: string) => {
    runTransaction(ref(db, `diaries/${id}/likes`), (likes) => (likes || 0) + 1).catch(console.warn);
  };

  const sendMessage = () => {
    if (!contactMsg.trim()) return;
    push(ref(db, 'inbox'), { name: contactName || "مجهول", msg: contactMsg })
      .then(() => { setContactMsg(''); setContactName(''); alert("تم الإرسال بنجاح!"); })
      .catch(() => alert("حدث خطأ."));
  };

  const addMusicAdmin = () => {
    const folder = selectedFolder === 'new' ? newFolderName : selectedFolder;
    if (!folder || !newSongTitle || !newSongUrl) return alert("يرجى إكمال البيانات");
    push(ref(db, 'music'), { name: newSongTitle, url: newSongUrl, image: newSongImg || "https://picsum.photos/400/400", folder })
      .then(() => { setNewSongTitle(''); setNewSongUrl(''); setNewSongImg(''); alert("تمت الإضافة!"); })
      .catch((e) => alert("خطأ: " + e.message));
  };

  const backgroundStyle = useMemo(() => {
    const filterClass = settings.bgFilter || 'mode-vivid';
    let filter = '';
    if (filterClass === 'mode-dark') filter = 'brightness(0.3)';
    if (filterClass === 'mode-blur') filter = 'blur(20px) brightness(0.7)';
    if (filterClass === 'mode-vivid') filter = 'brightness(0.85) contrast(1.1)';
    const url = settings.heroMode ? settings.heroImg : (heroSong?.image || currentSong?.image || settings.heroImg);
    return { backgroundImage: settings.heroType === 'image' ? `url(${url})` : 'none', backgroundSize: settings.bgFit, filter };
  }, [settings, currentSong, heroSong]);

  return (
    <div className="relative h-screen w-full flex overflow-hidden font-cairo text-white bg-black selection:bg-cyan-500/30 selection:text-cyan-200">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&display=swap');
          .font-cairo { font-family: 'Cairo', sans-serif; }
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          @keyframes music-bar {
            0% { height: 20%; }
            50% { height: 100%; }
            100% { height: 20%; }
          }
          .animate-music-bar { animation: music-bar 0.8s ease-in-out infinite; }
          @keyframes gradient-xy {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .animate-gradient-slow { background-size: 200% 200%; animation: gradient-xy 8s ease infinite; }
        `}
      </style>

      {/* --- Layers --- */}
      {/* 1. Base Dynamic Background */}
      <div 
        className={`absolute inset-0 z-0 transition-all duration-1000 bg-center bg-no-repeat ${settings.animType === 'zoom-in' ? 'anim-zoom-in' : ''}`}
        style={backgroundStyle}
      />
      
      {/* 2. Video Background Support */}
      {settings.heroType === 'video' && settings.heroMode && (
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-50" src={settings.heroImg} />
      )}

      {/* 3. Ambient Glow Layer (New) - "Breathing" Effect */}
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#050505] via-black/80 to-transparent pointer-events-none" />
      <div 
         className="absolute inset-0 z-0 opacity-40 blur-[100px] transition-colors duration-1000 pointer-events-none"
         style={{ backgroundColor: isPlaying ? 'rgba(6,182,212,0.15)' : 'transparent' }} 
      />

      {/* 4. Noise Texture Overlay (New) - For that "Premium" feel */}
      <div className="absolute inset-0 z-[5] opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay" />

      {/* --- Header (Mobile) --- */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-4 bg-black/10 backdrop-blur-xl border-b border-white/5">
         <div 
            onClick={() => setActiveTab('home')}
            className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-400 tracking-tighter cursor-pointer active:scale-95 transition-transform"
         >
            AHMED PULSE
         </div>
         <div className="flex items-center gap-3">
            {deferredPrompt && (
              <button 
                onClick={handleInstallClick}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg animate-pulse"
              >
                <Download size={16} />
              </button>
            )}
            {isAdmin && (
                <button onClick={() => setShowAdminModal(true)} className="text-cyan-400/80 hover:text-cyan-400">
                    <Shield size={20} />
                </button>
            )}
         </div>
      </header>

      {/* --- Sidebar (Desktop) --- */}
      <aside className="hidden md:flex w-72 glass border-l border-white/10 z-50 flex-col p-8 transition-all relative overflow-hidden">
        {/* Sidebar Noise */}
        <div className="absolute inset-0 bg-white/5 z-0" />
        
        <div className="relative z-10 mb-12 cursor-pointer group" onClick={() => setActiveTab('home')}>
          <h1 className="text-4xl font-black bg-gradient-to-br from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent tracking-tighter group-hover:scale-105 transition-transform origin-right">
            AHMED PULSE
          </h1>
          <div className="h-1 w-10 bg-cyan-500 rounded-full mt-2 group-hover:w-full transition-all duration-500" />
        </div>

        <div className="relative z-10 mb-8">
          <VisitorBadge count={settings.visitorCount} visible={settings.showVisitorCount || isAdmin} />
        </div>

        <nav className="relative z-10 flex-1 space-y-3">
          <SidebarBtn active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home size={22} />} label="الرئيسية" />
          <SidebarBtn active={activeTab === 'music'} onClick={() => setActiveTab('music')} icon={<MusicIcon size={22} />} label="الصوتيات" />
          <SidebarBtn active={activeTab === 'diaries'} onClick={() => setActiveTab('diaries')} icon={<Users size={22} />} label="المجتمع" />
          <SidebarBtn active={activeTab === 'contact'} onClick={() => setActiveTab('contact')} icon={<Mail size={22} />} label="تواصل معي" />
          
          <div className="pt-4 pb-2">
             <div className="h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          {customPages.map(page => (
            <SidebarBtn 
              key={page.id} 
              active={activeTab === page.id} 
              onClick={() => setActiveTab(page.id)} 
              icon={<MoreHorizontal size={22} />} 
              label={page.title} 
            />
          ))}
        </nav>

        <div className="relative z-10 mt-auto flex justify-center pt-4 opacity-50 hover:opacity-100 transition-opacity">
          <button 
            onClick={() => isAdmin ? setShowAdminModal(true) : handleLogin()}
            className="text-white hover:text-cyan-400 transition-colors duration-300"
          >
            <Shield size={20} />
          </button>
        </div>
      </aside>

      {/* --- Main Content --- */}
      <main className="flex-1 h-full relative z-10 overflow-y-auto px-4 md:px-12 pt-24 md:pt-12 pb-44 scroll-smooth no-scrollbar">
        <div className="max-w-6xl mx-auto">
          
          {/* HOME */}
          <section className={`${activeTab === 'home' ? 'block' : 'hidden'} animate-fade-in`}>
            <div className="min-h-[40vh] flex flex-col items-center justify-center text-center mb-20 relative">
              <h2 className="text-4xl md:text-7xl font-black text-white mb-10 drop-shadow-2xl leading-tight px-4 max-w-full break-words">
                {settings.welcome}
              </h2>

              {heroSong && (
                <div className="animate-fade-in flex flex-col items-center gap-6 mb-8 relative">
                   {/* Hero Glow */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/20 rounded-full blur-[80px] pointer-events-none" />
                  
                  <div className="relative group cursor-pointer" onClick={() => playSong(heroSong, [heroSong])}>
                    <img 
                      src={heroSong.image} 
                      alt={heroSong.name}
                      className="w-48 h-48 md:w-64 md:h-64 rounded-full object-cover border-[6px] border-white/5 shadow-2xl relative z-10 group-hover:scale-105 transition-transform duration-500 group-hover:rotate-3"
                    />
                    <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all rounded-full bg-black/40 backdrop-blur-sm">
                       <Play fill="white" className="w-12 h-12 text-white drop-shadow-lg" />
                    </div>
                  </div>
                  
                  <div className="relative z-10 max-w-full px-4">
                    <h2 className="text-3xl md:text-5xl font-black text-white mb-3 drop-shadow-xl tracking-tighter truncate max-w-full">
                      {heroSong.name}
                    </h2>
                    <p className="text-cyan-400 text-sm md:text-lg font-bold uppercase tracking-[0.2em] bg-cyan-950/30 px-6 py-2 rounded-full inline-block border border-cyan-500/10 backdrop-blur-md">
                      {heroSong.folder}
                    </p>
                  </div>
                  
                  <button 
                      onClick={() => playSong(heroSong, [heroSong])}
                      className="relative z-10 bg-white text-black px-10 py-4 rounded-full font-black hover:scale-105 active:scale-95 transition-all flex items-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.3)] mt-4"
                    >
                      <Play size={20} fill="black" /> <span>استمع الآن</span>
                  </button>
                </div>
              )}

              <div className="md:hidden mt-12 w-full flex justify-center">
                <VisitorBadge count={settings.visitorCount} visible={settings.showVisitorCount || isAdmin} />
              </div>
            </div>

            {/* Featured */}
            <div className="mb-20">
              <div className="flex items-center justify-between mb-8 px-2">
                <h3 className="text-2xl md:text-3xl font-black flex items-center gap-3">
                  <Sparkles className="text-yellow-400" fill="currentColor" /> مختارات
                </h3>
                <button onClick={() => setActiveTab('music')} className="text-cyan-400 text-sm font-bold flex items-center gap-2 hover:bg-cyan-500/10 px-4 py-2 rounded-full transition-all">
                  عرض الكل <ChevronRight size={16} />
                </button>
              </div>
              <div className="flex gap-6 overflow-x-auto no-scrollbar pb-8 px-2 snap-x">
                {featuredSongs.map(song => (
                  <div 
                    key={song.id} 
                    onClick={() => playSong(song, featuredSongs)}
                    className="snap-start flex-shrink-0 w-60 md:w-72 bg-white/5 border border-white/5 rounded-[2rem] overflow-hidden group cursor-pointer hover:border-cyan-500/30 hover:bg-white/10 transition-all duration-300 relative"
                  >
                    <div className="relative aspect-square overflow-hidden">
                      <img src={song.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />
                      <div className="absolute bottom-4 right-4 z-10 w-12 h-12 rounded-full bg-cyan-400 flex items-center justify-center text-black shadow-lg translate-y-16 group-hover:translate-y-0 transition-transform duration-300">
                         <Play fill="currentColor" size={20} className="ml-1" />
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="font-bold text-lg truncate mb-1 text-white">{song.name}</div>
                      <div className="text-xs text-white/50 font-medium">{song.folder}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Community Feed Preview */}
            <div className="mb-20">
               <div className="flex items-center justify-between mb-8 px-2">
                <h3 className="text-2xl md:text-3xl font-black flex items-center gap-3">
                  <Zap className="text-purple-400" fill="currentColor" /> نبض المجتمع
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 px-2">
                {latestDiaries.map(post => (
                  <div key={post.id} className="bg-white/5 border border-white/5 p-6 rounded-3xl hover:bg-white/10 transition-all flex flex-col gap-4">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-600 to-purple-600 flex items-center justify-center font-bold text-sm shadow-inner">
                           {post.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                           <div className="font-bold text-sm truncate flex items-center gap-2">{post.name} {post.verified && <CheckCircle size={14} className="text-cyan-400" />}</div>
                           <div className="text-[10px] text-white/30">{post.date}</div>
                        </div>
                     </div>
                     <p className="text-sm text-white/70 line-clamp-2 leading-relaxed">{post.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* MUSIC */}
          <section className={`${activeTab === 'music' ? 'block' : 'hidden'} animate-fade-in`}>
             <h2 className="text-4xl md:text-5xl font-black mb-12 mt-8 flex items-center gap-4 px-2">
                <span className="text-transparent bg-clip-text bg-gradient-to-l from-cyan-400 to-white">المكتبة الصوتية</span>
             </h2>

             {currentFolder ? (
              <div className="space-y-6">
                <button 
                  onClick={() => setCurrentFolder(null)}
                  className="flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-all bg-white/5 hover:bg-white/10 px-6 py-3 rounded-full border border-white/10 w-fit"
                >
                  <ArrowLeft size={20} /> <span className="font-bold">عودة للمجلدات</span>
                </button>
                <div className="text-2xl font-black text-cyan-400 mb-6 px-2">{currentFolder}</div>
                <div className="grid gap-3">
                  {folders[currentFolder]?.map((song) => (
                    <div 
                      key={song.id}
                      onClick={() => playSong(song, folders[currentFolder])}
                      className={`group flex items-center gap-4 p-3 md:p-4 rounded-2xl cursor-pointer transition-all border ${currentSong?.id === song.id ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                    >
                      <div className={`relative w-16 h-16 rounded-xl overflow-hidden shadow-lg flex-shrink-0 ${currentSong?.id === song.id ? 'ring-2 ring-cyan-400' : ''}`}>
                         <img src={song.image} className={`w-full h-full object-cover transition-transform ${currentSong?.id === song.id ? 'scale-110' : 'group-hover:scale-110'}`} />
                         {currentSong?.id === song.id && (
                           <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <MusicVisualizer isPlaying={isPlaying} color="bg-white" />
                           </div>
                         )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-bold text-lg truncate ${currentSong?.id === song.id ? 'text-cyan-400' : 'text-white'}`}>{song.name}</div>
                        <div className="text-xs text-white/40">{currentFolder}</div>
                      </div>
                      <button className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${currentSong?.id === song.id ? 'text-cyan-400' : 'text-white/20 group-hover:bg-white/10 group-hover:text-white'}`}>
                         {currentSong?.id === song.id && isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {Object.keys(folders).map(folder => (
                  <div 
                    key={folder}
                    onClick={() => setCurrentFolder(folder)}
                    className="relative group bg-white/5 hover:bg-white/10 border border-white/5 hover:border-cyan-500/30 p-8 rounded-[2.5rem] flex flex-col items-center text-center cursor-pointer transition-all duration-300"
                  >
                     <div className="w-20 h-20 mb-6 bg-gradient-to-br from-gray-800 to-black rounded-2xl flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-300">
                        <FolderOpen size={36} className="text-cyan-400" />
                     </div>
                     <h3 className="font-bold text-xl mb-2 text-white group-hover:text-cyan-300 transition-colors">{folder}</h3>
                     <span className="text-xs font-bold bg-white/5 px-3 py-1 rounded-full text-white/40">{folders[folder].length} ملفات</span>
                  </div>
                ))}
               </div>
            )}
          </section>

          {/* COMMUNITY */}
          <section className={`${activeTab === 'diaries' ? 'block' : 'hidden'} animate-fade-in`}>
             <div className="max-w-4xl mx-auto">
               <h2 className="text-4xl md:text-5xl font-black mb-12 mt-8 flex items-center gap-4 justify-center md:justify-start">
                  <span className="text-transparent bg-clip-text bg-gradient-to-l from-purple-400 to-white">المجتمع</span>
               </h2>
               
               <div className="bg-gradient-to-b from-white/10 to-black/40 border border-white/10 p-6 md:p-10 rounded-[2.5rem] mb-16 shadow-2xl relative overflow-hidden backdrop-blur-xl">
                  {/* Decorative */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 blur-[80px] rounded-full pointer-events-none" />
                  
                  <div className="relative z-10 flex flex-col gap-6">
                     <div className="flex flex-col md:flex-row gap-4">
                        <input 
                           value={diaryName}
                           onChange={e => setDiaryName(e.target.value)}
                           placeholder="اسمك المستعار"
                           className="bg-black/40 border border-white/10 p-4 rounded-2xl text-white placeholder:text-white/30 font-bold focus:ring-2 focus:ring-purple-500/50 outline-none transition-all flex-1"
                           maxLength={25}
                        />
                        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/5 text-xs text-white/50">
                           <Sparkles size={16} className="text-yellow-400" />
                           مساحة آمنة للتعبير
                        </div>
                     </div>
                     <textarea 
                        value={diaryMsg}
                        onChange={e => setDiaryMsg(e.target.value)}
                        placeholder="شاركنا أفكارك هنا..."
                        rows={4}
                        className="w-full bg-black/40 border border-white/10 p-5 rounded-[2rem] text-white placeholder:text-white/30 resize-none text-lg leading-relaxed focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
                     />
                     <div className="flex justify-end">
                        <button 
                           onClick={postDiaryEntry}
                           className="px-10 py-4 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-full font-black text-white shadow-xl hover:shadow-purple-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
                        >
                           <span>نشر المشاركة</span> <Send size={18} />
                        </button>
                     </div>
                  </div>
               </div>

               <div className="space-y-6">
                  {diaries.length === 0 && <div className="text-center text-white/30 py-20 font-bold">كن أول من يكتب هنا...</div>}
                  {diaries.map(post => (
                     <div key={post.id} className={`group relative bg-white/5 border border-white/5 rounded-[2rem] p-6 md:p-8 hover:bg-white/10 transition-all ${post.verified ? 'ring-1 ring-cyan-500/30 bg-cyan-950/10' : ''}`}>
                        <div className="flex items-start gap-4 mb-4">
                           <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-700 to-black flex items-center justify-center font-bold text-white shadow-lg text-xl flex-shrink-0">
                              {post.name[0]}
                           </div>
                           <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                 <h4 className="font-bold text-lg text-white truncate">{post.name}</h4>
                                 {post.verified && <CheckCircle size={16} className="text-cyan-400" />}
                              </div>
                              <span className="text-xs text-white/30">{post.date}</span>
                           </div>
                           {isAdmin && (
                              <button onClick={() => remove(ref(db, `diaries/${post.id}`))} className="text-red-500/50 hover:text-red-500 transition-colors">
                                 <Trash2 size={18} />
                              </button>
                           )}
                        </div>
                        <p className="text-gray-300 leading-relaxed text-lg whitespace-pre-wrap break-words">{post.text}</p>
                        <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                           <button 
                              onClick={() => likePost(post.id)}
                              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${post.likes > 0 ? 'text-red-400 bg-red-500/10' : 'text-white/40 hover:bg-white/5'}`}
                           >
                              <Heart size={18} fill={post.likes > 0 ? "currentColor" : "none"} />
                              <span className="font-bold text-sm">{post.likes || 0}</span>
                           </button>
                        </div>
                     </div>
                  ))}
               </div>
             </div>
          </section>

          {/* CONTACT */}
          <section className={`${activeTab === 'contact' ? 'block' : 'hidden'} animate-fade-in`}>
             <div className="max-w-2xl mx-auto glass border border-white/10 p-8 md:p-14 rounded-[3rem] text-center shadow-2xl mt-8 relative overflow-hidden">
                <div className="relative z-10">
                   <div className="w-20 h-20 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-xl rotate-3 hover:rotate-0 transition-all duration-500">
                      <Mail size={36} />
                   </div>
                   <h2 className="text-3xl md:text-4xl font-black mb-4 text-white">تواصل مباشر</h2>
                   <p className="text-white/50 mb-10 text-lg font-medium">آراؤكم هي وقود التطوير. لا تتردد في مراسلتي.</p>
                   
                   <div className="space-y-5">
                      <input 
                         value={contactName}
                         onChange={e => setContactName(e.target.value)}
                         placeholder="الاسم"
                         className="w-full bg-black/40 border border-white/10 p-5 rounded-3xl text-white text-center text-lg focus:ring-2 ring-cyan-500/30 outline-none transition-all"
                      />
                      <textarea 
                         value={contactMsg}
                         onChange={e => setContactMsg(e.target.value)}
                         placeholder="الرسالة..."
                         rows={5}
                         className="w-full bg-black/40 border border-white/10 p-5 rounded-[2.5rem] text-white resize-none text-center text-lg focus:ring-2 ring-cyan-500/30 outline-none transition-all"
                      />
                      <button 
                         onClick={sendMessage}
                         className="w-full py-5 bg-white text-black rounded-full font-black text-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all mt-4"
                      >
                         إرسال
                      </button>
                   </div>
                   
                   {/* Secret Trigger */}
                   <div className="mt-12 opacity-0 hover:opacity-20 transition-opacity duration-1000">
                      <button onClick={() => isAdmin ? setShowAdminModal(true) : handleLogin()}>
                         <Fingerprint size={40} className="mx-auto text-white cursor-pointer" />
                      </button>
                   </div>
                </div>
             </div>
          </section>

          {/* CUSTOM PAGES */}
          {customPages.map(page => (
            <section key={page.id} className={`${activeTab === page.id ? 'block' : 'hidden'} animate-fade-in`}>
              <h2 className="text-4xl font-black mb-12 mt-8 border-r-8 border-cyan-400 pr-6 pl-4 leading-tight">{page.title}</h2>
              <div 
                className="glass border border-white/10 p-8 md:p-12 rounded-[3rem] leading-relaxed prose prose-invert prose-lg max-w-none shadow-2xl break-words"
                dangerouslySetInnerHTML={{ __html: page.content }}
              />
            </section>
          ))}
        </div>
      </main>

      {/* --- Mini Music Player (Floating) --- */}
      <div 
        onClick={() => setIsPlayerExpanded(true)}
        className={`fixed bottom-24 md:bottom-8 left-4 right-4 md:right-8 md:left-[300px] h-20 md:h-24 rounded-[2rem] z-[100] border border-white/10 flex items-center justify-between px-4 md:px-8 shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all duration-500 cursor-pointer overflow-hidden backdrop-blur-2xl
          ${isPlaying ? 'ring-2 ring-cyan-500/20' : ''}
          bg-gradient-to-r from-[#0a0a0a]/90 via-[#1a1a1a]/90 to-[#0a0a0a]/90 animate-gradient-slow
        `}
      >
        {/* Progress Line */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-white/5" onClick={(e) => onSeek(e)}>
           <div className="h-full bg-gradient-to-r from-cyan-400 to-purple-500" style={{ width: `${progress}%` }} />
        </div>

        {/* Info */}
        <div className="flex items-center gap-4 flex-1 min-w-0 z-10">
          <div 
            className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-cover bg-center border border-white/10 shadow-lg transition-all duration-700 ${isPlaying ? 'rotate-[360deg]' : ''}`}
            style={{ backgroundImage: `url(${currentSong?.image || "https://picsum.photos/200/200"})`, animationDuration: '10s', animationIterationCount: 'infinite', animationTimingFunction: 'linear' }}
          />
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="font-black text-sm md:text-lg text-white truncate">{currentSong?.name || "اختر أغنية"}</div>
            <div className="flex items-center gap-2">
               <MusicVisualizer isPlaying={isPlaying} color="bg-cyan-400" />
               <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider truncate hidden md:block">{currentSong?.folder || "READY"}</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 md:gap-6 z-10" onClick={(e) => e.stopPropagation()}>
           <button onClick={(e) => prevSong(e)} className="p-2 text-white/50 hover:text-white transition-colors active:scale-90"><SkipBack size={20} className="md:w-6 md:h-6" /></button>
           <button 
              onClick={(e) => togglePlay(e)}
              className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all"
           >
              {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-1" />}
           </button>
           <button onClick={(e) => nextSong(e)} className="p-2 text-white/50 hover:text-white transition-colors active:scale-90"><SkipForward size={20} className="md:w-6 md:h-6" /></button>
        </div>
      </div>

      {/* --- Full Screen Expanded Player --- */}
      <div className={`fixed inset-0 z-[200] bg-black/60 backdrop-blur-[50px] flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isPlayerExpanded ? 'translate-y-0' : 'translate-y-full'}`}>
         {/* Noise Overlay inside Player */}
         <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
         
         <div className="relative z-10 p-6 flex justify-between items-center mt-4">
           <button onClick={() => setIsPlayerExpanded(false)} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"><ChevronDown size={32} /></button>
           <div className="text-xs font-black tracking-[0.3em] text-white/50 uppercase">Now Playing</div>
           <div className="w-12" />
         </div>

         <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 pb-12 w-full max-w-3xl mx-auto">
            <div className={`relative w-[70vw] h-[70vw] max-w-[350px] max-h-[350px] mb-12 rounded-[3rem] shadow-[0_20px_60px_rgba(0,0,0,0.6)] transition-all duration-700 ${isPlaying ? 'scale-100' : 'scale-90 opacity-80'}`}>
               <img src={currentSong?.image || "https://picsum.photos/400/400"} className="w-full h-full object-cover rounded-[3rem] border border-white/10" />
               {isPlaying && (
                  <div className="absolute -inset-4 rounded-[3.5rem] border-2 border-white/5 animate-pulse pointer-events-none" />
               )}
            </div>

            <div className="text-center w-full mb-10">
               <h2 className="text-3xl md:text-5xl font-black text-white mb-3 tracking-tight truncate px-4">{currentSong?.name || "اختر أغنية"}</h2>
               <p className="text-lg text-cyan-400 font-bold opacity-80">{currentSong?.folder || "AHMED PULSE Music"}</p>
            </div>

            <div className="w-full mb-12 group cursor-pointer" onClick={onSeek}>
               <div className="h-3 bg-white/10 rounded-full overflow-hidden relative">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-purple-600 shadow-[0_0_15px_currentColor]" style={{ width: `${progress}%` }} />
               </div>
            </div>

            <div className="flex items-center justify-between w-full max-w-xs">
               <button onClick={prevSong} className="text-white/40 hover:text-white transition-all transform active:scale-90"><SkipBack size={42} /></button>
               <button onClick={togglePlay} className="w-24 h-24 rounded-[2.5rem] bg-white text-black flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all">
                  {isPlaying ? <Pause size={36} fill="black" /> : <Play size={36} fill="black" className="ml-2" />}
               </button>
               <button onClick={nextSong} className="text-white/40 hover:text-white transition-all transform active:scale-90"><SkipForward size={42} /></button>
            </div>
         </div>
      </div>

      {/* --- Mobile Bottom Nav --- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-black/80 backdrop-blur-2xl border-t border-white/5 z-[150] flex items-center justify-around px-2 pb-2">
        <MobNavBtn active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home size={24} />} label="الرئيسية" />
        <MobNavBtn active={activeTab === 'music'} onClick={() => setActiveTab('music')} icon={<MusicIcon size={24} />} label="موسيقى" />
        <div className="w-12" /> {/* Space for Player */}
        <MobNavBtn active={activeTab === 'diaries'} onClick={() => setActiveTab('diaries')} icon={<Users size={24} />} label="المجتمع" />
        <MobNavBtn active={activeTab === 'contact'} onClick={() => setActiveTab('contact')} icon={<Mail size={24} />} label="اتصل" />
      </nav>

      {/* --- Admin Modal (Preserved Logic, Updated UI) --- */}
      {showAdminModal && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-cairo">
          <div className="w-full max-w-6xl h-[85vh] bg-[#09090b] border border-white/10 rounded-[3rem] flex flex-col overflow-hidden shadow-2xl relative">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />
            
            <div className="relative z-10 p-6 md:p-8 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div className="flex items-center gap-4 text-white font-black text-2xl">
                <div className="w-12 h-12 bg-cyan-500 rounded-2xl flex items-center justify-center text-black shadow-lg shadow-cyan-500/20"><Shield size={24} /></div>
                لوحة التحكم
              </div>
              <button onClick={() => setShowAdminModal(false)} className="w-10 h-10 rounded-full bg-white/5 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all">&times;</button>
            </div>
            
            <div className="flex flex-1 overflow-hidden relative z-10">
              <div className="w-20 md:w-64 bg-black/20 border-l border-white/5 flex flex-col p-3 gap-2">
                <AdminNavBtn active={adminTab === 'inbox'} onClick={() => setAdminTab('inbox')} icon={<Mail />} label="الرسائل" />
                <AdminNavBtn active={adminTab === 'music'} onClick={() => setAdminTab('music')} icon={<MusicIcon />} label="الموسيقى" />
                <AdminNavBtn active={adminTab === 'pages'} onClick={() => setAdminTab('pages')} icon={<Settings />} label="الصفحات" />
                <AdminNavBtn active={adminTab === 'settings'} onClick={() => setAdminTab('settings')} icon={<Zap />} label="الإعدادات" />
                <button onClick={() => { signOut(auth); setShowAdminModal(false); }} className="mt-auto flex items-center gap-4 p-4 text-red-400 hover:bg-red-500/10 rounded-2xl transition-all font-bold">
                  <LogOut size={20} /> <span className="hidden md:inline">خروج</span>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 md:p-10 no-scrollbar bg-black/20">
                {/* INBOX */}
                {adminTab === 'inbox' && (
                  <div className="space-y-4">
                    <h3 className="text-3xl font-black mb-8">البريد الوارد ({messages.length})</h3>
                    {messages.map(m => (
                      <div key={m.id} className="bg-white/5 border border-white/5 p-6 rounded-3xl flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-cyan-900/50 flex items-center justify-center text-cyan-400 font-bold text-xl">{m.name[0]}</div>
                        <div className="flex-1">
                          <div className="font-bold text-lg mb-1">{m.name}</div>
                          <p className="text-white/60 bg-black/20 p-3 rounded-xl">{m.msg}</p>
                        </div>
                        <button onClick={() => remove(ref(db, `inbox/${m.id}`))} className="text-red-500/50 hover:text-red-500"><Trash2 size={20} /></button>
                      </div>
                    ))}
                  </div>
                )}

                {/* MUSIC ADMIN */}
                {adminTab === 'music' && (
                  <div className="space-y-8">
                    <h3 className="text-3xl font-black">إضافة محتوى</h3>
                    <div className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem] grid gap-5">
                       <select value={selectedFolder} onChange={e => setSelectedFolder(e.target.value)} className="bg-black/40 border border-white/10 p-4 rounded-2xl text-white font-bold outline-none">
                          <option value="new">+ مجلد جديد</option>
                          {Object.keys(folders).map(f => <option key={f} value={f}>{f}</option>)}
                       </select>
                       {selectedFolder === 'new' && <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="اسم المجلد الجديد" className="bg-black/40 border border-white/10 p-4 rounded-2xl text-white outline-none" />}
                       <div className="grid md:grid-cols-2 gap-4">
                          <input value={newSongTitle} onChange={e => setNewSongTitle(e.target.value)} placeholder="اسم الأغنية" className="bg-black/40 border border-white/10 p-4 rounded-2xl text-white outline-none" />
                          <input value={newSongUrl} onChange={e => setNewSongUrl(e.target.value)} placeholder="رابط MP3" className="bg-black/40 border border-white/10 p-4 rounded-2xl text-white outline-none font-mono text-sm" />
                       </div>
                       <input value={newSongImg} onChange={e => setNewSongImg(e.target.value)} placeholder="رابط الصورة" className="bg-black/40 border border-white/10 p-4 rounded-2xl text-white outline-none font-mono text-sm" />
                       <button onClick={addMusicAdmin} className="bg-cyan-600 hover:bg-cyan-500 text-white p-4 rounded-2xl font-black shadow-lg transition-all">إضافة للمكتبة</button>
                    </div>
                    <div className="grid gap-2">
                       {songs.map(s => (
                          <div key={s.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                             <div className="flex items-center gap-4">
                                <img src={s.image} className="w-10 h-10 rounded-lg object-cover" />
                                <div><div className="font-bold">{s.name}</div><div className="text-xs text-white/40">{s.folder}</div></div>
                             </div>
                             <div className="flex gap-2">
                                <button onClick={() => update(ref(db, 'settings'), { defaultSongId: s.id })} className={`p-2 rounded-full ${settings.defaultSongId === s.id ? 'text-yellow-400 bg-yellow-400/10' : 'text-white/20'}`}><Sparkles size={18} /></button>
                                <button onClick={() => confirm('حذف؟') && remove(ref(db, `music/${s.id}`))} className="p-2 text-red-500/50 hover:text-red-500"><Trash2 size={18} /></button>
                             </div>
                          </div>
                       ))}
                    </div>
                  </div>
                )}
                
                {/* SETTINGS ADMIN */}
                {adminTab === 'settings' && (
                   <div className="space-y-8">
                      <h3 className="text-3xl font-black">إعدادات النظام</h3>
                      <div className="space-y-4">
                         <label className="block text-sm font-bold text-cyan-400">العنوان الرئيسي</label>
                         <input value={settings.welcome} onChange={e => setSettings({...settings, welcome: e.target.value})} className="w-full bg-black/40 border border-white/10 p-4 rounded-2xl text-xl font-bold text-white text-center" />
                      </div>
                      <div className="flex items-center justify-between bg-white/5 p-6 rounded-2xl border border-white/5">
                         <span>عداد الزيارات</span>
                         <input type="checkbox" checked={settings.showVisitorCount} onChange={e => setSettings({...settings, showVisitorCount: e.target.checked})} className="accent-cyan-500 w-6 h-6" />
                      </div>
                      <div className="bg-purple-900/10 border border-purple-500/20 p-8 rounded-[2rem]">
                         <h4 className="text-xl font-black text-purple-400 mb-6">HERO ENGINE</h4>
                         <div className="grid gap-4">
                            <input value={settings.heroImg} onChange={e => setSettings({...settings, heroImg: e.target.value})} placeholder="رابط الخلفية" className="bg-black/40 border border-white/10 p-4 rounded-2xl w-full" />
                            <div className="flex gap-4">
                               <label className="flex items-center gap-2"><input type="checkbox" checked={settings.heroMode} onChange={e => setSettings({...settings, heroMode: e.target.checked})} /> تفعيل الوضع</label>
                               <select value={settings.heroType} onChange={e => setSettings({...settings, heroType: e.target.value as any})} className="bg-black/40 rounded-lg p-2"><option value="image">صورة</option><option value="video">فيديو</option></select>
                            </div>
                         </div>
                      </div>
                      <button onClick={() => update(ref(db, 'settings'), settings).then(() => alert("تم الحفظ"))} className="w-full bg-white text-black font-black p-5 rounded-2xl text-xl hover:scale-[1.01] transition-all">حفظ التغييرات</button>
                   </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audio Element */}
      <audio ref={audioRef} onTimeUpdate={onTimeUpdate} onEnded={nextSong} />
    </div>
  );
};

// --- Helper Components ---
const SidebarBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all duration-300 group ${active ? 'bg-white text-black font-bold shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
  >
    <span className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
    <span className="tracking-wide text-sm md:text-base">{label}</span>
  </button>
);

const MobNavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 w-16 ${active ? '-translate-y-4' : 'text-white/40'}`}>
    <div className={`p-3 rounded-full transition-all duration-300 ${active ? 'bg-cyan-500 text-white shadow-[0_10px_20px_rgba(6,182,212,0.4)] ring-4 ring-black' : ''}`}>
      {icon}
    </div>
    <span className={`text-[10px] font-bold ${active ? 'text-cyan-400 opacity-100' : 'opacity-0'}`}>{label}</span>
  </button>
);

const AdminNavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex items-center gap-3 p-4 rounded-2xl transition-all ${active ? 'bg-cyan-500 text-black font-bold' : 'text-white/40 hover:bg-white/5'}`}>
    {icon} <span className="hidden md:inline">{label}</span>
  </button>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

export default App;
