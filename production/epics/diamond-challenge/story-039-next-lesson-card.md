# Story 039: Thẻ "Bài nên học tiếp" trên Hôm nay

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-24

## Context

**GDD**: N/A (minimal; `design/lessons/outline.md`)
**Requirement**: Phản hồi dùng thử 2026-11-24, kế hoạch 039–043 được duyệt 2026-11-24. Quyết định: thẻ trên Hôm nay, gợi ý theo thứ tự 18 chặng.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Hôm nay có thẻ "Bài nên học tiếp": tên bài, "Chặng N · Tên chặng", XP, nút "Học ngay".
- [ ] Bài gợi ý là bài đầu tiên chưa học lần nào theo thứ tự chặng rồi thứ tự bài (giống nhãn "Học tiếp" của tab Học). Hàm thuần, có unit test (chưa học gì, học một phần, học hết).
- [ ] "Học ngay" mở tab Học và chạy thẳng câu 1 của bài đó; thoát bài hoặc học xong thì về danh sách như cũ.
- [ ] Học hết mọi bài: thẻ báo đã học đủ và nút mở tab Học để ôn.
- [ ] 390 và 320px không tràn ngang, nút ≥ 44px.

## Out of Scope

- Lộ trình 4 tuần xen kẽ; khoá bài.

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-038-rebalance-stages.md`
- Unlocks: None

## Files

- `src/domain/lesson-stages.ts` (`nextLessonSuggestion`)
- `src/ui/lesson-content.ts` (new: lessons and stages loaded once, shared by Học and Hôm nay)
- `src/ui/screens/today-screen.tsx` (`NextLessonCard`), `src/ui/screens/lesson-screen.tsx` (`initialLessonId`), `src/app.tsx` (start request, cleared when leaving Học)
- `src/ui/lesson-strings.ts`, `src/ui/styles.css`
- `tests/unit/lesson/next-lesson.test.ts` (4 tests, seen failing first)
- `production/qa/evidence/story-039-next-lesson-card/`

## Completion Notes
**Completed**: 2026-11-24
**Criteria**: 5/5 passing (none deferred)
**Deviations**: Advisory: the "all learned" state is covered by unit test and code, not by a screenshot; Hôm nay now shows both "Chặng 1 · Khởi đầu" (lesson stage) and "Chặng hiện tại" (Con đường stage), which use the same word
**Test Evidence**: `tests/unit/lesson/next-lesson.test.ts`; screenshots `production/qa/evidence/story-039-next-lesson-card/` (390 and 320px); full suite 600/600
**Reviewed by**: self, no independent review
