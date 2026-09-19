import React from 'react';
import { Home, Music as MusicIcon, Users, Mail, WifiOff, Zap, MoreHorizontal } from 'lucide-react';
import { CustomPage, TabId } from '../types';
import VisitorBadge from './VisitorBadge';
import VisitorIdentity from './VisitorIdentity';

const SidebarBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-500 group relative overflow-hidden ${active ? 'bg-gradient-to-r from-cyan-500/20 to-transparent text-cyan-400 border-r-4 border-cyan-400 shadow-[10px_0_30px_rgba(245,158,11,0.15)]' : 'text-white/40 hover:bg-white/10 hover:text-white'}`}
  >
    {active && <div className="absolute inset-0 bg-cyan-400/5 blur-xl"></div>}
    <span className={`relative z-10 transition-transform duration-500 ${active ? 'scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'group-hover:scale-110'}`}>{icon}</span>
    <span className={`relative z-10 font-bold tracking-wide ${active ? 'text-white' : ''}`}>{label}</span>
  </button>
);

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  customPages: CustomPage[];
  isOffline: boolean;
  visitorCount: number;
  showVisitorCount: boolean;
  visitorId: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab, onTabChange, customPages, isOffline,
  visitorCount, showVisitorCount, visitorId
}) => {
  return (
    <aside className="hidden md:flex w-[280px] bg-black/40 backdrop-blur-2xl border-l border-white/5 z-50 flex-col p-8 transition-all shadow-[-20px_0_40px_rgba(0,0,0,0.5)] relative">
      {/* Glow effect */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-cyan-500/10 blur-[50px] pointer-events-none" />

      <div className="mb-12 cursor-pointer relative z-10 flex items-center gap-3" onClick={() => onTabChange('home')}>
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_10px_20px_rgba(245,158,11,0.3)]">
          {isOffline ? (
            <WifiOff size={24} className="text-white" />
          ) : (
            <Zap size={24} className="text-white" />
          )}
        </div>
        <h1 className="text-3xl font-black bg-gradient-to-br from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent tracking-tighter hover:scale-105 origin-left transition-transform drop-shadow-md">
          PULSE
        </h1>
      </div>

      <div className="mb-4">
        <VisitorBadge count={visitorCount} visible={showVisitorCount} />
      </div>
      <div className="mb-8">
        <VisitorIdentity visitorId={visitorId} />
      </div>

      <nav className="flex-1 space-y-2">
        <SidebarBtn active={activeTab === 'home'} onClick={() => onTabChange('home')} icon={<Home />} label="الرئيسية" />
        <SidebarBtn active={activeTab === 'music'} onClick={() => onTabChange('music')} icon={<MusicIcon />} label="الصوتيات" />
        <SidebarBtn active={activeTab === 'diaries'} onClick={() => onTabChange('diaries')} icon={<Users />} label="المجتمع" />
        <SidebarBtn active={activeTab === 'contact'} onClick={() => onTabChange('contact')} icon={<Mail />} label="تواصل معي" />

        {customPages.map(page => (
          <SidebarBtn
            key={page.id}
            active={activeTab === page.id}
            onClick={() => onTabChange(page.id as TabId)}
            icon={<MoreHorizontal />}
            label={page.title}
          />
        ))}
      </nav>
    </aside>
  );
};

// مغلف بـ React.memo: يعيد الرسم فقط لو تغيّرت الخصائص الفعلية
// (تبديل تبويب...)، وليس مع كل نبضة تشغيل أغنية.
export default React.memo(Sidebar);
