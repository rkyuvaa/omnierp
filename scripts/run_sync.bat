@echo off
title ERP Biometric Sync Agent
echo ============================================
echo      OMNI ERP BIOMETRIC SYNC AGENT
echo ============================================
echo.
echo Running sync script...
python "%~dp0local_sync_agent.py"
echo.
echo Sync Finished.
pause
