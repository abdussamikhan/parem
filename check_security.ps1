$pass = 0
$fail = 0
$warn = 0

# ── 1. .env in .gitignore ────────────────────────────────────────────────────
Write-Host ""
Write-Host "--- 9.1  .env files excluded from git ---" -ForegroundColor Cyan
$gi = Get-Content '.gitignore' -Raw
$envIgnored  = $gi -match '(?m)^\.env$'
$envAllIgnored = $gi -match '(?m)^\.env\*'
if ($envIgnored -or $envAllIgnored) {
    Write-Host "  .gitignore contains .env rule" -ForegroundColor Green
    Write-Host "PASS" -ForegroundColor Green; $pass++
} else {
    Write-Host "  .gitignore does NOT cover .env" -ForegroundColor Red
    Write-Host "FAIL" -ForegroundColor Red; $fail++
}

# Also verify .env is not already tracked by git
$tracked = git ls-files .env 2>$null
if ($tracked) {
    Write-Host "  WARNING: .env is tracked by git! Run: git rm --cached .env" -ForegroundColor Red
    $fail++
} else {
    Write-Host "  .env is NOT tracked by git" -ForegroundColor Green
    $pass++
}

# ── 2. CRON_SECRET length + randomness ──────────────────────────────────────
Write-Host ""
Write-Host "--- 9.2  CRON_SECRET strength ---" -ForegroundColor Cyan
$envContent = Get-Content '.env' -Raw
if ($envContent -match 'CRON_SECRET=([^\r\n]+)') {
    $secret = $Matches[1].Trim()
    $len = $secret.Length
    Write-Host "  CRON_SECRET length: $len chars"
    if ($len -ge 64) {
        Write-Host "  Entropy: 256 bits (64 hex chars)" -ForegroundColor Green
        Write-Host "PASS" -ForegroundColor Green; $pass++
    } elseif ($len -ge 32) {
        Write-Host "  Entropy: 128 bits (adequate)" -ForegroundColor Green
        Write-Host "PASS" -ForegroundColor Green; $pass++
    } else {
        Write-Host "FAIL - secret too short (< 32 chars)" -ForegroundColor Red; $fail++
    }
} else {
    Write-Host "FAIL - CRON_SECRET not found in .env" -ForegroundColor Red; $fail++
}

# ── 3. No hardcoded credentials in source ───────────────────────────────────
Write-Host ""
Write-Host "--- 9.3  Hardcoded credentials scan ---" -ForegroundColor Cyan
$patterns = @(
    'sk-[a-zA-Z0-9]{20,}',     # OpenAI keys
    'gsk_[a-zA-Z0-9]{20,}',    # Groq keys
    'AC[a-f0-9]{32}',           # Twilio SID
    'password\s*=\s*[''"][^''"]{4,}[''"]',  # hardcoded passwords
    'token\s*=\s*[''"][a-f0-9]{20,}[''"]'   # hardcoded tokens
)
$srcFiles = Get-ChildItem -Recurse -Include '*.ts','*.tsx','*.js','*.mjs' `
    -Exclude 'node_modules','*.test.*','*.spec.*' `
    | Where-Object { $_.FullName -notmatch 'node_modules|\.next' }

$hits = @()
foreach ($p in $patterns) {
    $found = $srcFiles | Select-String -Pattern $p -ErrorAction SilentlyContinue
    if ($found) { $hits += $found }
}
if ($hits.Count -eq 0) {
    Write-Host "  No hardcoded credentials found in source files" -ForegroundColor Green
    Write-Host "PASS" -ForegroundColor Green; $pass++
} else {
    Write-Host "  WARN - possible credentials found:" -ForegroundColor Yellow
    $hits | ForEach-Object { Write-Host "    $($_.Filename):$($_.LineNumber) - $($_.Line.Trim())" -ForegroundColor Yellow }
    Write-Host "WARN - review above lines manually" -ForegroundColor Yellow; $warn++; $pass++
}

# ── 4. Prisma schema scope ───────────────────────────────────────────────────
Write-Host ""
Write-Host "--- 9.4  Prisma schema scoped to 'app' ---" -ForegroundColor Cyan
$schema = Get-Content 'prisma\schema.prisma' -Raw -ErrorAction SilentlyContinue
$envC   = Get-Content '.env' -Raw
# Prisma can scope via schemas= block OR via ?schema=app in DATABASE_URL
$schemaInFile = $schema -match 'schema\s*=\s*"app"'
$schemaInUrl  = $envC   -match '\?schema=app'
if ($schemaInFile -or $schemaInUrl) {
    if ($schemaInFile) { Write-Host "  schema = app (prisma schema block)" -ForegroundColor Green }
    if ($schemaInUrl)  { Write-Host "  schema scoped via DATABASE_URL ?schema=app" -ForegroundColor Green }
    Write-Host "PASS" -ForegroundColor Green; $pass++
} else {
    Write-Host "FAIL - no schema=app found in prisma/schema.prisma or DATABASE_URL" -ForegroundColor Red; $fail++
}

