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
  ChevronDown, 
  MoreHorizontal,
  Disc,
  FolderOpen,
  Fingerprint,
  CheckCircle,
  Trash2,
  Plus,
  ArrowLeft,
  Sparkles,
  Zap,
  Menu,
  X,
  Download,
  Grid,
  ListOrdered
} from 'lucide-react';
import { 
  db, auth, googleProvider, ADMIN_EMAIL, 
  ref, onValue, push, set, update, remove, runTransaction, 
  signInWithPopup, signOut, onAuthStateChanged, User 
} from './firebase';
import { Song, DiaryPost, ContactMessage, CustomPage, AppSettings, TabId } from './types';

// Components defined outside
const VisitorBadge: React.FC<{ count: number; visible: boolean }> = ({ count, visible }) => {
  if (!visible) return null;
  return (
    <div className="visitor-box bg-cyan-500/10 border-r-4 border-cyan-500 p-3 rounded-lg flex items-center gap-4 transition-all duration-300">
      <div className="text-cyan-400">
        <Users size={20} />
      </div>
      <div>
        <div className="text-[10px] text-gray-400 uppercase tracking-wider">إجمالي الزيارات</div>
        <span className="visitor-num font-mono text-white font-bold text-lg text-glow-cyan">
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
  const [isExtrasOpen, setIsExtrasOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
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
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
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

  // Admin Music Form
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
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Firebase Listeners
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAdmin(u?.email === ADMIN_EMAIL);
    });

    const unsubSettings = onValue(ref(db, 'settings'), (snap) => {
      if (snap.exists()) setSettings(prev => ({ ...prev, ...snap.val() }));
    });

    if (!sessionStorage.getItem('visited')) {
      runTransaction(ref(db, 'settings/visitorCount'), (c) => (c || 0) + 1);
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
      data.sort((a: any, b: any) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999));
      setCustomPages(data);
    });

    const unsubInbox = onValue(ref(db, 'inbox'), (snap) => {
      const data: ContactMessage[] = [];
      snap.forEach((child) => data.push({ id: child.key!, ...child.val() }));
      setMessages(data);
    });

    return () => {
      unsubAuth(); unsubSettings(); unsubMusic(); unsubDiaries(); unsubPages(); unsubInbox();
    };
  }, []);

  // Pre-load
  useEffect(() => {
    if (heroSong && !currentSong && audioRef.current) {
        setCurrentSong(heroSong);
        setPlaylist([heroSong]);
        audioRef.current.src = heroSong.url;
    }
  }, [heroSong]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Player Functions
  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
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
    e?.stopPropagation();
    if (!currentSong || playlist.length === 0) return;
    const idx = playlist.findIndex(s => s.id === currentSong.id);
    playSong(playlist[(idx + 1) % playlist.length], playlist);
  };

  const prevSong = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!currentSong || playlist.length === 0) return;
    const idx = playlist.findIndex(s => s.id === currentSong.id);
    playSong(playlist[(idx - 1 + playlist.length) % playlist.length], playlist);
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
    audioRef.current.currentTime = (x / rect.width) * audioRef.current.duration;
  };

  // Groups & Data
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

  // Actions
  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user.email !== ADMIN_EMAIL) {
        await signOut(auth);
        alert("وصول مقيد للمسؤول فقط.");
      }
    } catch (e) { console.error(e); }
  };

  const postDiaryEntry = () => {
    if (!diaryMsg.trim()) return;
    push(ref(db, 'diaries'), {
      name: (isAdmin && confirm("نشر كمسؤول؟")) ? "AHMED PULSE" : (diaryName || "مجهول"),
      text: diaryMsg,
      verified: isAdmin,
      date: new Date().toLocaleDateString('ar-EG'),
      likes: 0
    });
    setDiaryMsg('');
  };

  const likePost = (id: string) => runTransaction(ref(db, `diaries/${id}/likes`), (l) => (l || 0) + 1);

  const sendMessage = () => {
    if (!contactMsg.trim()) return;
    push(ref(db, 'inbox'), { name: contactName || "مجهول", msg: contactMsg }).then(() => {
      setContactMsg(''); setContactName(''); alert("تم الإرسال!");
    });
  };

  const addMusicAdmin = () => {
    const folder = selectedFolder === 'new' ? newFolderName : selectedFolder;
    if (!folder || !newSongTitle || !newSongUrl) return alert("البيانات ناقصة");
    push(ref(db, 'music'), {
      name: newSongTitle, url: newSongUrl, image: newSongImg || "https://picsum.photos/400/400", folder
    }).then(() => {
      setNewSongTitle(''); setNewSongUrl(''); setNewSongImg(''); alert("تم!");
    });
  };

  // --- دالة التنقل الذكية الموحدة ---
  // هذه الدالة هي الحل: تغلق المشغل والقوائم عند الانتقال لأي تبويب
  const navigateTo = (tab: TabId) => {
    setActiveTab(tab);
    setIsPlayerExpanded(false); // إغلاق المشغل الكبير فوراً
    setIsExtrasOpen(false);     // إغلاق القائمة السفلية
  };

  const backgroundStyle = useMemo(() => {
    const filterClass = settings.bgFilter || 'mode-vivid';
    let filter = '';
    if (filterClass === 'mode-dark') filter = 'brightness(0.3)';
    if (filterClass === 'mode-blur') filter = 'blur(20px) brightness(0.7)';
    if (filterClass === 'mode-vivid') filter = 'brightness(0.85) contrast(1.1)';
    const url = settings.heroMode ? settings.heroImg : (heroSong?.image || currentSong?.image || settings.heroImg);
    return {
      backgroundImage: settings.heroType === 'image' ? `url(${url})` : 'none',
      backgroundSize: settings.bgFit,
      filter
    };
  }, [settings, currentSong, heroSong]);

  return (
    <div className="relative h-screen w-full flex overflow-hidden">
      {/* Background */}
      <div 
        className={`absolute inset-0 z-0 transition-all duration-1000 bg-center bg-no-repeat ${settings.animType === 'zoom-in' ? 'anim-zoom-in' : ''}`}
        style={backgroundStyle}
      />
      {settings.heroType === 'video' && settings.heroMode && (
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-50" src={settings.heroImg} />
      )}
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black via-transparent to-black/30 pointer-events-none" />

      {/* Header Mobile */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-black/30 backdrop-blur-md border-b border-white/5">
         <div onClick={() => navigateTo('home')} className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-400 tracking-tighter cursor-pointer">
            AHMED PULSE
         </div>
         <div className="flex items-center gap-3">
            {deferredPrompt && (
              <button onClick={handleInstallClick} className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-lg animate-pulse">
                <Download size={16} />
              </button>
            )}
            {isAdmin && (
                <button onClick={() => setShowAdminModal(true)} className="text-cyan-400/80 hover:text-cyan-400"><Shield size={20} /></button>
            )}
            <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
               <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
            </div>
         </div>
      </header>

      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-64 glass border-l border-white/10 z-50 flex-col p-8 transition-all">
        <div className="mb-10 cursor-pointer" onClick={() => navigateTo('home')}>
          <h1 className="text-3xl font-black bg-gradient-to-br from-white to-cyan-400 bg-clip-text text-transparent tracking-tighter">AHMED PULSE</h1>
        </div>
        <div className="mb-8"><VisitorBadge count={settings.visitorCount} visible={settings.showVisitorCount || isAdmin} /></div>
        <nav className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
          <SidebarBtn active={activeTab === 'home'} onClick={() => navigateTo('home')} icon={<Home />} label="الرئيسية" />
          <SidebarBtn active={activeTab === 'music'} onClick={() => navigateTo('music')} icon={<MusicIcon />} label="الصوتيات" />
          <SidebarBtn active={activeTab === 'diaries'} onClick={() => navigateTo('diaries')} icon={<Users />} label="المجتمع" />
          <SidebarBtn active={activeTab === 'contact'} onClick={() => navigateTo('contact')} icon={<Mail />} label="تواصل معي" />
          {customPages.length > 0 && <div className="h-px bg-white/10 my-4" />}
          {customPages.map(page => (
            <SidebarBtn key={page.id} active={activeTab === page.id} onClick={() => navigateTo(page.id)} icon={<Zap size={18} className="text-purple-400" />} label={page.title} />
          ))}
        </nav>
        <div className="mt-auto flex justify-center pt-4">
          <button onClick={() => isAdmin ? setShowAdminModal(true) : handleLogin()} className="text-white/20 hover:text-cyan-400 transition-colors"><Shield size={24} /></button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 h-full relative z-10 overflow-y-auto px-4 md:px-12 pt-20 md:pt-8 pb-40 scroll-smooth no-scrollbar">
        <div className="max-w-6xl mx-auto">
          {/* Home */}
          <section className={`${activeTab === 'home' ? 'block' : 'hidden'} animate-fade-in`}>
            <div className="min-h-[40vh] flex flex-col items-center justify-center text-center mt-8 md:mt-12 mb-20">
              <h2 className="text-4xl md:text-8xl font-black text-white mb-8 drop-shadow-2xl leading-tight px-4 break-words max-w-full">
                {settings.welcome}
              </h2>
              {heroSong && (
                <div className="animate-fade-in flex flex-col items-center gap-6 mb-8">
                  <div className="relative group cursor-pointer" onClick={() => playSong(heroSong, [heroSong])}>
                    <div className="absolute inset-0 bg-cyan-500 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                    <img src={heroSong.image} className="w-40 h-40 md:w-56 md:h-56 rounded-full object-cover border-4 border-white/10 shadow-2xl relative z-10 group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                       <div className="bg-black/50 backdrop-blur-sm rounded-full p-4"><Play fill="white" className="w-8 h-8 text-white" /></div>
                    </div>
                  </div>
                  <div className="max-w-full px-4">
                    <h2 className="text-2xl md:text-5xl font-black text-white mb-2 drop-shadow-2xl tracking-tighter truncate">{heroSong.name}</h2>
                    <p className="text-cyan-400 text-sm md:text-xl font-bold uppercase tracking-widest bg-cyan-500/10 px-4 py-1 rounded-full inline-block mt-2 border border-cyan-500/20">{heroSong.folder} | Featured Track</p>
                  </div>
                  <div className="flex gap-4 mt-4">
                    <button onClick={() => playSong(heroSong, [heroSong])} className="bg-white text-black px-8 py-3 rounded-full font-black hover:scale-105 transition-all flex items-center gap-2"><Play size={20} fill="black" /> استمع الآن</button>
                    {isAdmin && <button onClick={() => update(ref(db, 'settings'), { defaultSongId: null })} className="bg-white/10 text-white px-8 py-3 rounded-full font-bold hover:bg-white/20 transition-all border border-white/10">إلغاء التثبيت</button>}
                  </div>
                </div>
              )}
            </div>

            {/* Featured */}
            <div className="mb-16">
              <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-2xl font-black flex items-center gap-3"><Sparkles className="text-yellow-400" /> مختارات صوتية</h3>
                <button onClick={() => navigateTo('music')} className="text-cyan-400 text-sm font-bold flex items-center gap-1 hover:underline">عرض الكل <ChevronRight size={16} /></button>
              </div>
              <div className="carousel-container flex gap-6 overflow-x-auto no-scrollbar pb-6 px-2">
                {featuredSongs.map(song => (
                  <div key={song.id} onClick={() => playSong(song, featuredSongs)} className="carousel-item flex-shrink-0 w-64 md:w-80 glass border border-white/10 rounded-[2rem] overflow-hidden group cursor-pointer hover:border-cyan-500/50 transition-all duration-500">
                    <div className="relative aspect-square">
                      <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: `url(${song.image})` }} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="w-16 h-16 rounded-full bg-cyan-500 flex items-center justify-center text-black shadow-2xl scale-75 group-hover:scale-100 transition-transform"><Play fill="currentColor" size={28} className="ml-1" /></div>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="font-bold text-lg truncate mb-1">{song.name}</div>
                      <div className="text-xs text-white/40">{song.folder}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Community Preview */}
            <div className="mb-16">
              <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-2xl font-black flex items-center gap-3"><Zap className="text-purple-400" /> نبض المجتمع</h3>
                <button onClick={() => navigateTo('diaries')} className="text-cyan-400 text-sm font-bold flex items-center gap-1 hover:underline">انضم إلينا <ChevronRight size={16} /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-2">
                {latestDiaries.map(post => (
                  <div key={post.id} className="glass border border-white/10 p-6 rounded-3xl hover:bg-white/5 transition-all flex flex-col gap-4 group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg">{post.name[0]}</div>
                      <div className="flex-1">
                        <div className="font-bold text-sm flex items-center gap-2">{post.name} {post.verified && <CheckCircle size={14} className="text-cyan-400" />}</div>
                        <div className="text-[10px] text-white/30">{post.date}</div>
                      </div>
                      <Heart size={16} className="text-white/10 group-hover:text-red-400 transition-colors" />
                    </div>
                    <p className="text-sm text-white/70 line-clamp-3 leading-relaxed">{post.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Music Tab */}
          <section className={`${activeTab === 'music' ? 'block' : 'hidden'}`}>
            <h2 className="text-4xl font-black mb-12 mt-8 flex items-center gap-4"><MusicIcon className="text-cyan-400" size={36} /> المكتبة الصوتية</h2>
            {currentFolder ? (
              <div className="space-y-4">
                <button onClick={() => setCurrentFolder(null)} className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-all bg-white/5 px-4 py-2 rounded-full border border-white/10"><ArrowLeft size={18} /> رجوع للمجلدات</button>
                <h3 className="text-3xl font-black text-cyan-400 mb-8 border-r-4 border-cyan-400 pr-4">{currentFolder}</h3>
                <div className="grid gap-3">
                  {folders[currentFolder]?.map((song) => (
                    <div key={song.id} onClick={() => playSong(song, folders[currentFolder])} className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border ${currentSong?.id === song.id ? 'bg-cyan-500/20 border-cyan-500/30' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                      <div className={`w-14 h-14 rounded-2xl bg-cover bg-center shadow-lg transition-transform ${currentSong?.id === song.id ? 'scale-110 rotate-3' : ''}`} style={{ backgroundImage: `url(${song.image})` }} />
                      <div className="flex-1">
                        <div className="font-bold text-lg">{song.name}</div>
                        <div className="text-xs text-white/40">المجلد: {currentFolder}</div>
                      </div>
                      {currentSong?.id === song.id ? <div className="flex gap-1 items-end h-6">{[1,2,3,4].map(b => <div key={b} className="w-1 bg-cyan-400 rounded-full animate-pulse" style={{ height: `${Math.random()*100}%`, animationDelay: `${b*0.1}s` }} />)}</div> : <Play size={20} className="text-white/20" />}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                {Object.keys(folders).map(folder => (
                  <div key={folder} onClick={() => setCurrentFolder(folder)} className="glass border border-white/10 p-8 rounded-[3rem] flex flex-col items-center text-center cursor-pointer hover:scale-105 hover:border-cyan-500/50 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-opacity"><ChevronRight size={24} className="text-cyan-400" /></div>
                    <div className="w-20 h-20 bg-cyan-500/10 rounded-[2rem] flex items-center justify-center text-cyan-400 mb-6 group-hover:bg-cyan-500 group-hover:text-black transition-all shadow-xl"><FolderOpen size={40} /></div>
                    <div className="font-black text-xl mb-2">{folder}</div>
                    <div className="text-xs text-white/40 font-bold uppercase tracking-widest">{folders[folder].length} ملفات</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Diaries Tab */}
          <section className={`${activeTab === 'diaries' ? 'block' : 'hidden'}`}>
            <h2 className="text-4xl font-black mb-12 mt-8 flex items-center gap-4"><Users className="text-cyan-400" size={36} /> المجتمع الرقمي</h2>
            <div className="glass border border-white/10 p-8 rounded-[3rem] mb-12 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-500/10 blur-[60px] rounded-full" />
              <div className="relative z-10">
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <input value={diaryName} onChange={e => setDiaryName(e.target.value)} placeholder="اسمك المستعار" className="bg-black/40 border border-white/10 p-5 rounded-2xl text-white placeholder:text-white/20 font-bold" maxLength={20} />
                  <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/5"><Sparkles size={20} className="text-yellow-400" /><span className="text-xs text-white/40">شاركنا لحظاتك.</span></div>
                </div>
                <textarea value={diaryMsg} onChange={e => setDiaryMsg(e.target.value)} placeholder="ما الذي يدور في ذهنك؟" rows={4} className="w-full bg-black/40 border border-white/10 p-6 rounded-[2rem] mb-6 text-white placeholder:text-white/20 resize-none text-lg leading-relaxed" />
                <button onClick={postDiaryEntry} className="w-full md:w-auto px-12 py-5 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full font-black text-lg shadow-2xl shadow-cyan-500/20 hover:scale-[1.05] active:scale-95 transition-all flex items-center justify-center gap-3 float-left">نشر الآن <Send size={20} /></button>
                <div className="clear-both" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-8">
              {diaries.map(post => (
                <div key={post.id} className={`rounded-[2.5rem] border border-white/10 overflow-hidden shadow-xl transition-all ${post.verified ? 'bg-gradient-to-br from-cyan-900/20 to-black/40 border-cyan-500/30' : 'bg-white/5'}`}>
                  <div className="flex items-center gap-4 p-6 bg-black/30 backdrop-blur-md">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-black text-xl text-white shadow-xl">{post.name[0]}</div>
                    <div className="flex-1">
                      <div className="font-black text-lg flex items-center gap-2">{post.name} {post.verified && <CheckCircle size={14} className="text-cyan-400" />}</div>
                      <div className="text-xs text-white/30 font-medium">{post.date}</div>
                    </div>
                    {isAdmin && <button onClick={() => remove(ref(db, `diaries/${post.id}`))} className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white"><Trash2 size={18} /></button>}
                  </div>
                  <div className="p-8 text-white/80 text-lg leading-relaxed whitespace-pre-wrap">{post.text}</div>
                  <div className="p-4 bg-black/10 border-t border-white/5 px-8 flex justify-between items-center">
                    <button onClick={() => likePost(post.id)} className={`flex items-center gap-2 transition-all font-black py-2 px-4 rounded-full ${post.likes > 0 ? 'bg-red-500/10 text-red-500' : 'text-white/20 hover:text-white'}`}><Heart size={20} fill={post.likes > 0 ? "currentColor" : "none"} /> {post.likes || 0}</button>
                    <div className="text-[10px] uppercase tracking-widest text-white/10 font-black">Ahmed Pulse community</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Contact Tab */}
          <section className={`${activeTab === 'contact' ? 'block' : 'hidden'}`}>
            <div className="max-w-2xl mx-auto glass border border-white/10 p-12 rounded-[4rem] text-center shadow-2xl mt-8">
              <div className="w-24 h-24 bg-cyan-500/10 rounded-[2rem] flex items-center justify-center text-cyan-400 mx-auto mb-8 shadow-inner"><Mail size={48} /></div>
              <h2 className="text-4xl font-black mb-4 text-white">تواصل مباشر</h2>
              <div className="space-y-6 text-right">
                <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="اسمك الكريم" className="w-full bg-black/60 border border-white/10 p-5 rounded-3xl text-white text-center text-lg" />
                <textarea value={contactMsg} onChange={e => setContactMsg(e.target.value)} placeholder="بماذا تود أن تخبرني؟" rows={6} className="w-full bg-black/60 border border-white/10 p-6 rounded-[2.5rem] text-white resize-none text-center text-lg" />
                <button onClick={sendMessage} className="w-full py-6 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 rounded-full font-black text-xl shadow-2xl shadow-cyan-500/30">إرسال الرسالة الآن</button>
              </div>
              <div className="mt-16 opacity-5 hover:opacity-100 transition-opacity">
                <button onClick={() => isAdmin ? setShowAdminModal(true) : handleLogin()}>
                  <Fingerprint size={32} className="mx-auto text-white cursor-pointer" />
                </button>
              </div>
            </div>
          </section>

          {/* Custom Pages */}
          {customPages.map(page => (
            <section key={page.id} className={`${activeTab === page.id ? 'block' : 'hidden'}`}>
              <h2 className="text-4xl font-black mb-12 mt-8 border-r-8 border-cyan-400 pr-6">{page.title}</h2>
              <div className="glass border border-white/10 p-10 md:p-16 rounded-[4rem] leading-relaxed prose prose-invert max-w-none text-xl shadow-2xl" dangerouslySetInnerHTML={{ __html: page.content }} />
            </section>
          ))}
        </div>
      </main>

      {/* --- Smart Player --- */}
      <div 
        onClick={() => setIsPlayerExpanded(true)}
        className={`fixed transition-all duration-700 ease-in-out border border-white/10 shadow-2xl z-[100]
          ${isPlayerExpanded 
            ? 'inset-0 bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-8' 
            : 'bottom-24 md:bottom-8 left-4 right-4 md:right-8 md:left-[272px] h-24 glass rounded-full flex items-center justify-between px-6 md:px-10 cursor-pointer hover:bg-white/5'
          }
          ${isPlaying && !isPlayerExpanded ? 'playing ring-2 ring-cyan-500/20' : ''}
        `}
      >
        {isPlayerExpanded && (
          <button 
            onClick={(e) => { e.stopPropagation(); setIsPlayerExpanded(false); }}
            className="absolute top-8 right-8 text-white/40 hover:text-white p-4 rounded-full bg-white/5 hover:bg-white/10 transition-all z-50"
          >
            <ChevronDown size={32} />
          </button>
        )}

        <div className={`flex w-full ${isPlayerExpanded ? 'flex-col items-center gap-12 max-w-md' : 'flex-row items-center gap-4'}`}>
          {!isPlayerExpanded && (
            <div className="absolute top-0 left-10 right-10 h-1 cursor-pointer group" onClick={onSeek}>
              <div className="w-full h-full bg-white/10 rounded-full overflow-hidden relative">
                <div className="absolute top-0 right-0 h-full bg-gradient-to-l from-cyan-400 via-blue-500 to-purple-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className="relative">
             {isPlayerExpanded && isPlaying && (
               <>
                 <div className="absolute inset-0 rounded-2xl border-2 border-cyan-500/30 animate-ping opacity-20" style={{ animationDuration: '2s' }}></div>
                 <div className="absolute -inset-10 bg-cyan-500/20 blur-3xl rounded-full opacity-30 animate-pulse"></div>
               </>
             )}
             <div 
                className={`bg-cover bg-center border border-white/10 shadow-2xl transition-all duration-700
                  ${isPlayerExpanded 
                    ? 'w-64 h-64 md:w-80 md:h-80 rounded-[2rem] shadow-[0_0_50px_rgba(6,182,212,0.3)]' 
                    : `w-14 h-14 rounded-2xl ${isPlaying ? 'rotate-3 scale-110' : ''}`
                  }
                  ${isPlaying && isPlayerExpanded ? 'scale-105' : ''}
                `}
                style={{ backgroundImage: `url(${currentSong?.image || "https://picsum.photos/200/200"})` }}
             />
          </div>

          <div className={`overflow-hidden text-center ${!isPlayerExpanded ? 'text-right flex-1' : 'w-full px-4'}`}>
            <div className={`font-black text-white ${isPlayerExpanded ? 'text-2xl md:text-3xl mb-4 leading-snug whitespace-normal break-words' : 'text-sm md:text-lg max-w-[150px] truncate'}`}>
              {currentSong?.name || "اختر أغنية"}
            </div>
            <div className={`font-bold text-cyan-400 uppercase tracking-widest ${isPlayerExpanded ? 'text-lg' : 'text-[10px] opacity-60'}`}>{currentSong?.folder || "READY"}</div>
          </div>

          <div className={`flex items-center ${isPlayerExpanded ? 'gap-12' : 'gap-4 md:gap-8'}`}>
            <button onClick={prevSong} className={`text-white/40 hover:text-white transition-all transform active:scale-90 ${isPlayerExpanded ? 'scale-150' : ''}`}><SkipBack size={28} /></button>
            <button onClick={togglePlay} className={`rounded-full bg-white text-black flex items-center justify-center shadow-2xl shadow-white/10 hover:scale-110 active:scale-90 transition-all ${isPlayerExpanded ? 'w-24 h-24' : 'w-14 h-14'}`}>
              {isPlaying ? <Pause size={isPlayerExpanded ? 40 : 28} fill="currentColor" /> : <Play size={isPlayerExpanded ? 40 : 28} fill="currentColor" className="ml-1" />}
            </button>
            <button onClick={nextSong} className={`text-white/40 hover:text-white transition-all transform active:scale-90 ${isPlayerExpanded ? 'scale-150' : ''}`}><SkipForward size={28} /></button>
          </div>

          {isPlayerExpanded && (
            <div className="w-full space-y-2 group cursor-pointer" onClick={onSeek}>
               <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                 <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500" style={{ width: `${progress}%` }}></div>
               </div>
               <div className="flex justify-between text-xs text-white/30 font-mono">
                  <span>{audioRef.current ? (audioRef.current.currentTime / 60).toFixed(2) : "0:00"}</span>
                  <span>{audioRef.current ? (audioRef.current.duration / 60).toFixed(2) : "0:00"}</span>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Nav Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 glass border-t border-white/10 z-[150] flex items-center justify-around px-4 bg-black/80 backdrop-blur-3xl">
        <MobNavBtn active={activeTab === 'home'} onClick={() => navigateTo('home')} icon={<Home />} label="الرئيسية" />
        <MobNavBtn active={activeTab === 'music'} onClick={() => navigateTo('music')} icon={<MusicIcon />} label="موسيقى" />
        <div className="relative">
           <button 
             onClick={() => setIsExtrasOpen(!isExtrasOpen)}
             className={`p-4 -mt-8 rounded-full border-4 border-[#0c0c12] bg-gradient-to-tr from-cyan-600 to-purple-600 text-white shadow-2xl shadow-cyan-500/40 transition-transform ${isExtrasOpen ? 'rotate-45' : ''}`}
           >
             <Grid size={24} fill="white" />
           </button>
        </div>
        <MobNavBtn active={activeTab === 'diaries'} onClick={() => navigateTo('diaries')} icon={<Users />} label="المجتمع" />
        <MobNavBtn active={activeTab === 'contact'} onClick={() => navigateTo('contact')} icon={<Mail />} label="اتصل" />
      </nav>

      {/* Extras Menu */}
      <div className={`md:hidden fixed inset-x-0 bottom-24 z-[140] transition-all duration-500 ease-in-out transform ${isExtrasOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
        <div className="bg-[#12121a]/95 backdrop-blur-xl border border-white/10 rounded-[2rem] mx-4 p-6 shadow-2xl shadow-cyan-500/10">
          <div className="text-center text-white/40 text-xs font-bold uppercase tracking-widest mb-6">تطبيقات إضافية</div>
          <div className="grid grid-cols-3 gap-4">
             {customPages.map(page => (
               <button key={page.id} onClick={() => navigateTo(page.id)} className="flex flex-col items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors">
                 <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-cyan-400 shadow-lg"><Zap size={24} /></div>
                 <span className="text-xs font-bold text-white/80 truncate w-full text-center">{page.title}</span>
               </button>
             ))}
             {customPages.length === 0 && <div className="col-span-3 text-center text-white/20 py-4">لا توجد صفحات</div>}
          </div>
        </div>
      </div>

      {/* Admin Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4">
          <div className="w-full max-w-5xl h-[90vh] bg-[#0c0c12] border border-white/10 rounded-[3rem] flex flex-col overflow-hidden shadow-2xl ring-1 ring-white/10">
            <div className="p-8 border-b border-white/10 flex justify-between items-center bg-black/40">
              <div className="flex items-center gap-4 text-cyan-400 font-black text-2xl"><Shield size={28} /> نظام الإدارة</div>
              <button onClick={() => setShowAdminModal(false)} className="text-white/40 hover:text-white text-3xl">&times;</button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              <div className="w-24 md:w-60 bg-black/60 border-l border-white/5 flex flex-col p-4 gap-3">
                <AdminNavBtn active={adminTab === 'inbox'} onClick={() => setAdminTab('inbox')} icon={<Mail />} label="الوارد" />
                <AdminNavBtn active={adminTab === 'music'} onClick={() => setAdminTab('music')} icon={<MusicIcon />} label="الأغاني" />
                <AdminNavBtn active={adminTab === 'pages'} onClick={() => setAdminTab('pages')} icon={<Settings />} label="الصفحات" />
                <AdminNavBtn active={adminTab === 'settings'} onClick={() => setAdminTab('settings')} icon={<Settings />} label="الإعدادات" />
                <button onClick={() => { signOut(auth); setShowAdminModal(false); }} className="mt-auto flex items-center gap-4 p-4 text-red-400 hover:bg-red-400/10 rounded-2xl transition-all font-black"><LogOut size={24} /> خروج</button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 no-scrollbar">
                {/* Inbox */}
                {adminTab === 'inbox' && (
                  <div className="space-y-6">
                    {messages.map(m => (
                      <div key={m.id} className="bg-white/5 border border-white/10 p-6 rounded-[2rem] flex items-start gap-6">
                        <div className="w-12 h-12 rounded-xl bg-cyan-600/20 flex items-center justify-center text-cyan-400 font-black">{m.name[0]}</div>
                        <div className="flex-1">
                          <div className="font-black text-white mb-1">{m.name}</div>
                          <div className="text-white/60 bg-black/30 p-3 rounded-xl">{m.msg}</div>
                        </div>
                        <button onClick={() => remove(ref(db, `inbox/${m.id}`))} className="text-red-500/50 hover:text-red-500"><Trash2 size={20} /></button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Music */}
                {adminTab === 'music' && (
                  <div>
                    <div className="bg-white/5 p-8 rounded-[3rem] mb-12 space-y-4 shadow-xl">
                      <select value={selectedFolder} onChange={e => setSelectedFolder(e.target.value)} className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl font-bold mb-2">
                        <option value="new">++ مجلد جديد ++</option>
                        {Object.keys(folders).map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                      {selectedFolder === 'new' && <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="اسم المجلد" className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl" />}
                      <input value={newSongTitle} onChange={e => setNewSongTitle(e.target.value)} placeholder="اسم الأغنية" className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl" />
                      <input value={newSongUrl} onChange={e => setNewSongUrl(e.target.value)} placeholder="رابط MP3" className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl font-mono" />
                      <input value={newSongImg} onChange={e => setNewSongImg(e.target.value)} placeholder="رابط الصورة" className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl font-mono" />
                      <button onClick={addMusicAdmin} className="w-full py-4 bg-cyan-600 rounded-[2rem] font-black shadow-lg">إضافة</button>
                    </div>
                    {songs.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl mb-2">
                            <span className="truncate w-1/2">{s.name}</span>
                            <div className="flex gap-2">
                                <button onClick={() => update(ref(db, 'settings'), { defaultSongId: s.id })} className={`p-2 rounded-full ${settings.defaultSongId === s.id ? 'bg-yellow-500 text-black' : 'bg-white/10'}`}><Heart size={16} /></button>
                                <button onClick={() => remove(ref(db, `music/${s.id}`))} className="p-2 bg-red-500/10 text-red-500 rounded-full"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                  </div>
                )}
                {/* Settings */}
                {adminTab === 'settings' && (
                  <div className="space-y-6">
                      <div className="space-y-2"><label className="text-cyan-400 font-bold">رسالة الترحيب</label><input value={settings.welcome} onChange={e => setSettings({...settings, welcome: e.target.value})} className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl" /></div>
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl"><span>عداد الزيارات</span><input type="checkbox" checked={settings.showVisitorCount} onChange={e => setSettings({...settings, showVisitorCount: e.target.checked})} className="accent-cyan-500 w-6 h-6" /></div>
                      <div className="bg-purple-900/20 p-6 rounded-[2rem] space-y-4">
                        <div className="flex justify-between"><span>وضع Hero</span><input type="checkbox" checked={settings.heroMode} onChange={e => setSettings({...settings, heroMode: e.target.checked})} className="accent-purple-500 w-6 h-6" /></div>
                        <input value={settings.heroImg} onChange={e => setSettings({...settings, heroImg: e.target.value})} placeholder="رابط الخلفية" className="w-full bg-black/60 border border-white/10 p-3 rounded-xl" />
                      </div>
                      <button onClick={() => update(ref(db, 'settings'), settings)} className="w-full py-4 bg-gradient-to-r from-cyan-600 to-purple-600 rounded-2xl font-black">حفظ</button>
                  </div>
                )}
                {/* Pages */}
                {adminTab === 'pages' && (
                  <div className="space-y-6">
                    <div className="bg-white/5 p-8 rounded-[3rem] space-y-4 border border-white/10">
                      <div className="flex gap-4"><input id="pg-id" placeholder="ID" className="flex-1 bg-black/60 border border-white/10 p-4 rounded-2xl font-bold" /><input id="pg-order" type="number" placeholder="#" className="w-24 bg-black/60 border border-white/10 p-4 rounded-2xl font-bold text-center" /></div>
                      <input id="pg-title" placeholder="العنوان" className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl font-bold" />
                      <textarea id="pg-content" rows={8} placeholder="HTML..." className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl font-mono" />
                      <button onClick={() => {
                          const id = (document.getElementById('pg-id') as HTMLInputElement).value;
                          const title = (document.getElementById('pg-title') as HTMLInputElement).value;
                          const content = (document.getElementById('pg-content') as HTMLTextAreaElement).value;
                          const order = (document.getElementById('pg-order') as HTMLInputElement).value;
                          if(id && title) set(ref(db, `custom_pages/${id}`), { title, content, order: parseInt(order) || 999 }).then(() => alert("تم!"));
                        }} className="w-full py-4 bg-purple-600 rounded-2xl font-black">نشر</button>
                    </div>
                    <div className="space-y-2">
                       {customPages.map(pg => (
                         <div key={pg.id} className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
                            <div><span className="text-cyan-400 font-bold ml-2">#{pg.order}</span> {pg.title}</div>
                            <button onClick={() => remove(ref(db, `custom_pages/${pg.id}`))} className="text-red-500"><Trash2 size={18} /></button>
                         </div>
                       ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <audio ref={audioRef} onTimeUpdate={onTimeUpdate} onEnded={nextSong} />
    </div>
  );
};

// Sub-components
const SidebarBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-500 group ${active ? 'bg-cyan-500/20 text-cyan-400 border-r-4 border-cyan-400' : 'text-white/30 hover:bg-white/5 hover:text-white'}`}>
    <span className={`transition-transform duration-500 ${active ? 'scale-125' : 'group-hover:scale-110'}`}>{icon}</span>
    <span className={`font-black tracking-tight ${active ? 'text-glow-cyan' : ''}`}>{label}</span>
  </button>
);

const MobNavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all duration-500 flex-1 ${active ? 'text-cyan-400 -translate-y-2' : 'text-white/20'}`}>
    <div className={`p-2 rounded-2xl ${active ? 'bg-cyan-500/20' : ''}`}>{icon}</div>
    <span className={`text-[10px] font-black uppercase ${active ? 'opacity-100' : 'opacity-0'}`}>{label}</span>
  </button>
);

const AdminNavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 font-black ${active ? 'bg-cyan-500 text-black' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}>
    <span className={active ? 'scale-110 transition-transform' : ''}>{icon}</span>
    <span className="hidden md:inline">{label}</span>
  </button>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(err => console.log('PWA Failed', err)); });
}

export default App;
