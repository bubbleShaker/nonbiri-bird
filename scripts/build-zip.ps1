<#
.SYNOPSIS
  Chrome Web Store / Edge Add-ons 申請用の配布 zip を作成する。

.DESCRIPTION
  ホワイトリスト方式: 申請に必要なファイル/ディレクトリだけを集めて zip 化する。
  ブラックリスト（除外指定）方式と違い、.git や将来追加される秘密ファイルを
  取りこぼして同梱してしまう事故を防げる。

  manifest.json の "version" を読み取り、dist/nonbiri-bird-<version>.zip を出力する。

.EXAMPLE
  pwsh ./scripts/build-zip.ps1
#>
[CmdletBinding()]
param(
    # 出力先ディレクトリ（既定: リポジトリ直下の dist/）
    [string]$OutDir
)

$ErrorActionPreference = 'Stop'

# スクリプトの場所からリポジトリルートを決める（呼び出し時の作業ディレクトリに依存しない）
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $repoRoot 'dist' }

# --- 同梱するもの（ホワイトリスト）-------------------------------------------
# ストアにアップロードするのはこれだけ。ここに無いものは zip に入らない。
$includeFiles = @(
    'manifest.json',
    'popup.html',
    'popup.js'
)
# ディレクトリは「許可する拡張子」付きで指定する。
# ホワイトリストの中でさらに拡張子を絞ることで、将来 .map やエディタの一時ファイル・
# テスト・生成スクリプト等が紛れても配布 zip に入らないようにする。
$includeDirs = @{
    'src'   = @('.js')              # content.js / logic.js のみ
    'icons' = @('.png')             # アイコンのみ（generate_icons.py / requirements.txt は除外）
}
# ---------------------------------------------------------------------------

# version を manifest から取得（ファイル名に使う）
$manifestPath = Join-Path $repoRoot 'manifest.json'
if (-not (Test-Path $manifestPath)) { throw "manifest.json が見つからない: $manifestPath" }
# 明示的に UTF-8 で読む。Windows PowerShell 5.1 の Get-Content は BOM 無しを ANSI 扱いし、
# manifest 内の日本語が文字化けして ConvertFrom-Json が失敗するため。
$manifest = [System.IO.File]::ReadAllText($manifestPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$version = $manifest.version
if (-not $version) { throw 'manifest.json に version が無い' }

# クリーンな staging ディレクトリを作る（前回の残骸を持ち込まない）
$staging = Join-Path ([System.IO.Path]::GetTempPath()) ("nonbiri-bird-build-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $staging -Force | Out-Null

try {
    # 単体ファイルをコピー
    foreach ($f in $includeFiles) {
        $srcPath = Join-Path $repoRoot $f
        if (-not (Test-Path $srcPath)) { throw "同梱対象が見つからない: $f" }
        Copy-Item $srcPath -Destination (Join-Path $staging $f)
    }

    # ディレクトリをコピー（指定の許可拡張子のみ）
    foreach ($d in $includeDirs.Keys) {
        $srcDir = Join-Path $repoRoot $d
        if (-not (Test-Path $srcDir)) { throw "同梱対象ディレクトリが見つからない: $d" }
        $destDir = Join-Path $staging $d
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null

        $allowedExt = $includeDirs[$d]
        Get-ChildItem $srcDir -File |
            Where-Object { $allowedExt -contains $_.Extension.ToLower() } |
            ForEach-Object { Copy-Item $_.FullName -Destination (Join-Path $destDir $_.Name) }
    }

    # manifest が参照するアイコンが実際に staging に入ったか突き合わせる
    # （アイコン名変更時に「manifest は参照するが zip に無い」状態を取りこぼさない）
    if ($manifest.icons) {
        foreach ($iconPath in $manifest.icons.PSObject.Properties.Value) {
            $staged = Join-Path $staging $iconPath
            if (-not (Test-Path $staged)) { throw "manifest が参照するアイコンが zip に含まれない: $iconPath" }
        }
    }

    # 出力先を用意して zip 化
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
    $zipPath = Join-Path $OutDir "nonbiri-bird-$version.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

    # staging の「中身」を zip ルートに入れる（manifest.json が zip 直下に来るようにする）
    Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zipPath -Force

    Write-Host "OK: $zipPath を作成した (version $version)" -ForegroundColor Green
    Write-Host '--- 同梱内容 ---'
    Get-ChildItem $staging -Recurse -File |
        ForEach-Object { $_.FullName.Substring($staging.Length + 1) } |
        Sort-Object |
        ForEach-Object { Write-Host "  $_" }
}
finally {
    # staging は必ず片付ける
    Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
}
