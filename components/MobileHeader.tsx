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
        className="justify-self-center text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 tracking-tighter cursor-pointer active:scale-95 transition-transform flex items-center gap-2 drop-shadow-lg"
      >
        {isOffline ? (
          <WifiOff className="text-red-400" size={24} />
        ) : (
          <Zap className="text-cyan-400" size={24} />
        )}
        AHMED PULSE
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
