import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  db,
  ref, onValue, push, runTransaction,
  query, limitToLast, orderByKey, endBefore, get
} from './firebase';
import { Song, DiaryPost, CustomPage, AppSettings, TabId } from './types';
import { useVisitorId } from './hooks/useVisitorId';

import Sidebar from './components/Sidebar';
import MobileHeader from './components/MobileHeader';
import MobileNav from './components/MobileNav';
import HomeSection from './components/HomeSection';
import MusicSection from './components/MusicSection';
import DiariesSection from './components/DiariesSection';
import ContactSection from './components/ContactSection';
import CustomPages from './components/CustomPages';
import PlayerBar from './components/PlayerBar';

// حجم الدفعة الواحدة عند التحميل (توفير باقة الزائر)
const PAGE_SIZE = 20;

const App: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showOnlineMsg, setShowOnlineMsg] = useState(false);

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
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);

  // Audio State — يفضل هنا لأن قسمَي "الرئيسية" و"المكتبة" محتاجين
  // currentSong لتمييز الأغنية الشغالة، لكن "progress" (اللي كانت بتتحدث
  // عدة مرات في الثانية) اتنقلت بالكامل جوه PlayerBar فمبقتش بتأثر هنا خالص.
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Pagination State (توفير بيانات الزائر)
  const [hasMoreSongs, setHasMoreSongs] = useState(false);
  const [hasMoreDiaries, setHasMoreDiaries] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // هوية الزائر (جديد)
  const visitorId = useVisitorId();

  // Calculate Hero Song (The default song selected by admin)
  const heroSong = useMemo(() => songs.find(s => s.id === settings.defaultSongId), [songs, settings.defaultSongId]);

  // تحميل دفعة أقدم من الأغاني عند الطلب فقط
  const loadMoreSongs = async () => {
    if (loadingMore || songs.length === 0) return;
    setLoadingMore(true);
    try {
      const oldestKey = songs[0].id;
      const snap = await get(query(ref(db, 'music'), orderByKey(), endBefore(oldestKey), limitToLast(PAGE_SIZE)));
      const older: Song[] = [];
      snap.forEach((child) => { older.push({ id: child.key!, ...child.val() }); });
      if (older.length === 0) { setHasMoreSongs(false); }
      else {
        setSongs(prev => [...older, ...prev]);
        setHasMoreSongs(older.length >= PAGE_SIZE);
      }
    } catch (e) { console.warn("Load more songs failed", e); }
    setLoadingMore(false);
  };

  // تحميل دفعة أقدم من اليوميات عند الطلب فقط
  const loadMoreDiaries = async () => {
    if (loadingMore || diaries.length === 0) return;
    setLoadingMore(true);
    try {
      const oldestKey = diaries[diaries.length - 1].id;
      const snap = await get(query(ref(db, 'diaries'), orderByKey(), endBefore(oldestKey), limitToLast(PAGE_SIZE)));
      const older: DiaryPost[] = [];
      snap.forEach((child) => { older.push({ id: child.key!, ...child.val() }); });
      if (older.length === 0) { setHasMoreDiaries(false); }
      else {
        setDiaries(prev => [...prev, ...older.reverse()]);
        setHasMoreDiaries(older.length >= PAGE_SIZE);
      }
    } catch (e) { console.warn("Load more diaries failed", e); }
    setLoadingMore(false);
  };

  // Online / Offline detection
  useEffect(() => {
    const goOffline = () => window.setTimeout(() => setIsOffline(true), 100);
    const goOnline = () => {
      setIsOffline(false);
      setShowOnlineMsg(true);
      setTimeout(() => setShowOnlineMsg(false), 2000);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // Synchronize Offline Queues
  useEffect(() => {
    if (!isOffline) {
      setTimeout(() => {
        try {
          const offlineDiaries = JSON.parse(localStorage.getItem('offline_diaries_queue') || '[]');
          if (offlineDiaries.length > 0) {
            offlineDiaries.forEach((post: any) => push(ref(db, 'diaries'), post));
            localStorage.removeItem('offline_diaries_queue');
          }

          const offlineMsgs = JSON.parse(localStorage.getItem('offline_msgs_queue') || '[]');
          if (offlineMsgs.length > 0) {
            offlineMsgs.forEach((msg: any) => push(ref(db, 'inbox'), msg));
            localStorage.removeItem('offline_msgs_queue');
          }
        } catch (e) {
          console.warn("Error syncing offline queues:", e);
        }
      }, 3000);
    }
  }, [isOffline]);

  // Install Prompt Listener
  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  // Firebase Listeners
  useEffect(() => {
    try {
      const cachedSettings = localStorage.getItem('pulse_settings');
      if (cachedSettings) setSettings(prev => ({ ...prev, ...JSON.parse(cachedSettings) }));

      const cachedMusic = localStorage.getItem('pulse_music');
      if (cachedMusic) setSongs(JSON.parse(cachedMusic));

      const cachedDiaries = localStorage.getItem('pulse_diaries');
      if (cachedDiaries) setDiaries(JSON.parse(cachedDiaries));

      const cachedPages = localStorage.getItem('pulse_pages');
      if (cachedPages) setCustomPages(JSON.parse(cachedPages));
    } catch (e) { console.warn("Error loading cache", e); }

    const unsubSettings = onValue(ref(db, 'settings'), (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setSettings(prev => ({ ...prev, ...val }));
        localStorage.setItem('pulse_settings', JSON.stringify(val));
      }
    }, (error) => console.warn("Settings access restricted:", error.message));

    if (!sessionStorage.getItem('visited')) {
      const vRef = ref(db, 'settings/visitorCount');
      runTransaction(vRef, (current) => (current || 0) + 1).catch(() => {
        console.warn("Visitor count update failed.");
      });
      sessionStorage.setItem('visited', 'true');
    }

    const unsubMusic = onValue(query(ref(db, 'music'), orderByKey(), limitToLast(PAGE_SIZE)), (snap) => {
      const data: Song[] = [];
      snap.forEach((child) => { data.push({ id: child.key!, ...child.val() }); });
      setSongs(data);
      setHasMoreSongs(data.length >= PAGE_SIZE);
      localStorage.setItem('pulse_music', JSON.stringify(data));
    }, (error) => console.warn("Music access restricted:", error.message));

    const unsubDiaries = onValue(query(ref(db, 'diaries'), orderByKey(), limitToLast(PAGE_SIZE)), (snap) => {
      const data: DiaryPost[] = [];
      snap.forEach((child) => { data.push({ id: child.key!, ...child.val() }); });
      const reversed = data.reverse();
      setDiaries(reversed);
      setHasMoreDiaries(data.length >= PAGE_SIZE);
      localStorage.setItem('pulse_diaries', JSON.stringify(reversed));
    }, (error) => console.warn("Diaries access restricted:", error.message));

    get(ref(db, 'custom_pages')).then((snap) => {
      const data: CustomPage[] = [];
      snap.forEach((child) => { data.push({ id: child.key!, ...child.val() }); });
      setCustomPages(data);
      localStorage.setItem('pulse_pages', JSON.stringify(data));
    }).catch((error) => console.warn("Pages access restricted:", error.message));

    return () => {
      unsubSettings();
      unsubMusic();
      unsubDiaries();
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

  const togglePlay = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, songs]);

  const playSong = useCallback((song: Song, list: Song[]) => {
    if (!audioRef.current) return;
    setCurrentSong(song);
    setPlaylist(list);
    audioRef.current.src = song.url;
    audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong, isPlaying]);

  const nextSong = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentSong || playlist.length === 0) return;
    const currentIndex = playlist.findIndex(s => s.id === currentSong.id);
    const nextIndex = (currentIndex + 1) % playlist.length;
    playSong(playlist[nextIndex], playlist);
  }, [currentSong, playlist, playSong]);

  const prevSong = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentSong || playlist.length === 0) return;
    const currentIndex = playlist.findIndex(s => s.id === currentSong.id);
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playSong(playlist[prevIndex], playlist);
  }, [currentSong, playlist, playSong]);

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

  const featuredSongs = useMemo(() => songs.slice(0, 5), [songs]);
  const latestDiaries = useMemo(() => diaries.slice(0, 6), [diaries]);

  // Actions
  const addOptimisticDiary = useCallback((post: DiaryPost) => {
    setDiaries(prev => [post, ...prev]);
  }, []);

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
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#3d2410]/85 via-[#1a0f05]/20 to-black/10 pointer-events-none" />

      <MobileHeader
        isOffline={isOffline}
        canInstall={!!deferredPrompt}
        onInstallClick={handleInstallClick}
        onLogoClick={() => setActiveTab('home')}
      />

      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        customPages={customPages}
        isOffline={isOffline}
        visitorCount={settings.visitorCount}
        showVisitorCount={!!settings.showVisitorCount}
        visitorId={visitorId}
      />

      {/* Main Content */}
      <main className="flex-1 h-full relative z-10 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 md:px-12 pt-20 md:pt-8 pb-40 scroll-smooth no-scrollbar">
        <div className="max-w-6xl mx-auto">
          <HomeSection
            active={activeTab === 'home'}
            welcome={settings.welcome}
            heroSong={heroSong}
            featuredSongs={featuredSongs}
            latestDiaries={latestDiaries}
            onPlaySong={playSong}
            onGoToTab={setActiveTab}
            visitorCount={settings.visitorCount}
            showVisitorCount={!!settings.showVisitorCount}
            visitorId={visitorId}
          />

          <MusicSection
            active={activeTab === 'music'}
            folders={folders}
            currentFolder={currentFolder}
            onSelectFolder={setCurrentFolder}
            currentSong={currentSong}
            onPlaySong={playSong}
            hasMoreSongs={hasMoreSongs}
            loadingMore={loadingMore}
            onLoadMore={loadMoreSongs}
          />

          <DiariesSection
            active={activeTab === 'diaries'}
            diaries={diaries}
            hasMoreDiaries={hasMoreDiaries}
            loadingMore={loadingMore}
            onLoadMore={loadMoreDiaries}
            isOffline={isOffline}
            visitorId={visitorId}
            onOptimisticAdd={addOptimisticDiary}
          />

          <ContactSection
            active={activeTab === 'contact'}
            isOffline={isOffline}
            visitorId={visitorId}
          />

          <CustomPages activeTab={activeTab} customPages={customPages} />
        </div>
      </main>

      <PlayerBar
        currentSong={currentSong}
        isPlaying={isPlaying}
        audioRef={audioRef}
        onTogglePlay={togglePlay}
        onNext={nextSong}
        onPrev={prevSong}
      />

      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Audio Element */}
      <audio
        ref={audioRef}
        onEnded={nextSong}
        autoPlay={false}
      />
    </div>
  );
};

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('PWA Ready!'))
      .catch(err => console.log('PWA Failed', err));
  });
}

export default App;
