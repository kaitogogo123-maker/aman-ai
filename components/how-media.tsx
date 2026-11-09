'use client';

import { useEffect, useState } from 'react';

// "如何工作"步骤媒体:可点击切换画廊(缩略图竖条 + 大图 + 浮动平台徽章 + 自动轮播)。
// 大图用"多图叠放 + 仅切 opacity"实现平滑交叉淡化(无重挂载/缩放跳动)。
export function HowMedia({ images, badge }: { images: string[]; badge?: string }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const next = () => setActive((i) => (i + 1) % images.length);

  useEffect(() => {
    if (paused || images.length < 2) return;
    const t = setInterval(next, 4500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, images.length]);

  return (
    <div
      className="how-step-media"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') {
          setPaused(true);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') {
          setPaused(false);
        }
      }}
    >
      <div className="how-thumbs">
        {images.map((src, i) => (
          <button
            key={src}
            type="button"
            className={`how-thumb ${active === i ? 'active' : ''}`}
            onClick={() => setActive(i)}
            aria-label={`Превью ${i + 1}`}
          >
            <img src={src} alt="" loading="lazy" decoding="async" />
          </button>
        ))}
      </div>
      <div
        className="how-main"
        role="button"
        tabIndex={0}
        onClick={next}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            next();
          }
        }}
        aria-label="Следующее изображение"
      >
        {images.map((src, i) => (
          <img
            key={src}
            className={`how-media-img ${active === i ? 'is-active' : ''}`}
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ))}
        {badge ? <img className="how-badge" src={badge} alt="" loading="lazy" decoding="async" /> : null}
      </div>
    </div>
  );
}
