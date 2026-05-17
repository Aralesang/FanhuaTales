import { defineConfig } from 'vite';

export default defineConfig({
    // 项目根目录（index.html 所在位置）
    root: './',

    // Electron 通过 file:// 协议加载构建产物时必须使用相对路径，否则 /assets/xxx 会被解析为磁盘根目录
    base: './',

    // 开发服务器配置
    server: {
        port: 8000,
        // 由 Electron 加载页面，不再让浏览器自动打开
        open: false,
        host: true  // 允许通过局域网 IP 访问
    },

    // 静态资源处理
    publicDir: 'public'
});