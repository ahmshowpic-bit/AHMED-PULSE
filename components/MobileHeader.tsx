import React from 'react';
import { WifiOff, Download } from 'lucide-react';

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
        dir="ltr"
        className="justify-self-center cursor-pointer active:scale-95 transition-transform flex items-center min-w-0"
      >
        {/* 3D flip stage: front face = logo mark, back face = offline (WifiOff) mark */}
        <div
          className="shrink-0"
          style={{ perspective: '400px', width: 100, height: 60 }}
        >
          <div
            className="relative w-full h-full transition-transform duration-700"
            style={{
              transformStyle: 'preserve-3d',
              transform: isOffline ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Front face — normal "A PULSE" mark */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <svg
                width="100"
                height="60"
                viewBox="0 0 86 52"
                xmlns="http://www.w3.org/2000/svg"
                className="drop-shadow-[0_0_10px_rgba(251,191,36,0.55)]"
              >
                <defs>
                  <linearGradient id="apulse-mark-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fde68a" />
                    <stop offset="45%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#c2410c" />
                  </linearGradient>
                </defs>
                <text
                  x="43"
                  y="34"
                  textAnchor="middle"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontWeight="900"
                  fontSize="38"
                  fill="url(#apulse-mark-gradient)"
                >
                  A
                </text>
                <polyline
                  points="20,22 27,22 30,15 35,29 39,18 43,22 47,15 51,29 55,18 59,22 66,22"
                  fill="none"
                  stroke="#1c1006"
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <text
                  x="43"
                  y="47"
                  textAnchor="middle"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontWeight="700"
                  fontSize="11"
                  letterSpacing="3"
                  fill="url(#apulse-mark-gradient)"
                >
                  PULSE
                </text>
              </svg>
            </div>

            {/* Back face — offline mark, revealed once the flip passes 90deg */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <div className="flex flex-col items-center gap-0.5">
                <WifiOff
                  className="text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.6)] animate-pulse"
                  size={30}
                />
                <span
                  className="text-red-400 font-bold tracking-[3px]"
                  style={{ fontSize: 10 }}
                >
                  PULSE
                </span>
              </div>
            </div>
          </div>
        </div>
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
