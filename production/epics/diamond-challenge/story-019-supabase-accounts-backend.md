# Story 019: Nền tài khoản Supabase (bảng, RLS, Edge Function, triển khai)

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Integration
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-06

## Context

**GDD**: `design/phase-2-notes.md` (chi tiết: `design/quick-specs/supabase-accounts-2026-11-06.md`)
**Requirement**: Giai đoạn 2 — Tài khoản: đăng ký và đăng nhập; Đồng bộ số tổng hợp (phần server)

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) + Supabase (Postgres, Auth, Edge Functions) | **Risk**: NOT ASSESSED
**Engine Notes**: none

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` nằm trong `.env.production`; `src/config/supabase.ts` kiểm tra chúng và chỉ tạo client khi hợp lệ; thiếu thì app chạy offline như cũ.
- [ ] Không có khoá secret / service_role trong `src/`, `dist/` hay repo; workflow Pages có bước chặn.
- [ ] Migration trong `supabase/migrations/` tạo `profiles` và `aggregates`, bật RLS, đọc mình + tuyến dưới (admin đọc tất cả), chỉ ghi số tổng hợp của mình, không tự sửa vai trò / bảo trợ / SĐT; chặn vòng bảo trợ.
- [ ] Edge Function `create-f1-account` (người gọi thành người bảo trợ; admin tạo người gốc) và `reset-password` (chỉ admin) dưới `supabase/functions/`; SĐT chuẩn hoá E.164 và email nội bộ có unit test.
- [ ] `.github/workflows/supabase-deploy.yml` chạy migration và deploy function khi push `main`, dùng `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`.
- [ ] Danh sách bước Dashboard (tắt đăng ký, tắt xác nhận email, Site URL, Redirect URL) và câu SQL tạo admin đầu tiên có trong repo.

---

## Implementation Notes

- Kiểm tra migration bằng Postgres cục bộ (PGlite) với schema `auth` giả lập.
- Chưa có giao diện đăng nhập; app chưa gọi Supabase (story sau).

---

## Out of Scope

- Màn đăng nhập, đổi mật khẩu, nút "Tạo tài khoản" trên Danh bạ.
- Đồng bộ số tổng hợp từ app, cây và bảng 4x4 trên server.

---

## Files

- `.env.production`, `.env.example`, `package.json` (`@supabase/supabase-js`)
- `src/config/supabase.ts`
- `supabase/config.toml`
- `supabase/migrations/20261106000000_accounts.sql`
- `supabase/functions/_shared/phone.ts`, `supabase/functions/_shared/http.ts`, `supabase/functions/_shared/auth.ts`
- `supabase/functions/create-f1-account/index.ts`
- `supabase/functions/reset-password/index.ts`
- `supabase/snippets/make-first-admin.sql`
- `supabase/README.md`, `supabase/.gitignore`
- `tools/ci/check-no-secrets.mjs`
- `.github/workflows/supabase-deploy.yml`, `.github/workflows/deploy-pages.yml`
- `tests/unit/supabase/phone.test.ts`, `tests/unit/supabase/config.test.ts`
- `tests/integration/supabase/accounts-rls.test.ts` (PGlite, devDependency `@electric-sql/pglite`)

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/supabase/accounts-rls.test.ts` (migration + RLS on PGlite); live run of `supabase-deploy.yml` after merge

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: story đăng nhập và đồng bộ (chưa viết)

## Completion Notes
**Completed**: 2026-11-06
**Criteria**: 6/6 passing (migration and both functions deployed by supabase-deploy.yml run 42191801517; first admin created in the Dashboard)
**Deviations**: Advisory, not logged as tech debt: (1) `package-lock.json` and the `@electric-sql/pglite` devDependency are not named in `## Files`; (2) `.env.production` holds the public publishable key, which is intended but stays in git history; (3) the app does not call Supabase yet, and a successful account creation or password reset was not tried live; (4) Site URL and Redirect URLs on the Dashboard are not confirmed
**Test Evidence**: tests/integration/supabase/accounts-rls.test.ts (14 tests, 6 fail with RLS off); tests/unit/supabase/ (phone 17, config 4); full suite 324/324; live workflow runs 42191801517 (Supabase) and 42191801533 (Pages)
**Reviewed by**: self, no independent review
