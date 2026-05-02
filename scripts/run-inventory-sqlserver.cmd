@echo off
setlocal
cd /d "%~dp0.."
if "%INVENTORY_MAX_PAGES%"=="" set INVENTORY_MAX_PAGES=120
if "%INVENTORY_MAX_LINKS%"=="" set INVENTORY_MAX_LINKS=12000
if "%INVENTORY_SYNC_BATCH_SIZE%"=="" set INVENTORY_SYNC_BATCH_SIZE=1000
python scrapers/main.py --mode live --tiers tier1,tier2,tier3 --allow-planned --crawl-all --max-pages-per-platform %INVENTORY_MAX_PAGES% --max-links-per-platform %INVENTORY_MAX_LINKS% --persist-sqlserver
endlocal
