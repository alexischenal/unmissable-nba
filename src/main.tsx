// src/main.tsx
// Entry point: mounts the app.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
// Self-hosted fonts (Fontsource): plain CSS packages, imported here rather than from the SCSS
import '@fontsource/big-shoulders-display/700';
import '@fontsource/big-shoulders-display/900';
import '@fontsource/barlow-condensed/500';
import '@fontsource/barlow-condensed/600';
import './styles.scss';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
