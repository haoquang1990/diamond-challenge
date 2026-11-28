# Story 067: Nút Học / Làm trong Mục tiêu hôm nay, bỏ thẻ Bài nên học tiếp

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-28

## Context

**GDD**: `design/game-brief.md` (Hôm nay; story 039, 062)
**Requirement**: Phản hồi 2026-11-28: thêm nút vào chỗ Học và Làm trong thẻ Mục tiêu hôm nay; bỏ thẻ "Bài nên học tiếp". Mockup đã duyệt.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Dòng "Bài học x/y" có nút HỌC (đã đạt: HỌC THÊM, viền trắng) mở thẳng bài nên học tiếp; học hết bài thì mở trang Học.
- [x] Dòng "Việc làm x/y" có nút LÀM (đã đạt: LÀM THÊM) mở trang Làm.
- [x] Dòng "còn N XP" không có nút; phần đặt 0 không hiện như trước.
- [x] Thẻ "Bài nên học tiếp" không còn trên Hôm nay.
- [x] 390 và 320px không tràn ngang.

## Files

- `src/ui/screens/today-screen.tsx`, `src/app.tsx` (`onOpenWork`), `src/ui/strings.ts`, `src/ui/styles.css`
- `production/qa/evidence/story-067-goal-buttons/`

## Completion Notes
**Completed**: 2026-11-28
**Criteria**: 5/5 passing (none deferred)
**Deviations**: Advisory: no unit test (wiring only); the buttons were clicked in the built app and opened the lesson and Làm
**Test Evidence**: screenshots of Hôm nay at 390 and 320px; full suite passing
**Reviewed by**: self, no independent review
