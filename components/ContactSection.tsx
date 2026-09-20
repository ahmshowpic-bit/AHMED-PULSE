import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Send, Inbox, RefreshCw, Flag, MessageCircle, CheckCircle } from 'lucide-react';
import { db, ref, push, runTransaction } from '../firebase';
// دوال القراءة تُستورد مباشرة من الحزمة. لو firebase.ts بيصدّرها بالفعل تقدر تستوردها منه بدلًا من هنا.
import { get, query, limitToLast, onValue, serverTimestamp } from 'firebase/database';

interface ContactSectionProps {
  active: boolean;
  isOffline: boolean;
  visitorId: string;
}

interface Bottle {
  id: string;
  text: string;
  name: string;
  visitorId: string;
  createdAt: number;
}

interface MailItem {
  id: string;
  bottleId: string;
  bottleText: string;
  text: string;
  fromName: string;
  fromVisitorId: string;
  createdAt: number;
}

interface ReplyTarget {
  visitorId: string;
  bottleId: string;
  bottleText: string;
}

type View = 'bottle' | 'mailbox' | 'direct';
type Stage = 'write' | 'throwing' | 'found' | 'empty';
type SceneMode = 'idle' | 'away' | 'arrive';

/* ───────────── إعدادات ───────────── */
const MAX_BOTTLE = 280;
const MAX_REPLY = 200;
const MAX_NAME = 20;
const COOLDOWN_MS = 60000; // دقيقة بين كل زجاجة والتانية
const DAILY_LIMIT = 5; // حد أقصى ٥ زجاجات في اليوم للجهاز
const POOL_SIZE = 60; // عدد آخر الزجاجات اللي بنختار منها عشوائيًا
const REPORT_HIDE_AT = 3; // الزجاجة بتختفي تلقائيًا بعد ٣ بلاغات
const THROW_MS = 2600;
const LINK_RE = /(https?:\/\/|www\.|\b[\w-]+\.(com|net|org|io|me|app|xyz|ly)\b)/i;
const SAFE_KEY_RE = /^[^.#$[\]/]{1,128}$/; // مفتاح صالح كمسار في Firebase

const OFFLINE_NOTE = 'الزجاجات تحتاج اتصالًا بالإنترنت. اتصل وحاول مرة أخرى.';

/* ───────────── أدوات مساعدة ───────────── */
const readJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJSON = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* التخزين غير متاح: نتجاهل */
  }
};

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const plural = (n: number, one: string, two: string, few: string, many: string) =>
  n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`;

const timeAgo = (ts: number): string => {
  if (!ts) return '';
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'الآن';
  const m = Math.floor(s / 60);
  if (m < 60) return `منذ ${plural(m, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة')}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${plural(h, 'ساعة', 'ساعتين', 'ساعات', 'ساعة')}`;
  const d = Math.floor(h / 24);
  return `منذ ${plural(d, 'يوم', 'يومين', 'أيام', 'يومًا')}`;
};

/** يرجّع رسالة خطأ لو الجهاز تخطّى الحد المسموح، وإلا null */
const checkRate = (): string | null => {
  const now = Date.now();
  const log = readJSON<number[]>('bottle_sent_log', []).filter(t => now - t < 86400000);
  const last = log[log.length - 1];
  if (last && now - last < COOLDOWN_MS) {
    return `انتظر ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} ثانية قبل رمي زجاجة أخرى.`;
  }
  if (log.length >= DAILY_LIMIT) return `وصلت للحد اليومي (${DAILY_LIMIT} زجاجات). عُد غدًا 🌅`;
  return null;
};

const logSent = () => {
  const now = Date.now();
  const log = readJSON<number[]>('bottle_sent_log', []).filter(t => now - t < 86400000);
  log.push(now);
  writeJSON('bottle_sent_log', log);
};

/* ───────────── تنسيقات مشتركة ───────────── */
const inputCls =
  'w-full bg-black/40 border border-white/10 p-3 md:p-4 rounded-2xl text-white text-base md:text-lg focus:ring-2 ring-cyan-500/50 outline-none transition-all hover:border-white/20 shadow-inner';
const primaryBtn =
  'py-3 md:py-4 px-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 rounded-2xl font-black text-base md:text-lg shadow-[0_15px_30px_rgba(245,158,11,0.3)] hover:-translate-y-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:translate-y-0';
const ghostBtn =
  'py-3 md:py-4 px-4 bg-white/5 border border-white/10 rounded-2xl font-black text-sm md:text-base text-white/70 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 disabled:opacity-40';
const tabCls = (on: boolean) =>
  `flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs md:text-sm font-black transition-all ${
    on ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg' : 'text-white/50 hover:text-white'
  }`;

/* ───────────── حركات المشهد (CSS فقط) ───────────── */
const BOTTLE_CSS = `
@keyframes pb-wave { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes pb-bob { 0%,100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-5px) rotate(4deg); } }
@keyframes pb-away {
  0%   { transform: translate(0,0) rotate(-4deg) scale(1); opacity: 1; }
  25%  { transform: translate(6px,-18px) rotate(-18deg) scale(1.05); opacity: 1; }
  100% { transform: translate(var(--pb-dx), calc(var(--pb-dist) * -1)) rotate(8deg) scale(.12); opacity: 0; }
}
@keyframes pb-arrive {
  0%   { transform: translate(var(--pb-dx), calc(var(--pb-dist) * -1)) rotate(8deg) scale(.12); opacity: 0; }
  100% { transform: translate(0,0) rotate(-4deg) scale(1); opacity: 1; }
}
@keyframes pb-paper { from { opacity: 0; transform: translateY(-10px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes pb-twinkle { 0%,100% { opacity: .15; } 50% { opacity: .9; } }
.pb-scene { --pb-dist: 40px; --pb-dx: 30px; }
@media (min-width: 768px) { .pb-scene { --pb-dist: 58px; --pb-dx: 44px; } }
.pb-wave-a { animation: pb-wave 9s linear infinite; }
.pb-wave-b { animation: pb-wave 6s linear infinite reverse; }
.pb-bob { animation: pb-bob 3.4s ease-in-out infinite; }
.pb-away { animation: pb-away 2.4s cubic-bezier(.45,.05,.55,.95) forwards; }
.pb-arrive { animation: pb-arrive 1.6s ease-out forwards, pb-bob 3.4s ease-in-out 1.6s infinite; }
.pb-paper { animation: pb-paper .6s ease-out both; }
.pb-twinkle { animation: pb-twinkle 3s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .pb-wave-a, .pb-wave-b, .pb-bob, .pb-twinkle, .pb-paper { animation: none; }
  .pb-away { animation-duration: .01s; }
  .pb-arrive { animation: pb-arrive .01s forwards; }
}
`;

const STARS = [
  { t: '12%', l: '10%', d: '0s' },
  { t: '22%', l: '28%', d: '.8s' },
  { t: '8%', l: '46%', d: '1.6s' },
  { t: '18%', l: '63%', d: '.4s' },
  { t: '10%', l: '82%', d: '1.2s' },
  { t: '26%', l: '92%', d: '2s' },
];

const BottleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 64" className={className} fill="none" aria-hidden="true">
    <rect x="19" y="2" width="10" height="7" rx="2" fill="#b7793a" />
    <path
      d="M20 9h8v10c0 3 9 6 9 16v20a5 5 0 0 1-5 5H16a5 5 0 0 1-5-5V35c0-10 9-13 9-16V9z"
      fill="rgba(255,255,255,0.10)"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <g transform="rotate(-8 24 44)">
      <rect x="19" y="34" width="10" height="20" rx="3" fill="#f5e6c8" />
      <path d="M21 40h6M21 44h6M21 48h4" stroke="#b7793a" strokeWidth="1" strokeLinecap="round" />
    </g>
  </svg>
);

const Scene = React.memo(({ mode, seed }: { mode: SceneMode; seed: string }) => (
  <div
    className="pb-scene relative h-24 md:h-36 rounded-2xl overflow-hidden border border-white/5 bg-black/60"
    aria-hidden="true"
  >
    <div className="absolute inset-x-0 top-0 h-[48%] bg-[radial-gradient(ellipse_at_50%_100%,rgba(245,158,11,0.28),transparent_65%)]" />
    {STARS.map((s, i) => (
      <span
        key={i}
        className="pb-twinkle absolute w-[2px] h-[2px] rounded-full bg-white"
        style={{ top: s.t, left: s.l, animationDelay: s.d }}
      />
    ))}
    <div className="absolute inset-x-0 top-[48%] h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
    <div className="absolute inset-x-0 top-[48%] bottom-0 bg-gradient-to-b from-cyan-500/10 to-transparent" />

    <svg
      className="pb-wave-a absolute bottom-[10%] left-0 w-[200%] h-7 text-cyan-400"
      viewBox="0 0 200 40"
      preserveAspectRatio="none"
    >
      <path d="M0 20 Q25 4 50 20 T100 20 T150 20 T200 20 V40 H0Z" fill="currentColor" fillOpacity=".10" />
    </svg>

    <div
      key={`${mode}-${seed}`}
      className={`absolute left-1/2 bottom-[16%] -ml-4 w-8 md:-ml-5 md:w-10 ${
        mode === 'away' ? 'pb-away' : mode === 'arrive' ? 'pb-arrive' : 'pb-bob'
      }`}
    >
      <BottleIcon className="w-full h-auto text-cyan-300 drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]" />
    </div>

    <svg
      className="pb-wave-b absolute bottom-0 left-0 w-[200%] h-6 text-cyan-400"
      viewBox="0 0 200 40"
      preserveAspectRatio="none"
    >
      <path d="M0 22 Q25 6 50 22 T100 22 T150 22 T200 22 V40 H0Z" fill="#000" fillOpacity=".72" />
      <path
        d="M0 22 Q25 6 50 22 T100 22 T150 22 T200 22"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".45"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  </div>
));

