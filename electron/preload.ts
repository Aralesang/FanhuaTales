/**
 * Electron preload 脚本。
 *
 * 当前没有需要从主进程暴露给渲染进程的 API，因此这里只是一个占位骨架。
 * 未来若需要例如「保存存档到本地文件」这类能力，应在此处通过
 * contextBridge.exposeInMainWorld('api', { ... }) 进行受控暴露，
 * 而不是直接在游戏代码中使用 `require('electron')`，以保持 contextIsolation 安全模型。
 */
export {};
