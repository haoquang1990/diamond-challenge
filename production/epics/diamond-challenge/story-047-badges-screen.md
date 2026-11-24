# Story 047: Màn Huy hiệu

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
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

- [ ] Màn Huy hiệu: "x/150 huy hiệu đã có", số huy hiệu Vàng trở lên, hàng "Mới đạt" (3 huy hiệu gần nhất), lọc Tất cả / Đã có / Chưa có.
- [ ] Thẻ theo 7 nhóm (Thói quen, XP, Học, Chặng học, Danh sách, Việc làm, 30x30 và hộ) kèm "đã có/tổng" mỗi nhóm; mỗi thẻ có huy hiệu tô màu bậc cao nhất đã đạt (Đồng, Bạc, Vàng, Kim cương; xám khi chưa có), chấm mốc, thanh tiến độ và "giá trị/mốc tiếp theo".
- [ ] Bấm thẻ mở popup (`Dialog`) với mô tả, giá trị hiện tại và danh sách mốc (đã đạt có màu và dấu ✓).
- [ ] 390 và 320px không tràn ngang (3 cột, 2 cột dưới 340px), nút ≥ 44px.

## Files

- `src/ui/screens/badges-screen.tsx` (new), `src/ui/screens/lesson-path.tsx` (`PathIcon` exported)
- `src/ui/strings.ts`, `src/ui/styles.css`
- `production/qa/evidence/story-047-badges/`

## Completion Notes
**Completed**: 2026-11-24
**Criteria**: 4/4 passing (none deferred)
**Deviations**: Advisory: the "MỚI" mark on silently acknowledged badges from the mockup was not built; "Mới đạt" lists the latest badges that popped up
**Test Evidence**: screenshots at 390 and 320px (top, Chặng học, Việc làm, popup, Đã có filter); full suite 649/649
**Reviewed by**: self, no independent review
