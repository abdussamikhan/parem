# Parem — Pre-Deployment Checklist

> Run through this checklist before every production deployment.
> All items must be ✅ before go-live.
>
> **Last validated**: 2026-05-02 | Build ✅ | Lint ✅ | Tests 31/31 ✅ | Smoke Tests 6/6 ✅ | n8n 6/6 ✅

---

## 1. Environment Variables

| Variable | Required | `.env` Status | Notes |
|---|---|---|---|
| `DATABASE_URL` | ✅ | ✅ PRESENT | Must point to production Postgres with `?schema=app` |
| `GROQ_API_KEY` | ✅ | ✅ PRESENT | Groq LLM fallback — rotate before go-live |
| `OLLAMA_BASE_URL` | ✅ | ❌ MISSING | Ollama Cloud endpoint |
| `OLLAMA_QWEN_KEY` | ✅ | ❌ MISSING | Qwen 2.5 (NOK summaries, general) |
| `OLLAMA_LLAMA_KEY` | ✅ | ❌ MISSING | Llama 3.3 (risk scoring) |
| `OLLAMA_BIO_KEY` | ✅ | ❌ MISSING | BioMistral (clinical tasks) |
| `OLLAMA_WHISPER_KEY` | ✅ | ❌ MISSING | Whisper STT (voice notes) |
| `TWILIO_ACCOUNT_SID` | ✅ | ✅ PRESENT | Production Twilio SID |
| `TWILIO_AUTH_TOKEN` | ✅ | ✅ PRESENT | Rotate before go-live |
| `TWILIO_WHATSAPP_NUMBER` | ✅ | ✅ PRESENT | Approved WhatsApp sender number |
| `AZURE_TTS_KEY` | ✅ | ❌ MISSING | Neural TTS (Arabic/English) |
| `AZURE_TTS_REGION` | ✅ | ❌ MISSING | e.g. `uaenorth` |
| `CARE_TEAM_WHATSAPP` | ✅ | ✅ PRESENT | Care team alert recipient |
| `CRON_SECRET` | ✅ | ❌ MISSING | Min 32 chars: `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | ✅ | ❌ MISSING | Public-facing base URL |

**Verify**: `cp .env.example .env.production` then fill each value.

---

## 2. Database

- [ ] `prisma db push` has been run against the production DB
- [ ] Schema version matches `prisma/schema.prisma` (check `_prisma_migrations` table)
- [ ] `pgvector` extension enabled (if using vector search)
- [ ] RLS policies verified for `app.patients`, `app.risk_scores`
- [ ] Connection pool configured (`PgBouncer` or `pgcat` recommended)
- [ ] Backup snapshot taken before migration

---

## 3. Build & TypeScript

```bash
npx tsc --noEmit          # Must exit 0
npm run build             # Must produce .next/ without errors
npm run lint              # Zero ESLint errors
```

- [x] `tsc --noEmit` exits 0 ✅
- [x] `npm run build` completes successfully ✅
- [x] `npm run lint` — zero ESLint errors ✅
- [x] No `any` type warnings in API routes ✅

---

## 4. Test Suite

```bash
npm run test              # All tests pass
npm run test:cover        # Coverage report generated
```

- [x] `npm run test` — **31/31 tests passing** ✅
- [x] Risk engine tests passing (including LLM fallback case) ✅
- [x] Cron auth tests passing (401 without secret, 200 with) ✅
- [x] Anonymiser tests passing (PII scrubbing verified) ✅

---

## 5. API Endpoint Smoke Tests

Run these against a staging environment before prod:

```bash
# Dashboard
curl -s http://localhost:3000/api/dashboard | jq '.totalPatients'

# Risk scoring (authenticated)
curl -s -X POST http://localhost:3000/api/cron/risk-score \
  -H "x-cron-secret: $CRON_SECRET" | jq '.total'

# NOK summary cron (authenticated)
curl -s -X POST http://localhost:3000/api/cron/nok-summary \
  -H "x-cron-secret: $CRON_SECRET" | jq '.totalSent'

# Patient risk history (replace ID)
curl -s http://localhost:3000/api/patients/PATIENT_ID/risk | jq '.latest'

