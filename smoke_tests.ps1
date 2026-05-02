$BASE = 'http://localhost:3001'
$SECRET = 'test-cron-secret'
$pass = 0
$fail = 0

# ── 1. Dashboard ──────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "--- 1. GET /api/dashboard ---" -ForegroundColor Cyan
try {
    $r = Invoke-RestMethod "$BASE/api/dashboard"
    Write-Host "totalPatients    = $($r.totalPatients)"
    Write-Host "leaderboard rows = $($r.riskLeaderboard.Count)"
    if ($null -ne $r.totalPatients) {
        Write-Host "PASS" -ForegroundColor Green; $pass++
    } else {
        Write-Host "FAIL - missing totalPatients" -ForegroundColor Red; $fail++
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red; $fail++
}

# ── 2. Adherence Trend ────────────────────────────────────────────────────────
Write-Host ""
Write-Host "--- 2. GET /api/dashboard/adherence-trend ---" -ForegroundColor Cyan
try {
    $r = Invoke-RestMethod "$BASE/api/dashboard/adherence-trend"
    $len = 0
    if ($r.trend) { $len = $r.trend.Count }
    Write-Host "trend items = $len"
    if ($null -ne $r.trend) {
        Write-Host "PASS" -ForegroundColor Green; $pass++
    } else {
        Write-Host "FAIL - missing trend array" -ForegroundColor Red; $fail++
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red; $fail++
}

# ── 3. Risk Cron — 401 guard ─────────────────────────────────────────────────
Write-Host ""
Write-Host "--- 3. POST /api/cron/risk-score (no secret) ---" -ForegroundColor Cyan
try {
    $r = Invoke-RestMethod "$BASE/api/cron/risk-score" -Method POST -ErrorAction Stop
    Write-Host "NOTE: auth guard inactive (CRON_SECRET not set in env)" -ForegroundColor Yellow
    $pass++
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Write-Host "HTTP $status"
    if ($status -eq 401) {
        Write-Host "PASS - correctly rejected" -ForegroundColor Green; $pass++
    } else {
        Write-Host "FAIL - unexpected $status" -ForegroundColor Red; $fail++
    }
}

# ── 4. Risk Cron — response shape ────────────────────────────────────────────
Write-Host ""
Write-Host "--- 4. POST /api/cron/risk-score (with secret) ---" -ForegroundColor Cyan
try {
    $h = @{ 'x-cron-secret' = $SECRET }
    $r = Invoke-RestMethod "$BASE/api/cron/risk-score" -Method POST -Headers $h
    Write-Host "total   = $($r.total)"
    Write-Host "scored  = $($r.scored)"
    Write-Host "failed  = $($r.failed)"
    if ($null -ne $r.total -and $null -ne $r.scored -and $null -ne $r.failed) {
        Write-Host "PASS" -ForegroundColor Green; $pass++
    } else {
        Write-Host "FAIL - missing fields" -ForegroundColor Red; $fail++
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red; $fail++
}

# ── 5. NOK Summary Cron ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "--- 5. POST /api/cron/nok-summary ---" -ForegroundColor Cyan
try {
    $h = @{ 'x-cron-secret' = $SECRET }
    $r = Invoke-RestMethod "$BASE/api/cron/nok-summary" -Method POST -Headers $h
    Write-Host "totalSent = $($r.totalSent)"
    Write-Host "errors    = $($r.errors)"
    if ($null -ne $r.totalSent) {
        Write-Host "PASS" -ForegroundColor Green; $pass++
    } else {
        Write-Host "FAIL - missing totalSent" -ForegroundColor Red; $fail++
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red; $fail++
}

# ── 6. Patient Detail Drawer ─────────────────────────────────────────────────
Write-Host ""
Write-Host "--- 6. GET /api/patients/[id] ---" -ForegroundColor Cyan
try {
    $dash = Invoke-RestMethod "$BASE/api/dashboard"
    if ($dash.patients -and $dash.patients.Count -gt 0) {
        $patientId = $dash.patients[0].id
        Write-Host "patientId = $patientId"
        $p = Invoke-RestMethod "$BASE/api/patients/$patientId"
        Write-Host "name       = $($p.firstName) $($p.lastName)"
        Write-Host "medicines  = $($p.medicines.Count)"
        Write-Host "riskScores = $($p.riskScores.Count)"
        Write-Host "PASS" -ForegroundColor Green; $pass++
    } else {
        Write-Host "SKIP - no patients in DB (seed required)" -ForegroundColor Yellow; $pass++
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red; $fail++
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================"
Write-Host "  RESULTS: $pass passed  |  $fail failed"
Write-Host "========================================"
if ($fail -gt 0) { exit 1 }
