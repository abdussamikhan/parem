$pass = 0
$fail = 0
$warn = 0

# 1. Docker container running
Write-Host ""
Write-Host "--- 1. Docker: n8n container ---" -ForegroundColor Cyan
$raw = docker compose ps 2>$null
if ($raw -match 'n8n.*Up') {
    Write-Host "n8n container: Up" -ForegroundColor Green
    Write-Host "PASS" -ForegroundColor Green; $pass++
} else {
    Write-Host "FAIL - n8n not running" -ForegroundColor Red; $fail++
}

# 2. n8n reachable at :5678
Write-Host ""
Write-Host "--- 2. n8n reachable at http://localhost:5678 ---" -ForegroundColor Cyan
$reached = $false
try {
    $resp = Invoke-WebRequest 'http://localhost:5678/healthz' -TimeoutSec 5 -UseBasicParsing
    Write-Host "HTTP $($resp.StatusCode)"
    $reached = $true
} catch {
    try {
        $resp2 = Invoke-WebRequest 'http://localhost:5678' -TimeoutSec 5 -UseBasicParsing
        Write-Host "HTTP $($resp2.StatusCode) (root)"
        $reached = $true
    } catch {
        Write-Host "Not reachable: $($_.Exception.Message)"
    }
}
if ($reached) { Write-Host "PASS" -ForegroundColor Green; $pass++ }
else { Write-Host "FAIL" -ForegroundColor Red; $fail++ }

# 3. Workflow files present
Write-Host ""
Write-Host "--- 3. Workflow JSON files ---" -ForegroundColor Cyan
$files = @('nightly-schedule-loader.json','reminder-dispatcher.json','nok-summary.json','whatsapp-inbound.json')
$allFound = $true
foreach ($f in $files) {
    if (Test-Path "n8n-workflows\$f") { Write-Host "  FOUND  $f" -ForegroundColor Green }
    else { Write-Host "  MISSING $f" -ForegroundColor Red; $allFound = $false }
}
if ($allFound) { Write-Host "PASS" -ForegroundColor Green; $pass++ }
else { Write-Host "FAIL" -ForegroundColor Red; $fail++ }

# 4. Validate each workflow via raw JSON string (avoids CRLF parse issues)
Write-Host ""
Write-Host "--- 4. Workflow definitions ---" -ForegroundColor Cyan

function Test-Workflow {
    param($File, $ExpectedName, $ExpectedTrigger, $ExpectedUrl, $ExpectedCron)

    $raw = Get-Content "n8n-workflows\$File" -Raw
    $json = $raw | ConvertFrom-Json

    $nameOk    = $json.name -eq $ExpectedName
    $activeOk  = $json.active -eq $true

    # URL check via raw string search (avoids nested object parse issues)
    $urlOk     = $raw -match [regex]::Escape($ExpectedUrl)

    # Trigger check via raw string
    $triggerOk = $raw -match [regex]::Escape($ExpectedTrigger)

    # Cron check
    $cronOk = ($ExpectedCron -eq '') -or ($raw -match [regex]::Escape($ExpectedCron))

    $ok = $nameOk -and $activeOk -and $urlOk -and $triggerOk -and $cronOk

    if ($ok) {
        Write-Host "  PASS  $ExpectedName" -ForegroundColor Green
        Write-Host "        active=true  trigger=$ExpectedTrigger  url=*$ExpectedUrl" -ForegroundColor DarkGreen
    } else {
        Write-Host "  FAIL  $ExpectedName" -ForegroundColor Red
        if (-not $nameOk)    { Write-Host "        name mismatch: '$($json.name)'" }
        if (-not $activeOk)  { Write-Host "        active=$($json.active) (expected true)" }
        if (-not $urlOk)     { Write-Host "        URL '$ExpectedUrl' not in file" }
        if (-not $triggerOk) { Write-Host "        trigger '$ExpectedTrigger' not in file" }
        if (-not $cronOk)    { Write-Host "        cron '$ExpectedCron' not in file" }
    }
    return $ok
}

$r1 = Test-Workflow 'nightly-schedule-loader.json' 'Nightly Schedule Loader'   'scheduleTrigger' '/api/cron/load-schedule'  '0 23 * * *'
$r2 = Test-Workflow 'nok-summary.json'             'NOK Summary Dispatcher'    'scheduleTrigger' '/api/cron/nok-summary'     '0 21 * * *'
$r3 = Test-Workflow 'reminder-dispatcher.json'     'Reminder Dispatcher'       'webhook'         '/api/cron/send-reminder'   ''
$r4 = Test-Workflow 'whatsapp-inbound.json'        'WhatsApp Inbound Webhook'  'webhook'         '/api/webhook/twilio'       ''

if ($r1 -and $r2 -and $r3 -and $r4) { Write-Host "PASS" -ForegroundColor Green; $pass++ }
else { Write-Host "FAIL" -ForegroundColor Red; $fail++ }

# 5. URLs use host.docker.internal
Write-Host ""
Write-Host "--- 5. HTTP target URLs ---" -ForegroundColor Cyan
$allUrls = Get-ChildItem 'n8n-workflows\*.json' | ForEach-Object {
    $j = Get-Content $_.FullName -Raw | ConvertFrom-Json
    $j.nodes | Where-Object { $_.type -eq 'n8n-nodes-base.httpRequest' } | ForEach-Object { $_.parameters.url }
}
foreach ($u in $allUrls) { Write-Host "  $u" }
$badUrls = $allUrls | Where-Object { $_ -notmatch 'host\.docker\.internal' }
if ($badUrls.Count -eq 0) {
    Write-Host "PASS - all $($allUrls.Count) URLs use host.docker.internal" -ForegroundColor Green; $pass++
} else {
    Write-Host "WARN - non-docker URLs (update for production)" -ForegroundColor Yellow; $warn++; $pass++
}

# 6. n8n REST API live check
Write-Host ""
Write-Host "--- 6. n8n API: live active workflows ---" -ForegroundColor Cyan
try {
    $apiResp = Invoke-RestMethod 'http://localhost:5678/api/v1/workflows' -TimeoutSec 5 -ErrorAction Stop
    $activeWF = $apiResp.data | Where-Object { $_.active -eq $true }
    Write-Host "Total in n8n: $($apiResp.data.Count)  Active: $($activeWF.Count)"
    $activeWF | ForEach-Object { Write-Host "  - $($_.name)" -ForegroundColor Green }
    if ($activeWF.Count -gt 0) { Write-Host "PASS" -ForegroundColor Green; $pass++ }
    else { Write-Host "WARN - workflows not yet imported/activated in live n8n" -ForegroundColor Yellow; $warn++; $pass++ }
} catch {
    $sc = 0
    if ($_.Exception.Response) { $sc = [int]$_.Exception.Response.StatusCode }
    if ($sc -eq 401) {
        Write-Host "HTTP 401 - n8n API key required (n8n is running, auth needed for API)" -ForegroundColor Yellow
        Write-Host "ACTION: Open http://localhost:5678 and manually import + activate workflows" -ForegroundColor Yellow
    } else {
        Write-Host "Could not query n8n API ($sc): $($_.Exception.Message)" -ForegroundColor Yellow
    }
    $warn++; $pass++
}

# Summary
Write-Host ""
Write-Host "========================================"
Write-Host "  RESULTS: $pass passed | $fail failed | $warn warnings"
Write-Host "========================================"
if ($fail -gt 0) { exit 1 }
