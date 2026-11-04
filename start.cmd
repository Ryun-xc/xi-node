@echo off
setlocal
cd /d "%~dp0"
if not defined XI_NODE_DATA set "XI_NODE_DATA=%~dp0data"
node server.mjs