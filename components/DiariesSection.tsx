import React, { useState, useCallback, useMemo, useEffect, useSyncExternalStore } from 'react';
import { Users, Sparkles, Send, CheckCircle, Heart, Trash2, MessageCircle, ChevronDown, ChevronUp, ShieldCheck, UserRound, Pencil } from 'lucide-react';
import { DiaryPost } from '../types';
import { db, ref, push, set, remove, runTransaction } from '../firebase';

/**
 * ملاحظة: النوعان أدناه يوسّعان DiaryPost بحقول likedBy و comments.
 * لو النوع الأصلي DiaryPost في types.ts متطابق فعلياً مع بيانات Firebase
 * (يعني القسم الرئيسي بيستمع لعقدة diaries كاملة بكل ما تحتها)، يفضل نقل
 * هذين التعريفين إلى types.ts نفسه بدلاً من تكرارهم هنا.
 */
interface DiaryComment {
  id?: string;
  name: string;
  text: string;
  verified: boolean;
  date: string;
  visitorId: string;
}

type LikedByMap = Record<string, boolean>;
type CommentsMap = Record<string, DiaryComment>;

interface ExtendedDiaryPost extends DiaryPost {
  likedBy?: LikedByMap;
  comments?: CommentsMap;
}

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

/* -------------------------------------------------------------------------- */
/* مخزن اسم الزائر: مصدر واحد للحقيقة يتشارك فيه كل المكوّنات في الصفحة        */
/* -------------------------------------------------------------------------- */
const NICKNAME_KEY = 'visitor_nickname';
const MAX_NICKNAME_LENGTH = 20;

const readStoredNickname = (): string => {
  try {
    return (localStorage.getItem(NICKNAME_KEY) || '').trim();
  } catch {
    return '';
  }
};

let nicknameCache: string = typeof window === 'undefined' ? '' : readStoredNickname();
const nicknameListeners = new Set<() => void>();

const notifyNicknameChange = () => nicknameListeners.forEach(fn => fn());

const subscribeNickname = (listener: () => void) => {
  nicknameListeners.add(listener);
  return () => {
    nicknameListeners.delete(listener);
  };
};

const getNicknameSnapshot = () => nicknameCache;
const getNicknameServerSnapshot = () => '';

const writeNickname = (value: string) => {
  const clean = value.trim().slice(0, MAX_NICKNAME_LENGTH);
  if (!clean || clean === nicknameCache) return clean;
  try {
    localStorage.setItem(NICKNAME_KEY, clean);
  } catch (err) {
    console.warn('تعذر حفظ اسم الزائر:', err);
  }
  nicknameCache = clean;
  notifyNicknameChange();
  return clean;
};

const clearNickname = () => {
  try {
    localStorage.removeItem(NICKNAME_KEY);
  } catch (err) {
    console.warn('تعذر حذف اسم الزائر:', err);
  }
  nicknameCache = '';
  notifyNicknameChange();
};

/**
 * يعيد الاسم المحفوظ للزائر مع دوال الحفظ والتغيير.
 * أي مكوّن يستخدم الهوك يتحدّث فوراً عند حفظ الاسم من أي مكان آخر.
 */
const useVisitorNickname = () => {
  const savedName = useSyncExternalStore(subscribeNickname, getNicknameSnapshot, getNicknameServerSnapshot);

  // مزامنة بين تبويبات المتصفح المختلفة
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== NICKNAME_KEY) return;
      nicknameCache = (e.newValue || '').trim();
      notifyNicknameChange();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { savedName, saveName: writeNickname, resetName: clearNickname };
};

/* -------------------------------------------------------------------------- */
/* مكوّن صغير: عرض الاسم المثبّت للزائر مع إمكانية تغييره                      */
/* -------------------------------------------------------------------------- */
interface SavedNameBadgeProps {
  name: string;
  onChange: () => void;
  compact?: boolean;
}

