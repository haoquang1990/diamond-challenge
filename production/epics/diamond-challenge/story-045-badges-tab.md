# Story 045: Tab "Huy hiệu" thay Con đường; bỏ Cấp độ và ô Chặng hiện tại

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-24

## Context

**GDD**: N/A (minimal; `design/quick-specs/achievements-system-2026-11-05.md` is the earlier achievements spec)
**Requirement**: Phản hồi 2026-11-24: bỏ trang Con đường, thay bằng trang thành tích "càng nhiều càng tốt". Quyết định: không cộng XP thưởng; thành tích đạt từ trước ghi nhận im lặng; bỏ phần Cấp độ; dùng tên "Huy hiệu"; khoảng 150 huy hiệu (mỗi mốc là một huy hiệu); bỏ ô "Chặng hiện tại" ở Hôm nay; danh mục duyệt 2026-11-24.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Thanh tab: Hôm nay · Học · Làm · Huy hiệu; không còn màn Con đường và màn Thành tích cũ.
- [ ] Hôm nay không còn ô "Chặng hiện tại".
- [ ] Không còn thẻ hay nhóm Cấp độ.

## Files

- `src/app.tsx` (tab `badges`, routes `path` and `achievements` removed), `src/ui/screens/today-screen.tsx` (stage slot removed)
- Deleted: `src/ui/screens/achievements-screen.tsx`
- `production/qa/evidence/story-047-badges/` (tab bar and Hôm nay checked in the same run)

## Completion Notes
**Completed**: 2026-11-24
**Criteria**: 3/3 passing (none deferred)
**Deviations**: Advisory: `diamond-path-screen.tsx` stays because the stage helpers it exports (`DEFAULT_STAGES`, `buildStageView`) are still used by Hôm nay and the achievements overlay; its screen component is no longer routed. Hôm nay still computes the stage name it no longer shows.
**Test Evidence**: screenshots `production/qa/evidence/story-047-badges/`; full suite 649/649
**Reviewed by**: self, no independent review
