import { defineConfig } from 'wxt';
import { sanitizeExtensionHtml } from './lib/extension-html';
import { BUILTIN_HOST_PERMISSIONS } from './lib/safe-url';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  dev: {
    server: {
      port: 58417,
    },
  },
  vite: () => ({
    build: {
      modulePreload: false,
      sourcemap: false,
    },
    plugins: [
      {
        name: 'whu-strip-extension-cors',
        transformIndexHtml: {
          order: 'post',
          handler(html: string) {
            return sanitizeExtensionHtml(html);
          },
        },
      },
    ],
  }),
  manifest: {
    name: '武大成分检测',
    description: '手动核查新闻稿署名人员公开履历中是否出现武汉大学。进页不请求；点悬浮球才把清洗后的正文发给模型筛人。',
    minimum_chrome_version: '114',
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      128: '/icon/128.png',
    },
    action: {
      default_icon: {
        16: '/icon/16.png',
        32: '/icon/32.png',
        48: '/icon/48.png',
      },
    },
    permissions: ['storage', 'sidePanel', 'contextMenus', 'tabs'],
    host_permissions: [...BUILTIN_HOST_PERMISSIONS],
    optional_host_permissions: ['https://*/*'],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
  },
});
