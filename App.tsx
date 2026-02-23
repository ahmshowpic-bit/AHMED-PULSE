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
  ChevronDown, // أيقونة إغلاق المشغل الموسع
  Maximize2, // أيقونة التوسيع
  WifiOff
} from 'lucide-react';
import {
  db, auth, googleProvider, ADMIN_EMAIL,
  ref, set, onValue, push, update, remove, runTransaction,
  signInWithPopup, signOut, onAuthStateChanged, User
} from './firebase';
import { Song, DiaryPost, ContactMessage, CustomPage, AppSettings, TabId } from './types';

// Components defined outside for better performance
const VisitorBadge: React.FC<{ count: number; visible: boolean }> = ({ count, visible }) => {
  if (!visible) return null;
  return (
    <div className="visitor-box bg-black/40 backdrop-blur-xl border border-white/10 p-4 rounded-2xl flex items-center gap-4 transition-all duration-500 hover:bg-white/10 hover:border-cyan-500/50 group shadow-2xl">
      <div className="text-cyan-400 bg-cyan-500/10 p-3 rounded-xl group-hover:scale-110 group-hover:bg-cyan-500 group-hover:text-black transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)]">
        <Users size={20} />
      </div>
      <div>
        <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">إجمالي الزيارات</div>
        <span className="visitor-num font-mono text-white font-black text-xl tracking-tight text-glow-cyan drop-shadow-md">
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
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showOnlineMsg, setShowOnlineMsg] = useState(false);

  // New State for Expanded Player
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

  // Online / Offline detection
  useEffect(() => {
    const goOffline = () => window.setTimeout(() => setIsOffline(true), 100);
    const goOnline = () => {
      setIsOffline(false);
      setShowOnlineMsg(true);
      setTimeout(() => setShowOnlineMsg(false), 2000); // إخفاء بعد ثانيتين
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // Install Prompt Listener
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
    }, (error) => console.warn("Settings access restricted:", error.message));

    if (!sessionStorage.getItem('visited')) {
      const vRef = ref(db, 'settings/visitorCount');
      runTransaction(vRef, (current) => (current || 0) + 1).catch(err => {
        console.warn("Visitor count update failed.");
      });
      sessionStorage.setItem('visited', 'true');
    }

    const unsubMusic = onValue(ref(db, 'music'), (snap) => {
      const data: Song[] = [];
      snap.forEach((child) => {
        data.push({ id: child.key!, ...child.val() });
      });
      setSongs(data);
    }, (error) => console.warn("Music access restricted:", error.message));

    const unsubDiaries = onValue(ref(db, 'diaries'), (snap) => {
      const data: DiaryPost[] = [];
      snap.forEach((child) => {
        data.push({ id: child.key!, ...child.val() });
      });
      setDiaries(data.reverse());
    }, (error) => console.warn("Diaries access restricted:", error.message));

    const unsubPages = onValue(ref(db, 'custom_pages'), (snap) => {
      const data: CustomPage[] = [];
      snap.forEach((child) => {
        data.push({ id: child.key!, ...child.val() });
      });
      setCustomPages(data);
    }, (error) => console.warn("Pages access restricted:", error.message));

    const unsubInbox = onValue(ref(db, 'inbox'), (snap) => {
      const data: ContactMessage[] = [];
      snap.forEach((child) => {
        data.push({ id: child.key!, ...child.val() });
      });
      setMessages(data);
    }, (error) => console.warn("Inbox access restricted:", error.message));

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

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); // Prevent opening expand player
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

  // Media Session API - Lock Screen Integration
  useEffect(() => {
    if (!currentSong || !('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.name,
      artist: 'AHMED PULSE',
      album: currentSong.folder || 'Library',
      artwork: [
        { src: currentSong.image, sizes: '96x96', type: 'image/jpeg' },
        { src: currentSong.image, sizes: '128x128', type: 'image/jpeg' },
        { src: currentSong.image, sizes: '192x192', type: 'image/jpeg' },
        { src: currentSong.image, sizes: '256x256', type: 'image/jpeg' },
        { src: currentSong.image, sizes: '384x384', type: 'image/jpeg' },
        { src: currentSong.image, sizes: '512x512', type: 'image/jpeg' },
      ],
    });

    navigator.mediaSession.setActionHandler('play', () => { audioRef.current?.play(); setIsPlaying(true); });
    navigator.mediaSession.setActionHandler('pause', () => { audioRef.current?.pause(); setIsPlaying(false); });
    navigator.mediaSession.setActionHandler('previoustrack', () => prevSong());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextSong());

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [currentSong, isPlaying]);

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
    if (duration) {
      setProgress((currentTime / duration) * 100);
    }
  };

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!audioRef.current || !audioRef.current.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    let percentage = (rect.right - e.clientX) / rect.width;
    percentage = Math.max(0, Math.min(1, percentage));
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
      alert("حدث خطأ أثناء الإرسال.");
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
    <div className="relative h-[100dvh] w-screen max-w-[100vw] flex overflow-hidden">
      {/* رسالة قطع الاتصال */}
      {isOffline && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-red-600/90 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 animate-fade-in-up">
          <WifiOff size={14} className="animate-pulse" />
          <span>لا يوجد اتصال بالإنترنت</span>
        </div>
      )}

      {/* رسالة عودة الاتصال */}
      {showOnlineMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-emerald-500/90 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 animate-fade-in-up">
          <CheckCircle size={14} />
          <span>تم الاتصال بالإنترنت</span>
        </div>
      )}
      {/* Style for dynamic animations */}
      <style>
        {`
          @keyframes gradient-xy {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .animate-gradient-slow {
            background-size: 200% 200%;
            animation: gradient-xy 8s ease infinite;
          }
          .animate-fade-in-up {
            animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .glass-panel {
            background: rgba(10, 10, 15, 0.4);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 20px 40px rgba(0,0,0,0.4);
          }
        `}
      </style>

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

      {/* --- Mobile Header --- */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-black/40 backdrop-blur-2xl border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <div
          onClick={() => setActiveTab('home')}
          className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 tracking-tighter cursor-pointer active:scale-95 transition-transform flex items-center gap-2 drop-shadow-lg"
        >
          <Zap className="text-cyan-400" size={24} />
          AHMED PULSE
        </div>
        <div className="flex items-center gap-4">
          {/* Download Button */}
          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.5)] animate-pulse hover:scale-110 transition-transform"
            >
              <Download size={18} />
            </button>
          )}

          {isAdmin && (
            <button onClick={() => setShowAdminModal(true)} className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)] hover:bg-cyan-500 hover:text-black transition-all">
              <Shield size={20} />
            </button>
          )}
        </div>
      </header>

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-[280px] bg-black/40 backdrop-blur-2xl border-l border-white/5 z-50 flex-col p-8 transition-all shadow-[-20px_0_40px_rgba(0,0,0,0.5)] relative">
        {/* Glow effect */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-cyan-500/10 blur-[50px] pointer-events-none" />

        <div className="mb-12 cursor-pointer relative z-10 flex items-center gap-3" onClick={() => setActiveTab('home')}>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_10px_20px_rgba(6,182,212,0.3)]">
            <Zap size={24} className="text-white" />
          </div>
          <h1 className="text-3xl font-black bg-gradient-to-br from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent tracking-tighter hover:scale-105 origin-left transition-transform drop-shadow-md">
            PULSE
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
      <main className="flex-1 h-full relative z-10 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 md:px-12 pt-20 md:pt-8 pb-40 scroll-smooth no-scrollbar">
        <div className="max-w-6xl mx-auto">

          {/* Home Section */}
          <section className={`${activeTab === 'home' ? 'block' : 'hidden'} animate-fade-in`}>
            {/* Hero Section */}
            <div className="min-h-[50vh] flex flex-col items-center justify-center text-center mt-12 md:mt-24 mb-32 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 blur-[150px] rounded-full pointer-events-none" />

              <h2 className="relative z-10 text-6xl md:text-8xl lg:text-[7rem] font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-cyan-100 to-cyan-500 drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)] leading-[1.1] px-4 arabic-text-container animate-fade-in-up mb-12">
                {settings.welcome}
              </h2>

              {heroSong && (
                <div className="animate-fade-in-up flex flex-col items-center gap-8 relative z-20" style={{ animationDelay: '0.2s' }}>
                  <div className="relative group cursor-pointer" onClick={() => playSong(heroSong, [heroSong])}>
                    <div className="absolute -inset-4 bg-gradient-to-r from-cyan-400 to-purple-600 rounded-full blur-2xl opacity-20 group-hover:opacity-40 group-hover:rotate-45 transition-all duration-1000"></div>
                    <img
                      src={heroSong.image}
                      alt={heroSong.name}
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
                    onClick={() => playSong(heroSong, [heroSong])}
                    className="relative overflow-hidden bg-white text-black px-12 py-5 rounded-full font-black text-lg hover:scale-105 active:scale-95 transition-all duration-300 shadow-[0_20px_40px_rgba(255,255,255,0.1)] group flex items-center gap-3 mt-4 hover:shadow-cyan-500/20"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full duration-1000 transition-transform" />
                    <Play size={24} fill="currentColor" /> استمع الآن
                  </button>
                </div>
              )}

              <div className="md:hidden mt-16 w-full max-w-sm px-4">
                <VisitorBadge count={settings.visitorCount} visible={settings.showVisitorCount || isAdmin} />
              </div>
            </div>

            {/* Featured Songs Carousel */}
            <div className="mb-20">
              <div className="flex items-center justify-between mb-8 px-4 md:px-2">
                <h3 className="text-3xl font-black flex items-center gap-3 drop-shadow-md">
                  <Sparkles className="text-yellow-400 animate-pulse" /> مختارات صوتية
                </h3>
                <button onClick={() => setActiveTab('music')} className="text-cyan-400 text-sm font-bold flex items-center gap-1 hover:text-white transition-colors group">
                  عرض الكل <ChevronRight size={16} className="group-hover:-translate-x-1 transition-transform" />
                </button>
              </div>
              <div className="carousel-container flex gap-6 overflow-x-auto no-scrollbar pb-8 px-4 md:px-2 snap-x snap-mandatory">
                {featuredSongs.map(song => (
                  <div
                    key={song.id}
                    onClick={() => playSong(song, featuredSongs)}
                    className="carousel-item flex-shrink-0 w-64 md:w-80 bg-black/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden group cursor-pointer hover:border-cyan-500/50 hover:shadow-[0_15px_30px_rgba(6,182,212,0.15)] transition-all duration-500 snap-center"
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
                <button onClick={() => setActiveTab('diaries')} className="text-cyan-400 text-sm font-bold flex items-center gap-1 hover:text-white transition-colors group">
                  انضم إلينا <ChevronRight size={16} className="group-hover:-translate-x-1 transition-transform" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 md:px-2">
                {latestDiaries.map(post => (
                  <div
                    key={post.id}
                    className="bg-black/40 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] hover:bg-white/5 hover:border-purple-500/30 transition-all duration-500 flex flex-col gap-6 group hover:shadow-[0_10px_30px_rgba(168,85,247,0.1)] relative overflow-hidden"
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

          {/* Music Section */}
          <section className={`${activeTab === 'music' ? 'block' : 'hidden'} animate-fade-in-up`}>
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-16 mt-12 gap-6">
              <h2 className="text-4xl md:text-5xl font-black flex items-center gap-4 drop-shadow-md">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                  <MusicIcon size={32} />
                </div>
                المكتبة الصوتية
              </h2>
            </div>

            {currentFolder ? (
              <div className="space-y-6 animate-fade-in">
                <button
                  onClick={() => setCurrentFolder(null)}
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
                      onClick={() => playSong(song, folders[currentFolder])}
                      className={`flex items-center gap-6 p-4 rounded-3xl cursor-pointer transition-all duration-300 border backdrop-blur-md group ${currentSong?.id === song.id ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_10px_30px_rgba(6,182,212,0.15)] scale-[1.02]' : 'bg-black/40 border-white/5 hover:bg-white/5 hover:border-white/20'}`}
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
                        <div className="flex gap-1.5 items-end h-8 px-4">
                          {[1, 2, 3, 4, 5].map(b => <div key={b} className="w-1.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_#00f2ff]" style={{ height: `${Math.random() * 100}%`, animationDelay: `${b * 0.15}s` }} />)}
                        </div>
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
                    onClick={() => setCurrentFolder(folder)}
                    className="bg-black/40 backdrop-blur-xl border border-white/10 p-8 rounded-[3rem] flex flex-col items-center text-center cursor-pointer hover:-translate-y-2 hover:border-cyan-500/50 transition-all duration-300 group relative overflow-hidden shadow-xl hover:shadow-[0_20px_40px_rgba(6,182,212,0.15)]"
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
                    <span className="text-xs text-white/40">شاركنا لحظاتك المميزة.</span>
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
          <section className={`${activeTab === 'contact' ? 'block' : 'hidden'} animate-fade-in-up`}>
            <div className="max-w-3xl mx-auto bg-black/50 backdrop-blur-2xl border border-white/10 p-8 md:p-16 rounded-[4rem] text-center shadow-[0_20px_60px_rgba(0,0,0,0.8)] mt-12 relative overflow-hidden">
              {/* Background Glows */}
              <div className="absolute top-0 left-0 w-64 h-64 bg-cyan-500/20 blur-[100px] rounded-full pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />

              <div className="w-28 h-28 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-[2.5rem] flex items-center justify-center text-cyan-400 mx-auto mb-10 shadow-[0_0_30px_rgba(6,182,212,0.2)] relative z-10">
                <Mail size={56} />
              </div>
              <h2 className="text-5xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-100 relative z-10 tracking-tight">تواصل مباشر</h2>
              <p className="text-white/50 mb-12 text-xl max-w-lg mx-auto relative z-10">يسعدني دائماً استقبال رسائلكم واستفساراتكم على مدار الساعة.</p>

              <div className="space-y-8 text-right relative z-10">
                <div className="group">
                  <label className="text-sm font-black text-cyan-400 block mb-3 mr-4 uppercase tracking-wider">اسمك الكريم</label>
                  <input
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    placeholder="اكتب اسمك هنا"
                    className="w-full bg-black/40 border border-white/10 p-6 rounded-3xl text-white text-center text-xl focus:ring-2 ring-cyan-500/50 outline-none transition-all group-hover:border-white/20 shadow-inner"
                  />
                </div>
                <div className="group">
                  <label className="text-sm font-black text-cyan-400 block mb-3 mr-4 uppercase tracking-wider">محتوى الرسالة</label>
                  <textarea
                    value={contactMsg}
                    onChange={e => setContactMsg(e.target.value)}
                    placeholder="بماذا تود أن تخبرني؟"
                    rows={6}
                    className="w-full bg-black/40 border border-white/10 p-6 rounded-[2.5rem] text-white resize-none text-center text-xl focus:ring-2 ring-cyan-500/50 outline-none transition-all group-hover:border-white/20 shadow-inner"
                  />
                </div>
                <button
                  onClick={sendMessage}
                  className="w-full py-6 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 rounded-[2.5rem] font-black text-2xl shadow-[0_15px_30px_rgba(6,182,212,0.3)] hover:shadow-[0_20px_40px_rgba(6,182,212,0.5)] hover:-translate-y-1 active:translate-y-1 transition-all mt-8 flex items-center justify-center gap-4 group"
                >
                  <Send size={28} className="group-hover:translate-x-[-8px] transition-transform" /> إرسال الرسالة الآن
                </button>
              </div>

              {/* Hidden Admin Trigger (PRESERVED EXACTLY FOR SECURITY) */}
              <div className="mt-20 opacity-[0.02] hover:opacity-100 transition-opacity duration-1000 relative z-20">
                <button
                  onClick={() => isAdmin ? setShowAdminModal(true) : handleLogin()}
                  className="p-4 rounded-full border border-dashed border-white/20 hover:border-cyan-400 hover:text-cyan-400 hover:shadow-[0_0_20px_cyan] hover:bg-cyan-900/40 transition-all"
                  aria-label="Secure Login"
                >
                  <Fingerprint size={36} className="mx-auto text-white cursor-pointer" />
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

      {/* --- Premium Media Player Bar --- */}
      <div
        onClick={() => setIsPlayerExpanded(true)}
        className={`fixed bottom-[88px] md:bottom-6 left-2 right-2 md:left-4 md:right-6 lg:left-[296px] rounded-2xl md:rounded-[2rem] z-[100] border border-white/10 flex items-center justify-between px-3 md:px-6 shadow-2xl transition-all duration-500 cursor-pointer overflow-visible
          ${isPlaying ? 'shadow-[0_20px_40px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30' : 'shadow-[0_20px_40px_rgba(0,0,0,0.5)] bg-black/40'}
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
              className="absolute top-0 right-0 h-full bg-gradient-to-l from-cyan-400 to-purple-500 shadow-[0_0_10px_#00f2ff] transition-all duration-200"
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
          <button onClick={(e) => prevSong(e)} className="text-white/40 hover:text-white hover:scale-110 transition-all transform active:scale-95 p-1 md:p-2 hidden xs:block" aria-label="السابق"><SkipBack size={20} className="md:w-6 md:h-6" /></button>
          <button
            onClick={(e) => togglePlay(e)}
            className="w-10 h-10 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full bg-white text-black flex items-center justify-center shadow-[0_10px_20px_rgba(255,255,255,0.2)] hover:scale-110 hover:shadow-[0_15px_30px_rgba(255,255,255,0.3)] active:scale-95 transition-all duration-300"
            aria-label="تشغيل/ايقاف"
          >
            {isPlaying ? <Pause size={20} fill="currentColor" className="md:w-6 md:h-6" /> : <Play size={20} fill="currentColor" className="ml-0.5 md:ml-1 md:w-6 md:h-6" />}
          </button>
          <button onClick={(e) => nextSong(e)} className="text-white/40 hover:text-white hover:scale-110 transition-all transform active:scale-95 p-1 md:p-2" aria-label="التالي"><SkipForward size={20} className="md:w-6 md:h-6" /></button>
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
        className={`fixed inset-0 z-[200] flex flex-col transition-transformers duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${isPlayerExpanded ? 'translate-y-0 opacity-100' : 'translate-y-[100%] opacity-0 pointer-events-none'}`}
      >
        <div className="absolute inset-0 bg-black/80 backdrop-blur-[50px] z-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80 z-0" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] md:w-[40vw] md:h-[40vw] bg-cyan-500/20 blur-[100px] rounded-full z-0 opacity-50" />

        {/* Header */}
        <div className="p-8 flex justify-between items-center relative z-10">
          <button
            onClick={() => setIsPlayerExpanded(false)}
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
            <button onClick={(e) => prevSong(e)} className="text-white/30 hover:text-white hover:scale-110 active:scale-95 transition-all p-3 md:p-4"><SkipBack size={32} className="md:w-10 md:h-10" /></button>
            <button
              onClick={(e) => togglePlay(e)}
              className="rounded-full bg-white text-black flex items-center justify-center shadow-[0_20px_50px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all duration-300"
              style={{ width: 'clamp(80px, 15vw, 112px)', height: 'clamp(80px, 15vw, 112px)' }}
            >
              {isPlaying ? <Pause size={40} fill="currentColor" className="md:w-12 md:h-12" /> : <Play size={40} fill="currentColor" className="ml-1 md:ml-2 md:w-12 md:h-12" />}
            </button>
            <button onClick={(e) => nextSong(e)} className="text-white/30 hover:text-white hover:scale-110 active:scale-95 transition-all p-3 md:p-4"><SkipForward size={32} className="md:w-10 md:h-10" /></button>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[88px] pb-4 pt-2 border-t border-white/10 z-[150] flex items-center justify-around px-2 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] bg-black/80 backdrop-blur-3xl">
        <MobNavBtn active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home size={22} />} label="الرئيسية" />
        <MobNavBtn active={activeTab === 'music'} onClick={() => setActiveTab('music')} icon={<MusicIcon size={22} />} label="موسيقى" />
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
                          onChange={e => setSettings({ ...settings, welcome: e.target.value })}
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
                            onChange={e => setSettings({ ...settings, showVisitorCount: e.target.checked })}
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
                              onChange={e => setSettings({ ...settings, heroMode: e.target.checked })}
                            />
                            <div className="w-14 h-7 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                          </label>
                        </div>

                        <div className="space-y-3">
                          <label className="text-xs font-black text-white/40 mr-2">رابط الوسائط (صورة/فيديو)</label>
                          <input
                            value={settings.heroImg}
                            onChange={e => setSettings({ ...settings, heroImg: e.target.value })}
                            placeholder="ضع الرابط هنا"
                            className="w-full bg-black/60 border border-white/10 p-5 rounded-2xl text-lg font-mono"
                          />
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-xs font-black text-white/40 mr-2">نوع الوسائط</label>
                            <select
                              value={settings.heroType}
                              onChange={e => setSettings({ ...settings, heroType: e.target.value as any })}
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
                              onChange={e => setSettings({ ...settings, bgFit: e.target.value as any })}
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
                          if (id && title) {
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
    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-500 group relative overflow-hidden ${active ? 'bg-gradient-to-r from-cyan-500/20 to-transparent text-cyan-400 border-r-4 border-cyan-400 shadow-[10px_0_30px_rgba(6,182,212,0.15)]' : 'text-white/40 hover:bg-white/10 hover:text-white'}`}
  >
    {active && <div className="absolute inset-0 bg-cyan-400/5 blur-xl"></div>}
    <span className={`relative z-10 transition-transform duration-500 ${active ? 'scale-110 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'group-hover:scale-110'}`}>{icon}</span>
    <span className={`relative z-10 font-bold tracking-wide ${active ? 'text-white' : ''}`}>{label}</span>
  </button>
);

const MobNavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1.5 transition-all duration-500 flex-1 relative ${active ? 'text-cyan-400 -translate-y-4' : 'text-white/30 hover:text-white/60'}`}
  >
    <div className={`p-3 rounded-2xl transition-all duration-500 flex items-center justify-center ${active ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_10px_20px_rgba(6,182,212,0.3)] text-black scale-110' : ''}`}>
      {icon}
    </div>
    <span className={`text-[10px] font-black uppercase tracking-widest absolute -bottom-5 transition-all duration-500 ${active ? 'opacity-100 translate-y-0 text-cyan-400' : 'opacity-0 translate-y-2'}`}>{label}</span>
  </button>
);

const AdminNavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 font-bold ${active ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30' : 'text-white/40 hover:bg-white/10 hover:text-white'}`}
  >
    <span className={active ? 'scale-110 transition-transform' : ''}>{icon}</span>
    <span className="hidden md:inline">{label}</span>
  </button>
);

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('PWA Ready!'))
      .catch(err => console.log('PWA Failed', err));
  });
}

export default App;
