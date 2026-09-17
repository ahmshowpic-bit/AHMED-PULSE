import React from 'react';
import { Home, Music as MusicIcon, Users, Mail } from 'lucide-react';
import { TabId } from '../types';

const MobNavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1.5 transition-all duration-500 flex-1 relative ${active ? 'text-cyan-400 -translate-y-4' : 'text-white/30 hover:text-white/60'}`}
  >
    <div className={`p-3 rounded-2xl transition-all duration-500 flex items-center justify-center ${active ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_10px_20px_rgba(245,158,11,0.3)] text-black scale-110' : ''}`}>
      {icon}
    </div>
    <span className={`text-[10px] font-black uppercase tracking-widest absolute -bottom-5 transition-all duration-500 ${active ? 'opacity-100 translate-y-0 text-cyan-400' : 'opacity-0 translate-y-2'}`}>{label}</span>
  </button>
);

interface MobileNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const MobileNav: React.FC<MobileNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[88px] pb-4 pt-2 border-t border-white/10 z-[150] flex items-center justify-around px-2 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] bg-black/80 backdrop-blur-3xl">
      <MobNavBtn active={activeTab === 'home'} onClick={() => onTabChange('home')} icon={<Home size={22} />} label="الرئيسية" />
      <MobNavBtn active={activeTab === 'music'} onClick={() => onTabChange('music')} icon={<MusicIcon size={22} />} label="موسيقى" />
      <MobNavBtn active={activeTab === 'diaries'} onClick={() => onTabChange('diaries')} icon={<Users />} label="المجتمع" />
      <MobNavBtn active={activeTab === 'contact'} onClick={() => onTabChange('contact')} icon={<Mail />} label="اتصل" />
    </nav>
  );
};

export default React.memo(MobileNav);
