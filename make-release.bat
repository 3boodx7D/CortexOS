@echo off
setlocal

title CortexOS Release Builder
cd /d "%~dp0"

echo ===============================================================================
echo            CORTEXOS AUTOMATED RELEASE BUILDER (Windows)
echo ===============================================================================
echo.

set "TARGET_VERSION=%~1"

if not "%TARGET_VERSION%"=="" goto DO_BUILD

echo [INFO] No version specified.
echo Press ENTER to automatically bump to the next patch version.
echo Or type a custom version below [e.g. 0.3.24] and press ENTER.
echo.
set /p "TARGET_VERSION=Target Version (or ENTER for auto-bump): "

:DO_BUILD
echo.
if "%TARGET_VERSION%"=="" (
    echo [*] Starting automatic patch release build...
    node scripts\build-release.js
) else (
    echo [*] Starting build for release v%TARGET_VERSION%...
    node scripts\build-release.js %TARGET_VERSION%
)

if errorlevel 1 (
    echo.
    echo [ERROR] Build process failed. See details above.
    echo.
    pause
    exit /b 1
)

echo.
echo ===============================================================================
echo   SUCCESS! Release package generated, organized, and pushed to Git.
echo   Explorer folder opened. Drag and drop the 3 files to GitHub Releases.
echo ===============================================================================
echo.
pause
