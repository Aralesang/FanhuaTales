import { app, BrowserWindow, Menu } from 'electron';
import * as path from 'path';

/**
 * 应用主窗口引用。在 macOS 上需要保留以处理 dock 重新激活。
 */
let mainWindow: BrowserWindow | null = null;

/**
 * Vite dev server URL（开发模式由脚本通过环境变量注入）。
 * 当未设置时，视为生产模式并加载本地构建产物。
 */
const VITE_DEV_SERVER_URL: string | undefined = process.env.VITE_DEV_SERVER_URL;

/**
 * 创建主窗口。
 * - 开发模式：加载 Vite dev server 的 URL，并自动打开 DevTools 便于调试。
 * - 生产模式：加载 `dist/index.html`（由 `vite build` 产出）。
 */
function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#000000',
        title: '繁花物语',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    // 游戏窗口隐藏原生菜单栏（菜单干扰键位绑定）
    Menu.setApplicationMenu(null);

    if (VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        // __dirname 在运行时指向 dist-electron/，构建产物在同级目录 dist/
        const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
        mainWindow.loadFile(indexPath);
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    // macOS 习惯：点击 dock 图标且无窗口时重新创建一个
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 除 macOS 外，关闭所有窗口即退出
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
