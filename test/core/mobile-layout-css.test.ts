import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
const uploadFileMetaCss = css.match(/\.upload-file-meta\s*\{[^}]*\}/)?.[0] ?? '';
const collageBoxCss = css.match(/\.collage-model,\s*\n\.collage-dress\s*\{[^}]*\}/)?.[0] ?? '';
const collageStackCardCss = css.match(/\.collage-stack-card\s*\{[^}]*\}/)?.[0] ?? '';
const collageStackImgCss = css.match(/\.collage-stack-card img\s*\{[^}]*\}/)?.[0] ?? '';
const howThumbCss = css.match(/\.how-thumb\s*\{[^}]*\}/)?.[0] ?? '';
const howThumbActiveCss = css.match(/\.how-thumb\.active\s*\{[^}]*\}/)?.[0] ?? '';

describe('mobile layout css', () => {
  it('keeps H5 pages and help popovers inside the viewport', () => {
    expect(css).toMatch(/html,\s*\nbody\s*\{[\s\S]*overflow-x:\s*hidden/);
    expect(css).toMatch(/\.shell\s*\{[\s\S]*overflow-x:\s*clip/);
    expect(css).toMatch(/\.app-shell\s*\{[\s\S]*overflow-x:\s*clip/);
    expect(css).toMatch(/\.app-grid\s*\{[\s\S]*max-width:\s*100%/);
    expect(css).toMatch(/\.field-help p\s*\{[\s\S]*overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/\.field-help p\s*\{[\s\S]*position:\s*absolute/);
    expect(css).toMatch(/\.field-help p\s*\{[\s\S]*left:\s*0/);
    expect(css).toMatch(/\.field-help p\s*\{[\s\S]*bottom:\s*calc\(100% \+ 10px\)/);
    expect(css).toMatch(/\.field-help p\s*\{[\s\S]*width:\s*min\(320px,\s*calc\(100vw - 32px\)\)/);
    expect(css).toMatch(/\.field-help-button\s*\{[\s\S]*width:\s*18px[\s\S]*height:\s*18px/);
    expect(css).toMatch(/\.field-help-button::before\s*\{[\s\S]*width:\s*32px[\s\S]*height:\s*32px/);
    expect(css).not.toMatch(/@media \(max-width: 860px\)[\s\S]*\.field-help-button\s*\{[\s\S]*width:\s*32px/);
    expect(css).toMatch(
      /@media \(max-width: 860px\)[\s\S]*\.field-help\.open p\s*\{[\s\S]*position:\s*fixed[\s\S]*left:\s*16px[\s\S]*right:\s*16px[\s\S]*top:\s*auto[\s\S]*bottom:\s*calc\(96px \+ env\(safe-area-inset-bottom\)\)[\s\S]*overflow:\s*auto/
    );
    expect(css).not.toMatch(/\.field-help\.open p\s*\{[\s\S]*top:\s*calc\(96px \+ env\(safe-area-inset-top\)\)/);
  });

  it('keeps app scrolling stable without containing fixed help popovers', () => {
    expect(css).not.toMatch(/\.app-shell\s*\{[\s\S]*touch-action:\s*pan-y/);
    expect(css).toMatch(/\.upload-preview\s*\{[\s\S]*aspect-ratio:\s*4 \/ 3/);
    expect(css).toMatch(/\.upload-preview\s*\{[\s\S]*object-fit:\s*cover/);
    expect(css).not.toMatch(/\.panel\s*\{[\s\S]*content-visibility:/);
    expect(css).not.toMatch(/\.panel\s*\{[\s\S]*contain-intrinsic-size:/);
  });

  it('uses the shared animated loading dots for inline AI actions', () => {
    expect(css).toMatch(/\.analysis-inline-button:disabled\s*\{[\s\S]*cursor:\s*wait/);
    expect(css).toMatch(/\.loading-dots span\s*\{[\s\S]*animation:\s*dot-blink/);
  });

  it('keeps hero collage floating on real mobile browsers', () => {
    expect(css).toContain('@keyframes collage-float');
    expect(css).toContain('translate3d(0, var(--float-y, -12px), 0) rotate(var(--tilt, 0deg))');
    expect(css).toMatch(/\.collage-model\s*\{[\s\S]*position:\s*absolute[\s\S]*--tilt:\s*-2deg[\s\S]*animation:\s*collage-float/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.collage-model,\s*\n\s*\.collage-dress,\s*\n\s*\.collage-item-a,\s*\n\s*\.collage-item-b\s*\{[\s\S]*animation-duration:\s*12s/);
    expect(css).not.toContain('rotate: -2deg;');
    expect(css).not.toContain('@keyframes float-a');
    expect(css).not.toMatch(/\.hero-collage,\s*\.collage-model,\s*\.collage-dress,\s*\.collage-item-a,\s*\.collage-item-b\s*\{\s*animation:\s*none/);
  });

  it('keeps hero collage slide boxes fixed while the main cards use a stacked carousel', () => {
    expect(collageBoxCss).toContain('overflow: visible');
    expect(collageBoxCss).not.toContain('background: var(--white)');
    expect(css).toMatch(/\.collage-stack-card\s*\{[\s\S]*position:\s*absolute[\s\S]*transition:\s*transform/);
    expect(css).toMatch(/\.collage-stack-card\.is-active\s*\{[\s\S]*z-index:\s*5[\s\S]*transform:\s*translate3d\(0,\s*0,\s*0\)/);
    expect(css).toMatch(/\.collage-stack-card\.is-next\s*\{[\s\S]*z-index:\s*4[\s\S]*translate3d\(8%,\s*4%,\s*0\)/);
    expect(css).toMatch(/\.collage-stack-card\.is-back\s*\{[\s\S]*z-index:\s*3[\s\S]*translate3d\(15%,\s*8%,\s*0\)/);
    expect(css).toMatch(/\.collage-stack-card\.is-leaving\s*\{[\s\S]*animation:\s*collage-stack-exit/);
    expect(css).toContain('@keyframes collage-stack-exit');
    expect(css).not.toContain('collage-page-in');
    expect(css).not.toContain('collage-page-out');
    expect(css).not.toMatch(/\.collage-switch:hover\s*\{[\s\S]*z-index:/);
    expect(css).not.toMatch(/\.collage-switch:hover\s*\{[\s\S]*scale:/);
    expect(collageStackCardCss).not.toContain('background: var(--white)');
    expect(collageStackCardCss).not.toContain('border:');
    expect(collageStackImgCss).toContain('object-fit: cover');
    expect(collageStackImgCss).not.toContain('object-fit: contain');
    expect(css).toMatch(/\.collage-dress\s*\{[\s\S]*aspect-ratio:\s*560 \/ 683/);
  });

  it('keeps process thumbnails selected without a green frame', () => {
    expect(howThumbCss).toContain('border: 0');
    expect(howThumbCss).not.toContain('border: 2px solid transparent');
    expect(howThumbActiveCss).not.toContain('border-color: #8bd34f');
    expect(howThumbActiveCss).not.toContain('border-color: transparent');
    expect(howThumbActiveCss).not.toContain('box-shadow');
    expect(howThumbActiveCss).toContain('transform: translateY(-2px)');
  });

  it('keeps mobile proof cards on the single comparison image layout', () => {
    expect(css).toMatch(/\.proof-media\s*\{[\s\S]*aspect-ratio:\s*1774 \/ 887/);
    expect(css).not.toContain('.proof-shot');
    expect(css).not.toMatch(/@media \(max-width: 860px\)[\s\S]*\.proof-media\s*\{[\s\S]*grid-template-columns/);
  });

  it('lets upload hint text wrap instead of truncating it on mobile', () => {
    expect(uploadFileMetaCss).toContain('white-space: normal');
    expect(uploadFileMetaCss).toContain('overflow-wrap: anywhere');
    expect(uploadFileMetaCss).not.toContain('text-overflow: ellipsis');
  });
});
