# Story 074: Báo mã số F1 đã đổi, cập nhật một chạm

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-28

## Context

**GDD**: `design/game-brief.md` (Danh bạ, Hộ F1; story 042, 072)
**Requirement**: Chốt 2026-11-28: khi mã số một hộ F1 đổi, liên kết vẫn giữ; liên hệ NPP trong Danh bạ của tuyến trên còn ghi mã cũ thì báo mã mới và cho cập nhật một chạm. Mockup C đã duyệt.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Trang chi tiết liên hệ còn ghi mã cũ của một hộ F1 của mình: thẻ vàng "Mã số của F1 này đã đổi thành …" với nút "Cập nhật mã số"; bấm thì mã trong Danh bạ đổi, thẻ biến mất.
- [x] Máy chủ: `downline_code_changes()` chỉ trả mã cũ → mã mới của các hộ F1 trực tiếp của mình. Có integration test; client có unit test.
- [x] Liên hệ ghi mã khác, không có mã, hoặc không có thay đổi: không có thẻ.
- [x] Không đổi liên kết tuyến (vẫn theo hộ).
- [x] 390 và 320px không tràn ngang.

## Files

- `supabase/migrations/20261129050000_upline_links.sql` (074 part)
- `src/data/upline-service.ts` (`loadDownlineCodeChanges`), `src/ui/people-helpers.ts` (`codeChangeFor`), `src/ui/screens/people-screen.tsx`, `src/ui/screens/person-form.tsx`, `src/app.tsx`, `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/integration/supabase/upline.test.ts` (1 test for 074), `tests/unit/people-ui/contact-owner.test.ts` (2 tests); seen failing first
- `production/qa/evidence/story-074-code-changed/`

## Completion Notes
**Completed**: 2026-11-28
**Criteria**: 5/5 passing (none deferred)
**Deviations**: None
**Test Evidence**: integration and unit tests above; screenshots of the notice at 390 and 320px (and the code updated after the tap); full suite passing
**Reviewed by**: self, no independent review
