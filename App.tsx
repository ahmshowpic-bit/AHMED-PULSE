import React, { useState } from 'react';
import { 
  Zap, 
  Maximize2, 
  SkipBack, 
  Play, 
  Pause, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Mail, 
  Users, 
  Music, 
  Home 
} from 'lucide-react';

export default function App() {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [progress, setProgress] = useState<number>(30);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [isRepeat, setIsRepeat] = useState<boolean>(false);

  return (
    <div className="min-h-screen w-full bg-[#0d0502] text-[#e8b27d] flex flex-col justify-between items-center p-4 font-sans relative overflow-hidden select-none">
      
      {/* محاكاة نسيج الخشب الداكن مع تدرج إضاءة دافئ */}
      <div 
        className="absolute inset-0 opacity-40 pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(0, 0, 0, 0.4) 2px,
              rgba(0, 0, 0, 0.4) 4px
            ),
            radial-gradient(circle at 50% 30%, #4a210d 0%, #0d0502 85%)
          `
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#240e05]/60 via-transparent to-[#080201] pointer-events-none" />

      {/* 1. الهيدر العلوي */}
      <header className="w-full max-w-sm pt-4 flex justify-center items-center z-10">
        <h1 className="text-xl font-extrabold tracking-wider flex items-center gap-1.5 text-[#e58a3a] drop-shadow-[0_2px_10px_rgba(229,138,58,0.3)]">
          AHMED PULSE
          <Zap className="w-5 h-5 fill-[#e58a3a] text-[#e58a3a]" />
        </h1>
      </header>

      {/* 2. المحتوى الرئيسي للمشغل */}
      <main className="w-full max-w-sm flex flex-col items-center my-auto z-10 space-y-5">
        
        {/* اسم الأغنية */}
        <h2 className="text-2xl font-semibold text-[#f7d3b0] tracking-wide text-center">
          Desert Echoes
        </h2>

        {/* غلاف الألبوم (الصورة المدمجة للكاسيت مع اليد) */}
        <div className="relative w-72 h-72 rounded-2xl overflow-hidden shadow-[0_15px_35px_rgba(0,0,0,0.8)] border border-[#e58a3a]/20 group">
          <img 
            src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop" 
            alt="Desert Echoes Album Cover" 
            className="w-full h-full object-cover brightness-90 group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0502]/60 via-transparent to-transparent"></div>
        </div>

        {/* لوحة تحكم المشغل الزجاجية */}
        <div className="w-full bg-[#1c0c06]/75 backdrop-blur-xl border border-[#e58a3a]/25 rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.7)] flex flex-col gap-4">
          
          {/* شريط التقدم (Scrub Bar) */}
          <div 
            className="w-full bg-[#36170a] h-1 rounded-full cursor-pointer relative overflow-hidden group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              setProgress((clickX / rect.width) * 100);
            }}
          >
            <div 
              className="bg-[#e58a3a] h-full rounded-full transition-all duration-100 relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#fff3e0] rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* أزرار التحكم بالترتيب المطبابق للصورة */}
          <div className="flex items-center justify-between px-1 pt-1">
            
            {/* 1. ملء الشاشة / توسيع */}
            <button className="text-[#a8744f] hover:text-[#e58a3a] transition-colors p-1">
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* 2. الأغنية السابقة */}
            <button className="text-[#e58a3a] hover:scale-110 active:scale-95 transition-transform p-1">
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            {/* 3. زر التشغيل/الإيقاف المضيء الدائري */}
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-12 h-12 bg-gradient-to-tr from-[#b85215] via-[#e58a3a] to-[#f7b36a] rounded-full flex items-center justify-center text-[#0d0502] shadow-[0_0_20px_rgba(229,138,58,0.5)] hover:scale-105 active:scale-95 transition-all"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current ml-0.5" />
              )}
            </button>

            {/* 4. الأغنية التالية */}
            <button className="text-[#e58a3a] hover:scale-110 active:scale-95 transition-transform p-1">
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            {/* 5. التشغيل العشوائي */}
            <button 
              onClick={() => setIsShuffle(!isShuffle)}
              className={`p-1 transition-colors ${isShuffle ? 'text-[#e58a3a]' : 'text-[#a8744f] hover:text-[#e58a3a]'}`}
            >
              <Shuffle className="w-4 h-4" />
            </button>

            {/* 6. التكرار */}
            <button 
              onClick={() => setIsRepeat(!isRepeat)}
              className={`p-1 transition-colors ${isRepeat ? 'text-[#e58a3a]' : 'text-[#a8744f] hover:text-[#e58a3a]'}`}
            >
              <Repeat className="w-4 h-4" />
            </button>

          </div>
        </div>
      </main>

      {/* 3. شريط التنقل السفلي */}
      <nav className="w-full max-w-sm bg-[#140804]/90 backdrop-blur-2xl border-t border-[#e58a3a]/15 py-2 px-4 flex justify-between items-center rounded-3xl z-10 shadow-2xl">
        
        {/* البريد/الرسائل */}
        <button 
          onClick={() => setActiveTab('messages')}
          className={`p-2.5 transition-colors rounded-xl ${activeTab === 'messages' ? 'text-[#e58a3a]' : 'text-[#61381f] hover:text-[#a8744f]'}`}
        >
          <Mail className="w-5 h-5" />
        </button>

        {/* المجتمع / المستخدمين */}
        <button 
          onClick={() => setActiveTab('community')}
          className={`p-2.5 transition-colors rounded-xl ${activeTab === 'community' ? 'text-[#e58a3a]' : 'text-[#61381f] hover:text-[#a8744f]'}`}
        >
          <Users className="w-5 h-5" />
        </button>

        {/* الموسيقى */}
        <button 
          onClick={() => setActiveTab('music')}
          className={`p-2.5 transition-colors rounded-xl ${activeTab === 'music' ? 'text-[#e58a3a]' : 'text-[#61381f] hover:text-[#a8744f]'}`}
        >
          <Music className="w-5 h-5" />
        </button>

        {/* زر الرئيسية المضيء */}
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-2xl transition-all ${
            activeTab === 'home' 
              ? 'bg-gradient-to-r from-[#f7b36a] to-[#be5b1c] text-[#0d0502] font-bold shadow-[0_2px_12px_rgba(229,138,58,0.3)]' 
              : 'text-[#61381f]'
          }`}
        >
          <Home className="w-4 h-4 fill-current" />
          <span className="text-xs font-bold dir-rtl">الرئيسية</span>
        </button>
      </nav>

    </div>
  );
}
