@echo off
chcp 65001 >nul
echo ============================================
echo   VIDVI - Push ke GitHub
echo ============================================
echo.

:: Pindah ke direktori project
cd /d "%~dp0"

:: Cek status git
echo [*] Mengecek status perubahan...
git status

echo.
echo ============================================

:: Minta pesan commit
set /p COMMIT_MSG="Masukkan pesan commit (tekan Enter untuk default): "

:: Jika kosong, pakai pesan default dengan timestamp
if "%COMMIT_MSG%"=="" (
    for /f "tokens=1-3 delims=/ " %%a in ('date /t') do set DATE_STR=%%a-%%b-%%c
    for /f "tokens=1-2 delims=: " %%a in ('time /t') do set TIME_STR=%%a%%b
    set COMMIT_MSG=Update: %DATE_STR% %TIME_STR%
)

echo.
echo [*] Commit message: "%COMMIT_MSG%"
echo.

:: Add semua perubahan
echo [*] Menambahkan semua perubahan...
git add .

:: Commit
echo [*] Melakukan commit...
git commit -m "%COMMIT_MSG%"

:: Push ke GitHub
echo [*] Pushing ke GitHub (branch main)...
git push origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo [OK] Berhasil push ke GitHub!
    echo      https://github.com/rizd027/vidvi
) else (
    echo [ERROR] Gagal push. Cek pesan error di atas.
)

echo.
pause
