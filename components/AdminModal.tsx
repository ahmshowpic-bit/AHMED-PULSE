import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Mail, Music as MusicIcon, Settings, LogOut, Shield, Trash2, Heart, Users, Sparkles, Zap
} from 'lucide-react';
import { db, ref, set, onValue, push, update, remove, auth, signOut } from '../firebase';
import { Song, CustomPage, AppSettings, ContactMessage } from '../types';

/* ==========================================================================
   أنماط مشتركة: حقول معتمة تماماً (بدون backdrop-blur ولا شفافية متراكمة)
   الشفافية فوق طبقة مموّهة هي أغلى شيء أثناء الكتابة، فأُزيلت من الحقول.
   ========================================================================== */
const FIELD_BASE =
  'w-full bg-[#08080d] border border-white/10 rounded-2xl outline-none focus:border-cyan-500/60 transition-colors';

type AdminTab = 'inbox' | 'music' | 'pages' | 'settings';

/* ==========================================================================
   حقل نصي معزول: يحتفظ بقيمته في state محلي، ولا يُبلّغ الأب إلا عند
   ترك الحقل (onBlur) أو بعد توقف الكتابة (debounce). النتيجة: الكتابة
   لا تُسبب أي re-render خارج هذا الحقل.
   ========================================================================== */
interface LocalFieldProps {
  initialValue: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  debounceMs?: number;
  ariaLabel?: string;
}

const LocalField: React.FC<LocalFieldProps> = React.memo(({
  initialValue, onCommit, placeholder, className = '', rows, debounceMs = 500, ariaLabel
}) => {
  const [value, setValue] = useState(initialValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(initialValue);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  // لو الأب غيّر القيمة من الخارج (تحميل إعدادات جديدة مثلاً)
  useEffect(() => {
    if (initialValue !== latest.current) {
      latest.current = initialValue;
      setValue(initialValue);
    }
  }, [initialValue]);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const commit = useCallback((v: string) => {
    clearTimer();
    if (v === latest.current) return;
    latest.current = v;
    commitRef.current(v);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setValue(v);
    clearTimer();
    if (debounceMs > 0) {
      timer.current = setTimeout(() => commit(v), debounceMs);
    }
  }, [commit, debounceMs]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    commit(e.target.value);
  }, [commit]);

  useEffect(() => clearTimer, []);

  const shared = {
    value,
    onChange: handleChange,
    onBlur: handleBlur,
    placeholder,
    'aria-label': ariaLabel || placeholder,
    className: `${FIELD_BASE} ${className}`,
  };

  return rows ? <textarea {...shared} rows={rows} /> : <input {...shared} />;
});
LocalField.displayName = 'LocalField';

/* ==========================================================================
   عناصر واجهة صغيرة
   ========================================================================== */
const AdminNavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> =
  React.memo(({ active, onClick, icon, label }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 p-4 rounded-2xl transition-colors font-bold ${active ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30' : 'text-white/40 hover:bg-white/10 hover:text-white'}`}
    >
      <span>{icon}</span>
      <span className="hidden md:inline">{label}</span>
    </button>
  ));
AdminNavBtn.displayName = 'AdminNavBtn';

const FieldLabel: React.FC<{ children: React.ReactNode; accent?: boolean }> = React.memo(({ children, accent }) => (
  <label className={`block text-xs font-black mr-2 ${accent ? 'text-cyan-400' : 'text-white/40'}`}>{children}</label>
));
FieldLabel.displayName = 'FieldLabel';

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; color?: 'cyan' | 'purple' }> =
  React.memo(({ checked, onChange, color = 'cyan' }) => (
    <label className="relative inline-flex items-center cursor-pointer shrink-0">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <div
        className={`w-14 h-7 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform ${color === 'purple' ? 'peer-checked:bg-purple-600' : 'peer-checked:bg-cyan-500'}`}
      />
    </label>
  ));
Toggle.displayName = 'Toggle';

/* ==========================================================================
   تبويب البريد الوارد
   ========================================================================== */
