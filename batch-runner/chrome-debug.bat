@echo off
echo ========================================
echo  18AUTO Chrome 디버그 모드
echo ========================================
echo.
echo Chrome 종료 중...
taskkill /F /IM chrome.exe >nul 2>nul
timeout /t 3 /nobreak >nul

set SRC=C:\Users\Joon2\AppData\Local\Google\Chrome\User Data\Default
set DST=C:\chrome-debug\Default
set SRC_ROOT=C:\Users\Joon2\AppData\Local\Google\Chrome\User Data
set DST_ROOT=C:\chrome-debug

echo 로그인/쿠키 복사 중...
mkdir "%DST%" 2>nul

:: 쿠키/로그인/세션 복사
copy /Y "%SRC%\Cookies" "%DST%\Cookies" >nul 2>nul
copy /Y "%SRC%\Cookies-journal" "%DST%\Cookies-journal" >nul 2>nul
copy /Y "%SRC%\Login Data" "%DST%\Login Data" >nul 2>nul
copy /Y "%SRC%\Login Data-journal" "%DST%\Login Data-journal" >nul 2>nul
copy /Y "%SRC%\Web Data" "%DST%\Web Data" >nul 2>nul
copy /Y "%SRC%\Preferences" "%DST%\Preferences" >nul 2>nul
copy /Y "%SRC%\Secure Preferences" "%DST%\Secure Preferences" >nul 2>nul
copy /Y "%SRC%\Extension Cookies" "%DST%\Extension Cookies" >nul 2>nul

:: 암호화 키 (필수)
copy /Y "%SRC_ROOT%\Local State" "%DST_ROOT%\Local State" >nul 2>nul

echo [OK] 로그인 데이터 복사 완료
echo.
echo Chrome 디버그 모드 시작 (포트 9222)...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\chrome-debug" --load-extension="C:\20260320_new\18AUTO" --no-first-run https://labs.google/fx/ko/tools/flow
echo.
echo [OK] Chrome 실행됨 - 로그인 자동 유지
echo.
echo  배치 실행:
echo    cd C:\20260320_new\18AUTO\batch-runner
echo    node run.js ..\prompts.txt
echo.
pause
