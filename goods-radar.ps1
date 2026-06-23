param(
  [Parameter(Position = 0)]
  [string]$Command,

  [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
  [string[]]$Rest
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Decode-Utf8Base64 {
  param([string]$Value)
  return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($Value))
}

function Write-Zh {
  param([string]$Value)
  Write-Host (Decode-Utf8Base64 $Value)
}

function Resolve-Node {
  $candidates = @()
  if ($env:GOODS_RADAR_NODE) { $candidates += $env:GOODS_RADAR_NODE }
  $candidates += "node"
  if ($env:USERPROFILE) {
    $candidates += (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe")
  }

  foreach ($candidate in $candidates) {
    $exe = $candidate
    if (-not [System.IO.Path]::IsPathRooted($candidate)) {
      $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
      if (-not $cmd) { continue }
      $exe = $cmd.Source
    }
    if (-not (Test-Path $exe)) { continue }
    try {
      & $exe --version *> $null
      if ($LASTEXITCODE -eq 0) { return $exe }
    } catch {
      continue
    }
  }

  throw (Decode-Utf8Base64 "5pyq5om+5Yiw5Y+v6L+Q6KGM55qEIE5vZGUuanPjgILor7flsIYgR09PRFNfUkFEQVJfTk9ERSDorr7nva7kuLrlj6/nlKjnmoQgbm9kZS5leGUg6Lev5b6E44CC")
}

function Show-Help {
  Write-Zh "R29vZHMgUmFkYXIg6LSn5rqQ6Zu36L6+5ZG95Luk5YWl5Y+j"
  Write-Host ""
  Write-Zh "5bu66K6u5LiL5LiA5q2l77ya"
  Write-Host "  .\goods-radar.cmd doctor"
  Write-Host "  .\goods-radar.cmd collect"
  Write-Host "  .\goods-radar.cmd source:providers"
  Write-Host "  .\goods-radar.cmd radar"
  Write-Host "  .\goods-radar.cmd contacts"
  Write-Host "  .\goods-radar.cmd products"
  Write-Host "  .\goods-radar.cmd source:freshness"
  Write-Host "  .\goods-radar.cmd score --rank-by p0 --explain-selection"
  Write-Host "  .\goods-radar.cmd source:gaps"
  Write-Host "  .\goods-radar.cmd p0"
  Write-Host "  .\goods-radar.cmd verify"
  Write-Host "  .\goods-radar.cmd weekly"
  Write-Host ""
  Write-Zh "55So5rOV77ya"
  Write-Host "  .\goods-radar.cmd doctor"
  Write-Host "  .\goods-radar.cmd test"
  Write-Host "  .\goods-radar.cmd score --rank-by p0 --dry-run --limit 5 --explain-selection"
  Write-Host ""
  Write-Zh "5ZG95Luk77ya"
  Write-Host "  collect, source:providers, collect:radar, radar, routes, contacts, products, scan"
  Write-Host "  score, score:rules, source:gaps, p0:gaps, p0, weekly, verify, doctor, test, test-all"
  Write-Host "  data:framework, data:country, data:logistics, data:initial"
  Write-Host "  data:intake, data:intake:check, data:intake:draft, data:intake:plan"
  Write-Host "  data:ops, data:p0, data:probe, data:source:evaluate, data:review"
}

$CommandArgs = @()
if ($Command) { $CommandArgs += $Command }
if ($Rest) { $CommandArgs += $Rest }

if (-not $CommandArgs -or $CommandArgs.Count -eq 0 -or $CommandArgs[0] -in @("help", "--help", "-h")) {
  Show-Help
  exit 0
}

if ($CommandArgs[0] -eq "run" -and $CommandArgs.Count -gt 1) {
  $CommandArgs = $CommandArgs[1..($CommandArgs.Count - 1)]
}

$command = $CommandArgs[0]
$rest = @()
if ($CommandArgs.Count -gt 1) {
  $rest = $CommandArgs[1..($CommandArgs.Count - 1)]
}
if ($rest.Count -gt 0 -and $rest[0] -eq "--") {
  $rest = if ($rest.Count -gt 1) { $rest[1..($rest.Count - 1)] } else { @() }
}

$scripts = @{
  "collect" = "collect.mjs"
  "providers" = "source-providers.mjs"
  "source:providers" = "source-providers.mjs"
  "collect:providers" = "source-providers.mjs"
  "collect:radar" = "collect-radar.mjs"
  "radar" = "collect-radar.mjs"
  "contacts" = "collect-contacts.mjs"
  "collect:contacts" = "collect-contacts.mjs"
  "products" = "collect-products.mjs"
  "collect:products" = "collect-products.mjs"
  "contacts:import" = "contacts-import.mjs"
  "source:gaps" = "source-gaps.mjs"
  "p0:gaps" = "source-gaps.mjs"
  "source:freshness" = "source-freshness.mjs"
  "routes" = "collect-routes.mjs"
  "collect:routes" = "collect-routes.mjs"
  "scan" = "scan.mjs"
  "score" = "score.mjs"
  "score:rules" = "score-rules.mjs"
  "weekly" = "weekly-report.mjs"
  "p0" = "p0-cockpit.mjs"
  "verify" = "verify-pipeline.mjs"
  "doctor" = "doctor.mjs"
  "import:bol" = "import-bol.mjs"
  "data:framework" = "data-framework.mjs"
  "data:country" = "data-country-context.mjs"
  "data:logistics" = "data-logistics-context.mjs"
  "data:initial" = "data-initial-assessment-report.mjs"
  "data:intake" = "data-p0-intake.mjs"
  "data:intake:check" = "data-p0-intake-preflight.mjs"
  "data:intake:draft" = "data-p0-intake-draft.mjs"
  "data:intake:plan" = "data-p0-import-plan.mjs"
  "data:ops" = "data-ops-summary.mjs"
  "data:p0" = "data-p0-activation.mjs"
  "data:probe" = "data-source-probe.mjs"
  "data:source:evaluate" = "data-source-evaluation.mjs"
  "data:review" = "data-staging-review.mjs"
  "llm:evaluate" = "llm-evaluate.mjs"
  "test-all" = "test-all.mjs"
}

$node = Resolve-Node
Push-Location $Root
try {
  if ($command -eq "test") {
    & $node --test @rest
    exit $LASTEXITCODE
  }

  if ($command -eq "test-all") {
    & $node (Join-Path $Root $scripts[$command]) "--run" @rest
    exit $LASTEXITCODE
  }

  if (-not $scripts.ContainsKey($command)) {
    Write-Error "$((Decode-Utf8Base64 "5pyq55+lIEdvb2RzIFJhZGFyIOWRveS7pO+8mg=="))$command"
  }

  & $node (Join-Path $Root $scripts[$command]) @rest
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
