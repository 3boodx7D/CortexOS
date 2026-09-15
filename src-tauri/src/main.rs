// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  #[cfg(target_os = "windows")]
  {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    #[link(name = "shell32")]
    extern "system" {
      fn SetCurrentProcessExplicitAppUserModelID(AppID: *const u16) -> i32;
    }

    let app_id: Vec<u16> = OsStr::new("CortexOS").encode_wide().chain(std::iter::once(0)).collect();
    unsafe {
      let _ = SetCurrentProcessExplicitAppUserModelID(app_id.as_ptr());
    }

    std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--app-user-model-id=CortexOS");
  }

  app_lib::run();
}

