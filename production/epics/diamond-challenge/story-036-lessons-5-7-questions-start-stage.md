# Story 036: Bài học 5–7 câu, nhóm Khởi đầu, bổ sung 11 bài cũ

> **Epic**: diamond-challenge
> **Status**: In Progress
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-24

## Context

**GDD**: N/A — nội dung bài học theo `design/lessons/outline.md` (mục "Quy tắc độ khó và trình tự", "Dàn ý bổ sung từ Drive BTC")
**Requirement**: Người dùng 2026-11-24: mỗi bài ít nhất 5 câu; bài tư duy, động lực cho người mới đứng trước; đưa các bài học trong dàn ý lên app theo đợt, duyệt từng đợt.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] `parseLessons` nhận bài có 5–7 câu; bài 4 câu hoặc 8 câu bị loại và báo lỗi "cần 5–7 câu hỏi" (`MIN_QUESTIONS` = 5, `MAX_QUESTIONS` = 7 trong `src/domain/lesson.ts`).
- [ ] `src/content/lessons.json` có nhóm `start` "Khởi đầu" đứng đầu danh sách `stages`; nhóm chưa có bài hiện "Sắp có bài" như các nhóm khác.
- [ ] 11 bài cũ đang có 3–4 câu được bổ sung lên ít nhất 5 câu, nội dung theo `design/lessons/outline.md` (nguồn B2, MH, LKK) và các quy tắc nội dung đã duyệt; giữ nguyên `id`, câu cũ giữ nguyên.
- [ ] Test nội dung: mọi bài trong `lessons.json` hợp lệ, có 5–7 câu, mọi bài thuộc một nhóm đã khai báo, nhóm đầu tiên là `start`, không có chữ "Amway".
- [ ] Màn Học hiện nhóm "Khởi đầu" trên cùng; ảnh 390 và 320px không tràn ngang.

---

## Out of Scope

- Soạn 86 bài mới (các đợt nội dung sau).
- Nút "Bài nên học tiếp" theo lộ trình gợi ý.
- Gắn mức độ khó cho bài cũ.

---

## Files

- `src/domain/lesson.ts`, `src/content/lessons.json`
- `tests/unit/lesson/lesson.test.ts`, `tests/unit/lesson/lesson-order.test.ts`, `tests/unit/lesson/lesson-match.test.ts`, `tests/unit/lesson/lesson-stages.test.ts`
- `production/qa/evidence/story-036-lessons-5-7-questions-start-stage/`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: unit test giới hạn câu và nội dung `lessons.json`; ảnh màn Học có nhóm Khởi đầu.

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: các đợt nội dung bài học
