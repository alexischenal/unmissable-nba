// src/components/Menu.tsx
// The burger, left of the brand, and the menu it unfolds under the header.
//   - The menu lays over the page: it never pushes the content down.
//   - It unfolds from top to bottom (clip-path, see _header.scss).
//   - A click anywhere outside it, or Escape, folds it back.

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export type MenuItem = { href: string; label: ReactNode; key: string };

export function Menu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    // pointerdown rather than click: the menu folds as soon as the finger or the mouse goes down
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="header__menu-root" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="header__burger"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        {/* Three bars, as tall as the brand's capital letters (see _header.scss).
            Whole numbers on purpose: drawn at 31px (desktop), each bar falls on exactly 3 rows of
            pixels. With 3.2-tall bars, the middle one straddled 4 rows and looked thicker. */}
        <svg className="header__burger-icon" viewBox="0 0 25 31" aria-hidden="true">
          <rect x="0" y="0" width="25" height="3" fill="currentColor" />
          <rect x="0" y="14" width="25" height="3" fill="currentColor" />
          <rect x="0" y="28" width="25" height="3" fill="currentColor" />
        </svg>
        {/* Tablets (brand at 32px): the drawing above would land between pixels and the middle bar
            would look thicker. Its own drawing, in whole pixels: 26px tall, 2px bars, 10px gaps. */}
        <svg className="header__burger-icon-tablet" viewBox="0 0 21 26" aria-hidden="true">
          <rect x="0" y="0" width="21" height="2" fill="currentColor" />
          <rect x="0" y="12" width="21" height="2" fill="currentColor" />
          <rect x="0" y="24" width="21" height="2" fill="currentColor" />
        </svg>
      </button>

      {/* Closed: hidden from view, from the keyboard and from screen readers (visibility in the CSS) */}
      <nav id={menuId} className={open ? 'header__menu header__menu--open' : 'header__menu'} aria-label="Menu">
        <ul className="header__menu-list">
          {items.map((item) => (
            <li key={item.key}>
              <a className="header__night header__link" href={item.href}>{item.label}</a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
