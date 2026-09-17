import React, { useState } from 'react';
import { Users, Sparkles, Send, CheckCircle, Heart, Trash2 } from 'lucide-react';
import { DiaryPost } from '../types';
import { db, ref, push, remove, runTransaction } from '../firebase';

interface DiariesSectionProps {
  active: boolean;
  diaries: DiaryPost[];
  hasMoreDiaries: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  isAdmin: boolean;
  isOffline: boolean;
  visitorId: string;
  onOptimisticAdd: (post: DiaryPost) => void;
}

const DiariesSection: React.FC<DiariesSectionProps> = ({
  active, diaries, hasMoreDiaries, loadingMore, onLoadMore, isAdmin, isOffline, visitorId, onOptimisticAdd
}) => {
  // اتنقلت هنا من الكومبوننت الرئيسي: الكتابة في الحقول دي دلوقتي
  // بتعيد رسم القسم ده بس، مش الموقع كله
  const [diaryName, setDiaryName] = useState('');
  const [diaryMsg, setDiaryMsg] = useState('');

  const postDiaryEntry = () => {
    if (!diaryMsg.trim()) return;
    const postData: any = {
      name: (isAdmin && confirm("نشر كمسؤول؟")) ? "AHMED PULSE" : (diaryName || "مجهول"),
      text: diaryMsg,
      verified: isAdmin,
      date: new Date().toLocaleDateString('ar-EG'),
      likes: 0,
      visitorId,
    };

    if (isOffline) {
      alert("أنت تتصفح أوفلاين. تم حفظ اليومية وسيتم نشرها عند الاتصال بالإنترنت.");
      const queue = JSON.parse(localStorage.getItem('offline_diaries_queue') || '[]');
      queue.push(postData);
      localStorage.setItem('offline_diaries_queue', JSON.stringify(queue));
      onOptimisticAdd({ id: 'offline-' + Date.now(), ...postData });
      setDiaryMsg('');
      return;
    }

    push(ref(db, 'diaries'), postData).catch(() => {
      alert("فشل النشر. يرجى التأكد من صلاحيات قاعدة البيانات.");
    });
    setDiaryMsg('');
  };

  const likePost = (id: string) => {
    const postRef = ref(db, `diaries/${id}/likes`);
    runTransaction(postRef, (likes) => (likes || 0) + 1).catch((err: any) => {
      console.warn("Like failed:", err.message);
    });
  };

  return (
    <section className={`${active ? 'block' : 'hidden'}`}>
      <h2 className="text-4xl font-black mb-12 mt-8 flex items-center gap-4">
        <Users className="text-cyan-400" size={36} /> المجتمع الرقمي
      </h2>

      <div className="glass border border-white/10 p-8 rounded-[3rem] mb-12 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-500/10 blur-[60px] rounded-full" />
        <div className="relative z-10">
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <input
              value={diaryName}
              onChange={e => setDiaryName(e.target.value)}
              placeholder="اسمك المستعار"
              className="bg-black/40 border border-white/10 p-5 rounded-2xl text-white placeholder:text-white/20 font-bold"
              maxLength={20}
            />
            <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/5">
              <Sparkles size={20} className="text-yellow-400" />
              <span className="text-xs text-white/40">شاركنا لحظاتك المميزة.</span>
            </div>
          </div>
          <textarea
            value={diaryMsg}
            onChange={e => setDiaryMsg(e.target.value)}
            placeholder="ما الذي يدور في ذهنك اليوم؟"
            rows={4}
            className="w-full bg-black/40 border border-white/10 p-6 rounded-[2rem] mb-6 text-white placeholder:text-white/20 resize-none text-lg leading-relaxed"
          />
          <button
            onClick={postDiaryEntry}
            className="w-full md:w-auto px-12 py-5 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full font-black text-lg shadow-2xl shadow-cyan-500/20 hover:scale-[1.05] active:scale-95 transition-all flex items-center justify-center gap-3 float-left"
          >
            نشر الآن <Send size={20} />
          </button>
          <div className="clear-both" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {diaries.length === 0 && <div className="text-center text-white/20 py-20 text-xl font-bold">المجتمع بانتظار مشاركتك الأولى...</div>}
        {diaries.map(post => (
          <div
            key={post.id}
            className={`rounded-[2.5rem] border border-white/10 overflow-hidden shadow-xl transition-all hover:border-white/20 ${post.verified ? 'bg-gradient-to-br from-cyan-900/20 to-black/40 border-cyan-500/30 ring-1 ring-cyan-500/10' : 'bg-white/5'}`}
          >
            <div className="flex items-center gap-4 p-6 bg-black/30 backdrop-blur-md">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-black text-xl text-white shadow-xl">
                {post.name[0]}
              </div>
              <div className="flex-1">
                <div className="font-black text-lg flex items-center gap-2">
                  {post.name} {post.verified && <span className="flex items-center gap-1 text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded-full border border-cyan-500/30 uppercase tracking-tighter font-black"><CheckCircle size={10} /> Verified Agent</span>}
                </div>
                <div className="text-xs text-white/30 font-medium">{post.date}</div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => remove(ref(db, `diaries/${post.id}`)).catch(e => console.error(e))}
                  className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
            <div className="p-8 text-white/80 text-lg leading-relaxed whitespace-pre-wrap">{post.text}</div>
            <div className="p-4 bg-black/10 border-t border-white/5 px-8 flex justify-between items-center">
              <button
                onClick={() => likePost(post.id)}
                className={`flex items-center gap-2 transition-all font-black py-2 px-4 rounded-full ${post.likes > 0 ? 'bg-red-500/10 text-red-500' : 'text-white/20 hover:text-white hover:bg-white/5'}`}
              >
                <Heart size={20} fill={post.likes > 0 ? "currentColor" : "none"} /> {post.likes || 0}
              </button>
              <div className="text-[10px] uppercase tracking-widest text-white/10 font-black">Ahmed Pulse community</div>
            </div>
          </div>
        ))}
        {hasMoreDiaries && (
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="w-full py-5 rounded-[2rem] bg-white/5 border border-white/10 text-white/60 font-black hover:bg-white/10 hover:text-white transition-all disabled:opacity-40"
          >
            {loadingMore ? 'جاري التحميل...' : 'تحميل يوميات أقدم'}
          </button>
        )}
      </div>
    </section>
  );
};

export default React.memo(DiariesSection);
