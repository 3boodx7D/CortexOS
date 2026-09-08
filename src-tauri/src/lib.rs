use sysinfo::System;
use serde::Serialize;
use tauri::State;
use std::sync::Mutex;

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
  
  tauri::Builder::default()
    .manage(SysState(Mutex::new(sys)))
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![get_system_info])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
