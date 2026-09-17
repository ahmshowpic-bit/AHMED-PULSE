import React, { useEffect, useState } from 'react';
import {
  Mail, Music as MusicIcon, Settings, LogOut, Shield, Trash2, Heart, Users, Sparkles, Zap
} from 'lucide-react';
import { db, ref, set, onValue, push, update, remove, auth, signOut } from '../firebase';
import { Song, CustomPage, AppSettings, ContactMessage } from '../types';

const AdminNavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 font-bold ${active ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30' : 'text-white/40 hover:bg-white/10 hover:text-white'}`}
  >
    <span className={active ? 'scale-110 transition-transform' : ''}>{icon}</span>
    <span className="hidden md:inline">{label}</span>
  </button>
);

interface AdminModalProps {
  settings: AppSettings;
  songs: Song[];
  folders: Record<string, Song[]>;
  customPages: CustomPage[];
  onClose: () => void;
  onSaveSettings: (payload: AppSettings) => Promise<void>;
}

const AdminModal: React.FC<AdminModalProps> = ({ settings, songs, folders, customPages, onClose, onSaveSettings }) => {
  // كل حالة الأدمن (التبويب، مسودة الإعدادات، نموذج الأغاني، البريد
  // الوارد) بقت محلية جوه المودال ده بالكامل. يعني الكتابة في أي حقل
  // هنا معناها إعادة رسم المودال بس، مش الموقع اللي وراه.
  const [adminTab, setAdminTab] = useState('inbox');
  const [draftSettings, setDraftSettings] = useState<AppSettings>(settings);
  const [messages, setMessages] = useState<ContactMessage[]>([]);

  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongUrl, setNewSongUrl] = useState('');
  const [newSongImg, setNewSongImg] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('new');
  const [newFolderName, setNewFolderName] = useState('');

  // البريد الوارد يُحمَّل فقط أثناء فتح لوحة الإدارة (المودال ده أصلاً
  // ما بيتركبش غير لما الأدمن يفتحه)
  useEffect(() => {
    const unsubInbox = onValue(ref(db, 'inbox'), (snap) => {
      const data: ContactMessage[] = [];
      snap.forEach((child) => { data.push({ id: child.key!, ...child.val() }); });
      setMessages(data);
    }, (error) => console.warn("Inbox access restricted:", error.message));
    return () => unsubInbox();
  }, []);

  const addMusicAdmin = () => {
    const folder = selectedFolder === 'new' ? newFolderName : selectedFolder;
    if (!folder || !newSongTitle || !newSongUrl) return alert("يرجى إكمال البيانات");
    push(ref(db, 'music'), {
      name: newSongTitle,
      url: newSongUrl,
      image: newSongImg || "https://picsum.photos/400/400",
      folder
    }).then(() => {
      setNewSongTitle('');
      setNewSongUrl('');
      setNewSongImg('');
      alert("تمت الإضافة بنجاح!");
    }).catch(err => {
      alert("خطأ في الصلاحيات: " + err.message);
    });
  };

  const handleSaveSettings = () => {
    const payload = { ...draftSettings, visitorCount: settings.visitorCount };
    onSaveSettings(payload)
      .then(() => alert("تم تحديث كافة الإعدادات بنجاح"))
      .catch((e: any) => alert("فشل الحفظ: " + e.message));
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4">
      <div className="w-full max-w-5xl h-[90vh] bg-[#0c0c12] border border-white/10 rounded-[3rem] flex flex-col overflow-hidden shadow-2xl ring-1 ring-white/10">
        <div className="p-8 border-b border-white/10 flex justify-between items-center bg-black/40">
          <div className="flex items-center gap-4 text-cyan-400 font-black text-2xl">
            <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center"><Shield size={28} /></div>
            نظام الإدارة المتكامل
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-full hover:bg-white/5 flex items-center justify-center text-white/40 hover:text-white text-3xl transition-all">&times;</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Admin Side Nav */}
          <div className="w-24 md:w-60 bg-black/60 border-l border-white/5 flex flex-col p-4 gap-3">
            <AdminNavBtn active={adminTab === 'inbox'} onClick={() => setAdminTab('inbox')} icon={<Mail />} label="البريد الوارد" />
            <AdminNavBtn active={adminTab === 'music'} onClick={() => setAdminTab('music')} icon={<MusicIcon />} label="إدارة الأغاني" />
            <AdminNavBtn active={adminTab === 'pages'} onClick={() => setAdminTab('pages')} icon={<Settings />} label="بناء الصفحات" />
            <AdminNavBtn active={adminTab === 'settings'} onClick={() => setAdminTab('settings')} icon={<Settings />} label="إعدادات النظام" />
            <button
              onClick={() => { signOut(auth); onClose(); }}
              className="mt-auto flex items-center gap-4 p-4 text-red-400 hover:bg-red-400/10 rounded-2xl transition-all font-black"
            >
              <LogOut size={24} /> <span className="hidden md:inline">تسجيل الخروج</span>
            </button>
          </div>

          {/* Admin View Area */}
          <div className="flex-1 overflow-y-auto p-10 no-scrollbar">
            {/* Inbox Tab */}
            {adminTab === 'inbox' && (
              <div className="space-y-6">
                <h3 className="text-3xl font-black mb-10 flex items-center justify-between">
                  صندوق الوارد <span className="bg-cyan-500/20 text-cyan-400 px-4 py-1 rounded-full text-sm font-black">{messages.length} رسالة</span>
                </h3>
                {messages.length === 0 && <div className="text-white/10 text-center py-20 text-xl font-bold">لا توجد رسائل جديدة حالياً</div>}
                {messages.map(m => (
                  <div key={m.id} className="bg-white/5 border border-white/10 p-6 rounded-[2rem] flex items-start gap-6 hover:bg-white/10 transition-all group">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-cyan-600/20 flex items-center justify-center text-cyan-400 font-black text-2xl uppercase">
                      {m.name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="font-black text-xl text-white mb-2 flex items-center gap-3">
                        {m.name}
                        {(m as any).visitorId && (
                          <span className="text-[10px] font-mono text-white/20 font-normal">#{(m as any).visitorId}</span>
                        )}
                      </div>
                      <div className="text-lg text-white/60 leading-relaxed bg-black/30 p-4 rounded-2xl">{m.msg}</div>
                    </div>
                    <button onClick={() => remove(ref(db, `inbox/${m.id}`)).catch(e => console.error(e))} className="text-red-500/30 hover:text-red-500 p-3 rounded-full hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={24} /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Music Admin Tab */}
            {adminTab === 'music' && (
              <div>
                <h3 className="text-3xl font-black mb-10">إدارة المحتوى الصوتي</h3>
                <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem] mb-12 space-y-6 shadow-xl ring-1 ring-white/5">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-white/40 mr-2">اختيار المجلد</label>
                      <select
                        value={selectedFolder}
                        onChange={e => setSelectedFolder(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl text-lg font-bold"
                      >
                        <option value="new">++ إنشاء مجلد جديد ++</option>
                        {Object.keys(folders).map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    {selectedFolder === 'new' && (
                      <div className="space-y-2">
                        <label className="text-xs font-black text-white/40 mr-2">اسم المجلد الجديد</label>
                        <input
                          value={newFolderName}
                          onChange={e => setNewFolderName(e.target.value)}
                          placeholder="أدخل اسماً للمجلد"
                          className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl text-lg"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-white/40 mr-2">اسم الأغنية</label>
                      <input value={newSongTitle} onChange={e => setNewSongTitle(e.target.value)} placeholder="مثال: لحن الخلود" className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl text-lg" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-white/40 mr-2">رابط ملف MP3</label>
                      <input value={newSongUrl} onChange={e => setNewSongUrl(e.target.value)} placeholder="https://..." className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl text-lg font-mono" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-white/40 mr-2">رابط صورة الغلاف</label>
                    <input value={newSongImg} onChange={e => setNewSongImg(e.target.value)} placeholder="https://..." className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl text-lg font-mono" />
                  </div>
                  <button onClick={addMusicAdmin} className="w-full py-5 bg-cyan-600 rounded-[2rem] font-black text-xl shadow-2xl shadow-cyan-600/20 hover:scale-[1.02] active:scale-95 transition-all">إضافة الملف الآن</button>
                </div>

                <div className="space-y-3">
                  {songs.map(s => (
                    <div key={s.id} className="flex items-center gap-6 p-4 bg-white/5 rounded-[1.5rem] border border-white/5 hover:border-white/10 transition-all group">
                      <img src={s.image} loading="lazy" className="w-16 h-16 rounded-xl object-cover shadow-lg" />
                      <div className="flex-1 truncate">
                        <div className="font-black text-lg">{s.name}</div>
                        <div className="text-xs text-white/30 font-bold uppercase tracking-widest">{s.folder}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => update(ref(db, 'settings'), { defaultSongId: s.id }).catch(e => console.error(e))}
                          className={`w-12 h-12 rounded-full transition-all flex items-center justify-center ${settings.defaultSongId === s.id ? 'bg-yellow-500 text-black' : 'bg-white/5 text-white/20'}`}
                        >
                          <Heart size={20} fill={settings.defaultSongId === s.id ? "currentColor" : "none"} />
                        </button>
                        <button onClick={() => confirm('هل أنت متأكد من الحذف؟') && remove(ref(db, `music/${s.id}`)).catch(e => console.error(e))} className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><Trash2 size={20} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {adminTab === 'settings' && (
              <div className="space-y-10">
                <h3 className="text-3xl font-black">إعدادات النظام الأساسية</h3>

                <div className="space-y-8 bg-white/5 p-10 rounded-[3rem] border border-white/10 shadow-2xl">
                  <div className="space-y-3">
                    <label className="block text-sm font-black text-cyan-400 mr-2">نص الترحيب الرئيسي</label>
                    <input
                      value={draftSettings.welcome}
                      onChange={e => setDraftSettings({ ...draftSettings, welcome: e.target.value })}
                      className="w-full bg-black/60 border border-white/10 p-5 rounded-2xl text-xl font-black text-center"
                    />
                  </div>

                  <div className="flex items-center justify-between p-6 bg-cyan-500/5 rounded-[2rem] border border-cyan-500/10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400"><Users size={24} /></div>
                      <div>
                        <div className="font-black text-lg">عداد الزيارات</div>
                        <div className="text-xs text-white/30">إظهار عدد زوار الموقع للعامة</div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={draftSettings.showVisitorCount}
                        onChange={e => setDraftSettings({ ...draftSettings, showVisitorCount: e.target.checked })}
                      />
                      <div className="w-14 h-7 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                    </label>
                  </div>

                  <div className="p-10 bg-purple-500/5 rounded-[3rem] border border-purple-500/20 space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5"><Zap size={100} /></div>
                    <h4 className="text-2xl font-black text-purple-400 flex items-center gap-3"><Sparkles size={24} /> محرك العرض (Hero Engine)</h4>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-black text-lg">وضع Hero الثابت</div>
                        <div className="text-xs text-white/30">تجاهل خلفيات الأغاني واستخدام خلفية ثابتة</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={draftSettings.heroMode}
                          onChange={e => setDraftSettings({ ...draftSettings, heroMode: e.target.checked })}
                        />
                        <div className="w-14 h-7 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-black text-white/40 mr-2">رابط الوسائط (صورة/فيديو)</label>
                      <input
                        value={draftSettings.heroImg}
                        onChange={e => setDraftSettings({ ...draftSettings, heroImg: e.target.value })}
                        placeholder="ضع الرابط هنا"
                        className="w-full bg-black/60 border border-white/10 p-5 rounded-2xl text-lg font-mono"
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-white/40 mr-2">نوع الوسائط</label>
                        <select
                          value={draftSettings.heroType}
                          onChange={e => setDraftSettings({ ...draftSettings, heroType: e.target.value as any })}
                          className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl font-bold"
                        >
                          <option value="image">صورة احترافية</option>
                          <option value="video">فيديو تفاعلي</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-white/40 mr-2">نمط الملاءمة</label>
                        <select
                          value={draftSettings.bgFit}
                          onChange={e => setDraftSettings({ ...draftSettings, bgFit: e.target.value as any })}
                          className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl font-bold"
                        >
                          <option value="cover">ملء كامل (Cover)</option>
                          <option value="contain">احتواء ذكي (Contain)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveSettings}
                    className="w-full py-6 bg-gradient-to-r from-cyan-600 to-purple-600 rounded-[2rem] font-black text-2xl shadow-2xl shadow-cyan-600/30 hover:scale-[1.01] active:scale-95 transition-all"
                  >
                    حفظ التعديلات
                  </button>
                </div>
              </div>
            )}

            {/* Pages Tab */}
            {adminTab === 'pages' && (
              <div className="space-y-8">
                <h3 className="text-3xl font-black">منشئ المحتوى التفاعلي</h3>
                <div className="bg-white/5 p-10 rounded-[3rem] border border-white/10 space-y-6 shadow-2xl">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-white/40 mr-2">مُعرف الصفحة (English ID)</label>
                      <input id="pg-id" placeholder="مثال: about_us" className="w-full bg-black/60 border border-white/10 p-5 rounded-2xl font-bold" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-white/40 mr-2">عنوان القائمة (Arabic)</label>
                      <input id="pg-title" placeholder="مثال: من نحن" className="w-full bg-black/60 border border-white/10 p-5 rounded-2xl font-bold" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-white/40 mr-2">محتوى الصفحة (HTML / Text)</label>
                    <textarea id="pg-content" rows={12} placeholder="اكتب محتوى الصفحة هنا بصيغة HTML..." className="w-full bg-black/60 border border-white/10 p-6 rounded-[2rem] text-lg font-mono leading-relaxed" />
                  </div>
                  <button
                    onClick={() => {
                      const id = (document.getElementById('pg-id') as HTMLInputElement).value;
                      const title = (document.getElementById('pg-title') as HTMLInputElement).value;
                      const content = (document.getElementById('pg-content') as HTMLTextAreaElement).value;
                      if (id && title) {
                        set(ref(db, `custom_pages/${id}`), { title, content, icon: 'MoreHorizontal' }).then(() => alert("تم نشر الصفحة بنجاح!")).catch(e => alert("خطأ في الصلاحيات: " + e.message));
                      } else {
                        alert("يرجى إكمال الحقول الأساسية");
                      }
                    }}
                    className="w-full py-6 bg-purple-600 rounded-full font-black text-xl shadow-2xl shadow-purple-600/20 hover:scale-[1.02] transition-all"
                  >
                    نشر الصفحة الجديدة
                  </button>
                </div>

                <div className="grid gap-4">
                  <h4 className="text-xl font-black text-white/40 mt-8 mb-4">الصفحات الحالية</h4>
                  {customPages.map(pg => (
                    <div key={pg.id} className="flex items-center justify-between p-6 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all">
                      <div className="font-black text-lg">{pg.title} <span className="text-xs text-white/20 ml-2">({pg.id})</span></div>
                      <button onClick={() => confirm('حذف الصفحة؟') && remove(ref(db, `custom_pages/${pg.id}`)).catch(e => console.error(e))} className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><Trash2 size={18} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminModal;
