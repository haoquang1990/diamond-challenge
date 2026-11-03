# Story 005: Bài Học ngắn

> **Epic**: diamond-challenge
> **Status**: In Progress
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-03

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Brief MVP feature 2 — Bài Học ngắn

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Bài học đọc từ file dữ liệu (`src/content/lessons.json`): tiêu đề, 3–5 câu trắc nghiệm, đáp án đúng, giải thích ngắn, XP.
- [ ] Có ít nhất 5 bài mẫu (nội dung kỹ năng chung, không dùng tài liệu/thương hiệu chính thức của Amway).
- [ ] Màn Học cho chọn bài; đang làm hiện tiến độ (câu x/n) và báo đúng/sai kèm giải thích sau mỗi câu.
- [ ] Hoàn thành bài thì thêm sự kiện `lesson_completed` (story 001) với XP của bài.
- [ ] Làm lại bài đã hoàn thành trong cùng ngày không cộng XP lần nữa.
- [ ] Bài mất khoảng 2 phút, làm trọn bằng một tay trên điện thoại.
- [ ] Thêm bài mới chỉ cần sửa file dữ liệu, không sửa code.
- [ ] File bài học hỏng hoặc thiếu trường hiển thị thông báo lỗi dễ hiểu, không sập app.

---

## Implementation Notes

- Sắp xếp và gợi ý bài theo thứ tự trong file; chưa cần thuật toán lặp lại cách quãng.

---

## Out of Scope

- Trình soạn bài trong app, chấm điểm nâng cao, lặp lại cách quãng.

---

## Files

- `src/content/lessons.json`
- `src/domain/lesson.ts`
- `src/ui/screens/lesson-screen.tsx`
- `src/app.tsx`
- `src/ui/strings.ts`
- `src/ui/styles.css`
- `tests/unit/lesson/lesson.test.ts`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp màn hình chọn bài, đang làm (đúng/sai) và hoàn thành, giữ lại trong `production/qa/evidence/`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-001-event-log.md`, `production/epics/diamond-challenge/story-004-today-screen.md`
- Unlocks: None
