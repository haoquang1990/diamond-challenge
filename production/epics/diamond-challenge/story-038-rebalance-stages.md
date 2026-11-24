# Story 038: Chia lại tab Học thành 18 chặng, mỗi chặng 5–7 bài

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: Config/Data
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-24

## Context

**GDD**: N/A (minimal; `design/lessons/outline.md` là bản ghi nội dung bài học)
**Requirement**: Phản hồi 2026-11-24: độ dài các chặng lệch nhau (12/8/13/14/21/13/4/15); người dùng chọn mỗi chặng 5–7 bài, số chặng được tăng. Đề xuất 18 chặng được duyệt 2026-11-24.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] `lessons.json` có 18 chặng theo đúng thứ tự và danh sách bài đã duyệt; mỗi chặng 5–7 bài, có icon và câu mô tả; không bài nào nằm ở nhóm "Khác". Có unit test.
- [ ] `id` của bài không đổi, nên lịch sử học, số lần học và XP giữ nguyên; tiến độ từng chặng tự tính lại.
- [ ] Chặng đầu vẫn là `start` "Khởi đầu".
- [ ] Tab Học hiện 18 thẻ chặng; 390 và 320px không tràn ngang, chữ và vòng không đè nhau.

## Out of Scope

- Đổi nội dung bài, giao diện con đường, màu riêng cho từng chặng (bảng 8 màu lặp lại).

## Files

- `src/content/lessons.json` (18 stages; stage of each lesson; lesson order)
- `tests/unit/lesson/lesson-path.test.ts` (stage size test; seen failing on the old 8-stage file)
- `production/qa/evidence/story-038-rebalance-stages/`

## Test Evidence

**Story Type**: Config/Data
**Required evidence**: unit test kích thước chặng; ảnh tab Học 390 và 320px.

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-037-lesson-path.md`
- Unlocks: None

## Completion Notes
**Completed**: 2026-11-24
**Criteria**: 4/4 passing (none deferred)
**Deviations**: Advisory: stage colours cycle through the existing 8-colour palette, so stages 9–18 repeat colours of stages 1–10 (stated in the approved proposal)
**Test Evidence**: `tests/unit/lesson/lesson-path.test.ts`; screenshots `production/qa/evidence/story-038-rebalance-stages/`; full suite 596/596
**Reviewed by**: self, no independent review
