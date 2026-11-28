# Story 068: Bắt buộc mã số Amway cho tài khoản còn thiếu

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-28

## Context

**GDD**: `design/game-brief.md` (mã số, tuyến trên/dưới; story 019, 023)
**Requirement**: Chốt 2026-11-28: app dành cho NPP Amway, mỗi tài khoản phải có mã số. Hộ là danh tính nối tuyến trên/dưới; mã số là duy nhất, bắt buộc, dùng để tìm. Hộ chưa có mã thì nhập một lần; mã trùng với tài khoản khác thì gửi admin; đổi mã vẫn qua admin. Mockup đã duyệt.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Sau khi đăng nhập, hộ chưa có mã số đang hoạt động và chưa có yêu cầu chờ admin thì app hiện "Mã số Amway của bạn" trước các tab; vợ/chồng chỉ cần một người nhập.
- [x] Mã hợp lệ, chưa ai dùng: lưu cho hộ, vào app. Mã sai định dạng: báo lỗi. Mã đã thuộc hộ khác: "Mã này đã thuộc một tài khoản khác", "Gửi admin kiểm tra" / "Nhập lại"; gửi xong vẫn dùng app, lần sau mở không hỏi lại khi còn chờ.
- [x] Máy chủ: `claim_household_code` chỉ đặt mã khi hộ chưa có; không đổi mã đã có; mã trùng tạo yêu cầu trong `code_claims` (chỉ thành viên hộ và admin đọc được, không ai ghi trực tiếp). Có integration test.
- [x] Tài khoản không thuộc hộ nào (admin) và lúc không có mạng: không bị chặn. Có unit test.
- [x] 390 và 320px không tràn ngang.

## Files

- `supabase/migrations/20261129010000_claim_household_code.sql`
- `src/data/account-service.ts` (`codeRequirement`, `loadCodeRequirement`, `claimHouseholdCode`, `parseClaimResult`), `src/ui/screens/code-required-screen.tsx`, `src/app.tsx`, `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/integration/supabase/claim-household-code.test.ts` (6 tests), `tests/unit/accounts/code-required.test.ts` (4 tests); both seen failing first
- `production/qa/evidence/story-068-code-required/`

## Completion Notes
**Completed**: 2026-11-28
**Criteria**: 5/5 passing (none deferred)
**Deviations**: Advisory: (1) the admin screen does not list `code_claims` yet; an admin settles a claim with the existing "đặt mã" tool after reading the table in Supabase; (2) how many live accounts lack a code is still unchecked (`production/qa/checks/accounts-without-code.sql`)
**Test Evidence**: integration and unit tests above; screenshots of the ask, taken and sent states at 390 and 320px; full suite passing
**Reviewed by**: self, no independent review
