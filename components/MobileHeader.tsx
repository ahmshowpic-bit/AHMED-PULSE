import React from 'react';
import { WifiOff, Zap, Download } from 'lucide-react';

interface MobileHeaderProps {
  isOffline: boolean;
  canInstall: boolean;
  onInstallClick: () => void;
  onLogoClick: () => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({ isOffline, canInstall, onInstallClick, onLogoClick }) => {
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-50 grid grid-cols-3 items-center px-6 py-4 bg-black/40 backdrop-blur-2xl border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
      <div className="justify-self-start" />
      <div
        onClick={onLogoClick}
        className="justify-self-center cursor-pointer active:scale-95 transition-transform flex items-center gap-1.5 drop-shadow-lg min-w-0"
      >
        {isOffline ? (
          <WifiOff className="text-red-400 shrink-0" size={22} />
        ) : (
          <Zap className="text-amber-400 shrink-0" size={22} />
        )}
        <span className="flex items-center gap-[0.15em] text-xl sm:text-2xl font-black tracking-tighter text-amber-400 whitespace-nowrap leading-none">
          <span>A</span>
          <svg
            viewBox="0 0 24 24"
            className="w-[0.55em] h-[0.55em] shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="1,12 5,12 8,4 13,20 16,7 18,12 23,12" />
          </svg>
          <span>PULSE</span>
        </span>
      </div>
      <div className="justify-self-end flex items-center gap-3">
        {canInstall && (
          <button
            onClick={onInstallClick}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-pulse hover:scale-110 transition-transform"
          >
            <Download size={18} />
          </button>
        )}
      </div>
    </header>
  );
};

export default React.memo(MobileHeader);