const InboxTab: React.FC<{ messages: ContactMessage[] }> = React.memo(({ messages }) => {
  const handleDelete = useCallback((id: string) => {
    remove(ref(db, `inbox/${id}`)).catch(e => console.error(e));
  }, []);

  return (
    <div className="space-y-6">
      <h3 className="text-3xl font-black mb-10 flex items-center justify-between">
        صندوق الوارد
        <span className="bg-cyan-500/20 text-cyan-400 px-4 py-1 rounded-full text-sm font-black">{messages.length} رسالة</span>
      </h3>
      {messages.length === 0 && <div className="text-white/10 text-center py-20 text-xl font-bold">لا توجد رسائل جديدة حالياً</div>}
      {messages.map(m => (
        <div key={m.id} className="bg-white/5 border border-white/10 p-6 rounded-[2rem] flex items-start gap-6 hover:bg-white/10 transition-colors group">
          <div className="w-16 h-16 shrink-0 rounded-[1.5rem] bg-cyan-600/20 flex items-center justify-center text-cyan-400 font-black text-2xl uppercase">
            {m.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-xl text-white mb-2 flex items-center gap-3">
              {m.name}
              {(m as any).visitorId && (
                <span className="text-[10px] font-mono text-white/20 font-normal">#{(m as any).visitorId}</span>
              )}
            </div>
            <div className="text-lg text-white/60 leading-relaxed bg-[#08080d] p-4 rounded-2xl break-words">{m.msg}</div>
          </div>
          <button
            onClick={() => handleDelete(m.id)}
            className="text-red-500/30 hover:text-red-500 p-3 rounded-full hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
          >
            <Trash2 size={24} />
          </button>
        </div>
      ))}
    </div>
  );
});
InboxTab.displayName = 'InboxTab';

/* ==========================================================================
   تبويب إدارة الأغاني — نموذج الإضافة كامل داخل هذا المكوّن
   ========================================================================== */
interface MusicDraft {
  title: string;
  url: string;
  img: string;
  folder: string;
  newFolder: string;
}

interface MusicTabProps {
  songs: Song[];
  folderNames: string[];
  defaultSongId?: string;
  draftRef: React.MutableRefObject<MusicDraft>;
}

const MusicTab: React.FC<MusicTabProps> = React.memo(({ songs, folderNames, defaultSongId, draftRef }) => {
  // المجلد المختار فقط يحتاج state (لأنه يتحكم في ظهور حقل المجلد الجديد)
  const [folder, setFolder] = useState(draftRef.current.folder);
  const [busy, setBusy] = useState(false);

  const setField = useCallback(<K extends keyof MusicDraft>(key: K) =>
    (value: MusicDraft[K]) => { draftRef.current[key] = value; }, [draftRef]);

  const handleFolderChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    draftRef.current.folder = e.target.value;
    setFolder(e.target.value);
  }, [draftRef]);

  const addMusic = useCallback(() => {
    const d = draftRef.current;
    const target = d.folder === 'new' ? d.newFolder.trim() : d.folder;
    if (!target || !d.title.trim() || !d.url.trim()) {
      alert('يرجى إكمال البيانات');
      return;
    }
    setBusy(true);
    push(ref(db, 'music'), {
      name: d.title.trim(),
      url: d.url.trim(),
      image: d.img.trim() || 'https://picsum.photos/400/400',
      folder: target,
    })
      .then(() => {
        draftRef.current = { title: '', url: '', img: '', folder: target, newFolder: '' };
        setFolder(target);
        alert('تمت الإضافة بنجاح!');
      })
      .catch(err => alert('خطأ في الصلاحيات: ' + err.message))
      .finally(() => setBusy(false));
  }, [draftRef]);

  const setDefault = useCallback((id: string) => {
    update(ref(db, 'settings'), { defaultSongId: id }).catch(e => console.error(e));
  }, []);

  const deleteSong = useCallback((id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    remove(ref(db, `music/${id}`)).catch(e => console.error(e));
  }, []);

  // مفتاح يُعيد بناء الحقول بعد الإضافة الناجحة لتفريغها
  const formKey = `${folder}-${draftRef.current.title}`;

  return (
    <div>
      <h3 className="text-3xl font-black mb-10">إدارة المحتوى الصوتي</h3>
      <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem] mb-12 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <FieldLabel>اختيار المجلد</FieldLabel>
            <select
              value={folder}
              onChange={handleFolderChange}
              className={`${FIELD_BASE} p-4 text-lg font-bold`}
            >
              <option value="new">++ إنشاء مجلد جديد ++</option>
              {folderNames.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          {folder === 'new' && (
            <div className="space-y-2">
              <FieldLabel>اسم المجلد الجديد</FieldLabel>
              <LocalField
                key={`nf-${formKey}`}
                initialValue={draftRef.current.newFolder}
                onCommit={setField('newFolder')}
                placeholder="أدخل اسماً للمجلد"
                className="p-4 text-lg"
              />
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <FieldLabel>اسم الأغنية</FieldLabel>
            <LocalField
              key={`t-${formKey}`}
              initialValue={draftRef.current.title}
              onCommit={setField('title')}
              placeholder="مثال: لحن الخلود"
              className="p-4 text-lg"
            />
          </div>
          <div className="space-y-2">
            <FieldLabel>رابط ملف MP3</FieldLabel>
            <LocalField
              key={`u-${formKey}`}
              initialValue={draftRef.current.url}
              onCommit={setField('url')}
              placeholder="https://..."
              className="p-4 text-lg font-mono"
            />
          </div>
        </div>

        <div className="space-y-2">
          <FieldLabel>رابط صورة الغلاف</FieldLabel>
          <LocalField
            key={`i-${formKey}`}
            initialValue={draftRef.current.img}
            onCommit={setField('img')}
            placeholder="https://..."
            className="p-4 text-lg font-mono"
          />
        </div>

        <button
          onClick={addMusic}
          disabled={busy}
          className="w-full py-5 bg-cyan-600 rounded-[2rem] font-black text-xl shadow-lg shadow-cyan-600/20 hover:bg-cyan-500 active:scale-95 transition-all disabled:opacity-40"
        >
          {busy ? 'جاري الإضافة...' : 'إضافة الملف الآن'}
        </button>
      </div>

      <div className="space-y-3">
        {songs.map(s => (
          <div key={s.id} className="flex items-center gap-6 p-4 bg-white/5 rounded-[1.5rem] border border-white/5 hover:border-white/10 transition-colors">
            <img src={s.image} loading="lazy" decoding="async" alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
            <div className="flex-1 truncate">
              <div className="font-black text-lg truncate">{s.name}</div>
              <div className="text-xs text-white/30 font-bold uppercase tracking-widest">{s.folder}</div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setDefault(s.id)}
                className={`w-12 h-12 rounded-full transition-colors flex items-center justify-center ${defaultSongId === s.id ? 'bg-yellow-500 text-black' : 'bg-white/5 text-white/20 hover:text-white/60'}`}
              >
                <Heart size={20} fill={defaultSongId === s.id ? 'currentColor' : 'none'} />
              </button>
              <button
                onClick={() => deleteSong(s.id)}
                className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
MusicTab.displayName = 'MusicTab';

/* ==========================================================================
   تبويب إعدادات النظام — المسودة محفوظة في ref بالأب فلا تضيع عند تبديل التبويب
   ========================================================================== */
interface SettingsTabProps {
  draftRef: React.MutableRefObject<AppSettings>;
  onSave: (payload: AppSettings) => Promise<void>;
}

const SettingsTab: React.FC<SettingsTabProps> = React.memo(({ draftRef, onSave }) => {
  // الحقول النصية لا تحتاج state هنا إطلاقاً (تكتب في ref مباشرة).
  // فقط المفاتيح والقوائم المنسدلة تحتاج re-render لتغيير شكلها.
  const [, forceRender] = useState(0);
  const [saving, setSaving] = useState(false);
  const d = draftRef.current;

  const setText = useCallback(<K extends keyof AppSettings>(key: K) =>
    (value: string) => { (draftRef.current as any)[key] = value; }, [draftRef]);

  const setControlled = useCallback((key: keyof AppSettings, value: any) => {
    (draftRef.current as any)[key] = value;
    forceRender(n => n + 1);
  }, [draftRef]);

  const handleSave = useCallback(() => {
    setSaving(true);
    onSave({ ...draftRef.current })
      .then(() => alert('تم تحديث كافة الإعدادات بنجاح'))
      .catch((e: any) => alert('فشل الحفظ: ' + e.message))
      .finally(() => setSaving(false));
  }, [onSave, draftRef]);

  return (
    <div className="space-y-10">
      <h3 className="text-3xl font-black">إعدادات النظام الأساسية</h3>

      <div className="space-y-8 bg-white/5 p-10 rounded-[3rem] border border-white/10">
        <div className="space-y-3">
          <FieldLabel accent>نص الترحيب الرئيسي</FieldLabel>
          <LocalField
            initialValue={d.welcome || ''}
            onCommit={setText('welcome')}
            className="p-5 text-xl font-black text-center"
          />
        </div>

        <div className="flex items-center justify-between p-6 bg-cyan-500/5 rounded-[2rem] border border-cyan-500/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0"><Users size={24} /></div>
            <div>
              <div className="font-black text-lg">عداد الزيارات</div>
              <div className="text-xs text-white/30">إظهار عدد زوار الموقع للعامة</div>
            </div>
          </div>
          <Toggle checked={!!d.showVisitorCount} onChange={v => setControlled('showVisitorCount', v)} />
        </div>

        <div className="p-10 bg-purple-500/5 rounded-[3rem] border border-purple-500/20 space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none"><Zap size={100} /></div>
          <h4 className="text-2xl font-black text-purple-400 flex items-center gap-3"><Sparkles size={24} /> محرك العرض (Hero Engine)</h4>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-black text-lg">وضع Hero الثابت</div>
              <div className="text-xs text-white/30">تجاهل خلفيات الأغاني واستخدام خلفية ثابتة</div>
            </div>
            <Toggle color="purple" checked={!!d.heroMode} onChange={v => setControlled('heroMode', v)} />
          </div>

          <div className="space-y-3">
            <FieldLabel>رابط الوسائط (صورة/فيديو)</FieldLabel>
            <LocalField
              initialValue={d.heroImg || ''}
              onCommit={setText('heroImg')}
              placeholder="ضع الرابط هنا"
              className="p-5 text-lg font-mono"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <FieldLabel>نوع الوسائط</FieldLabel>
              <select
                value={d.heroType}
                onChange={e => setControlled('heroType', e.target.value)}
                className={`${FIELD_BASE} p-4 font-bold`}
              >
                <option value="image">صورة احترافية</option>
                <option value="video">فيديو تفاعلي</option>
              </select>
            </div>
            <div className="space-y-2">
              <FieldLabel>نمط الملاءمة</FieldLabel>
              <select
                value={d.bgFit}
                onChange={e => setControlled('bgFit', e.target.value)}
                className={`${FIELD_BASE} p-4 font-bold`}
              >
                <option value="cover">ملء كامل (Cover)</option>
                <option value="contain">احتواء ذكي (Contain)</option>
              </select>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-6 bg-gradient-to-r from-cyan-600 to-purple-600 rounded-[2rem] font-black text-2xl shadow-lg shadow-cyan-600/20 active:scale-95 transition-all disabled:opacity-40"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>
    </div>
  );
});
SettingsTab.displayName = 'SettingsTab';

/* ==========================================================================
   تبويب بناء الصفحات — بدون document.getElementById، والحالة محفوظة في ref
   ========================================================================== */
interface PageDraft { id: string; title: string; content: string }

interface PagesTabProps {
  customPages: CustomPage[];
  draftRef: React.MutableRefObject<PageDraft>;
}

const PagesTab: React.FC<PagesTabProps> = React.memo(({ customPages, draftRef }) => {
  const [busy, setBusy] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const setField = useCallback(<K extends keyof PageDraft>(key: K) =>
    (value: PageDraft[K]) => { draftRef.current[key] = value; }, [draftRef]);

  const publish = useCallback(() => {
    const { id, title, content } = draftRef.current;
    if (!id.trim() || !title.trim()) {
      alert('يرجى إكمال الحقول الأساسية');
      return;
    }
    setBusy(true);
    set(ref(db, `custom_pages/${id.trim()}`), { title: title.trim(), content, icon: 'MoreHorizontal' })
      .then(() => {
        draftRef.current = { id: '', title: '', content: '' };
        setResetKey(k => k + 1);
        alert('تم نشر الصفحة بنجاح!');
      })
      .catch(e => alert('خطأ في الصلاحيات: ' + e.message))
      .finally(() => setBusy(false));
  }, [draftRef]);

  const deletePage = useCallback((id: string) => {
    if (!confirm('حذف الصفحة؟')) return;
    remove(ref(db, `custom_pages/${id}`)).catch(e => console.error(e));
  }, []);

  return (
    <div className="space-y-8">
      <h3 className="text-3xl font-black">منشئ المحتوى التفاعلي</h3>
      <div className="bg-white/5 p-10 rounded-[3rem] border border-white/10 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <FieldLabel>مُعرف الصفحة (English ID)</FieldLabel>
            <LocalField
              key={`pid-${resetKey}`}
              initialValue={draftRef.current.id}
              onCommit={setField('id')}
              placeholder="مثال: about_us"
              className="p-5 font-bold"
            />
          </div>
          <div className="space-y-2">
            <FieldLabel>عنوان القائمة (Arabic)</FieldLabel>
            <LocalField
              key={`ptitle-${resetKey}`}
              initialValue={draftRef.current.title}
              onCommit={setField('title')}
              placeholder="مثال: من نحن"
              className="p-5 font-bold"
            />
          </div>
        </div>
        <div className="space-y-2">
          <FieldLabel>محتوى الصفحة (HTML / Text)</FieldLabel>
          <LocalField
            key={`pcontent-${resetKey}`}
            initialValue={draftRef.current.content}
            onCommit={setField('content')}
            placeholder="اكتب محتوى الصفحة هنا بصيغة HTML..."
            rows={12}
            debounceMs={0}
            className="p-6 rounded-[2rem] text-lg font-mono leading-relaxed"
          />
        </div>
        <button
          onClick={publish}
          disabled={busy}
          className="w-full py-6 bg-purple-600 rounded-full font-black text-xl shadow-lg shadow-purple-600/20 hover:bg-purple-500 transition-colors disabled:opacity-40"
        >
          {busy ? 'جاري النشر...' : 'نشر الصفحة الجديدة'}
        </button>
      </div>

      <div className="grid gap-4">
        <h4 className="text-xl font-black text-white/40 mt-8 mb-4">الصفحات الحالية</h4>
        {customPages.map(pg => (
          <div key={pg.id} className="flex items-center justify-between p-6 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors">
            <div className="font-black text-lg">{pg.title} <span className="text-xs text-white/20 ml-2">({pg.id})</span></div>
            <button
              onClick={() => deletePage(pg.id)}
              className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});
PagesTab.displayName = 'PagesTab';

/* ==========================================================================
   المكوّن الرئيسي: لا يحتفظ إلا بالتبويب الحالي + رسائل البريد.
   كل النصوص في refs، فالكتابة لا تُصيّر هذا المكوّن ولا التطبيق.
   ========================================================================== */
interface AdminModalProps {
  settings: AppSettings;
  songs: Song[];
  folders: Record<string, Song[]>;
  customPages: CustomPage[];
  onClose: () => void;
  onSaveSettings: (payload: AppSettings) => Promise<void>;
}

const AdminModal: React.FC<AdminModalProps> = ({
  settings, songs, folders, customPages, onClose, onSaveSettings
}) => {
  const [adminTab, setAdminTab] = useState<AdminTab>('inbox');
  const [messages, setMessages] = useState<ContactMessage[]>([]);

  // مسودات محفوظة بين تبديل التبويبات بدون أي re-render
  const settingsDraft = useRef<AppSettings>({ ...settings });
  const musicDraft = useRef<MusicDraft>({ title: '', url: '', img: '', folder: 'new', newFolder: '' });
  const pageDraft = useRef<PageDraft>({ id: '', title: '', content: '' });

  // عدّاد الزيارات يأتي من الخارج دائماً ولا يُكتب من المسودة
  const visitorCountRef = useRef(settings.visitorCount);
  visitorCountRef.current = settings.visitorCount;

  useEffect(() => {
    const unsubInbox = onValue(
      ref(db, 'inbox'),
      snap => {
        const data: ContactMessage[] = [];
        snap.forEach(child => { data.push({ id: child.key!, ...child.val() }); });
        setMessages(data);
      },
      error => console.warn('Inbox access restricted:', error.message)
    );
    return () => unsubInbox();
  }, []);

  const folderNames = useMemo(() => Object.keys(folders), [folders]);

  const handleSaveSettings = useCallback((payload: AppSettings) => {
    return onSaveSettings({ ...payload, visitorCount: visitorCountRef.current });
  }, [onSaveSettings]);

  const goInbox = useCallback(() => setAdminTab('inbox'), []);
  const goMusic = useCallback(() => setAdminTab('music'), []);
  const goPages = useCallback(() => setAdminTab('pages'), []);
  const goSettings = useCallback(() => setAdminTab('settings'), []);

  const handleSignOut = useCallback(() => {
    signOut(auth);
    onClose();
  }, [onClose]);

  return (
    // الخلفية معتمة بلون صريح بدل backdrop-blur-2xl: التمويه على كامل الشاشة
    // كان يُعاد حسابه مع كل إطار أثناء الكتابة والتمرير.
    <div className="fixed inset-0 z-[1000] bg-[#05050a]/98 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl h-[90vh] bg-[#0c0c12] border border-white/10 rounded-[3rem] flex flex-col overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-white/10 flex justify-between items-center bg-black/40">
          <div className="flex items-center gap-4 text-cyan-400 font-black text-2xl">
            <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center"><Shield size={28} /></div>
            نظام الإدارة المتكامل
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 rounded-full hover:bg-white/5 flex items-center justify-center text-white/40 hover:text-white text-3xl transition-colors"
          >
            &times;
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Admin Side Nav */}
          <div className="w-24 md:w-60 bg-black/60 border-l border-white/5 flex flex-col p-4 gap-3 shrink-0">
            <AdminNavBtn active={adminTab === 'inbox'} onClick={goInbox} icon={<Mail />} label="البريد الوارد" />
            <AdminNavBtn active={adminTab === 'music'} onClick={goMusic} icon={<MusicIcon />} label="إدارة الأغاني" />
            <AdminNavBtn active={adminTab === 'pages'} onClick={goPages} icon={<Settings />} label="بناء الصفحات" />
            <AdminNavBtn active={adminTab === 'settings'} onClick={goSettings} icon={<Settings />} label="إعدادات النظام" />
            <button
              onClick={handleSignOut}
              className="mt-auto flex items-center gap-4 p-4 text-red-400 hover:bg-red-400/10 rounded-2xl transition-colors font-black"
            >
              <LogOut size={24} /> <span className="hidden md:inline">تسجيل الخروج</span>
            </button>
          </div>

          {/* Admin View Area — تبويب واحد فقط مُركَّب في كل مرة */}
          <div className="flex-1 overflow-y-auto p-10 no-scrollbar">
            {adminTab === 'inbox' && <InboxTab messages={messages} />}
            {adminTab === 'music' && (
              <MusicTab
                songs={songs}
                folderNames={folderNames}
                defaultSongId={settings.defaultSongId}
                draftRef={musicDraft}
              />
            )}
            {adminTab === 'pages' && <PagesTab customPages={customPages} draftRef={pageDraft} />}
            {adminTab === 'settings' && <SettingsTab draftRef={settingsDraft} onSave={handleSaveSettings} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(AdminModal);
