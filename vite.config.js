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

export default defineConfig({
  plugins: [appNamePlugin()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
