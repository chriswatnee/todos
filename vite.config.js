import { defineConfig } from 'vite';
import { APP_NAME } from './src/config.js';

// Replaces %APP_NAME% placeholders in index.html so the name lives in one place.
function appNamePlugin() {
  return {
    name: 'app-name',
    transformIndexHtml(html) {
      return html.replaceAll('%APP_NAME%', APP_NAME);
    },
  };
}

// Strict Content Security Policy for the production build only. The dev server
// needs inline scripts and a websocket for HMR, so it is left alone.
// Allows: our own files, the Todoist API, and Google Fonts. Nothing else.
// frame-ancestors can't be set in a <meta>; hosts should send it as a header.
export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  'connect-src https://api.todoist.com',
  "img-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

function cspPlugin() {
  return {
    name: 'csp',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig({
  plugins: [appNamePlugin(), cspPlugin()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
