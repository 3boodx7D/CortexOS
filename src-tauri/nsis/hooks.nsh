; ==============================================================================
; CortexOS NSIS Installer Hooks (hooks.nsh)
; ==============================================================================
; Ensures background sidecar processes are killed before file replacement,
; and displays a clean centered banner window during updates instead of the full wizard.

!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Stopping CortexOS background processes..."
  ; Kill backend daemon and any running CortexOS instances
  nsExec::Exec 'taskkill /F /IM cortex-backend.exe /T'
  nsExec::Exec 'taskkill /F /IM cortex-backend-x86_64-pc-windows-msvc.exe /T'
  nsExec::Exec 'taskkill /F /IM CortexOS.exe /T'
  nsExec::Exec 'taskkill /F /IM app.exe /T'
  Sleep 600

  ; If this is an update or passive run, hide the main wizard window and show a small centered banner
  ${If} $PassiveMode = 1
  ${OrIf} $UpdateMode = 1
    ShowWindow $HWNDPARENT 0
    Banner::show /NOUNLOAD "Updating CortexOS... Please wait." "CortexOS Update"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ${If} $PassiveMode = 1
  ${OrIf} $UpdateMode = 1
    Banner::destroy
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Stopping CortexOS background processes..."
  nsExec::Exec 'taskkill /F /IM cortex-backend.exe /T'
  nsExec::Exec 'taskkill /F /IM cortex-backend-x86_64-pc-windows-msvc.exe /T'
  nsExec::Exec 'taskkill /F /IM CortexOS.exe /T'
  nsExec::Exec 'taskkill /F /IM app.exe /T'
  Sleep 600
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend
