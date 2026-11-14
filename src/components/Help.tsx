// src/components/Help.tsx
// The "?" on the right of the header, drawn like the rating box: the concept in a few lines.
//   - Opens on hover (mouse) and on click / tap; a click pins it open on desktop.
//   - A click outside, Escape or leaving it (unless pinned) folds it back.
//   - It grows from the button's corner (scale + fade), see _header.scss.

import { useEffect, useId, useRef, useState } from 'react';
import { ABOUT_URL } from '../lib/night.ts';

const CAN_HOVER = window.matchMedia?.('(hover: hover)').matches ?? false;

export function Help() {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setPinned(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      setPinned(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // Hover: open at once, close a little after leaving (time to reach the pop-up from the button)
  const onEnter = () => {
    if (!CAN_HOVER) return;
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const onLeave = () => {
    if (!CAN_HOVER || pinned) return;
    closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  };
  const onClick = () => {
    if (CAN_HOVER) {
      // Already open by hovering: the click pins it (or unpins and closes it)
      const next = !pinned;
      setPinned(next);
      setOpen(next);
    } else {
      setOpen((o) => !o);
    }
  };

  return (
    <div className="header__help" ref={rootRef} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <button
        ref={buttonRef}
        type="button"
        className="header__help-button"
        aria-label="What is Unmissable?"
        aria-expanded={open}
        aria-controls={popId}
        onClick={onClick}
      >
        <span>?<span className="header__help-unit">%</span></span>
      </button>
      <div
        id={popId}
        className={`header__help-pop${open ? ' header__help-pop--open' : ''}`}
        role="dialog"
        aria-label="What is Unmissable?"
      >
        <p className="header__help-text">
          <strong>Every NBA game, rated without spoilers.</strong>
          <br />
          Minutes after the final buzzer.
        </p>
        <p className="header__help-text">
          The higher the percentage, the more it&rsquo;s worth watching.
        </p>
        <p className="header__help-text header__help-flame">
          <span className="header__help-badge" aria-hidden="true">
            <svg className="header__help-icon"><use href="/sprite.svg#flame" /></svg>
          </span>
          A flame means somebody cooked.
        </p>
        <a className="header__help-link" href={ABOUT_URL}>How it works</a>
      </div>
    </div>
  );
}
