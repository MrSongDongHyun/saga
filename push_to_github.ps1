# SAGA → GitHub 푸시 스크립트
# 실행: powershell -ExecutionPolicy Bypass -File push_to_github.ps1

$ErrorActionPreference = "Stop"
$RepoUrl = "git@github.com:MrSongDongHyun/saga.git"

Set-Location $PSScriptRoot

Write-Host "=== SAGA GitHub 푸시 시작 ===" -ForegroundColor Cyan

# lock 파일 제거
if (Test-Path ".git\index.lock") {
    Remove-Item ".git\index.lock" -Force
    Write-Host "[OK] index.lock 제거" -ForegroundColor Green
}

# git 초기화 (이미 되어 있으면 스킵)
if (-not (Test-Path ".git")) {
    git init
    Write-Host "[OK] git init" -ForegroundColor Green
}

# 브랜치 main으로 설정
git branch -M main 2>$null

# 사용자 정보 (없을 경우 대비)
git config user.email "ymxclaude@gmail.com" 2>$null
git config user.name "MrSongDongHyun" 2>$null

# 원격 설정
$remoteExists = git remote get-url origin 2>$null
if ($remoteExists) {
    git remote set-url origin $RepoUrl
    Write-Host "[OK] remote URL 업데이트" -ForegroundColor Green
} else {
    git remote add origin $RepoUrl
    Write-Host "[OK] remote 추가" -ForegroundColor Green
}

# 스테이징 + 커밋
git add -A
$commitMsg = "feat: WRTN-style story builder + AI profile generation ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))"
git commit -m $commitMsg
Write-Host "[OK] 커밋: $commitMsg" -ForegroundColor Green

# 푸시
Write-Host "GitHub에 푸시 중..." -ForegroundColor Yellow
git push -u origin main --force

Write-Host "=== 푸시 완료 ===" -ForegroundColor Cyan
