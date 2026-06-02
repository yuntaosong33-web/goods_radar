param(
  [Parameter(Position = 0)]
  [string]$Command,

  [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
  [string[]]$Rest
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

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

  throw "No runnable Node.js found. Set GOODS_RADAR_NODE to a working node.exe path."
}

function Show-Help {
  Write-Host "Goods Radar source-radar runner"
  Write-Host ""
  Write-Host "Usage:"
  Write-Host "  .\goods-radar.cmd doctor"
  Write-Host "  .\goods-radar.cmd test"
  Write-Host "  .\goods-radar.cmd score --dry-run --limit 5"
  Write-Host ""
  Write-Host "Commands:"
  Write-Host "  collect, collect:radar, radar, routes, scan"
  Write-Host "  score, score:rules, weekly, verify, doctor, test"
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
  "collect:radar" = "collect-radar.mjs"
  "radar" = "collect-radar.mjs"
  "routes" = "collect-routes.mjs"
  "collect:routes" = "collect-routes.mjs"
  "scan" = "scan.mjs"
  "score" = "score.mjs"
  "score:rules" = "score-rules.mjs"
  "weekly" = "weekly-report.mjs"
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
}

$node = Resolve-Node
Push-Location $Root
try {
  if ($command -eq "test") {
    & $node --test @rest
    exit $LASTEXITCODE
  }

  if (-not $scripts.ContainsKey($command)) {
    Write-Error "Unknown Goods Radar command: $command"
  }

  & $node (Join-Path $Root $scripts[$command]) @rest
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
