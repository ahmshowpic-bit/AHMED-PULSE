import React, { useState } from 'react';
import { Fingerprint, Check, Copy } from 'lucide-react';

interface VisitorIdentityProps {
  visitorId: string;
}

// هوية ثابتة لكل زائر: تُعرض له للتوثيق الذاتي، وتُرفق (بشكل غير ظاهر)
// مع اليوميات ورسائل التواصل حتى لو غيّر اسمه المستعار في كل مرة.
const VisitorIdentity: React.FC<VisitorIdentityProps> = ({ visitorId }) => {
  const [copied, setCopied] = useState(false);

  if (!visitorId) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(visitorId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      // نتجاهل بصمت لو الكليبورد غير متاح
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="w-full bg-black/30 hover:bg-white/10 border border-white/10 hover:border-cyan-500/40 p-3 rounded-2xl flex items-center gap-3 transition-all duration-300 text-right group"
      title="نسخ هويتك"
    >
      <div className="text-purple-400 bg-purple-500/10 p-2.5 rounded-xl group-hover:bg-purple-500 group-hover:text-black transition-all flex-shrink-0">
        <Fingerprint size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-0.5">هويتك الرقمية</div>
        <div className="font-mono text-white/80 text-xs font-black truncate">{visitorId}</div>
      </div>
      {copied ? <Check size={14} className="text-cyan-400 flex-shrink-0" /> : <Copy size={14} className="text-white/20 group-hover:text-white/50 flex-shrink-0" />}
    </button>
  );
};

export default React.memo(VisitorIdentity);
