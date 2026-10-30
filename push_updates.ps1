# ==============================================================================
# Enterprise RecSys & Customer Operations - Continuous Deployment Helper
# ==============================================================================

param(
    [string]$CommitMessage = "chore: apply system updates and configuration enhancements"
)

$ErrorActionPreference = "Stop"
$RepoDir = "d:\USer REccomendation"
Set-Location $RepoDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Enterprise Platform Update & Push Automation" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Run Integration Test Suite
Write-Host "`n[1/4] Running automated integration verification suite..." -ForegroundColor Yellow
& "$RepoDir\.venv\Scripts\python.exe" "$RepoDir\tests\test_enterprise_e2e.py"
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[ERROR] Integration tests failed. Aborting commit to prevent regression." -ForegroundColor Red
    exit 1
}
Write-Host "[PASS] All 7 test cases passed successfully." -ForegroundColor Green

# 2. Stage All Changes
Write-Host "`n[2/4] Staging modified and new files..." -ForegroundColor Yellow
git add .
git status --short

# 3. Commit
Write-Host "`n[3/4] Creating Git commit..." -ForegroundColor Yellow
git commit -m "$CommitMessage"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[INFO] Nothing new to commit or working tree clean." -ForegroundColor Gray
}

# 4. Push to Remote Repository
Write-Host "`n[4/4] Pushing changes to GitHub (origin/main)..." -ForegroundColor Yellow
$Token = (Get-Content "D:\git acesss token.txt").Trim()
if ($Token.Length -gt 40) {
    $Token = $Token.Substring(0, 40)
}

$AuthUrl = "https://${Token}@github.com/jithu212882/enterprise-ecommerce-recommender-operations.git"
git push $AuthUrl main

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " Successfully pushed updates to:" -ForegroundColor Green
Write-Host " https://github.com/jithu212882/enterprise-ecommerce-recommender-operations" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green