const SavedNameBadge: React.FC<SavedNameBadgeProps> = React.memo(({ name, onChange, compact }) => (
  <div
    className={`flex items-center justify-between gap-3 rounded-2xl bg-white/5 border border-white/5 ${
      compact ? 'px-4 py-2 mb-3' : 'px-5 py-4 mb-4'
    }`}
  >
    <span className="flex items-center gap-2 min-w-0">
      <UserRound size={compact ? 16 : 20} className="text-cyan-400 shrink-0" />
      <span className={`font-black truncate ${compact ? 'text-xs' : 'text-sm'}`}>{name}</span>
    </span>
    <button
      type="button"
      onClick={onChange}
      className="flex items-center gap-1 text-[11px] font-black text-white/40 hover:text-cyan-400 transition-all shrink-0"
    >
      <Pencil size={12} /> تغيير الاسم
    </button>
  </div>
));
SavedNameBadge.displayName = 'SavedNameBadge';

/* -------------------------------------------------------------------------- */
/* مكوّن صغير: اختيار هوية النشر للمدير فقط (كمسؤول أو كزائر باسم اختياري)     */
/* -------------------------------------------------------------------------- */
interface AdminIdentityToggleProps {
  asAdmin: boolean;
  setAsAdmin: (v: boolean) => void;
  name: string;
  setName: (v: string) => void;
  namePlaceholder: string;
}

