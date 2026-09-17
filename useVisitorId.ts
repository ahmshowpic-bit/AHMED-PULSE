import { useEffect, useState } from 'react';
import { db, ref, get, set, update } from '../firebase';

const STORAGE_KEY = 'pulse_visitor_id';

function generateVisitorId(): string {
  const time = Date.now().toString(36).slice(-4).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PULSE-${time}${rand}`;
}

/**
 * يمنح كل زائر معرّفاً ثابتاً يُخزَّن في localStorage فيبقى نفسه في كل
 * زياراته القادمة على نفس الجهاز، ويسجّل/يحدّث بياناته الأساسية في
 * قاعدة البيانات (أول زيارة/آخر زيارة/عدد الزيارات) دون أي تأثير على
 * أداء الواجهة (العملية بالكامل غير متزامنة ولا تحجب الرندر).
 */
export function useVisitorId(): string {
  const [visitorId, setVisitorId] = useState('');

  useEffect(() => {
    let id = '';
    try {
      id = localStorage.getItem(STORAGE_KEY) || '';
    } catch (e) {
      // localStorage قد لا يكون متاحاً (وضع خاص مثلاً)
    }

    if (!id) {
      id = generateVisitorId();
      try { localStorage.setItem(STORAGE_KEY, id); } catch (e) { /* تجاهل */ }
    }
    setVisitorId(id);

    const visitorRef = ref(db, `visitors/${id}`);
    get(visitorRef)
      .then((snap) => {
        if (snap.exists()) {
          const current = snap.val();
          update(visitorRef, {
            lastSeen: Date.now(),
            visits: (current.visits || 0) + 1,
          }).catch(() => {});
        } else {
          set(visitorRef, {
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            visits: 1,
            userAgent: navigator.userAgent,
          }).catch(() => {});
        }
      })
      .catch(() => {
        // لو صلاحيات قاعدة البيانات مقيدة، الهوية المحلية تبقى شغالة برضه
      });
  }, []);

  return visitorId;
}
