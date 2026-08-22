import React, { useEffect, useRef, useState } from "react";
import { useApp } from "@/store/app";

// 声明 Wails 自动挂载至全局的 Go 后端接口类型约束
declare global {
    interface Window {
        go?: {
            main: {
                App: {
                    ReadPluginFile?: (pluginId: string, filename: string) => Promise<string>;
                }
            }
        }
    }
}

interface PluginPanelProps {
    pluginId: string;
}

export const PluginPanel: React.FC<PluginPanelProps> = ({ pluginId }) => {
    const { enabledPlugins } = useApp();
    const containerRef = useRef<HTMLDivElement>(null);
    const pluginInstanceRef = useRef<{ unmount?: () => void } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const pluginMeta = enabledPlugins[pluginId];

    useEffect(() => {
        if (!pluginMeta || !containerRef.current) return;

        let isMounted = true;
        let createdBlobUrl: string | null = null;

        const initPlugin = async () => {
            try {
                setError(null);

                // 1. 无损安全卸载旧实例句柄，防止内存泄漏和事件重复监听
                if (pluginInstanceRef.current?.unmount) {
                    pluginInstanceRef.current.unmount();
                }

                const container = containerRef.current;
                if (!container) return;

                // 2. 刷入主框架外壳骨架（包含精致的头部和独立的插件内容挂载槽：#plugin-runtime-root）
                container.innerHTML = `
          <div class="p-6 font-mono max-w-7xl mx-auto space-y-6 text-text-mid animate-fade-in">
            <div class="flex items-center justify-between border-b border-edge pb-4">
              <div>
                <h1 class="text-xl font-bold text-text-hi tracking-wider flex items-center gap-2">
                  🔌 PLUGIN · ${pluginMeta.name.toUpperCase()}
                </h1>
                <p class="text-[11px] text-text-lo mt-1">${pluginMeta.description || ''}</p>
              </div>
              <div class="text-[10px] bg-[#eee] border border-[#ddd] px-2 py-0.5 rounded-full text-accent font-mono">
                ${pluginMeta.id} @ v${pluginMeta.version || '0.1.0'}
              </div>
            </div>

            <div id="plugin-runtime-root" class="w-full"></div>
          </div>
        `;

                // 3. 构建提供给原生独立外部插件调用的全局上下文 API 运行时接口 (pt)
                // 完美对齐你的 index.js 内部使用的 pt.notes.search / create / update 逻辑
                const ptRuntime = {
                    notes: {
                        async search(query: string) {
                            const data = localStorage.getItem(`pt_plugin_vault_${query}`) || "[]";
                            return JSON.parse(data);
                        },
                        async create(noteObj: any) {
                            const id = crypto.randomUUID();
                            const newNote = { ...noteObj, id };
                            localStorage.setItem(`pt_plugin_vault_${noteObj.title}`, JSON.stringify([newNote]));
                            return newNote;
                        },
                        async update(noteObj: any) {
                            localStorage.setItem(`pt_plugin_vault_${noteObj.title}`, JSON.stringify([noteObj]));
                            return true;
                        }
                    },
                    ui: {
                        toast(msg: string, type: "info" | "success" | "warn" | "error" = "info") {
                            const toastBar = document.createElement('div');
                            toastBar.className = `fixed bottom-6 right-6 px-4 py-2 rounded font-mono text-xs border z-50 animate-slide-up shadow-lg ${
                                type === 'success' ? 'bg-emerald-950 text-emerald-400 border-emerald-500' :
                                    type === 'warn' ? 'bg-amber-950 text-amber-400 border-amber-500' :
                                        type === 'error' ? 'bg-rose-950 text-rose-400 border-rose-500' : 'bg-zinc-900 text-zinc-300 border-zinc-700'
                            }`;
                            toastBar.innerText = msg;
                            document.body.appendChild(toastBar);
                            setTimeout(() => toastBar.remove(), 2500);
                        },
                        async confirm(msg: string): Promise<boolean> {
                            return window.confirm(msg);
                        }
                    }
                };

                // 4. 🔀 核心跨界：调用在 app.go 里面绑定的 ReadPluginFile 方法去跨域抓取 C 盘下的明文代码
                let codeText = "";
                if (window.go?.main?.App?.ReadPluginFile) {
                    codeText = await window.go.main.App.ReadPluginFile(pluginMeta.id, pluginMeta.entry);
                } else {
                    throw new Error("Wails 后端未发现 App.ReadPluginFile 绑定方法，请先重启 Go 编译后端。");
                }

                if (!isMounted) return;

                // 5. 🚀 关键转换：将从磁盘读取出的 JS 源码文本转为内存中的同源虚拟 ESM 模块
                // 这样可以彻底绕过并免疫 Vite 编译期间对静态资源路径的干预和拦截
                const blob = new Blob([codeText], { type: "application/javascript" });
                createdBlobUrl = URL.createObjectURL(blob);

                const module = await import(/* @vite-ignore */ createdBlobUrl);

                if (!isMounted) return;

                if (module.default && typeof module.default === "function") {
                    // 6. 执行插件导出的默认默认 activate 入口，将运行时参数 pt 注入，获取生命周期对象
                    const pluginObject = module.default(ptRuntime);

                    // 7. 定位到专属挂载槽，将控制权全盘移交给插件自带的 mount() 进行 UI 构造和事件注册
                    const runtimeRoot = document.getElementById("plugin-runtime-root");
                    if (runtimeRoot && pluginObject && typeof pluginObject.mount === "function") {
                        await pluginObject.mount(runtimeRoot);
                    }

                    // 缓存当前插件对象，方便销毁时调用其自带的 unmount() 逻辑
                    pluginInstanceRef.current = pluginObject || null;
                } else {
                    throw new Error("插件入口文件必须 export default 一个激活函数。");
                }

            } catch (err: any) {
                console.error("Failed to load plugin active runtime:", err);
                if (isMounted) {
                    setError(err.message || "An unknown sandbox error occurred.");
                }
            }
        };

        initPlugin();

        return () => {
            isMounted = false;
            if (pluginInstanceRef.current?.unmount) {
                pluginInstanceRef.current.unmount();
            }
            if (createdBlobUrl) {
                URL.revokeObjectURL(createdBlobUrl);
            }
        };
    }, [pluginId, pluginMeta]);

    if (error) {
        return (
            <div className="p-6 font-mono text-rose-400 border border-rose-500/20 bg-rose-500/5 m-4 rounded">
                <h3 className="font-bold text-[14px]">🔌 PLUGIN RUNTIME CRASH</h3>
                <p className="text-[12px] mt-1 text-text-mid">{error}</p>
                <p className="text-[11px] text-text-lo mt-2 font-sans bg-[#f5f5f5] p-2 rounded border border-edge/30">
                    💡 诊断提示：请确认插件文件已正确放置在本地磁盘的{" "}
                    <code className="text-accent-dim bg-[#e8e8e8] px-1 rounded font-mono text-[11px]">
                        .personal-terminal/plugins/{pluginMeta?.id || "plugin-id"}/
                    </code>{" "}
                    路径下。
                </p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="w-full h-full overflow-y-auto"
            style={{ background: "transparent" }}
        />
    );
};