import React, { useState } from 'react';
import { Mail, Send, Fingerprint } from 'lucide-react';
import { db, ref, push } from '../firebase';

interface ContactSectionProps {
  active: boolean;
  isOffline: boolean;
  isAdmin: boolean;
  onSecureClick: () => void;
  visitorId: string;
}

const ContactSection: React.FC<ContactSectionProps> = ({ active, isOffline, isAdmin, onSecureClick, visitorId }) => {
  const [contactName, setContactName] = useState('');
  const [contactMsg, setContactMsg] = useState('');

  const sendMessage = () => {
    if (!contactMsg.trim()) return;
    const msgData = { name: contactName || "مجهول", msg: contactMsg, visitorId };

    if (isOffline) {
      alert("أنت تتصفح أوفلاين. تم حفظ رسالتك وسيتم إرسالها عند الاتصال بالإنترنت.");
      const queue = JSON.parse(localStorage.getItem('offline_msgs_queue') || '[]');
      queue.push(msgData);
      localStorage.setItem('offline_msgs_queue', JSON.stringify(queue));
      setContactMsg('');
      setContactName('');
      return;
    }

    push(ref(db, 'inbox'), msgData).then(() => {
      setContactMsg('');
      setContactName('');
      alert("تم الإرسال بنجاح!");
    }).catch(() => {
      alert("حدث خطأ أثناء الإرسال.");
    });
  };

  return (
    <section className={`${active ? 'block' : 'hidden'} animate-fade-in-up`}>
      <div className="max-w-3xl mx-auto bg-black/50 backdrop-blur-2xl border border-white/10 p-8 md:p-16 rounded-[4rem] text-center shadow-[0_20px_60px_rgba(0,0,0,0.8)] mt-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-cyan-500/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="w-28 h-28 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-[2.5rem] flex items-center justify-center text-cyan-400 mx-auto mb-10 shadow-[0_0_30px_rgba(245,158,11,0.2)] relative z-10">
          <Mail size={56} />
        </div>
        <h2 className="text-5xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-100 relative z-10 tracking-tight">تواصل مباشر</h2>
        <p className="text-white/50 mb-12 text-xl max-w-lg mx-auto relative z-10">يسعدني دائماً استقبال رسائلكم واستفساراتكم على مدار الساعة.</p>

        <div className="space-y-8 text-right relative z-10">
          <div className="group">
            <label className="text-sm font-black text-cyan-400 block mb-3 mr-4 uppercase tracking-wider">اسمك الكريم</label>
            <input
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="اكتب اسمك هنا"
              className="w-full bg-black/40 border border-white/10 p-6 rounded-3xl text-white text-center text-xl focus:ring-2 ring-cyan-500/50 outline-none transition-all group-hover:border-white/20 shadow-inner"
            />
          </div>
          <div className="group">
            <label className="text-sm font-black text-cyan-400 block mb-3 mr-4 uppercase tracking-wider">محتوى الرسالة</label>
            <textarea
              value={contactMsg}
              onChange={e => setContactMsg(e.target.value)}
              placeholder="بماذا تود أن تخبرني؟"
              rows={6}
              className="w-full bg-black/40 border border-white/10 p-6 rounded-[2.5rem] text-white resize-none text-center text-xl focus:ring-2 ring-cyan-500/50 outline-none transition-all group-hover:border-white/20 shadow-inner"
            />
          </div>
          <button
            onClick={sendMessage}
            className="w-full py-6 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 rounded-[2.5rem] font-black text-2xl shadow-[0_15px_30px_rgba(245,158,11,0.3)] hover:shadow-[0_20px_40px_rgba(245,158,11,0.5)] hover:-translate-y-1 active:translate-y-1 transition-all mt-8 flex items-center justify-center gap-4 group"
          >
            <Send size={28} className="group-hover:translate-x-[-8px] transition-transform" /> إرسال  
          </button>
        </div>

        {/* Hidden Admin Trigger (PRESERVED EXACTLY FOR SECURITY) */}
        <div className="mt-20 opacity-[0.02] hover:opacity-100 transition-opacity duration-1000 relative z-20">
          <button
            onClick={onSecureClick}
            className="p-4 rounded-full border border-dashed border-white/20 hover:border-cyan-400 hover:text-cyan-400 hover:shadow-[0_0_20px_cyan] hover:bg-cyan-900/40 transition-all"
            aria-label="Secure Login"
          >
            <Fingerprint size={36} className="mx-auto text-white cursor-pointer" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default React.memo(ContactSection);
