#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager, State};

struct SidecarState {
    child: Mutex<Option<Child>>,
    port: u16,
}

#[tauri::command]
fn get_sidecar_port(state: State<SidecarState>) -> u16 {
    state.port
}

#[tauri::command]
fn get_sidecar_status(state: State<SidecarState>) -> String {
    let guard = state.child.lock().unwrap();
    match &*guard {
        Some(_) => "running".to_string(),
        None => "stopped".to_string(),
    }
}

fn wait_for_sidecar(port: u16, timeout_secs: u32) -> bool {
    let client = reqwest::blocking::Client::new();
    for _ in 0..timeout_secs * 2 {
        if let Ok(resp) = client
            .get(format!("http://127.0.0.1:{}/api/health", port))
            .timeout(Duration::from_millis(500))
            .send()
        {
            if resp.status().is_success() {
                return true;
            }
        }
        thread::sleep(Duration::from_millis(500));
    }
    false
}

fn start_python_sidecar() -> Option<Child> {
    let binary_name = if cfg!(target_os = "windows") {
        "attribution-engine.exe"
    } else {
        "attribution-engine"
    };

    // Resolve sidecar path: in dev it's in sidecar/ subdir, in bundle it's next to the exe
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    let sidecar_path = if exe_dir.join("sidecar").join(binary_name).exists() {
        exe_dir.join("sidecar").join(binary_name)
    } else {
        exe_dir.join(binary_name)
    };

    println!(
        "[Tauri] Starting Python sidecar: {}",
        sidecar_path.display()
    );

    match Command::new(&sidecar_path)
        .arg("--port")
        .arg("8710")
        .spawn()
    {
        Ok(child) => {
            println!("[Tauri] Sidecar spawned on port 8710 (PID: {})", child.id());
            Some(child)
        }
        Err(e) => {
            eprintln!("[Tauri] Failed to spawn sidecar: {}", e);
            eprintln!("[Tauri] Run backend manually: python -m app --port 8710");
            None
        }
    }
}

fn main() {
    let sidecar_state = SidecarState {
        child: Mutex::new(None),
        port: 8710,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(sidecar_state)
        .on_window_event(|window, event| {
            use tauri::WindowEvent;
            match event {
                // Native file drag-drop from OS → forward filtered paths to frontend
                WindowEvent::DragDrop(drop_event) => match drop_event {
                    tauri::DragDropEvent::Drop { paths, .. } => {
                        let excel_paths: Vec<String> = paths
                            .iter()
                            .filter(|p| {
                                let lower = p.to_string_lossy().to_lowercase();
                                lower.ends_with(".xls") || lower.ends_with(".xlsx")
                            })
                            .map(|p| p.to_string_lossy().to_string())
                            .collect();

                        if !excel_paths.is_empty() {
                            println!(
                                "[Tauri] Native drag-drop: {} Excel file(s)",
                                excel_paths.len()
                            );
                            let _ = window.emit("native-file-drop", excel_paths);
                        }
                    }
                    tauri::DragDropEvent::Enter { paths, .. } => {
                        let has_excel = paths.iter().any(|p| {
                            let lower = p.to_string_lossy().to_lowercase();
                            lower.ends_with(".xls") || lower.ends_with(".xlsx")
                        });
                        let _ = window.emit("native-drag-hover", has_excel);
                    }
                    tauri::DragDropEvent::Leave => {
                        let _ = window.emit("native-drag-hover", false);
                    }
                    _ => {}
                },
                _ => {}
            }
        })
        .setup(|app| {
            #[cfg(not(debug_assertions))]
            {
                let state = app.state::<SidecarState>();
                {
                    let mut guard = state.child.lock().unwrap();
                    *guard = start_python_sidecar();
                }

                // Wait for sidecar readiness (max 10s), then notify frontend
                let ready = wait_for_sidecar(state.port, 10);
                let main_window = app
                    .get_webview_window("main")
                    .expect("main window not found");
                let _ = main_window.emit("sidecar-ready", ready);

                if ready {
                    println!(
                        "[Tauri] Sidecar healthy on port {}",
                        state.port
                    );
                } else {
                    eprintln!(
                        "[Tauri] Sidecar not responding — backend unavailable"
                    );
                }
            }

            #[cfg(debug_assertions)]
            {
                let main_window = app
                    .get_webview_window("main")
                    .expect("main window not found");
                // In dev mode, assume backend is running (Vite proxy handles it)
                let _ = main_window.emit("sidecar-ready", true);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_sidecar_port,
            get_sidecar_status
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            use tauri::RunEvent;
            if let RunEvent::Exit = event {
                let state = app.state::<SidecarState>();
                let child = state.child.lock().unwrap().take();
                if let Some(mut child) = child {
                    println!("[Tauri] Shutting down sidecar (PID: {})...", child.id());
                    let _ = child.kill();
                    let _ = child.wait();
                    println!("[Tauri] Sidecar stopped");
                };
            }
        });
}
