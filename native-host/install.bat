@echo off
echo ========================================
echo  Native Messaging Host 등록
echo ========================================
echo.

:: 레지스트리에 네이티브 메시징 호스트 등록
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.joon.veo" /ve /t REG_SZ /d "C:\20260320_new\18AUTO\native-host\com.joon.veo.json" /f

if %errorlevel%==0 (
    echo [OK] com.joon.veo 호스트 등록 완료
) else (
    echo [!!] 등록 실패
)
echo.
pause