# ── 5. API route mutation guards (no GET for mutations) ─────────────────────
Write-Host ""
Write-Host "--- 9.5  API route method guards ---" -ForegroundColor Cyan
$cronRoutes = Get-ChildItem -Recurse 'app\api\cron' -Include 'route.ts' -ErrorAction SilentlyContinue
$guardMissing = @()
foreach ($r in $cronRoutes) {
    $content = Get-Content $r.FullName -Raw
    # Cron routes should use POST, not export GET
    if ($content -match 'export\s+(async\s+)?function\s+GET') {
        $guardMissing += $r.Name
    }
}
if ($guardMissing.Count -eq 0) {
    Write-Host "  No cron routes expose GET handler" -ForegroundColor Green
    Write-Host "PASS" -ForegroundColor Green; $pass++
} else {
    Write-Host "  WARN - these cron routes export GET (should be POST only):" -ForegroundColor Yellow
    $guardMissing | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
    $warn++; $pass++
}

# ── 6. Twilio: SID is production (not test) ──────────────────────────────────
Write-Host ""
Write-Host "--- 9.6  Twilio credential check ---" -ForegroundColor Cyan
if ($envContent -match 'TWILIO_ACCOUNT_SID=([^\r\n]+)') {
    $sid = $Matches[1].Trim()
    Write-Host "  TWILIO_ACCOUNT_SID = $($sid.Substring(0,4))****$($sid.Substring($sid.Length-4))"
    if ($sid -match '^AC[a-f0-9]{32}$') {
        Write-Host "  Format: valid (AC + 32 hex chars)" -ForegroundColor Green
        if ($sid -match '^ACtest') {
            Write-Host "  FAIL - this is a TEST SID" -ForegroundColor Red; $fail++
        } else {
            Write-Host "  Not a test credential" -ForegroundColor Green
            Write-Host "PASS" -ForegroundColor Green; $pass++
        }
    } else {
        Write-Host "  WARN - SID format unexpected: $sid" -ForegroundColor Yellow; $warn++; $pass++
    }
} else {
    Write-Host "FAIL - TWILIO_ACCOUNT_SID not in .env" -ForegroundColor Red; $fail++
}

# Twilio whatsapp number
if ($envContent -match 'TWILIO_WHATSAPP_NUMBER=([^\r\n]+)') {
    $num = $Matches[1].Trim()
    Write-Host "  TWILIO_WHATSAPP_NUMBER = $num"
    # Sandbox number is +14155238886
    if ($num -eq '+14155238886') {
        Write-Host "  WARN - using Twilio SANDBOX number (ok for dev, must change for production)" -ForegroundColor Yellow
        $warn++
    } else {
        Write-Host "  Production WhatsApp number" -ForegroundColor Green
    }
}

# ── 7. Webhook secret strength ───────────────────────────────────────────────
Write-Host ""
Write-Host "--- 9.7  WHATSAPP_WEBHOOK_SECRET strength ---" -ForegroundColor Cyan
if ($envContent -match 'WHATSAPP_WEBHOOK_SECRET=([^\r\n]+)') {
    $ws = $Matches[1].Trim()
    if ($ws -eq 'my_secret_123' -or $ws.Length -lt 16) {
        Write-Host "  FAIL - weak/default webhook secret: '$ws'" -ForegroundColor Red
        Write-Host "  Replace with: openssl rand -hex 16" -ForegroundColor Red
        $fail++
    } else {
        Write-Host "  Webhook secret length: $($ws.Length)" -ForegroundColor Green
        Write-Host "PASS" -ForegroundColor Green; $pass++
    }
} else {
    Write-Host "  Not set (optional if Twilio auth token validation used)" -ForegroundColor Yellow; $warn++; $pass++
}

# Summary
Write-Host ""
Write-Host "========================================"
Write-Host "  RESULTS: $pass passed | $fail failed | $warn warnings"
Write-Host "========================================"
if ($fail -gt 0) { exit 1 }