# Adherence trend
curl -s http://localhost:3000/api/dashboard/adherence-trend | jq '.trend | length'
```

- [x] Dashboard returns `totalPatients > 0` — **observed: 10** ✅
- [x] Risk cron returns `{ total: 10, scored: 10, failed: 0 }` ✅
- [x] NOK cron returns `{ totalSent: 10, errors: 0 }` ✅
- [x] Adherence trend returns 7 items ✅
- [x] Patient detail drawer returns full profile (medicines, riskScores) ✅

---

## 6. Twilio Configuration

- [ ] WhatsApp Business API approved for production template messages
- [ ] Inbound webhook URL set to: `https://YOUR_DOMAIN/api/webhook/twilio`
- [ ] Webhook URL is HTTPS with valid TLS certificate
- [ ] Twilio Messaging Service SID configured (for higher throughput)
- [ ] `ACCOUNT_SID` is **not** a test credential (`AC` prefix, not `ACtest...`)

---

## 7. Azure TTS

- [ ] Azure Cognitive Services resource created in correct region
- [ ] Neural voice `ar-SA-HamedNeural` (Arabic male) available in region
- [ ] Neural voice `en-US-JennyNeural` (English female) available in region
- [ ] Monthly quota sufficient for patient volume
- [ ] TTS CDN upload bucket / Twilio media URL configured

---

## 8. n8n Automation Workflows

- [x] Docker Compose `n8n` service started: **Up** (port 5678) ✅
- [x] n8n reachable at `http://localhost:5678` — HTTP 200 ✅
- [x] Workflows present in `n8n-workflows/` directory (4/4 files) ✅
- [x] **Nightly Schedule Loader** — `scheduleTrigger` @ `0 23 * * *` → `POST /api/cron/load-schedule` ✅
- [x] **NOK Summary Dispatcher** — `scheduleTrigger` @ `0 21 * * *` → `POST /api/cron/nok-summary` ✅
- [x] **Reminder Dispatcher** — `webhook` → `POST /api/cron/send-reminder` ✅
- [x] **WhatsApp Inbound Webhook** — `webhook` → `POST /api/webhook/twilio` (SOS escalation) ✅
- [x] All HTTP targets use `host.docker.internal:3000` (correct container→host routing) ✅
- [x] All 4 workflows imported and **Published** in live n8n ✅ _(confirmed 2026-05-02)_

---

## 9. Security

- [x] `.env` and `.env.production` in `.gitignore` — not tracked by git ✅
- [x] `CRON_SECRET` — 64-char / 256-bit cryptographic secret generated and set ✅
- [x] `WHATSAPP_WEBHOOK_SECRET` — replaced default with 64-char random secret ✅
- [x] No hardcoded credentials found in source files ✅
- [x] Prisma queries scoped to `app` schema (`?schema=app` in `DATABASE_URL`) ✅
- [x] Cron API routes — GET handlers removed, POST-only enforced ✅
- [x] `TWILIO_ACCOUNT_SID` — valid production format (`AC` + 32 hex), not a test SID ✅
- [ ] ⚠️ `TWILIO_WHATSAPP_NUMBER` = `+14155238886` **(Sandbox number)** — must be replaced with approved production WhatsApp sender before go-live

---

## 10. Deployment (Docker)

```bash
# Production build
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Verify containers
docker compose -f docker-compose.prod.yml ps
docker logs parem-app --tail 50
```

- [ ] All containers in `healthy` or `running` state
- [ ] No OOM kills in `docker stats`
- [ ] App accessible at production URL
- [ ] `cloudflared` tunnel active (if using Cloudflare Tunnel)

---

## 11. Pilot Validation

- [ ] Seed data loaded: `npm run db:seed`
- [ ] At least one test patient receives a WhatsApp reminder
- [ ] Risk scoring cron runs and populates `risk_scores` table
- [ ] Dashboard loads with real data (patients, adherence chart, leaderboard)
- [ ] Patient detail drawer opens and shows medicines + logs
- [ ] SOS escalation triggers care team alert
- [ ] NOK summary sends to at least one family contact

---

## Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Developer | | | |
| Clinical Lead | | | |
| Data Protection Officer | | | |

> **DPA Note**: Ensure a Data Processing Agreement is in place with all third-party AI providers (Groq, Ollama Cloud, Azure) before processing real patient data.
