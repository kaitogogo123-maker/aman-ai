'use client';

import { useCallback, useEffect, useState } from 'react';

// hero 拼贴:默认先展示成品商品卡,后续再切普通商品图和不同平台样式。
const COLLAGE_SLIDES = [
  { sceneSrc: '/collage/hero-kz-premium-look-full.webp', cardSrc: '/collage/hero-kz-premium-result-full.webp' },
  { sceneSrc: '/collage/hero-model-look-full.webp', cardSrc: '/collage/hero-model-result-full.webp' },
  { sceneSrc: '/collage/hero-kz-knit-source-full.webp', cardSrc: '/collage/hero-kz-knit-result-full.webp' }
] as const;
const AUTOPLAY_MS = 4000;
const STACK_TURN_MS = 760;

type CollageState = {
  active: number;
  leaving: number | null;
  turn: number;
};

export function HeroCollage() {
  const [slideState, setSlideState] = useState<CollageState>({ active: 0, leaving: null, turn: 0 });
  const [paused, setPaused] = useState(false);
  const i = slideState.active;

  const turnTo = useCallback((target: number | ((current: number) => number)) => {
    setSlideState((current) => {
      const nextIndex = typeof target === 'function' ? target(current.active) : target;
      if (nextIndex === current.active) {
        return current;
      }

      return {
        active: nextIndex,
        leaving: current.active,
        turn: current.turn + 1
      };
    });
  }, []);
  const next = useCallback(() => turnTo((current) => (current + 1) % COLLAGE_SLIDES.length), [turnTo]);
  const goTo = useCallback((idx: number) => turnTo(idx), [turnTo]);

  useEffect(() => {
    if (slideState.leaving === null) return;
    const turn = slideState.turn;
    const timer = window.setTimeout(() => {
      setSlideState((current) => (current.turn === turn ? { ...current, leaving: null } : current));
    }, STACK_TURN_MS);

    return () => window.clearTimeout(timer);
  }, [slideState.leaving, slideState.turn]);

  useEffect(() => {
    if (paused) return;
    let timer: number | null = null;

    const clearTimer = () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const schedule = () => {
      clearTimer();
      if (document.hidden) return;
      timer = window.setTimeout(next, AUTOPLAY_MS);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearTimer();
        return;
      }
      schedule();
    };

    schedule();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [next, paused, i]);

  const stackClassName = (idx: number) => {
    const order = (idx - i + COLLAGE_SLIDES.length) % COLLAGE_SLIDES.length;
    const classes = ['collage-stack-card'];

    if (idx === i) {
      classes.push('is-active');
      if (slideState.turn > 0) {
        classes.push('is-entering');
      }
    } else if (idx === slideState.leaving) {
      classes.push('is-leaving');
    } else if (order === 1) {
      classes.push('is-next');
    } else {
      classes.push('is-back');
    }

    return classes.join(' ');
  };

  return (
    <div
      className="hero-collage"
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
      <button type="button" className="collage-model collage-switch" onClick={next} aria-label="Следующее изображение">
        {COLLAGE_SLIDES.map((slide, idx) => (
          <span key={`scene-${idx}`} className={stackClassName(idx)} data-stack-slot="scene">
            <img
              src={slide.sceneSrc}
              alt=""
              data-collage-slot="scene"
              fetchPriority={idx === 0 ? 'high' : 'low'}
            />
          </span>
        ))}
      </button>
      <button type="button" className="collage-dress collage-switch" onClick={next} aria-label="Следующее изображение">
        {COLLAGE_SLIDES.map((slide, idx) => (
          <span key={`card-${idx}`} className={stackClassName(idx)} data-stack-slot="card">
            <img
              src={slide.cardSrc}
              alt=""
              data-collage-slot="card"
              fetchPriority={idx === 0 ? 'high' : 'low'}
            />
          </span>
        ))}
      </button>
      <img className="collage-item-b" src="/collage/item-b.webp" alt="" fetchPriority="low" />
      <img className="collage-item-a" src="/collage/sweater.webp" alt="" fetchPriority="low" />
      <div className="collage-dots">
        {COLLAGE_SLIDES.map((slide, d) => (
          <button
            key={`${slide.cardSrc}-${d}`}
            type="button"
            className={d === i ? 'active' : ''}
            onClick={() => goTo(d)}
            aria-label={`Изображение ${d + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