const AdminIdentityToggle: React.FC<AdminIdentityToggleProps> = React.memo(
  ({ asAdmin, setAsAdmin, name, setName, namePlaceholder }) => (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex items-center gap-2 p-1 rounded-2xl bg-black/40 border border-white/10 w-fit">
        <button
          type="button"
          onClick={() => setAsAdmin(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${
            asAdmin ? 'bg-cyan-500 text-black' : 'text-white/40 hover:text-white'
          }`}
        >
          <ShieldCheck size={16} /> نشر كمسؤول
        </button>
        <button
          type="button"
          onClick={() => setAsAdmin(false)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${
            !asAdmin ? 'bg-white text-black' : 'text-white/40 hover:text-white'
          }`}
        >
          <UserRound size={16} /> نشر كزائر
        </button>
      </div>
      {!asAdmin && (
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={namePlaceholder}
          maxLength={MAX_NICKNAME_LENGTH}
          className="bg-black/40 border border-white/10 p-4 rounded-2xl text-white placeholder:text-white/20 font-bold text-sm"
        />
      )}
    </div>
  )
);
AdminIdentityToggle.displayName = 'AdminIdentityToggle';

/* -------------------------------------------------------------------------- */
/* مكوّن صغير: قسم التعليقات لكل منشور - حالته المحلية معزولة عن باقي القائمة  */
/* -------------------------------------------------------------------------- */
interface CommentsSectionProps {
  postId: string;
  comments?: CommentsMap;
  isAdmin: boolean;
  isOffline: boolean;
  visitorId: string;
}

const CommentsSection: React.FC<CommentsSectionProps> = React.memo(
  ({ postId, comments, isAdmin, isOffline, visitorId }) => {
    const { savedName, saveName, resetName } = useVisitorNickname();
    const [open, setOpen] = useState(false);
    const [text, setText] = useState('');
    const [name, setName] = useState('');
    const [asAdmin, setAsAdmin] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // الزائر العادي يُطلب منه الاسم مرة واحدة فقط؛ بعدها يُخفى الحقل نهائياً
    const needsName = !isAdmin && !savedName;

    const commentList = useMemo(() => {
      if (!comments) return [];
      return Object.entries(comments)
        .map(([id, c]) => ({ id, ...c }))
        .sort((a, b) => (a.id > b.id ? 1 : -1));
    }, [comments]);

    const submitComment = useCallback(() => {
      if (!text.trim() || submitting) return;

      let finalName: string;
      if (isAdmin) {
        finalName = asAdmin ? 'AHMED PULSE' : name.trim() || 'مجهول';
      } else if (savedName) {
        finalName = savedName;
      } else {
        const typed = name.trim();
        if (!typed) {
          alert('اكتب اسمك المستعار أولاً، سيُحفظ مرة واحدة فقط.');
          return;
        }
        finalName = saveName(typed);
      }

      const finalVerified = isAdmin && asAdmin;

      const commentData: DiaryComment = {
        name: finalName,
        text: text.trim(),
        verified: finalVerified,
        date: new Date().toLocaleDateString('ar-EG'),
        visitorId,
      };

      if (isOffline) {
        alert('أنت تتصفح أوفلاين. تم حفظ التعليق وسيتم نشره عند الاتصال بالإنترنت.');
        try {
          const queue = JSON.parse(localStorage.getItem('offline_comments_queue') || '[]');
          queue.push({ postId, ...commentData });
          localStorage.setItem('offline_comments_queue', JSON.stringify(queue));
        } catch (err) {
          console.warn('تعذر حفظ التعليق أوفلاين:', err);
        }
        setText('');
        return;
      }

      setSubmitting(true);
      const newCommentRef = push(ref(db, `diaries/${postId}/comments`));
      set(newCommentRef, commentData)
        .then(() => setText(''))
        .catch((err: any) => {
          console.warn('Comment failed:', err?.message);
          alert('فشل إرسال التعليق. يرجى المحاولة مرة أخرى.');
        })
        .finally(() => setSubmitting(false));
    }, [text, submitting, isAdmin, asAdmin, name, savedName, saveName, isOffline, postId, visitorId]);

    const handleChangeName = useCallback(() => {
      setName(savedName);
      resetName();
    }, [savedName, resetName]);

    return (
      <div className="border-t border-white/5">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-8 py-4 text-white/50 hover:text-white transition-all font-bold text-sm"
        >
          <span className="flex items-center gap-2">
            <MessageCircle size={16} /> التعليقات ({commentList.length})
          </span>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {open && (
          <div className="px-8 pb-8">
            {isAdmin && (
              <AdminIdentityToggle
                asAdmin={asAdmin}
                setAsAdmin={setAsAdmin}
                name={name}
                setName={setName}
                namePlaceholder="اسمك المستعار (اختياري)"
              />
            )}
            {!isAdmin && savedName && (
              <SavedNameBadge name={savedName} onChange={handleChangeName} compact />
            )}
            {needsName && (
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="اسمك المستعار (يُحفظ مرة واحدة)"
                maxLength={MAX_NICKNAME_LENGTH}
                className="w-full bg-black/40 border border-white/10 p-4 rounded-2xl mb-3 text-white placeholder:text-white/20 font-bold text-sm"
              />
            )}
            <div className="flex gap-3">
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="اكتب تعليقك..."
                className="flex-1 bg-black/40 border border-white/10 p-4 rounded-2xl text-white placeholder:text-white/20 text-sm"
                onKeyDown={e => {
                  if (e.key === 'Enter') submitComment();
                }}
              />
              <button
                type="button"
                onClick={submitComment}
                disabled={submitting || !text.trim() || (needsName && !name.trim())}
                className="px-5 rounded-2xl bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500 hover:text-black transition-all disabled:opacity-30 disabled:hover:bg-cyan-500/20 disabled:hover:text-cyan-400"
              >
                <Send size={18} />
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-4">
              {commentList.length === 0 && (
                <div className="text-white/20 text-sm text-center py-4">لا توجد تعليقات بعد، كن أول من يعلّق.</div>
              )}
              {commentList.map(c => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-black text-sm text-white">
                    {c.name[0]}
                  </div>
                  <div className="flex-1 bg-white/5 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-black text-sm">{c.name}</span>
                      {c.verified && (
                        <span className="flex items-center gap-1 text-[9px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full border border-cyan-500/30 font-black">
                          <CheckCircle size={9} /> Verified Agent
                        </span>
                      )}
                      <span className="text-[10px] text-white/20 font-medium">{c.date}</span>
                    </div>
                    <div className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{c.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);
CommentsSection.displayName = 'CommentsSection';

/* -------------------------------------------------------------------------- */
/* المكوّن الرئيسي                                                            */
/* -------------------------------------------------------------------------- */
const DiariesSection: React.FC<DiariesSectionProps> = ({
  active, diaries, hasMoreDiaries, loadingMore, onLoadMore, isAdmin, isOffline, visitorId, onOptimisticAdd
}) => {
  const { savedName, saveName, resetName } = useVisitorNickname();
  const [diaryName, setDiaryName] = useState('');
  const [diaryMsg, setDiaryMsg] = useState('');
  const [postAsAdmin, setPostAsAdmin] = useState(true);

  const needsName = !isAdmin && !savedName;

  const postDiaryEntry = useCallback(() => {
    if (!diaryMsg.trim()) return;

    let finalName: string;
    if (isAdmin) {
      finalName = postAsAdmin ? 'AHMED PULSE' : diaryName.trim() || 'مجهول';
    } else if (savedName) {
      finalName = savedName;
    } else {
      const typed = diaryName.trim();
      if (!typed) {
        alert('اكتب اسمك المستعار أولاً، سيُحفظ مرة واحدة فقط.');
        return;
      }
      finalName = saveName(typed);
    }

    const finalVerified = isAdmin && postAsAdmin;

    const postData: any = {
      name: finalName,
      text: diaryMsg,
      verified: finalVerified,
      date: new Date().toLocaleDateString('ar-EG'),
      likes: 0,
      visitorId,
    };

    if (isOffline) {
      alert('أنت تتصفح أوفلاين. تم حفظ اليومية وسيتم نشرها عند الاتصال بالإنترنت.');
      try {
        const queue = JSON.parse(localStorage.getItem('offline_diaries_queue') || '[]');
        queue.push(postData);
        localStorage.setItem('offline_diaries_queue', JSON.stringify(queue));
      } catch (err) {
        console.warn('تعذر حفظ اليومية أوفلاين:', err);
      }
      onOptimisticAdd({ id: 'offline-' + Date.now(), ...postData });
      setDiaryMsg('');
      return;
    }

    const newPostRef = push(ref(db, 'diaries'));
    set(newPostRef, postData).catch((err: any) => {
      console.warn('Post failed:', err?.message);
      alert('فشل النشر. يرجى التأكد من صلاحيات قاعدة البيانات.');
    });
    setDiaryMsg('');
  }, [diaryMsg, diaryName, savedName, saveName, isAdmin, postAsAdmin, isOffline, visitorId, onOptimisticAdd]);

  const handleChangeName = useCallback(() => {
    setDiaryName(savedName);
    resetName();
  }, [savedName, resetName]);

  const toggleLike = useCallback((post: ExtendedDiaryPost) => {
    if (isOffline) {
      alert('لا يمكن الإعجاب أثناء التصفح دون اتصال بالإنترنت.');
      return;
    }

    const likesRef = ref(db, `diaries/${post.id}/likes`);

    // المدير يتجاوز فحص visitorId ويزيد العداد بحرية بكل ضغطة
    if (isAdmin) {
      runTransaction(likesRef, (likes: number | null) => (likes || 0) + 1).catch((err: any) => {
        console.warn('Admin like failed:', err?.message);
      });
      return;
    }

    // الزائر العادي: إعجاب واحد فقط لكل منشور، والضغط مجدداً يلغي الإعجاب
    const likedByRef = ref(db, `diaries/${post.id}/likedBy/${visitorId}`);
    runTransaction(likedByRef, (current: boolean | null) => (current ? null : true))
      .then((result: any) => {
        if (!result.committed) return;
        const nowLiked = !!result.snapshot.val();
        const delta = nowLiked ? 1 : -1;
        runTransaction(likesRef, (likes: number | null) => Math.max(0, (likes || 0) + delta)).catch(
          (err: any) => console.warn('Like count update failed:', err?.message)
        );
      })
      .catch((err: any) => {
        console.warn('Like failed:', err?.message);
      });
  }, [isAdmin, isOffline, visitorId]);

  return (
    <section className={`${active ? 'block' : 'hidden'}`}>
      <h2 className="text-4xl font-black mb-12 mt-8 flex items-center gap-4">
        <Users className="text-cyan-400" size={36} /> المجتمع الرقمي
      </h2>

      <div className="glass border border-white/10 p-8 rounded-[3rem] mb-12 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-500/10 blur-[60px] rounded-full" />
        <div className="relative z-10">
          {isAdmin ? (
            <AdminIdentityToggle
              asAdmin={postAsAdmin}
              setAsAdmin={setPostAsAdmin}
              name={diaryName}
              setName={setDiaryName}
              namePlaceholder="اسمك المستعار"
            />
          ) : savedName ? (
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <SavedNameBadge name={savedName} onChange={handleChangeName} />
              <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/5 mb-4">
                <Sparkles size={20} className="text-yellow-400" />
                <span className="text-xs text-white/40">شاركنا لحظاتك المميزة.</span>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <input
                value={diaryName}
                onChange={e => setDiaryName(e.target.value)}
                placeholder="اسمك المستعار"
                className="bg-black/40 border border-white/10 p-5 rounded-2xl text-white placeholder:text-white/20 font-bold"
                maxLength={MAX_NICKNAME_LENGTH}
              />
              <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/5">
                <Sparkles size={20} className="text-yellow-400" />
                <span className="text-xs text-white/40">اختر اسمك مرة واحدة، وسنتذكره لك.</span>
              </div>
            </div>
          )}
          <textarea
            value={diaryMsg}
            onChange={e => setDiaryMsg(e.target.value)}
            placeholder="ما الذي يدور في ذهنك اليوم؟"
            rows={4}
            className="w-full bg-black/40 border border-white/10 p-6 rounded-[2rem] mb-6 text-white placeholder:text-white/20 resize-none text-lg leading-relaxed"
          />
          <button
            onClick={postDiaryEntry}
            disabled={!diaryMsg.trim() || (needsName && !diaryName.trim())}
            className="w-full md:w-auto px-12 py-5 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full font-black text-lg shadow-2xl shadow-cyan-500/20 hover:scale-[1.05] active:scale-95 transition-all flex items-center justify-center gap-3 float-left disabled:opacity-40 disabled:hover:scale-100"
          >
            نشر الآن <Send size={20} />
          </button>
          <div className="clear-both" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {diaries.length === 0 && <div className="text-center text-white/20 py-20 text-xl font-bold">المجتمع بانتظار مشاركتك الأولى...</div>}
        {diaries.map(post => {
          const extendedPost = post as ExtendedDiaryPost;
          const liked = isAdmin ? false : !!extendedPost.likedBy?.[visitorId];
          return (
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
                  onClick={() => toggleLike(extendedPost)}
                  className={`flex items-center gap-2 transition-all font-black py-2 px-4 rounded-full ${liked || post.likes > 0 ? 'bg-red-500/10 text-red-500' : 'text-white/20 hover:text-white hover:bg-white/5'}`}
                >
                  <Heart size={20} fill={liked ? 'currentColor' : 'none'} /> {post.likes || 0}
                </button>
                <div className="text-[10px] uppercase tracking-widest text-white/10 font-black">Ahmed Pulse community</div>
              </div>
              <CommentsSection
                postId={post.id}
                comments={extendedPost.comments}
                isAdmin={isAdmin}
                isOffline={isOffline}
                visitorId={visitorId}
              />
            </div>
          );
        })}
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
