<#
  健康集 —— 一键部署到 GitHub Pages

  用法（在 d:\project\A9 目录下打开 PowerShell 执行）：
      .\deploy.ps1 -User 你的GitHub用户名
      .\deploy.ps1 -User 你的GitHub用户名 -RepoName 其他仓库名

  前置条件：
      已在 GitHub 网页创建同名【空】仓库（不要勾选 Add a README file）
      创建入口：https://github.com/new
#>

param(
  [Parameter(Mandatory = $true, HelpMessage = '你的 GitHub 用户名')]
  [string]$User,

  [string]$RepoName = 'health-hub'
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

$repoUrl  = "https://github.com/$User/$RepoName.git"
$pagesUrl = "https://$User.github.io/$RepoName/"

Write-Host ''
Write-Host '=========================================' -ForegroundColor DarkCyan
Write-Host '   健康集 -> GitHub Pages 一键部署' -ForegroundColor Cyan
Write-Host '=========================================' -ForegroundColor DarkCyan
Write-Host "   目标仓库: $repoUrl"
Write-Host ''

# 0) 确保是 git 仓库
if (-not (Test-Path (Join-Path $PSScriptRoot '.git'))) {
  Write-Host '[0/4] 初始化 git 仓库...' -ForegroundColor Cyan
  git init -b main | Out-Null
}

# 1) 提交身份（用 GitHub noreply 邮箱，不暴露真实邮箱）
Write-Host '[1/4] 配置提交身份...' -ForegroundColor Cyan
git config user.name  $User
git config user.email "$User@users.noreply.github.com"
Write-Host "      $User <$User@users.noreply.github.com>"

# 2) 提交文件
Write-Host '[2/4] 提交文件...' -ForegroundColor Cyan
git add -A
if (git status --porcelain) {
  git commit -m '健康集：静态部署版（PWA，本地优先个人健康档案）' | Out-Null
  Write-Host '      已创建提交'
} else {
  Write-Host '      没有需要提交的改动（已是最新）'
}

# 3) 配置远程仓库
Write-Host '[3/4] 配置远程仓库...' -ForegroundColor Cyan
$remotes = @(git remote)
if ($remotes -contains 'origin') {
  git remote set-url origin $repoUrl
} else {
  git remote add origin $repoUrl
}
Write-Host "      origin -> $repoUrl"

# 4) 推送
Write-Host '[4/4] 推送到 GitHub...' -ForegroundColor Cyan
Write-Host '      （若弹出浏览器/登录窗口，请登录 GitHub 并授权）' -ForegroundColor Yellow
git push -u origin main

Write-Host ''
Write-Host '推送完成！最后一步在网页开启 GitHub Pages：' -ForegroundColor Green
Write-Host "  1) 打开 https://github.com/$User/$RepoName/settings/pages"
Write-Host '     （或：仓库页面 -> Settings -> 左侧 Pages）'
Write-Host "  2) Source 选 'Deploy from a branch'"
Write-Host '     Branch 选 main，目录选 / (root)，点 Save'
Write-Host "  3) 等 1~2 分钟，访问：$pagesUrl" -ForegroundColor Green
Write-Host ''
Write-Host '部署完成后，手机浏览器打开该网址即可「添加到主屏幕」，支持离线使用。' -ForegroundColor Green
Write-Host ''
Write-Host '关于 AI：' -ForegroundColor Yellow
Write-Host '  手机直连时需使用支持浏览器跨域（CORS）的接口，如 OpenRouter / SiliconFlow / Groq。' -ForegroundColor Yellow
Write-Host '  若想用 DeepSeek / 通义等任意接口，请在电脑上运行 python server.py（走本地代理）。' -ForegroundColor Yellow
Write-Host ''
