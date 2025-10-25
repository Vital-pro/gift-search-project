/* eslint-env browser */
/* global document */

import { initApp } from './src/app/init.js';

// Точка входа — без логики, всё в initApp()
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
