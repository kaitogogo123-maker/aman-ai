'use client';

import { useEffect, useRef, useState } from 'react';

export interface LightboxItem {
  url: string;
  alt?: string;
  caption?: string;
}

export function ImageLightbox({
  items,
  activeIndex,
  onClose,
  onIndexChange
}: {
  items: LightboxItem[];
  activeIndex: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const touchStartX = useRef<number | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const current = items[activeIndex];
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < items.length - 1;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImageLoaded(false);
  }, [activeIndex]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowLeft' && hasPrev) {
        onIndexChange(activeIndex - 1);
      } else if (event.key === 'ArrowRight' && hasNext) {
        onIndexChange(activeIndex + 1);
      }
    }

    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [activeIndex, hasPrev, hasNext, onClose, onIndexChange]);

  if (!current) {
    return null;
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta > 0 && hasPrev) {
      onIndexChange(activeIndex - 1);
    } else if (delta < 0 && hasNext) {
      onIndexChange(activeIndex + 1);
    }
  }

  return (
    <div
      className={`image-lightbox ${items.length > 1 ? 'has-thumbs' : ''}`}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        type="button"
        className="image-lightbox__close"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="Close"
      >
        ✕
      </button>

      {hasPrev ? (
        <button
          type="button"
          className="image-lightbox__nav image-lightbox__nav--prev"
          onClick={(event) => {
            event.stopPropagation();
            onIndexChange(activeIndex - 1);
          }}
          aria-label="Previous image"
        >
          ‹
        </button>
      ) : null}

      <div className="image-lightbox__stage" onClick={(event) => event.stopPropagation()}>
        {!imageLoaded ? <div className="image-lightbox__spinner" aria-hidden="true" /> : null}
        <img
          key={current.url}
          src={current.url}
          alt={current.alt ?? ''}
          className="image-lightbox__img"
          onLoad={() => setImageLoaded(true)}
        />
        {current.caption ? <div className="image-lightbox__caption">{current.caption}</div> : null}
      </div>

      {hasNext ? (
        <button
          type="button"
          className="image-lightbox__nav image-lightbox__nav--next"
          onClick={(event) => {
            event.stopPropagation();
            onIndexChange(activeIndex + 1);
          }}
          aria-label="Next image"
        >
          ›
        </button>
      ) : null}

      {items.length > 1 ? (
        <div className="image-lightbox__thumbs" onClick={(event) => event.stopPropagation()}>
          {items.map((item, index) => (
            <button
              key={item.url}
              type="button"
              className={index === activeIndex ? 'active' : ''}
              onClick={() => onIndexChange(index)}
              aria-label={`${index + 1} / ${items.length}`}
            >
              <img src={item.url} alt="" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
