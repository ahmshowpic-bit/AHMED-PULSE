import React from 'react';
import { Users } from 'lucide-react';

interface VisitorBadgeProps {
  count: number;
  visible: boolean;
}

// Components defined outside for better performance
const VisitorBadge: React.FC<VisitorBadgeProps> = ({ count, visible }) => {
  if (!visible) return null;
  return (
    <div className="visitor-box bg-black/40 backdrop-blur-xl border border-white/10 p-4 rounded-2xl flex items-center gap-4 transition-all duration-500 hover:bg-white/10 hover:border-cyan-500/50 group shadow-2xl">
      <div className="text-cyan-400 bg-cyan-500/10 p-3 rounded-xl group-hover:scale-110 group-hover:bg-cyan-500 group-hover:text-black transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)]">
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

// مغلف بـ React.memo: لا يعيد رسم نفسه إلا لو تغيّر العدد أو الظهور فعلاً
export default React.memo(VisitorBadge);
