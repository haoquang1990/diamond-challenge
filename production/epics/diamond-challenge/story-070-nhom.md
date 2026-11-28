# Story 070: Thẻ Nhóm trên Hôm nay, cổ vũ bạn bè và tuyến trên, cổ vũ có XP

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-28

## Context

**GDD**: `design/game-brief.md` (nhóm, cổ vũ; story 041, 049, 061, 069)
**Requirement**: Chốt 2026-11-28: Nhóm nằm trong Hôm nay, thay thẻ Vợ/chồng và Cổ vũ nhóm; thẻ có avatar, "x/y đã đạt", "Chưa đạt hôm nay" (tối đa 3, sắp mất chuỗi trước) với 👏; cổ vũ được +5 XP, tối đa 3 lần/ngày, người nhận không được XP. Mockup đã duyệt.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Hôm nay: thẻ "Nhóm" có avatar (viền xanh = đã đạt), "x/y người đã đạt mục tiêu hôm nay", "Chưa đạt hôm nay" tối đa 3 người (sắp mất chuỗi trước, rồi vợ/chồng, F1, tuyến trên, bạn), nhãn quan hệ, chuỗi ngày, lý do; 👏 hoặc ✓ đã cổ vũ; "Cả nhóm đều đạt" khi không còn ai; nhóm trống có "+ Kết bạn". Thẻ Vợ/chồng và Cổ vũ nhóm cũ bị bỏ.
- [x] Cổ vũ: +5 XP cho 3 lần đầu mỗi ngày (config `cheerXp`), cộng vào XP hôm nay và tổng, không tính là Việc làm, người nhận không được XP; Hôm nay cập nhật XP ngay; sự kiện `cheer_sent` đồng bộ theo tài khoản. Có unit test.
- [x] Trang Nhóm: các mục Vợ/chồng, Tuyến trên, Tuyến dưới, Bạn bè, mỗi người có ✓ đạt hôm nay, chuỗi ngày, XP 7 ngày và 👏; bấm tên bạn để huỷ kết bạn.
- [x] Máy chủ: `nhom_people()` trả mỗi người một lần (vợ/chồng > tuyến trên > tuyến dưới > bạn); cổ vũ được bạn bè (đã đồng ý) và tuyến trên, mỗi ngày một lần; người lạ thì không; `personal_events` nhận `cheer_sent`. Có integration test.
- [x] 390 và 320px không tràn ngang.

## Files

- `supabase/migrations/20261129030000_nhom_people_cheers.sql`, `supabase/migrations/20261129030100_cheer_xp.sql`
- `src/domain/cheer-xp.ts`, `src/data/nhom-service.ts`, `src/data/event-store.ts`, `src/data/progress-sync.ts`, `src/ui/screens/nhom-panel.tsx`, `src/ui/screens/group-screen.tsx`, `src/ui/screens/today-screen.tsx`, `src/app.tsx`, `src/ui/strings.ts`, `src/ui/styles.css`, `src/config/game-config.json` (`cheerXp`, `nhomCard`); removed `src/ui/screens/group-cheer-card.tsx`
- `tests/unit/nhom/nhom.test.ts` (6 tests), `tests/integration/supabase/nhom-people.test.ts` (8 tests), `tests/integration/supabase/cheer-xp.test.ts` (2 tests); seen failing first
- `production/qa/evidence/story-070-nhom/`

## Completion Notes
**Completed**: 2026-11-28
**Criteria**: 5/5 passing (none deferred)
**Deviations**: Advisory: (1) the cheer picker no longer offers the F1-specific suggested lines of story 049, only the standard ones and my own words; (2) tuyến trên now sees nothing new, but F1s now see their sponsor's streak, today's goal and XP of 7 days in Nhóm; (3) a cheer to an F1 or to tuyến trên still goes to the whole household, as before
**Test Evidence**: unit and integration tests above; screenshots of the card, after a cheer and the Nhóm page at 390 and 320px; full suite passing
**Reviewed by**: self, no independent review
