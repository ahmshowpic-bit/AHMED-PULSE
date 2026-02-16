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
  Disc,
  FolderOpen,
  Fingerprint,
  CheckCircle,
  Trash2,
  Plus,
  ArrowLeft,
  Sparkles,
  Zap
} from 'lucide-react';
import { 
  db, auth, googleProvider, ADMIN_EMAIL, 
  ref, onValue, push, set, update, remove, runTransaction, 
  signInWithPopup, signOut, onAuthStateChanged, User 
} from './firebase';
import { Song, DiaryPost, ContactMessage, CustomPage, AppSettings, TabId } from './types';

// Components defined outside for better performance
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

  // Community Input State
  const [diaryName, setDiaryName] = useState('');
  const [diaryMsg, setDiaryMsg] = useState('');
  
  // Contact State
  const [contactName, setContactName] = useState('');
  const [contactMsg, setContactMsg] = useState('');

  // Admin Music Form
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongUrl, setNewSongUrl] = useState('');
  const [newSongImg, setNewSongImg] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('new');
  const [newFolderName, setNewFolderName] = useState('');

  // Calculate Hero Song (The default song selected by admin)
  const heroSong = useMemo(() => songs.find(s => s.id === settings.defaultSongId), [songs, settings.defaultSongId]);

  // Firebase Listeners
  useEffect(() => {
    // Auth
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAdmin(u?.email === ADMIN_EMAIL);
    });

    // Settings
    const unsubSettings = onValue(ref(db, 'settings'), (snap) => {
      if (snap.exists()) setSettings(prev => ({ ...prev, ...snap.val() }));
    }, (error) => console.warn("Settings access restricted:", error.message));

    // Visitor Counter Transaction
    if (!sessionStorage.getItem('visited')) {
      const vRef = ref(db, 'settings/visitorCount');
      runTransaction(vRef, (current) => (current || 0) + 1).catch(err => {
        console.warn("Visitor count update failed. Check Firebase Rules.");
      });
      sessionStorage.setItem('visited', 'true');
    }

    // Music
    const unsubMusic = onValue(ref(db, 'music'), (snap) => {
      const data: Song[] = [];
      snap.forEach((child) => {
        data.push({ id: child.key!, ...child.val() });
      });
      setSongs(data);
    }, (error) => console.warn("Music access restricted:", error.message));

    // Community
    const unsubDiaries = onValue(ref(db, 'diaries'), (snap) => {
      const data: DiaryPost[] = [];
      snap.forEach((child) => {
        data.push({ id: child.key!, ...child.val() });
      });
      setDiaries(data.reverse()); // Latest first
    }, (error) => console.warn("Diaries access restricted:", error.message));

    // Custom Pages
    const unsubPages = onValue(ref(db, 'custom_pages'), (snap) => {
      const data: CustomPage[] = [];
      snap.forEach((child) => {
        data.push({ id: child.key!, ...child.val() });
      });
      setCustomPages(data);
    }, (error) => console.warn("Pages access restricted:", error.message));

    // Inbox
    const unsubInbox = onValue(ref(db, 'inbox'), (snap) => {
      const data: ContactMessage[] = [];
      snap.forEach((child) => {
        data.push({ id: child.key!, ...child.val() });
      });
      setMessages(data);
    }, (error) => console.warn("Inbox access restricted (Admin only):", error.message));

    return () => {
      unsubAuth();
      unsubSettings();
      unsubMusic();
      unsubDiaries();
      unsubPages();
      unsubInbox();
    };
  }, []);

  // Pre-load Default Song
  useEffect(() => {
    if (heroSong && !currentSong && audioRef.current) {
        setCurrentSong(heroSong);
        setPlaylist([heroSong]);
        audioRef.current.src = heroSong.url;
    }
  }, [heroSong]);

  // Audio Handlers
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      if (!audioRef.current.src && songs.length > 0) {
        playSong(songs[0], songs);
      } else {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
      }
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

  const nextSong = () => {
    if (!currentSong || playlist.length === 0) return;
    const currentIndex = playlist.findIndex(s => s.id === currentSong.id);
    const nextIndex = (currentIndex + 1) % playlist.length;
    playSong(playlist[nextIndex], playlist);
  };

  const prevSong = () => {
    if (!currentSong || playlist.length === 0) return;
    const currentIndex = playlist.findIndex(s => s.id === currentSong.id);
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playSong(playlist[prevIndex], playlist);
  };

  const onTimeUpdate = () => {
    if (!audioRef.current) return;
    const { currentTime, duration } = audioRef.current;
    if (duration) {
      setProgress((currentTime / duration) * 100);
    }
  };

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioRef.current.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    audioRef.current.currentTime = percentage * audioRef.current.duration;
  };

  // Grouped Songs by Folder
  const folders = useMemo(() => {
    const map: Record<string, Song[]> = {};
    songs.forEach(s => {
      const f = s.folder || "منوعات";
      if (!map[f]) map[f] = [];
      map[f].push(s);
    });
    return map;
  }, [songs]);

  // Featured Content
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
    } catch (e) {
      console.error(e);
      alert("فشل تسجيل الدخول. تأكد من إعدادات Firebase Authentication.");
    }
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
    push(ref(db, 'diaries'), postData).catch(err => {
      alert("فشل النشر. يرجى التأكد من صلاحيات قاعدة البيانات.");
    });
    setDiaryMsg('');
  };

  const likePost = (id: string) => {
    const postRef = ref(db, `diaries/${id}/likes`);
    runTransaction(postRef, (likes) => (likes || 0) + 1).catch(err => {
       console.warn("Like failed:", err.message);
    });
  };

  const sendMessage = () => {
    if (!contactMsg.trim()) return;
    push(ref(db, 'inbox'), { name: contactName || "مجهول", msg: contactMsg }).then(() => {
      setContactMsg('');
      setContactName('');
      alert("تم الإرسال بنجاح!");
    }).catch(err => {
      alert("حدث خطأ أثناء الإرسال. تأكد من إعدادات Firebase.");
    });
  };

  const addMusicAdmin = () => {
    const folder = selectedFolder === 'new' ? newFolderName : selectedFolder;
    if (!folder || !newSongTitle || !newSongUrl) return alert("يرجى إكمال البيانات");
    push(ref(db, 'music'), {
      name: newSongTitle,
      url: newSongUrl,
      image: newSongImg || "https://picsum.photos/400/400",
      folder
    }).then(() => {
      setNewSongTitle('');
      setNewSongUrl('');
      setNewSongImg('');
      alert("تمت الإضافة بنجاح!");
    }).catch(err => {
      alert("خطأ في الصلاحيات: " + err.message);
    });
  };

  // Background Logic
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
      {/* Dynamic Background */}
      <div 
        className={`absolute inset-0 z-0 transition-all duration-1000 bg-center bg-no-repeat ${settings.animType === 'zoom-in' ? 'anim-zoom-in' : ''}`}
        style={backgroundStyle}
      />
      {settings.heroType === 'video' && settings.heroMode && (
        <video 
          autoPlay 
          loop 
          muted 
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-50"
          src={settings.heroImg}
        />
      )}
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black via-transparent to-black/30 pointer-events-none" />

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 glass border-l border-white/10 z-50 flex-col p-8 transition-all">
        <div className="mb-10">
          <h1 className="text-3xl font-black bg-gradient-to-br from-white to-cyan-400 bg-clip-text text-transparent tracking-tighter">
            AHMED PULSE
          </h1>
        </div>

        <div className="mb-8">
          <VisitorBadge count={settings.visitorCount} visible={settings.showVisitorCount || isAdmin} />
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarBtn active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home />} label="الرئيسية" />
          <SidebarBtn active={activeTab === 'music'} onClick={() => setActiveTab('music')} icon={<MusicIcon />} label="الصوتيات" />
          <SidebarBtn active={activeTab === 'diaries'} onClick={() => setActiveTab('diaries')} icon={<Users />} label="المجتمع" />
          <SidebarBtn active={activeTab === 'contact'} onClick={() => setActiveTab('contact')} icon={<Mail />} label="تواصل معي" />
          
          {customPages.map(page => (
            <SidebarBtn 
              key={page.id} 
              active={activeTab === page.id} 
              onClick={() => setActiveTab(page.id)} 
              icon={<MoreHorizontal />} 
              label={page.title} 
            />
          ))}
        </nav>

        <div className="mt-auto flex justify-center pt-4">
          <button 
            onClick={() => isAdmin ? setShowAdminModal(true) : handleLogin()}
            className="text-white/20 hover:text-cyan-400 transition-colors duration-300"
          >
            <Shield size={24} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full relative z-10 overflow-y-auto px-4 md:px-12 pt-8 pb-40 scroll-smooth no-scrollbar">
        <div className="max-w-6xl mx-auto">
          
          {/* Home Section */}
          <section className={`${activeTab === 'home' ? 'block' : 'hidden'} animate-fade-in`}>
            {/* Hero Section: Text + Optional Song */}
            <div className="min-h-[40vh] flex flex-col items-center justify-center text-center mt-12 mb-20">
              
              {/* 1. Welcome Text (Always Visible) */}
              <h2 className="text-5xl md:text-8xl font-black text-white mb-8 drop-shadow-2xl leading-tight px-4 arabic-text-container">
                {settings.welcome}
              </h2>

              {/* 2. Hero Song (Visible ONLY if selected) */}
              {heroSong && (
                <div className="animate-fade-in flex flex-col items-center gap-6 mb-8">
                  <div className="relative group cursor-pointer" onClick={() => playSong(heroSong, [heroSong])}>
                    <div className="absolute inset-0 bg-cyan-500 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                    <img 
                      src={heroSong.image} 
                      alt={heroSong.name}
                      className="w-40 h-40 md:w-56 md:h-56 rounded-full object-cover border-4 border-white/10 shadow-2xl relative z-10 group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                       <div className="bg-black/50 backdrop-blur-sm rounded-full p-4">
                         <Play fill="white" className="w-8 h-8 text-white" />
                       </div>
                    </div>
                  </div>
                  
                  <div>
                    <h2 className="text-3xl md:text-5xl font-black text-white mb-2 drop-shadow-2xl tracking-tighter">
                      {heroSong.name}
                    </h2>
                    <p className="text-cyan-400 text-lg md:text-xl font-bold uppercase tracking-widest bg-cyan-500/10 px-4 py-1 rounded-full inline-block mt-2 border border-cyan-500/20">
                      {heroSong.folder} | Featured Track
                    </p>
                  </div>
                  
                  <div className="flex gap-4 mt-4">
                    <button 
                      onClick={() => playSong(heroSong, [heroSong])}
                      className="bg-white text-black px-8 py-3 rounded-full font-black hover:scale-105 transition-all flex items-center gap-2"
                    >
                      <Play size={20} fill="black" /> استمع الآن
                    </button>
                    {isAdmin && (
                        <button 
                        onClick={() => update(ref(db, 'settings'), { defaultSongId: null })}
                        className="bg-white/10 text-white px-8 py-3 rounded-full font-bold hover:bg-white/20 transition-all border border-white/10"
                        >
                        إلغاء التثبيت
                        </button>
                    )}
                  </div>
                </div>
              )}

              <div className="md:hidden mt-8">
                <VisitorBadge count={settings.visitorCount} visible={settings.showVisitorCount || isAdmin} />
              </div>
            </div>

            {/* Featured Songs Carousel */}
            <div className="mb-16">
              <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-2xl font-black flex items-center gap-3">
                  <Sparkles className="text-yellow-400" /> مختارات صوتية
                </h3>
                <button onClick={() => setActiveTab('music')} className="text-cyan-400 text-sm font-bold flex items-center gap-1 hover:underline">
                  عرض الكل <ChevronRight size={16} />
                </button>
              </div>
              <div className="carousel-container flex gap-6 overflow-x-auto no-scrollbar pb-6 px-2">
                {featuredSongs.map(song => (
                  <div 
                    key={song.id} 
                    onClick={() => playSong(song, featuredSongs)}
                    className="carousel-item flex-shrink-0 w-64 md:w-80 glass border border-white/10 rounded-[2rem] overflow-hidden group cursor-pointer hover:border-cyan-500/50 transition-all duration-500"
                  >
                    <div className="relative aspect-square">
                      <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: `url(${song.image})` }} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="w-16 h-16 rounded-full bg-cyan-500 flex items-center justify-center text-black shadow-2xl scale-75 group-hover:scale-100 transition-transform">
                            <Play fill="currentColor" size={28} className="ml-1" />
                         </div>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="font-bold text-lg truncate mb-1">{song.name}</div>
                      <div className="text-xs text-white/40">{song.folder}</div>
                    </div>
                  </div>
                ))}
                {featuredSongs.length === 0 && <div className="text-white/20 p-8">لا توجد صوتيات مختارة حالياً</div>}
              </div>
            </div>

            {/* Community Highlights */}
            <div className="mb-16">
              <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-2xl font-black flex items-center gap-3">
                  <Zap className="text-purple-400" /> نبض المجتمع
                </h3>
                <button onClick={() => setActiveTab('diaries')} className="text-cyan-400 text-sm font-bold flex items-center gap-1 hover:underline">
                  انضم إلينا <ChevronRight size={16} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-2">
                {latestDiaries.map(post => (
                  <div 
                    key={post.id} 
                    className="glass border border-white/10 p-6 rounded-3xl hover:bg-white/5 transition-all flex flex-col gap-4 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg">
                        {post.name[0]}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-sm flex items-center gap-2">{post.name} {post.verified && <CheckCircle size={14} className="text-cyan-400" />}</div>
                        <div className="text-[10px] text-white/30">{post.date}</div>
                      </div>
                      <Heart size={16} className="text-white/10 group-hover:text-red-400 transition-colors" />
                    </div>
                    <p className="text-sm text-white/70 line-clamp-3 leading-relaxed">{post.text}</p>
                  </div>
                ))}
                {latestDiaries.length === 0 && <div className="col-span-full text-white/20 py-10 text-center">كن أول من يشاركنا في المجتمع!</div>}
              </div>
            </div>
          </section>

          {/* Music Section */}
          <section className={`${activeTab === 'music' ? 'block' : 'hidden'}`}>
            <div className="flex justify-between items-center mb-12 mt-8">
              <h2 className="text-4xl font-black flex items-center gap-4">
                <MusicIcon className="text-cyan-400" size={36} /> المكتبة الصوتية
              </h2>
            </div>
            
            {currentFolder ? (
              <div className="space-y-4">
                <button 
                  onClick={() => setCurrentFolder(null)}
                  className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-all bg-white/5 px-4 py-2 rounded-full border border-white/10"
                >
                  <ArrowLeft size={18} /> رجوع للمجلدات
                </button>
                <h3 className="text-3xl font-black text-cyan-400 mb-8 border-r-4 border-cyan-400 pr-4">{currentFolder}</h3>
                <div className="grid gap-3">
                  {folders[currentFolder]?.map((song, i) => (
                    <div 
                      key={song.id}
                      onClick={() => playSong(song, folders[currentFolder])}
                      className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border ${currentSong?.id === song.id ? 'bg-cyan-500/20 border-cyan-500/30' : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'}`}
                    >
                      <div className={`w-14 h-14 rounded-2xl bg-cover bg-center shadow-lg transition-transform ${currentSong?.id === song.id ? 'scale-110 rotate-3' : ''}`} style={{ backgroundImage: `url(${song.image})` }} />
                      <div className="flex-1">
                        <div className="font-bold text-lg">{song.name}</div>
                        <div className="text-xs text-white/40">المجلد: {currentFolder}</div>
                      </div>
                      {currentSong?.id === song.id ? (
                        <div className="flex gap-1 items-end h-6">
                           {[1,2,3,4].map(b => <div key={b} className="w-1 bg-cyan-400 rounded-full animate-pulse" style={{ height: `${Math.random()*100}%`, animationDelay: `${b*0.1}s` }} />)}
                        </div>
                      ) : (
                        <Play size={20} className="text-white/20" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                {Object.keys(folders).map(folder => (
                  <div 
                    key={folder}
                    onClick={() => setCurrentFolder(folder)}
                    className="glass border border-white/10 p-8 rounded-[3rem] flex flex-col items-center text-center cursor-pointer hover:scale-105 hover:border-cyan-500/50 transition-all group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-opacity">
                      <ChevronRight size={24} className="text-cyan-400" />
                    </div>
                    <div className="w-20 h-20 bg-cyan-500/10 rounded-[2rem] flex items-center justify-center text-cyan-400 mb-6 group-hover:bg-cyan-500 group-hover:text-black transition-all shadow-xl">
                      <FolderOpen size={40} />
                    </div>
                    <div className="font-black text-xl mb-2">{folder}</div>
                    <div className="text-xs text-white/40 font-bold uppercase tracking-widest">{folders[folder].length} ملفات</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Diaries/Community Section */}
          <section className={`${activeTab === 'diaries' ? 'block' : 'hidden'}`}>
            <h2 className="text-4xl font-black mb-12 mt-8 flex items-center gap-4">
              <Users className="text-cyan-400" size={36} /> المجتمع الرقمي
            </h2>
            
            <div className="glass border border-white/10 p-8 rounded-[3rem] mb-12 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-500/10 blur-[60px] rounded-full" />
              <div className="relative z-10">
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <input 
                    value={diaryName}
                    onChange={e => setDiaryName(e.target.value)}
                    placeholder="اسمك المستعار"
                    className="bg-black/40 border border-white/10 p-5 rounded-2xl text-white placeholder:text-white/20 font-bold"
                    maxLength={20}
                  />
                  <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/5">
                    <Sparkles size={20} className="text-yellow-400" />
                    <span className="text-xs text-white/40">شاركنا لحظاتك المميزة، أفكارك، أو حتى اقتراحاتك الموسيقية.</span>
                  </div>
                </div>
                <textarea 
                  value={diaryMsg}
                  onChange={e => setDiaryMsg(e.target.value)}
                  placeholder="ما الذي يدور في ذهنك اليوم؟"
                  rows={4}
                  className="w-full bg-black/40 border border-white/10 p-6 rounded-[2rem] mb-6 text-white placeholder:text-white/20 resize-none text-lg leading-relaxed"
                />
                <button 
                  onClick={postDiaryEntry}
                  className="w-full md:w-auto px-12 py-5 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full font-black text-lg shadow-2xl shadow-cyan-500/20 hover:scale-[1.05] active:scale-95 transition-all flex items-center justify-center gap-3 float-left"
                >
                  نشر الآن <Send size={20} />
                </button>
                <div className="clear-both" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
              {diaries.length === 0 && <div className="text-center text-white/20 py-20 text-xl font-bold">المجتمع بانتظار مشاركتك الأولى...</div>}
              {diaries.map(post => (
                <div 
                  key={post.id} 
                  className={`rounded-[2.5rem] border border-white/10 overflow-hidden shadow-xl transition-all hover:border-white/20 ${post.verified ? 'bg-gradient-to-br from-cyan-900/20 to-black/40 border-cyan-500/30 ring-1 ring-cyan-500/10' : 'bg-white/5'}`}
                >
                  <div className="flex items-center gap-4 p-6 bg-black/30 backdrop-blur-md">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-black text-xl text-white shadow-xl">
                      {post.name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="font-black text-lg flex items-center gap-2">
                        {post.name} {post.verified && <span className="flex items-center gap-1 text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded-full border border-cyan-500/30 uppercase tracking-tighter font-black"><CheckCircle size={10} /> Verified Agent</span>}
                      </div>
                      <div className="text-xs text-white/30 font-medium">{post.date}</div>
                    </div>
                    {isAdmin && (
                      <button 
                        onClick={() => remove(ref(db, `diaries/${post.id}`)).catch(e => console.error(e))}
                        className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                  <div className="p-8 text-white/80 text-lg leading-relaxed whitespace-pre-wrap">{post.text}</div>
                  <div className="p-4 bg-black/10 border-t border-white/5 px-8 flex justify-between items-center">
                    <button 
                      onClick={() => likePost(post.id)}
                      className={`flex items-center gap-2 transition-all font-black py-2 px-4 rounded-full ${post.likes > 0 ? 'bg-red-500/10 text-red-500' : 'text-white/20 hover:text-white hover:bg-white/5'}`}
                    >
                      <Heart size={20} fill={post.likes > 0 ? "currentColor" : "none"} /> {post.likes || 0}
                    </button>
                    <div className="text-[10px] uppercase tracking-widest text-white/10 font-black">Ahmed Pulse community</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Contact Section */}
          <section className={`${activeTab === 'contact' ? 'block' : 'hidden'}`}>
            <div className="max-w-2xl mx-auto glass border border-white/10 p-12 rounded-[4rem] text-center shadow-2xl mt-8">
              <div className="w-24 h-24 bg-cyan-500/10 rounded-[2rem] flex items-center justify-center text-cyan-400 mx-auto mb-8 shadow-inner">
                 <Mail size={48} />
              </div>
              <h2 className="text-4xl font-black mb-4 text-white">تواصل مباشر</h2>
              <p className="text-white/40 mb-10 text-lg">يسعدني دائماً استقبال رسائلكم واستفساراتكم</p>
              
              <div className="space-y-6 text-right">
                <div>
                  <label className="text-sm font-black text-cyan-400 block mb-3 mr-4">اسمك الكريم</label>
                  <input 
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    placeholder="اكتب اسمك هنا"
                    className="w-full bg-black/60 border border-white/10 p-5 rounded-3xl text-white text-center text-lg focus:ring-2 ring-cyan-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="text-sm font-black text-cyan-400 block mb-3 mr-4">محتوى الرسالة</label>
                  <textarea 
                    value={contactMsg}
                    onChange={e => setContactMsg(e.target.value)}
                    placeholder="بماذا تود أن تخبرني؟"
                    rows={6}
                    className="w-full bg-black/60 border border-white/10 p-6 rounded-[2.5rem] text-white resize-none text-center text-lg focus:ring-2 ring-cyan-500/20 transition-all"
                  />
                </div>
                <button 
                  onClick={sendMessage}
                  className="w-full py-6 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 rounded-full font-black text-xl shadow-2xl shadow-cyan-500/30 hover:scale-[1.02] active:scale-95 transition-all mt-6"
                >
                  إرسال الرسالة الآن
                </button>
              </div>
              
              {/* Hidden Admin Trigger */}
              <div className="mt-16 opacity-5 hover:opacity-100 transition-opacity">
                <button onClick={() => isAdmin ? setShowAdminModal(true) : handleLogin()}>
                  <Fingerprint size={32} className="mx-auto text-white cursor-pointer" />
                </button>
              </div>
            </div>
          </section>

          {/* Dynamic Pages */}
          {customPages.map(page => (
            <section key={page.id} className={`${activeTab === page.id ? 'block' : 'hidden'}`}>
              <h2 className="text-4xl font-black mb-12 mt-8 border-r-8 border-cyan-400 pr-6">{page.title}</h2>
              <div 
                className="glass border border-white/10 p-10 md:p-16 rounded-[4rem] leading-relaxed prose prose-invert max-w-none text-xl shadow-2xl"
                dangerouslySetInnerHTML={{ __html: page.content }}
              />
            </section>
          ))}
        </div>
      </main>

      {/* Music Player Bar */}
      <div className={`fixed bottom-24 md:bottom-8 left-4 right-4 md:right-8 md:left-[272px] h-24 glass rounded-full z-[100] border border-white/10 flex items-center justify-between px-6 md:px-10 shadow-2xl transition-all duration-500 ${isPlaying ? 'playing border-cyan-500/30 ring-4 ring-cyan-500/5 bg-black/90' : ''}`}>
        {/* Progress Bar (Absolute Positioned for Thread Look) */}
        <div 
          className="absolute top-0 left-10 right-10 h-1 cursor-pointer group"
          onClick={onSeek}
        >
          <div className="w-full h-full bg-white/10 rounded-full overflow-hidden relative">
            <div 
              className="absolute top-0 right-0 h-full bg-gradient-to-l from-cyan-400 via-blue-500 to-purple-500 transition-all duration-300 shadow-[0_0_15px_#00f2ff]" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Player Left: Info */}
        <div className="flex items-center gap-4 flex-1">
          <div 
            className={`w-14 h-14 rounded-2xl bg-cover bg-center border border-white/10 shadow-2xl transition-all duration-700 ${isPlaying ? 'rotate-12 scale-110 shadow-cyan-500/20' : ''}`}
            style={{ backgroundImage: `url(${currentSong?.image || "https://picsum.photos/200/200"})` }}
          />
          <div className="overflow-hidden">
            <div className="font-black text-sm md:text-lg truncate max-w-[120px] md:max-w-[200px]">{currentSong?.name || "اختر أغنية"}</div>
            <div className="text-[10px] uppercase font-bold text-cyan-400 tracking-tighter opacity-60">{currentSong?.folder || "READY"}</div>
          </div>
        </div>

        {/* Player Center: Controls */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-4 md:gap-8">
            <button onClick={prevSong} className="text-white/40 hover:text-white transition-all transform active:scale-90"><SkipBack size={28} /></button>
            <button 
              onClick={togglePlay}
              className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-2xl shadow-white/10 hover:scale-110 active:scale-90 transition-all"
            >
              {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
            </button>
            <button onClick={nextSong} className="text-white/40 hover:text-white transition-all transform active:scale-90"><SkipForward size={28} /></button>
          </div>
        </div>

        {/* Player Right: Volume (Desktop Only) */}
        <div className="hidden md:flex items-center gap-3 flex-1 justify-end">
          <Volume2 size={20} className="text-cyan-400" />
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={volume} 
            onChange={e => setVolume(parseFloat(e.target.value))}
            className="w-32 h-1 accent-cyan-400 bg-white/10 rounded-full cursor-pointer"
          />
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 glass border-t border-white/10 z-[150] flex items-center justify-around px-4 bg-black/80 backdrop-blur-3xl">
        <MobNavBtn active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home />} label="الرئيسية" />
        <MobNavBtn active={activeTab === 'music'} onClick={() => setActiveTab('music')} icon={<MusicIcon />} label="موسيقى" />
        <MobNavBtn active={activeTab === 'diaries'} onClick={() => setActiveTab('diaries')} icon={<Users />} label="المجتمع" />
        <MobNavBtn active={activeTab === 'contact'} onClick={() => setActiveTab('contact')} icon={<Mail />} label="اتصل" />
      </nav>

      {/* Admin Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4">
          <div className="w-full max-w-5xl h-[90vh] bg-[#0c0c12] border border-white/10 rounded-[3rem] flex flex-col overflow-hidden shadow-2xl ring-1 ring-white/10">
            <div className="p-8 border-b border-white/10 flex justify-between items-center bg-black/40">
              <div className="flex items-center gap-4 text-cyan-400 font-black text-2xl">
                <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center"><Shield size={28} /></div>
                نظام الإدارة المتكامل
              </div>
              <button onClick={() => setShowAdminModal(false)} className="w-12 h-12 rounded-full hover:bg-white/5 flex items-center justify-center text-white/40 hover:text-white text-3xl transition-all">&times;</button>
            </div>
            
            <div className="flex flex-1 overflow-hidden">
              {/* Admin Side Nav */}
              <div className="w-24 md:w-60 bg-black/60 border-l border-white/5 flex flex-col p-4 gap-3">
                <AdminNavBtn active={adminTab === 'inbox'} onClick={() => setAdminTab('inbox')} icon={<Mail />} label="البريد الوارد" />
                <AdminNavBtn active={adminTab === 'music'} onClick={() => setAdminTab('music')} icon={<MusicIcon />} label="إدارة الأغاني" />
                <AdminNavBtn active={adminTab === 'pages'} onClick={() => setAdminTab('pages')} icon={<Settings />} label="بناء الصفحات" />
                <AdminNavBtn active={adminTab === 'settings'} onClick={() => setAdminTab('settings')} icon={<Settings />} label="إعدادات النظام" />
                <button 
                  onClick={() => { signOut(auth); setShowAdminModal(false); }}
                  className="mt-auto flex items-center gap-4 p-4 text-red-400 hover:bg-red-400/10 rounded-2xl transition-all font-black"
                >
                  <LogOut size={24} /> <span className="hidden md:inline">تسجيل الخروج</span>
                </button>
              </div>
              
              {/* Admin View Area */}
              <div className="flex-1 overflow-y-auto p-10 no-scrollbar">
                {/* Inbox Tab */}
                {adminTab === 'inbox' && (
                  <div className="space-y-6">
                    <h3 className="text-3xl font-black mb-10 flex items-center justify-between">
                      صندوق الوارد <span className="bg-cyan-500/20 text-cyan-400 px-4 py-1 rounded-full text-sm font-black">{messages.length} رسالة</span>
                    </h3>
                    {messages.length === 0 && <div className="text-white/10 text-center py-20 text-xl font-bold">لا توجد رسائل جديدة حالياً</div>}
                    {messages.map(m => (
                      <div key={m.id} className="bg-white/5 border border-white/10 p-6 rounded-[2rem] flex items-start gap-6 hover:bg-white/10 transition-all group">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-cyan-600/20 flex items-center justify-center text-cyan-400 font-black text-2xl uppercase">
                          {m.name[0]}
                        </div>
                        <div className="flex-1">
                          <div className="font-black text-xl text-white mb-2">{m.name}</div>
                          <div className="text-lg text-white/60 leading-relaxed bg-black/30 p-4 rounded-2xl">{m.msg}</div>
                        </div>
                        <button onClick={() => remove(ref(db, `inbox/${m.id}`)).catch(e => console.error(e))} className="text-red-500/30 hover:text-red-500 p-3 rounded-full hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={24} /></button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Music Admin Tab */}
                {adminTab === 'music' && (
                  <div>
                    <h3 className="text-3xl font-black mb-10">إدارة المحتوى الصوتي</h3>
                    <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem] mb-12 space-y-6 shadow-xl ring-1 ring-white/5">
                      <div className="grid md:grid-cols-2 gap-6">
                         <div className="space-y-2">
                            <label className="text-xs font-black text-white/40 mr-2">اختيار المجلد</label>
                            <select 
                              value={selectedFolder} 
                              onChange={e => setSelectedFolder(e.target.value)}
                              className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl text-lg font-bold"
                            >
                              <option value="new">++ إنشاء مجلد جديد ++</option>
                              {Object.keys(folders).map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                         </div>
                        {selectedFolder === 'new' && (
                          <div className="space-y-2">
                             <label className="text-xs font-black text-white/40 mr-2">اسم المجلد الجديد</label>
                             <input 
                                value={newFolderName} 
                                onChange={e => setNewFolderName(e.target.value)} 
                                placeholder="أدخل اسماً للمجلد" 
                                className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl text-lg" 
                             />
                          </div>
                        )}
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-white/40 mr-2">اسم الأغنية</label>
                          <input value={newSongTitle} onChange={e => setNewSongTitle(e.target.value)} placeholder="مثال: لحن الخلود" className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl text-lg" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-black text-white/40 mr-2">رابط ملف MP3</label>
                           <input value={newSongUrl} onChange={e => setNewSongUrl(e.target.value)} placeholder="https://..." className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl text-lg font-mono" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-white/40 mr-2">رابط صورة الغلاف</label>
                        <input value={newSongImg} onChange={e => setNewSongImg(e.target.value)} placeholder="https://..." className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl text-lg font-mono" />
                      </div>
                      <button onClick={addMusicAdmin} className="w-full py-5 bg-cyan-600 rounded-[2rem] font-black text-xl shadow-2xl shadow-cyan-600/20 hover:scale-[1.02] active:scale-95 transition-all">إضافة الملف الآن</button>
                    </div>
                    
                    <div className="space-y-3">
                      {songs.map(s => (
                        <div key={s.id} className="flex items-center gap-6 p-4 bg-white/5 rounded-[1.5rem] border border-white/5 hover:border-white/10 transition-all group">
                          <img src={s.image} className="w-16 h-16 rounded-xl object-cover shadow-lg" />
                          <div className="flex-1 truncate">
                            <div className="font-black text-lg">{s.name}</div>
                            <div className="text-xs text-white/30 font-bold uppercase tracking-widest">{s.folder}</div>
                          </div>
                          <div className="flex gap-2">
                             <button 
                                onClick={() => update(ref(db, 'settings'), { defaultSongId: s.id }).catch(e => console.error(e))}
                                className={`w-12 h-12 rounded-full transition-all flex items-center justify-center ${settings.defaultSongId === s.id ? 'bg-yellow-500 text-black' : 'bg-white/5 text-white/20'}`}
                              >
                                <Heart size={20} fill={settings.defaultSongId === s.id ? "currentColor" : "none"} />
                              </button>
                              <button onClick={() => confirm('هل أنت متأكد من الحذف؟') && remove(ref(db, `music/${s.id}`)).catch(e => console.error(e))} className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><Trash2 size={20} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Settings Tab */}
                {adminTab === 'settings' && (
                  <div className="space-y-10">
                    <h3 className="text-3xl font-black">إعدادات النظام الأساسية</h3>
                    
                    <div className="space-y-8 bg-white/5 p-10 rounded-[3rem] border border-white/10 shadow-2xl">
                      <div className="space-y-3">
                        <label className="block text-sm font-black text-cyan-400 mr-2">نص الترحيب الرئيسي</label>
                        <input 
                          value={settings.welcome} 
                          onChange={e => setSettings({...settings, welcome: e.target.value})}
                          className="w-full bg-black/60 border border-white/10 p-5 rounded-2xl text-xl font-black text-center"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between p-6 bg-cyan-500/5 rounded-[2rem] border border-cyan-500/10">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400"><Users size={24} /></div>
                          <div>
                            <div className="font-black text-lg">عداد الزيارات</div>
                            <div className="text-xs text-white/30">إظهار عدد زوار الموقع للعامة</div>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={settings.showVisitorCount} 
                            onChange={e => setSettings({...settings, showVisitorCount: e.target.checked})}
                          />
                          <div className="w-14 h-7 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                        </label>
                      </div>

                      <div className="p-10 bg-purple-500/5 rounded-[3rem] border border-purple-500/20 space-y-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5"><Zap size={100} /></div>
                        <h4 className="text-2xl font-black text-purple-400 flex items-center gap-3"><Sparkles size={24} /> محرك العرض (Hero Engine)</h4>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-black text-lg">وضع Hero الثابت</div>
                            <div className="text-xs text-white/30">تجاهل خلفيات الأغاني واستخدام خلفية ثابتة</div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer"
                              checked={settings.heroMode} 
                              onChange={e => setSettings({...settings, heroMode: e.target.checked})}
                            />
                            <div className="w-14 h-7 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                          </label>
                        </div>

                        <div className="space-y-3">
                           <label className="text-xs font-black text-white/40 mr-2">رابط الوسائط (صورة/فيديو)</label>
                           <input 
                            value={settings.heroImg} 
                            onChange={e => setSettings({...settings, heroImg: e.target.value})}
                            placeholder="ضع الرابط هنا"
                            className="w-full bg-black/60 border border-white/10 p-5 rounded-2xl text-lg font-mono"
                          />
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                             <label className="text-xs font-black text-white/40 mr-2">نوع الوسائط</label>
                             <select 
                              value={settings.heroType} 
                              onChange={e => setSettings({...settings, heroType: e.target.value as any})}
                              className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl font-bold"
                            >
                              <option value="image">صورة احترافية</option>
                              <option value="video">فيديو تفاعلي</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                             <label className="text-xs font-black text-white/40 mr-2">نمط الملاءمة</label>
                             <select 
                              value={settings.bgFit} 
                              onChange={e => setSettings({...settings, bgFit: e.target.value as any})}
                              className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl font-bold"
                            >
                              <option value="cover">ملء كامل (Cover)</option>
                              <option value="contain">احتواء ذكي (Contain)</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => { update(ref(db, 'settings'), settings).then(() => alert("تم تحديث كافة الإعدادات بنجاح")).catch(e => alert("فشل الحفظ: " + e.message)); }}
                        className="w-full py-6 bg-gradient-to-r from-cyan-600 to-purple-600 rounded-[2rem] font-black text-2xl shadow-2xl shadow-cyan-600/30 hover:scale-[1.01] active:scale-95 transition-all"
                      >
                        حفظ التعديلات
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Pages Tab */}
                {adminTab === 'pages' && (
                  <div className="space-y-8">
                    <h3 className="text-3xl font-black">منشئ المحتوى التفاعلي</h3>
                    <div className="bg-white/5 p-10 rounded-[3rem] border border-white/10 space-y-6 shadow-2xl">
                      <div className="grid md:grid-cols-2 gap-6">
                         <div className="space-y-2">
                           <label className="text-xs font-black text-white/40 mr-2">مُعرف الصفحة (English ID)</label>
                           <input id="pg-id" placeholder="مثال: about_us" className="w-full bg-black/60 border border-white/10 p-5 rounded-2xl font-bold" />
                         </div>
                         <div className="space-y-2">
                            <label className="text-xs font-black text-white/40 mr-2">عنوان القائمة (Arabic)</label>
                            <input id="pg-title" placeholder="مثال: من نحن" className="w-full bg-black/60 border border-white/10 p-5 rounded-2xl font-bold" />
                         </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-white/40 mr-2">محتوى الصفحة (HTML / Text)</label>
                        <textarea id="pg-content" rows={12} placeholder="اكتب محتوى الصفحة هنا بصيغة HTML..." className="w-full bg-black/60 border border-white/10 p-6 rounded-[2rem] text-lg font-mono leading-relaxed" />
                      </div>
                      <button 
                        onClick={() => {
                          const id = (document.getElementById('pg-id') as HTMLInputElement).value;
                          const title = (document.getElementById('pg-title') as HTMLInputElement).value;
                          const content = (document.getElementById('pg-content') as HTMLTextAreaElement).value;
                          if(id && title) {
                            set(ref(db, `custom_pages/${id}`), { title, content, icon: 'MoreHorizontal' }).then(() => alert("تم نشر الصفحة بنجاح!")).catch(e => alert("خطأ في الصلاحيات: " + e.message));
                          } else {
                            alert("يرجى إكمال الحقول الأساسية");
                          }
                        }}
                        className="w-full py-6 bg-purple-600 rounded-full font-black text-xl shadow-2xl shadow-purple-600/20 hover:scale-[1.02] transition-all"
                      >
                        نشر الصفحة الجديدة
                      </button>
                    </div>

                    <div className="grid gap-4">
                       <h4 className="text-xl font-black text-white/40 mt-8 mb-4">الصفحات الحالية</h4>
                       {customPages.map(pg => (
                         <div key={pg.id} className="flex items-center justify-between p-6 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all">
                            <div className="font-black text-lg">{pg.title} <span className="text-xs text-white/20 ml-2">({pg.id})</span></div>
                            <button onClick={() => confirm('حذف الصفحة؟') && remove(ref(db, `custom_pages/${pg.id}`)).catch(e => console.error(e))} className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><Trash2 size={18} /></button>
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

      {/* Audio Element */}
      <audio 
        ref={audioRef} 
        onTimeUpdate={onTimeUpdate} 
        onEnded={nextSong} 
        autoPlay={false}
      />
    </div>
  );
};

// Sub-components
const SidebarBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-500 group ${active ? 'bg-cyan-500/20 text-cyan-400 border-r-4 border-cyan-400 shadow-[10px_0_20px_rgba(6,182,212,0.1)]' : 'text-white/30 hover:bg-white/5 hover:text-white'}`}
  >
    <span className={`transition-transform duration-500 ${active ? 'scale-125' : 'group-hover:scale-110'}`}>{icon}</span>
    <span className={`font-black tracking-tight ${active ? 'text-glow-cyan' : ''}`}>{label}</span>
  </button>
);

const MobNavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 transition-all duration-500 flex-1 ${active ? 'text-cyan-400 -translate-y-3' : 'text-white/20'}`}
  >
    <div className={`p-2 rounded-2xl transition-all duration-500 ${active ? 'bg-cyan-500/20 shadow-lg shadow-cyan-500/20' : ''}`}>
      {icon}
    </div>
    <span className={`text-[10px] font-black uppercase tracking-tighter ${active ? 'opacity-100' : 'opacity-0'}`}>{label}</span>
  </button>
);

const AdminNavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 font-black ${active ? 'bg-cyan-500 text-black shadow-xl shadow-cyan-500/20' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
  >
    <span className={active ? 'scale-110 transition-transform' : ''}>{icon}</span>
    <span className="hidden md:inline">{label}</span>
  </button>
);

export default App;
