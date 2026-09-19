import React from 'react';
import { WifiOff, Download, Shield } from 'lucide-react';

interface MobileHeaderProps {
  isOffline: boolean;
  canInstall: boolean;
  onInstallClick: () => void;
  isAdmin: boolean;
  onOpenAdmin: () => void;
  onLogoClick: () => void;
}

/**
 * AHMED PULSE Logo
 * 
 * حرف A هندسي بداخله نبضة صوتية
 * وتحت الحرف كلمة PULSE فقط.
 */
const AhmedPulseLogo: React.FC = () => {
  return (
    <div
      className="
        flex flex-col items-center justify-center
        cursor-pointer
        select-none
        active:scale-95
        transition-transform duration-200
      "
      aria-label="AHMED PULSE"
    >
      {/* Logo Mark */}
      <div className="relative w-[58px] h-[52px] flex items-center justify-center">

        <svg
          viewBox="0 0 100 90"
          className="
            w-full h-full
            overflow-visible
            drop-shadow-[0_0_10px_rgba(245,158,11,0.55)]
          "
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Main orange gradient */}
            <linearGradient
              id="pulseLogoGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#FFD166" />
              <stop offset="45%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EA580C" />
            </linearGradient>

            {/* Glow */}
            <filter
              id="pulseLogoGlow"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur
                stdDeviation="2.5"
                result="blur"
              />

              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Geometric A */}
          <path
            d="
              M 16 78
              L 39 12
              Q 42 5 50 5
              Q 58 5 61 12
              L 84 78
              L 66 78
              L 60 59
              L 40 59
              L 34 78
              Z
            "
            fill="url(#pulseLogoGradient)"
            filter="url(#pulseLogoGlow)"
          />

          {/* Inner cutout of A */}
          <path
            d="
              M 45 44
              L 55 44
              L 50 26
              Z
            "
            fill="#0b0907"
          />

          {/* Heartbeat / Pulse line */}
          <path
            d="
              M 23 45
              L 34 45
              L 39 45
              L 43 35
              L 47 56
              L 52 24
              L 57 54
              L 61 40
              L 65 45
              L 77 45
            "
            fill="none"
            stroke="#0b0907"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Small orange highlight on pulse */}
          <path
            d="
              M 23 45
              L 34 45
              L 39 45
            "
            fill="none"
            stroke="#FFD166"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          <path
            d="
              M 61 40
              L 65 45
              L 77 45
            "
            fill="none"
            stroke="#FFD166"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* PULSE */}
      <span
        className="
          -mt-1
          text-[12px]
          font-extrabold
          tracking-[0.32em]
          pl-[0.32em]
          leading-none
          bg-gradient-to-r
          from-amber-300
          via-amber-500
          to-orange-500
          bg-clip-text
          text-transparent
          drop-shadow-[0_0_7px_rgba(245,158,11,0.45)]
        "
      >
        PULSE
      </span>
    </div>
  );
};

const MobileHeader: React.FC<MobileHeaderProps> = ({
  isOffline,
  canInstall,
  onInstallClick,
  isAdmin,
  onOpenAdmin,
  onLogoClick,
}) => {
  return (
    <header
      className="
        md:hidden
        fixed
        top-0
        left-0
        right-0
        z-50
        grid
        grid-cols-3
        items-center
        px-6
        py-3
        bg-black/40
        backdrop-blur-2xl
        border-b
        border-white/10
        shadow-[0_10px_30px_rgba(0,0,0,0.5)]
      "
    >

      {/* Left side */}
      <div className="justify-self-start" />

      {/* Center Logo */}
      <div
        onClick={onLogoClick}
        className="justify-self-center"
      >
        <AhmedPulseLogo />
      </div>

      {/* Right side */}
      <div className="justify-self-end flex items-center gap-3">

        {/* Offline indicator */}
        {isOffline && (
          <div
            className="
              flex
              items-center
              justify-center
              w-10
              h-10
              rounded-full
              bg-red-500/10
              border
              border-red-500/30
              shadow-[0_0_12px_rgba(239,68,68,0.2)]
            "
            title="Offline"
          >
            <WifiOff
              className="text-red-400"
              size={18}
            />
          </div>
        )}

        {/* Install button */}
        {canInstall && (
          <button
            onClick={onInstallClick}
            aria-label="Install app"
            className="
              flex
              items-center
              justify-center
              w-10
              h-10
              rounded-full
              bg-gradient-to-r
              from-amber-500
              to-orange-500
              text-black
              shadow-[0_0_18px_rgba(245,158,11,0.45)]
              hover:scale-110
              active:scale-95
              transition-transform
            "
          >
            <Download size={18} />
          </button>
        )}

        {/* Admin button */}
        {isAdmin && (
          <button
            onClick={onOpenAdmin}
            aria-label="Admin"
            className="
              w-10
              h-10
              rounded-full
              bg-amber-500/10
              border
              border-amber-500/30
              flex
              items-center
              justify-center
              text-amber-400
              shadow-[0_0_12px_rgba(245,158,11,0.2)]
              hover:bg-amber-500
              hover:text-black
              transition-all
            "
          >
            <Shield size={20} />
          </button>
        )}

      </div>
    </header>
  );
};

export default React.memo(MobileHeader);
