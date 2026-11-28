# Story 072: Quản trị: tạo tài khoản và đổi tuyến trên theo mã số

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-28

## Context

**GDD**: `design/game-brief.md` (mã số, tuyến trên/dưới; story 024, 029, 068)
**Requirement**: Phản hồi 2026-11-28: admin cần tạo tài khoản cho người không phải F1 của mình, và nối tuyến trên theo mã số. Liên kết vẫn theo hộ; mã số dùng để tìm. Mockup A đã duyệt.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Quản trị có thẻ "Tạo tài khoản": SĐT, tên hiển thị, mã số Amway, mã số tuyến trên (trống = tài khoản gốc); nhập mã tuyến trên thì hiện ngay hộ tìm được; tạo xong hiện mật khẩu tạm một lần.
- [x] Hộ tìm được trong Quản trị có "Đổi tuyến trên": tuyến trên hiện tại, mã mới (trống = bỏ tuyến trên), xem trước hộ đó; báo rõ không tìm thấy, tự làm tuyến trên của mình, hoặc thành vòng.
- [x] Máy chủ: `admin_set_sponsor_by_code` chỉ admin dùng được; Edge Function `create-f1-account` nhận `sponsorCode` (chỉ admin). Có integration test.
- [x] Liên kết tuyến trên/dưới vẫn theo hộ; đổi mã số không làm đứt liên kết. Có unit test.
- [x] 390 và 320px không tràn ngang.

## Files

- `supabase/migrations/20261129050000_upline_links.sql` (072 part), `supabase/functions/create-f1-account/index.ts`
- `src/data/admin-service.ts` (`sponsorCode`, `adminHouseholdNames`, `setSponsorByCode`), `src/data/account-service.ts`, `src/ui/screens/admin-upline.tsx`, `src/ui/screens/admin-screen.tsx`, `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/integration/supabase/upline.test.ts` (3 tests for 072), `tests/unit/accounts/admin-sponsor.test.ts` (2 tests); seen failing first
- `production/qa/evidence/story-072-admin-upline/`

## Completion Notes
**Completed**: 2026-11-28
**Criteria**: 5/5 passing (none deferred)
**Deviations**: Advisory: the Edge Function change is not covered by a test here (Deno code); its sponsor lookup mirrors the tested SQL
**Test Evidence**: integration and unit tests above; screenshots of Tạo tài khoản, the created account and Đổi tuyến trên at 390 and 320px; full suite passing
**Reviewed by**: self, no independent review
