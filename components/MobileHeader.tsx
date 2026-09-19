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
        className="justify-self-center cursor-pointer active:scale-95 transition-transform flex items-center gap-2 drop-shadow-lg"
      >
        {isOffline ? (
          <WifiOff className="text-red-400" size={24} />
        ) : (
          <Zap className="text-amber-400" size={24} />
        )}
        <svg
          viewBox="0 0 132 30"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: 'clamp(96px, 32vw, 150px)', height: 'auto' }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="apulse-logo-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fcd34d" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <text
            x="0"
            y="23"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="900"
            fontSize="24"
            fill="url(#apulse-logo-gradient)"
            letterSpacing="-0.5"
          >
            A
          </text>
          <polyline
            points="20,15 27,15 30,6 35,24 39,10 43,15 51,15"
            fill="none"
            stroke="url(#apulse-logo-gradient)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <text
            x="55"
            y="23"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="900"
            fontSize="24"
            fill="url(#apulse-logo-gradient)"
            letterSpacing="-0.5"
          >
            PULSE
          </text>
        </svg>
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
