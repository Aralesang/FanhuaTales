import { defineConfig } from 'vite';

export default defineConfig({
    // 项目根目录（index.html 所在位置）
    root: './', 
    
    // 开发服务器配置
    server: {
        port: 8000,
        open: true, // 启动后自动打开浏览器
        host: true  // 允许通过局域网 IP 访问
    },

    // 静态资源处理
    publicDir: 'public'
});