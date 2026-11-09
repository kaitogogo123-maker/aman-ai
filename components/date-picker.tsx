'use client';

import { useEffect, useRef, useState } from 'react';
import type { SupportedLocale } from '@/lib/i18n';

// 本地化日历弹层选择器:一个按钮显示已选日期(本地化格式),点击弹出月历网格选日,
// 避免原生 <input type=date> 漏中文 + 替代笨重的 年/月/日 三下拉。value 契约仍是 YYYY-MM-DD 或 ''。
const MONTHS: Record<SupportedLocale, string[]> = {
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  kk: ['Қаңтар', 'Ақпан', 'Наурыз', 'Сәуір', 'Мамыр', 'Маусым', 'Шілде', 'Тамыз', 'Қыркүйек', 'Қазан', 'Қараша', 'Желтоқсан'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  zh: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
};

// 周一开头(CIS 习惯),周日结尾
const WEEKDAYS: Record<SupportedLocale, string[]> = {
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  kk: ['Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб', 'Жс'],
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
  zh: ['一', '二', '三', '四', '五', '六', '日']
};

const PLACEHOLDER: Record<SupportedLocale, string> = {
  ru: 'Выберите дату',
  kk: 'Күнді таңдаңыз',
  en: 'Select date',
  zh: '选择日期'
};

function fmt(locale: SupportedLocale, y: number, m: number, d: number) {
  const month = MONTHS[locale][m - 1];
  if (locale === 'zh') return `${y}年${m}月${d}日`;
  if (locale === 'en') return `${month} ${d}, ${y}`;
  return `${d} ${month.toLowerCase()} ${y}`;
}

// 该月 1 号是周几(转成 周一=0 … 周日=6)
function leadingBlanks(year: number, month1: number) {
  const jsDay = new Date(year, month1 - 1, 1).getDay(); // 0=周日
  return (jsDay + 6) % 7;
}

export function DatePicker({
  locale,
  value,
  onChange,
  min,
  max
}: {
  locale: SupportedLocale;
  value: string; // YYYY-MM-DD 或 ''
  onChange: (next: string) => void;
  min?: string; // 可选下限 YYYY-MM-DD,早于它的日期不可选
  max?: string; // 可选上限 YYYY-MM-DD,晚于它的日期不可选
}) {
  const today = new Date();
  const sel = value ? value.split('-').map((n) => parseInt(n, 10)) : null;
  const [open, setOpen] = useState(false);
  const [viewY, setViewY] = useState(sel ? sel[0] : today.getFullYear());
  const [viewM, setViewM] = useState(sel ? sel[1] : today.getMonth() + 1); // 1-12
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function prevMonth() {
    setViewM((m) => {
      if (m === 1) {
        setViewY((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  }

  function nextMonth() {
    setViewM((m) => {
      if (m === 12) {
        setViewY((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
  }

  function pick(day: number) {
    onChange(`${viewY}-${String(viewM).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    setOpen(false);
  }

  const daysCount = new Date(viewY, viewM, 0).getDate();
  const blanks = leadingBlanks(viewY, viewM);

  return (
    <div className="date-picker" ref={ref}>
      <button type="button" className={`date-field-btn ${value ? 'filled' : ''}`} onClick={() => setOpen((o) => !o)}>
        <span>{sel ? fmt(locale, sel[0], sel[1], sel[2]) : PLACEHOLDER[locale]}</span>
        <span className="date-field-ic" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
            <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
          </svg>
        </span>
      </button>

      {open ? (
        <div className="date-cal" role="dialog">
          <div className="date-cal-head">
            <button type="button" onClick={prevMonth} aria-label="prev">‹</button>
            <b>{locale === 'zh' ? `${viewY}年${viewM}月` : `${MONTHS[locale][viewM - 1]} ${viewY}`}</b>
            <button type="button" onClick={nextMonth} aria-label="next">›</button>
          </div>
          <div className="date-cal-grid date-cal-wd">
            {WEEKDAYS[locale].map((w) => (
              <span key={w} className="date-cal-wdcell">{w}</span>
            ))}
          </div>
          <div className="date-cal-grid">
            {Array.from({ length: blanks }, (_, i) => (
              <span key={`b${i}`} />
            ))}
            {Array.from({ length: daysCount }, (_, i) => i + 1).map((day) => {
              const isSel = sel && sel[0] === viewY && sel[1] === viewM && sel[2] === day;
              const dateStr = `${viewY}-${String(viewM).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const disabled = (min ? dateStr < min : false) || (max ? dateStr > max : false);
              return (
                <button
                  key={day}
                  type="button"
                  className={`date-cal-day ${isSel ? 'sel' : ''}`}
                  onClick={() => pick(day)}
                  disabled={disabled}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
