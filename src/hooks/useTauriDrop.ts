import { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { readFile } from "@tauri-apps/plugin-fs";

/**
 * Hook that listens for native OS file drag-drop events from Tauri
 * and converts them into File objects suitable for the upload pipeline.
 *
 * Usage:
 *   useTauriDrop((files: File[]) => uploadFiles(files));
 */
export function useTauriDrop(onFiles: (files: File[]) => void) {
    const handleNativeDrop = useCallback(
        async (paths: string[]) => {
            const files: File[] = [];
            for (const path of paths) {
                try {
                    const data = await readFile(path);
                    const name = path.split("/").pop()?.split("\\").pop() || "unknown.xlsx";
                    const ext = name.toLowerCase();
                    let mime = "application/octet-stream";
                    if (ext.endsWith(".xlsx"))
                        mime =
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                    else if (ext.endsWith(".xls"))
                        mime = "application/vnd.ms-excel";

                    const file = new File([data], name, { type: mime });
                    files.push(file);
                } catch (err) {
                    console.warn(`Failed to read dropped file: ${path}`, err);
                }
            }
            if (files.length > 0) {
                onFiles(files);
            }
        },
        [onFiles]
    );

    useEffect(() => {
        const unlisten = listen<string[]>("native-file-drop", (event) => {
            handleNativeDrop(event.payload);
        });
        return () => {
            unlisten.then((fn) => fn());
        };
    }, [handleNativeDrop]);
}
