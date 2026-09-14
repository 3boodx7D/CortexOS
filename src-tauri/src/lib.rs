use sysinfo::System;
use serde::Serialize;
use tauri::State;
use std::sync::Mutex;
use std::process::Child;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct DaemonState {
    pub token: String,
    pub process: Mutex<Option<Child>>,
}

impl Drop for DaemonState {
    fn drop(&mut self) {
        if let Ok(mut lock) = self.process.lock() {
            if let Some(mut child) = lock.take() {
                let _ = child.kill();
            }
        }
    }
}

#[allow(dead_code)]
fn generate_daemon_token() -> String {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    let pid = std::process::id();
    format!("{:016x}{:08x}cortex", now, pid)
}

#[tauri::command]
fn get_daemon_token(state: State<'_, DaemonState>) -> String {
    state.token.clone()
}

#[tauri::command]
fn prepare_for_update(state: State<'_, DaemonState>) {
    if let Ok(mut lock) = state.process.lock() {
        if let Some(mut child) = lock.take() {
            let _ = child.kill();
        }
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "cortex-backend.exe", "/T"])
            .creation_flags(0x08000000)
            .status();
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "cortex-backend-x86_64-pc-windows-msvc.exe", "/T"])
            .creation_flags(0x08000000)
            .status();
    }
}

#[derive(Serialize, Clone)]
pub struct MemoryInfo {
    total_gb: f64,
    free_gb: f64,
    used_gb: f64,
    usage_percent: f64,
}

#[derive(Serialize, Clone)]
pub struct CpuInfo {
    brand: String,
    usage: f32,
    cores: usize,
}

#[derive(Serialize, Clone)]
pub struct SystemInfo {
    platform: String,
    cpu: CpuInfo,
    memory: MemoryInfo,
    gpu: String,
}

struct SysState(Mutex<System>);

#[tauri::command]
fn get_system_info(state: State<'_, SysState>) -> SystemInfo {
    let mut sys = state.0.lock().unwrap();
    sys.refresh_cpu_all();
    sys.refresh_memory();
    
    let total_bytes = sys.total_memory();
    let used_bytes = sys.used_memory();
    let free_bytes = sys.free_memory();
    
    let total_gb = total_bytes as f64 / 1_073_741_824.0;
    let used_gb = used_bytes as f64 / 1_073_741_824.0;
    let free_gb = free_bytes as f64 / 1_073_741_824.0;
    
    let usage_percent = if total_bytes > 0 {
        (used_bytes as f64 / total_bytes as f64) * 100.0
    } else {
        0.0
    };
    
    let global_cpu_usage = sys.global_cpu_usage();
    let cpu_brand = sys.cpus().first().map(|c| c.brand().to_string()).unwrap_or_else(|| "Unknown CPU".to_string());
    
    SystemInfo {
        platform: std::env::consts::OS.to_string(),
        cpu: CpuInfo {
            brand: cpu_brand,
            usage: global_cpu_usage,
            cores: sys.cpus().len(),
        },
        memory: MemoryInfo {
            total_gb,
            free_gb,
            used_gb,
            usage_percent,
        },
        gpu: "Detected GPU (Mock)".to_string(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut sys = System::new_all();
    sys.refresh_all();

    // Generate or fetch internal daemon secret
    let token = std::env::var("CORTEX_DAEMON_TOKEN").unwrap_or_else(|_| "cortex-local-daemon-token-9a7f3e".to_string());
    std::env::set_var("CORTEX_DAEMON_TOKEN", &token);

    #[cfg(not(debug_assertions))]
    let mut child_proc: Option<Child> = None;
    #[cfg(debug_assertions)]
    let child_proc: Option<Child> = None;

    #[cfg(not(debug_assertions))]
    {
        let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|p| p.to_path_buf()));
        let sidecar_candidates = [
            exe_dir.as_ref().map(|d| d.join("cortex-backend.exe")),
            exe_dir.as_ref().map(|d| d.join("cortex-backend-x86_64-pc-windows-msvc.exe")),
            exe_dir.as_ref().map(|d| d.join("binaries").join("cortex-backend.exe")),
            exe_dir.as_ref().map(|d| d.join("binaries").join("cortex-backend-x86_64-pc-windows-msvc.exe")),
            Some(std::path::PathBuf::from("src-tauri/binaries/cortex-backend.exe")),
            Some(std::path::PathBuf::from("cortex-backend.exe")),
        ];

        let found_binary = sidecar_candidates.into_iter().flatten().find(|p| p.exists());

        if let Some(candidate) = found_binary {
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                // Clean up any stale backend instance before launching fresh one
                let _ = std::process::Command::new("taskkill")
                    .args(["/F", "/IM", "cortex-backend.exe", "/T"])
                    .creation_flags(0x08000000)
                    .status();
            }

            let mut cmd = std::process::Command::new(&candidate);
            cmd.env("CORTEX_DAEMON_TOKEN", &token);
            if let Some(parent) = candidate.parent() {
                cmd.current_dir(parent);
            }
            
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            }
            
            if let Ok(child) = cmd.spawn() {
                child_proc = Some(child);
            }
        }
    }
  
    tauri::Builder::default()
        .manage(SysState(Mutex::new(sys)))
        .manage(DaemonState {
            token,
            process: Mutex::new(child_proc),
        })
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            app.handle().plugin(tauri_plugin_opener::init())?;
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            app.handle().plugin(tauri_plugin_process::init())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_system_info, get_daemon_token, prepare_for_update])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
