# Caveman Review Fixes Plan

**Goal**: Fix 1 critical CSP issue + 15 warnings from caveman-review before merge.

**Scope**: `public/index.html`, `src/server/routes/stream.ts`, `src/server/routes/config.ts`, `README.md`, `.sisyphus/notepads/vegapunk-record-roadmap/learnings.md`

---

## Phase 1: Critical Fix

### Task 1.1: Remove `'unsafe-eval'` from CSP
**File**: `public/index.html` L7
**Issue**: Alpine.js doesn't need eval. CSP allows arbitrary code execution.
**Fix**: Remove `'unsafe-eval'` from `script-src` directive.
**Verification**: Load dashboard, verify Alpine.js works, check browser console for CSP violations.

---

## Phase 2: High-Priority Warnings

### Task 2.1: Fix CSS variable duplication
**File**: `public/index.html` L50-63
**Issue**: Hex + RGB vars duplicated. Hex vars unused.
**Fix**: Remove hex vars, keep only RGB vars with `-rgb` suffix.
**Verification**: Visual regression check - dashboard looks identical.

### Task 2.2: Fix EventSource cleanup leak
**File**: `public/index.html` L820, L843
**Issue**: Old `pagehide` listeners not removed when `activityEvents` changes. Memory leak.
**Fix**: Use `AbortController` for cleanup. Store controller, abort on reconnect.
**Verification**: Open dashboard, trigger reconnect (network toggle), check DevTools memory profile.

### Task 2.3: Fix SSE stream cleanup race
**File**: `src/server/routes/stream.ts` L35, L48, L54
**Issue**: `cleanup()` may run twice (cancel + abort). Heartbeat runs after disconnect.
**Fix**: Add cleanup guard flag. Clear heartbeat immediately on abort.
**Verification**: Connect SSE client, disconnect, check server logs for double-cleanup errors.

### Task 2.4: Add noscript fallback
**File**: `public/index.html` L296
**Issue**: If JS fails, user sees blank page.
**Fix**: Add `<noscript>` with "JavaScript required" message + link to docs.
**Verification**: Disable JS in browser, reload dashboard, see fallback message.

---

## Phase 3: Medium-Priority Warnings

### Task 3.1: Cache LLM provider config read
**File**: `src/server/routes/config.ts` L36
**Issue**: DB read on every `/api/config` request.
**Fix**: Cache `LLM_PROVIDER` in memory, invalidate on PATCH.
**Verification**: Load dashboard 10x, check DB query count (should be 1, not 10).

### Task 3.2: Fix onboarding overflow scroll
**File**: `public/index.html` L103
**Issue**: `.onboarding-shell` uses `place-items: center` + `min-height: 100vh`. No scroll if content overflows.
**Fix**: Move `min-height` to `.onboarding-card`, use `overflow-y: auto` on shell.
**Verification**: Shrink viewport to 320px height, verify onboarding scrolls.

### Task 3.3: Add conic-gradient fallback
**File**: `public/index.html` L147
**Issue**: `.orbit-mark` uses `conic-gradient` with no fallback.
**Fix**: Add solid `background-color` fallback before gradient.
**Verification**: Test in older Safari (if available) or accept risk.

### Task 3.4: Fix badge line-height
**File**: `public/index.html` L189
**Issue**: `line-height: 1` clips descenders.
**Fix**: Change to `line-height: 1.2`.
**Verification**: Visual check - badge text not clipped.

### Task 3.5: Add GPU acceleration hint
**File**: `public/index.html` L220, L240
**Issue**: `transform` animations may cause reflow.
**Fix**: Add `will-change: transform` to `.provider-card` and `@keyframes shake`, or use `translate3d`.
**Verification**: Record performance profile during hover/shake, check for layout thrashing.

### Task 3.6: Fix Alpine.js error handling
**File**: `public/index.html` L580, L650
**Issue**: Network errors leave user stuck with no retry UI.
**Fix**: Add retry button on `authError` and `setupError` states.
**Verification**: Disconnect network, trigger error, click retry, verify recovery.

### Task 3.7: Document stellaApp override behavior
**File**: `public/index.html` L563
**Issue**: `stellaApp()` spreads `stellaDashboard()`. Property override behavior unclear.
**Fix**: Add comment explaining spread order and override rules.
**Verification**: Code review only.

---

## Phase 4: Nits

### Task 4.1: Fix timestamp format
**File**: `.sisyphus/notepads/vegapunk-record-roadmap/learnings.md` L99
**Issue**: Inconsistent timestamp format.
**Fix**: Use ISO 8601 like L97.
**Verification**: Visual check.

### Task 4.2: Capitalize section title
**File**: `README.md` L31
**Issue**: "Local Stella server" → "Local Stella Server".
**Fix**: Capitalize.
**Verification**: Visual check.

### Task 4.3: Drop filler
**File**: `README.md` L71
**Issue**: "Or you can paste" → "Or paste".
**Fix**: Remove "you can".
**Verification**: Visual check.

### Task 4.4: Add secret leak warning
**File**: `README.md` L73
**Issue**: Pasting setup instructions to AI risks leaking `.env` secrets.
**Fix**: Add explicit "never paste .env contents" reminder in setup instructions block.
**Verification**: Visual check.

### Task 4.5: Verify vegapunk.ts exists
**File**: `package.json` L18
**Issue**: New script added.
**Fix**: Verify `scripts/satellites/vegapunk.ts` exists. If not, create or remove script.
**Verification**: Run `bun run vegapunk:satellite --help`.

### Task 4.6: Fix import order
**File**: `src/server/app.ts` L10
**Issue**: Import order changed.
**Fix**: Group by source (routes, then mcp).
**Verification**: Lint check.

### Task 4.7: Verify new route files exist
**File**: `src/server/routes/index.ts` L3
**Issue**: New exports added.
**Fix**: Verify `auth.ts` and `setup.ts` exist in `src/server/routes/`.
**Verification**: Check file existence.

### Task 4.8: Verify test config param usage
**File**: `test/api/helpers.ts` L20
**Issue**: `createTestApp` now accepts `config` param.
**Fix**: Grep all test files for `createTestApp()` calls, verify they pass correct config or accept default.
**Verification**: Run `bun test`.

### Task 4.9: Clarify dashboard compatibility comment
**File**: `public/index.html` L290
**Issue**: Comment says `stellaDashboard()` but code uses `stellaApp()`.
**Fix**: Update comment to match code or explain compatibility layer.
**Verification**: Code review only.

### Task 4.10: Document no-transform header
**File**: `src/server/routes/stream.ts` L67
**Issue**: `no-transform` prevents proxy compression.
**Fix**: Add inline comment explaining why (SSE requires unbuffered streaming).
**Verification**: Code review only.

---

## Verification Strategy

1. **Critical**: Load dashboard, verify Alpine.js works, no CSP errors.
2. **High-priority**: Run full test suite, manual dashboard flow (auth → setup → dashboard → SSE reconnect).
3. **Medium-priority**: Visual regression check, performance profile, error state testing.
4. **Nits**: Code review + lint.

---

## Success Criteria

- [ ] No CSP violations in browser console
- [ ] All tests pass
- [ ] Dashboard loads and functions identically
- [ ] SSE reconnect works without memory leaks
- [ ] Error states show retry UI
- [ ] No layout thrashing during animations
- [ ] All nits addressed

---

## Estimated Effort

- Phase 1: 5 min
- Phase 2: 30 min
- Phase 3: 45 min
- Phase 4: 20 min
- **Total**: ~1.5 hours