/* ───────────── المكوّن ───────────── */
const ContactSection: React.FC<ContactSectionProps> = ({ active, isOffline, visitorId }) => {
  // الرسالة المباشرة لأحمد (المنطق الأصلي كما هو)
  const [contactName, setContactName] = useState('');
  const [contactMsg, setContactMsg] = useState('');

  // الزجاجات
  const [view, setView] = useState<View>('bottle');
  const [stage, setStage] = useState<Stage>('write');
  const [bottleName, setBottleName] = useState('');
  const [bottleText, setBottleText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Bottle | null>(null);
  const [emptyMsg, setEmptyMsg] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySent, setReplySent] = useState(false);
  const [reported, setReported] = useState(false);

  // صندوق الردود
  const [mail, setMail] = useState<MailItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>(() => readJSON<string[]>('mailbox_read', []));
  const [mailReplyId, setMailReplyId] = useState<string | null>(null);
  const [mailReplyText, setMailReplyText] = useState('');
  const [mailSent, setMailSent] = useState<string[]>([]);

  const unread = mail.reduce((n, m) => n + (readIds.includes(m.id) ? 0 : 1), 0);

  /* الرسالة المباشرة: نفس المنطق الأصلي بدون أي تغيير */
  const sendMessage = () => {
    if (!contactMsg.trim()) return;
    const msgData = { name: contactName || 'مجهول', msg: contactMsg, visitorId };

    if (isOffline) {
      alert('أنت تتصفح أوفلاين. تم حفظ رسالتك وسيتم إرسالها عند الاتصال بالإنترنت.');
      const queue = JSON.parse(localStorage.getItem('offline_msgs_queue') || '[]');
      queue.push(msgData);
      localStorage.setItem('offline_msgs_queue', JSON.stringify(queue));
      setContactMsg('');
      setContactName('');
      return;
    }

    push(ref(db, 'inbox'), msgData)
      .then(() => {
        setContactMsg('');
        setContactName('');
        alert('تم الإرسال بنجاح!');
      })
      .catch(() => {
        alert('حدث خطأ أثناء الإرسال.');
      });
  };

  /* الاستماع لردود صندوقي (فقط والقسم ظاهر) */
  useEffect(() => {
    if (!active || isOffline) return undefined;
    const q = query(ref(db, `mailbox/${visitorId}`), limitToLast(40));
    const unsubscribe = onValue(
      q,
      snap => {
        const list: MailItem[] = [];
        snap.forEach(child => {
          const v = child.val();
          if (!v || typeof v.text !== 'string') return;
          list.push({
            id: child.key as string,
            bottleId: v.bottleId || '',
            bottleText: v.bottleText || '',
            text: v.text,
            fromName: v.fromName || 'غريب',
            fromVisitorId: v.fromVisitorId || '',
            createdAt: typeof v.createdAt === 'number' ? v.createdAt : 0,
          });
        });
        list.sort((a, b) => b.createdAt - a.createdAt);
        setMail(list);
      },
      () => {
        /* صلاحيات أو اتصال: نتجاهل ونعرض صندوقًا فارغًا */
      }
    );
    return () => unsubscribe();
  }, [active, isOffline, visitorId]);

  /* التقاط زجاجة عشوائية من غير زجاجاتي */
  const openRandom = useCallback(
    async (afterThrow: boolean): Promise<void> => {
      setReplying(false);
      setReplyText('');
      setReplySent(false);
      setReported(false);
      try {
        const snap = await get(query(ref(db, 'bottles'), limitToLast(POOL_SIZE)));
        const pool: Bottle[] = [];
        snap.forEach(child => {
          const v = child.val();
          if (!v || typeof v.text !== 'string') return;
          if (v.visitorId === visitorId || v.hidden || (v.reports || 0) >= REPORT_HIDE_AT) return;
          pool.push({
            id: child.key as string,
            text: v.text,
            name: v.name || 'غريب',
            visitorId: typeof v.visitorId === 'string' ? v.visitorId : '',
            createdAt: typeof v.createdAt === 'number' ? v.createdAt : 0,
          });
        });

        const seen = readJSON<string[]>('bottle_seen', []);
        const fresh = pool.filter(b => !seen.includes(b.id));
        const source = fresh.length ? fresh : pool;

        if (!source.length) {
          setFound(null);
          setEmptyMsg(
            afterThrow
              ? 'أنت أول من يرمي زجاجة هنا. زجاجتك الآن في البحر، وأول غريب يلتقطها سيقرؤها.'
              : 'البحر هادئ الآن ولا زجاجات عائمة. كن أول من يرمي واحدة.'
          );
          setStage('empty');
          return;
        }

        const pick = source[Math.floor(Math.random() * source.length)];
        writeJSON('bottle_seen', [...seen, pick.id].slice(-200));
        setFound(pick);
        setStage('found');
      } catch {
        setNotice('تعذّر فتح زجاجة الآن. حاول مرة أخرى.');
        setStage('write');
      }
    },
    [visitorId]
  );

  /* رمي زجاجة: تُنشر ثم نلتقط زجاجة غريب */
  const throwBottle = async () => {
    if (busy) return;
    const text = bottleText.trim();
    if (isOffline) return setNotice(OFFLINE_NOTE);
    if (text.length < 3) return setNotice('اكتب رسالة أطول قليلًا.');
    if (LINK_RE.test(text)) return setNotice('الروابط غير مسموحة داخل الزجاجات.');
    const limited = checkRate();
    if (limited) return setNotice(limited);

    setNotice(null);
    setBusy(true);
    setStage('throwing');
    try {
      const written = Promise.resolve(
        push(ref(db, 'bottles'), {
          text,
          name: bottleName.trim() || 'غريب',
          visitorId,
          createdAt: serverTimestamp(),
        })
      );
      await Promise.all([written, wait(prefersReducedMotion() ? 500 : THROW_MS)]);
      logSent();
      setBottleText('');
    } catch {
      setNotice('تعذّر رمي الزجاجة. تحقق من الاتصال وحاول مرة أخرى.');
      setStage('write');
      setBusy(false);
      return;
    }
    await openRandom(true);
    setBusy(false);
  };

  const pickup = async () => {
    if (busy) return;
    if (isOffline) return setNotice(OFFLINE_NOTE);
    setNotice(null);
    setBusy(true);
    await openRandom(false);
    setBusy(false);
  };

  /* إرسال رد إلى صندوق كاتب الزجاجة (أو إلى من ردّ عليك) */
  const sendReply = async (target: ReplyTarget, text: string): Promise<boolean> => {
    const clean = text.trim();
    if (isOffline) {
      setNotice(OFFLINE_NOTE);
      return false;
    }
    if (clean.length < 2) {
      setNotice('اكتب ردًا أطول قليلًا.');
      return false;
    }
    if (LINK_RE.test(clean)) {
      setNotice('الروابط غير مسموحة.');
      return false;
    }
    if (!SAFE_KEY_RE.test(target.visitorId)) {
      setNotice('تعذّر تحديد صندوق المستلم.');
      return false;
    }
    try {
      await push(ref(db, `mailbox/${target.visitorId}`), {
        bottleId: target.bottleId,
        bottleText: target.bottleText.slice(0, 120),
        text: clean,
        fromName: bottleName.trim() || 'غريب',
        fromVisitorId: visitorId,
        createdAt: serverTimestamp(),
      });
      setNotice(null);
      return true;
    } catch {
      setNotice('تعذّر إرسال الرد. حاول مرة أخرى.');
      return false;
    }
  };

  const submitFoundReply = async () => {
    if (!found || busy) return;
    setBusy(true);
    const ok = await sendReply({ visitorId: found.visitorId, bottleId: found.id, bottleText: found.text }, replyText);
    setBusy(false);
    if (ok) {
      setReplySent(true);
      setReplying(false);
      setReplyText('');
    }
  };

  const submitMailReply = async (m: MailItem) => {
    if (busy) return;
    setBusy(true);
    const ok = await sendReply({ visitorId: m.fromVisitorId, bottleId: m.bottleId, bottleText: m.bottleText }, mailReplyText);
    setBusy(false);
    if (ok) {
      setMailSent(prev => [...prev, m.id]);
      setMailReplyId(null);
      setMailReplyText('');
    }
  };

  /* إبلاغ: يزيد عدّاد البلاغات، والزجاجة تختفي تلقائيًا عند الحد */
  const reportBottle = async () => {
    if (!found || reported || isOffline) return;
    setReported(true);
    try {
      await runTransaction(ref(db, `bottles/${found.id}/reports`), (n: number | null) => (n || 0) + 1);
    } catch {
      /* نتجاهل */
    }
  };

  const markAllRead = () => {
    const merged = Array.from(new Set([...readIds, ...mail.map(m => m.id)]));
    if (merged.length !== readIds.length) {
      setReadIds(merged);
      writeJSON('mailbox_read', merged.slice(-300));
    }
  };

  const switchView = (next: View) => {
    if (view === 'mailbox' && next !== 'mailbox') markAllRead();
    setNotice(null);
    setView(next);
  };

  const sceneMode: SceneMode = stage === 'throwing' ? 'away' : stage === 'found' ? 'arrive' : 'idle';

  return (
    <section
      className={`${
        active
          ? 'block bg-black px-2 py-2 md:px-8 md:py-4 shadow-[0_0_0_100vmax_#000] [clip-path:inset(0_-100vmax)]'
          : 'hidden'
      } animate-fade-in-up`}
    >
      <style>{BOTTLE_CSS}</style>

      <div className="max-w-2xl mx-auto bg-black/50 backdrop-blur-2xl border border-white/10 p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-[0_20px_60px_rgba(0,0,0,0.8)] mt-2 md:mt-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-cyan-500/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 text-right">
          <div className="mb-3 md:mb-4">
            <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-100 tracking-tight">
              رسالة في زجاجة
            </h2>
            <p className="text-white/50 text-xs md:text-sm mt-1">اكتب لغريب... وقد يصلك ردّه.</p>
          </div>

          <div className="flex gap-1 mb-3 md:mb-4 bg-white/5 border border-white/5 p-1 rounded-2xl" role="tablist">
            <button role="tab" aria-selected={view === 'bottle'} onClick={() => switchView('bottle')} className={tabCls(view === 'bottle')}>
              <BottleIcon className="w-3.5 h-auto" /> زجاجة
            </button>
            <button role="tab" aria-selected={view === 'mailbox'} onClick={() => switchView('mailbox')} className={tabCls(view === 'mailbox')}>
              <Inbox size={14} /> صندوقي
              {unread > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center">
                  {unread}
                </span>
              )}
            </button>
            <button role="tab" aria-selected={view === 'direct'} onClick={() => switchView('direct')} className={tabCls(view === 'direct')}>
              <Mail size={14} /> راسل أحمد
            </button>
          </div>

          {/* ───── تبويب الزجاجة ───── */}
          {view === 'bottle' && (
            <>
              <Scene mode={sceneMode} seed={found ? found.id : 'x'} />

              {stage === 'write' && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={bottleText}
                    onChange={e => setBottleText(e.target.value)}
                    maxLength={MAX_BOTTLE}
                    rows={3}
                    placeholder="اكتب رسالتك... سترمى في البحر ويلتقطها غريب"
                    className={`${inputCls} resize-none`}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      value={bottleName}
                      onChange={e => setBottleName(e.target.value)}
                      maxLength={MAX_NAME}
                      placeholder="اسمك (اختياري)"
                      className="flex-1 bg-black/40 border border-white/10 px-3 py-2 rounded-xl text-white text-sm focus:ring-2 ring-cyan-500/50 outline-none"
                    />
                    <span className="text-xs text-white/30 tabular-nums">
                      {bottleText.length}/{MAX_BOTTLE}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={throwBottle} disabled={busy || !bottleText.trim()} className={`${primaryBtn} flex-[2]`}>
                      <Send size={18} /> ارمِ الزجاجة
                    </button>
                    <button onClick={pickup} disabled={busy} className={`${ghostBtn} flex-1`}>
                      <RefreshCw size={16} /> التقط زجاجة
                    </button>
                  </div>
                </div>
              )}

              {stage === 'throwing' && (
                <p aria-live="polite" className="text-center text-white/60 text-sm mt-4 md:mt-6">
                  الزجاجة تبتعد عن الشاطئ…
                </p>
              )}

              {stage === 'empty' && (
                <div className="mt-3 text-center">
                  <p className="text-white/70 text-sm md:text-base leading-relaxed">{emptyMsg}</p>
                  <button onClick={() => setStage('write')} className={`${ghostBtn} mx-auto mt-3`}>
                    اكتب زجاجة
                  </button>
                </div>
              )}

              {stage === 'found' && found && (
                <div className="mt-3">
                  <div key={found.id} className="pb-paper bg-white/5 border border-cyan-500/20 rounded-2xl p-3 md:p-4">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-black text-cyan-400">{found.name}</span>
                      <span className="text-white/40">{timeAgo(found.createdAt)}</span>
                    </div>
                    <p className="text-white text-base md:text-lg leading-relaxed whitespace-pre-wrap break-words max-h-32 md:max-h-40 overflow-y-auto">
                      {found.text}
                    </p>
                  </div>

                  {replySent && (
                    <p className="mt-3 text-sm text-cyan-400 flex items-center justify-center gap-2">
                      <CheckCircle size={16} /> وصل ردّك إلى الكاتب، وسيجده في صندوقه.
                    </p>
                  )}

                  {replying && !replySent && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        maxLength={MAX_REPLY}
                        rows={2}
                        placeholder="اكتب ردّك للغريب…"
                        className={`${inputCls} resize-none`}
                      />
                      <div className="flex gap-2">
                        <button onClick={submitFoundReply} disabled={busy || replyText.trim().length < 2} className={`${primaryBtn} flex-1`}>
                          <Send size={18} /> أرسل الرد
                        </button>
                        <button onClick={() => setReplying(false)} className={ghostBtn}>
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}

                  {!replying && (
                    <div className="flex gap-2 mt-3">
                      {!replySent && found.visitorId && (
                        <button
                          onClick={() => {
                            setReplying(true);
                            setNotice(null);
                          }}
                          className={`${primaryBtn} flex-[2]`}
                        >
                          <MessageCircle size={18} /> ردّ على الكاتب
                        </button>
                      )}
                      <button onClick={pickup} disabled={busy} className={`${ghostBtn} flex-1`}>
                        <RefreshCw size={16} /> أخرى
                      </button>
                      <button
                        onClick={reportBottle}
                        disabled={reported}
                        aria-label="إبلاغ عن الزجاجة"
                        title="إبلاغ"
                        className={`${ghostBtn} ${reported ? 'text-red-400' : ''}`}
                      >
                        <Flag size={16} />
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setStage('write');
                      setNotice(null);
                    }}
                    className="block mx-auto mt-3 text-xs text-white/40 hover:text-white transition-colors"
                  >
                    اكتب زجاجة جديدة
                  </button>
                </div>
              )}
            </>
          )}

          {/* ───── تبويب صندوقي ───── */}
          {view === 'mailbox' && (
            <>
              {isOffline && <p className="text-xs text-white/40 mb-2">أنت أوفلاين، قد لا تظهر الردود الجديدة.</p>}
              {mail.length === 0 ? (
                <div className="text-center py-8 text-white/40 text-sm leading-relaxed">
                  لا توجد ردود بعد.
                  <br />
                  ارمِ زجاجة وعُد لاحقًا لترى من ردّ عليك 🌊
                </div>
              ) : (
                <ul className="space-y-2 max-h-[42vh] md:max-h-[50vh] overflow-y-auto pl-1">
                  {mail.map(m => {
                    const isNew = !readIds.includes(m.id);
                    const canReply = !!m.fromVisitorId && !mailSent.includes(m.id);
                    return (
                      <li key={m.id} className={`rounded-2xl p-3 border ${isNew ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-white/5 border-white/10'}`}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-black text-cyan-400 flex items-center gap-2">
                            {m.fromName}
                            {isNew && <span className="text-[10px] bg-red-500 text-white px-1.5 rounded-full">جديد</span>}
                          </span>
                          <span className="text-white/40">{timeAgo(m.createdAt)}</span>
                        </div>
                        {m.bottleText && <p className="text-[11px] text-white/30 truncate mb-1">ردًا على: «{m.bottleText}»</p>}
                        <p className="text-white text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words">{m.text}</p>

                        {mailSent.includes(m.id) && (
                          <p className="mt-2 text-xs text-cyan-400 flex items-center gap-1">
                            <CheckCircle size={14} /> تم إرسال ردّك
                          </p>
                        )}

                        {mailReplyId === m.id ? (
                          <div className="mt-2 space-y-2">
                            <textarea
                              value={mailReplyText}
                              onChange={e => setMailReplyText(e.target.value)}
                              maxLength={MAX_REPLY}
                              rows={2}
                              placeholder="اكتب ردّك…"
                              className={`${inputCls} resize-none`}
                            />
                            <div className="flex gap-2">
                              <button onClick={() => submitMailReply(m)} disabled={busy || mailReplyText.trim().length < 2} className={`${primaryBtn} flex-1`}>
                                <Send size={16} /> أرسل
                              </button>
                              <button onClick={() => setMailReplyId(null)} className={ghostBtn}>
                                إلغاء
                              </button>
                            </div>
                          </div>
                        ) : (
                          canReply && (
                            <button
                              onClick={() => {
                                setMailReplyId(m.id);
                                setMailReplyText('');
                                setNotice(null);
                              }}
                              className="mt-2 text-xs font-black text-cyan-400 hover:text-white transition-colors flex items-center gap-1"
                            >
                              <MessageCircle size={14} /> ردّ
                            </button>
                          )
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {/* ───── تبويب راسل أحمد (المنطق الأصلي) ───── */}
          {view === 'direct' && (
            <div className="space-y-3 md:space-y-4">
              <div className="group">
                <label className="text-xs md:text-sm font-black text-cyan-400 block mb-1.5 mr-4 uppercase tracking-wider">اسمك الكريم</label>
                <input
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder="اكتب اسمك هنا"
                  className="w-full bg-black/40 border border-white/10 p-3 md:p-4 rounded-2xl text-white text-center text-base md:text-lg focus:ring-2 ring-cyan-500/50 outline-none transition-all group-hover:border-white/20 shadow-inner"
                />
              </div>
              <div className="group">
                <label className="text-xs md:text-sm font-black text-cyan-400 block mb-1.5 mr-4 uppercase tracking-wider">محتوى الرسالة</label>
                <textarea
                  value={contactMsg}
                  onChange={e => setContactMsg(e.target.value)}
                  placeholder="بماذا تود أن تخبرني؟"
                  rows={3}
                  className="w-full bg-black/40 border border-white/10 p-3 md:p-4 rounded-2xl text-white resize-none text-center text-base md:text-lg focus:ring-2 ring-cyan-500/50 outline-none transition-all group-hover:border-white/20 shadow-inner"
                />
              </div>
              <button
                onClick={sendMessage}
                className="w-full py-3 md:py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 rounded-2xl font-black text-lg md:text-xl shadow-[0_15px_30px_rgba(245,158,11,0.3)] hover:shadow-[0_20px_40px_rgba(245,158,11,0.5)] hover:-translate-y-1 active:translate-y-1 transition-all mt-2 md:mt-4 flex items-center justify-center gap-3 group"
              >
                <Send size={28} className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-[-8px] transition-transform" /> إرسال
              </button>
            </div>
          )}

          {notice && view !== 'direct' && (
            <p role="alert" className="mt-3 text-xs md:text-sm text-red-400 text-center">
              {notice}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default React.memo(ContactSection);
