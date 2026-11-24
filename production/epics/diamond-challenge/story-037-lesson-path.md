# Story 037: Tab Học theo chặng: con đường bài học có icon, popup bài

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-24

## Context

**GDD**: N/A (minimal; `design/lessons/outline.md` là bản ghi nội dung bài học)
**Requirement**: Phản hồi 2026-11-24: "Bài học có từng chặng tương tự như duolingo thay vì liệt kê tất cả như hiện tại"; làm mẫu trước. Mẫu v2 (con đường vòng tròn, icon riêng từng bài, thẻ đầu chặng, cúp cuối chặng, popup bài) được duyệt 2026-11-24. Quyết định: không khoá bài; cúp chỉ để trang trí, không thêm XP hay thành tích.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Danh sách bài trong tab Học thay bằng con đường: mỗi chặng (theo `stages` trong `lessons.json`) mở đầu bằng một thẻ có icon chặng, tên "Chặng N · Tên", câu mô tả và thanh tiến độ (số bài đã học ít nhất một lần / tổng); dưới thẻ là các vòng tròn bài xếp so le, tên bài dưới mỗi vòng, cuối chặng có cúp. Chặng chưa có bài hiện thẻ với "Sắp có bài", không có vòng.
- [ ] Mỗi vòng có icon của bài (`icon` trong `lessons.json`); thiếu hoặc không có trong bộ icon thì dùng icon của chặng, rồi icon chung. Bài đã học có màu chặng và dấu ✓ ở góc; bài chưa học màu xám; bài gợi ý học tiếp to hơn, có vòng sáng và nhãn "Học tiếp".
- [ ] Bài gợi ý học tiếp là bài đầu tiên chưa học lần nào theo thứ tự chặng rồi thứ tự bài; học hết thì không có bài gợi ý. Hàm thuần, có unit test.
- [ ] Không khoá bài: bấm bất kỳ vòng nào mở popup (`Dialog` của story 034) với tên bài, XP, số câu, "Đã học N lần · gần nhất dd/mm" khi đã học, "Đã học hôm nay" khi đã học hôm nay; nút "Bắt đầu" (chưa học) hoặc "Ôn lại" (đã học) chạy bài như cũ, nút "Đóng". Luật XP không đổi.
- [ ] Cúp cuối chặng chuyển màu vàng khi đã học hết bài của chặng; bấm vào cúp mở popup nói cần học hết bao nhiêu bài. Không thêm XP, thành tích hay sự kiện.
- [ ] Khi cuộn qua thẻ đầu chặng, một thanh trên cùng hiện chặng đang xem và "x/y bài"; ở đầu trang thì ẩn.
- [ ] `stages` nhận thêm `icon` và `description` không bắt buộc, bài nhận thêm `icon` không bắt buộc; giá trị sai kiểu bị bỏ qua mà không làm hỏng bài. Có unit test cho phần đọc file.
- [ ] Mobile-first 390×844 và 320px: không tràn ngang, vòng ≥ 48px, nhãn không đè lên nhau; chuyển động nhấp nhô của nhãn "Học tiếp" tắt khi bật giảm chuyển động.

---

## Implementation Notes

- Nền: `src/ui/screens/lesson-screen.tsx` (phần list), `src/domain/lesson-stages.ts`, `src/domain/lesson.ts`, `src/ui/lesson-strings.ts`, `src/ui/styles.css`; `Dialog` trong `src/ui/screens/person-form.tsx` (export để dùng lại).
- Icon là SVG nét đơn trong một file bộ icon, không thêm thư viện. Màu chặng theo vị trí chặng (bảng màu trong CSS).
- Mẫu đã duyệt: ảnh trong phiên 2026-11-24 (`hoc-chang.html`).
- Không cần migration; không đổi đồng bộ hay luật XP.

---

## Out of Scope

- Khoá bài, thành tích chặng, XP thưởng chặng.
- Nội dung bài mới (các đợt nội dung riêng).
- Chế độ tối riêng cho con đường.

---

## Files

- `src/ui/screens/lesson-path.tsx` (new: path, stage cards, nodes, trophy, top bar, lesson and trophy popups)
- `src/ui/lesson-icons.ts` (new: line icon set, `resolveLessonIcon`)
- `src/ui/screens/lesson-screen.tsx` (list replaced by `LessonPath`)
- `src/ui/screens/person-form.tsx` (`Dialog` exported for reuse)
- `src/domain/lesson-stages.ts` (stage `icon`, `description`; `suggestedNextLesson`)
- `src/domain/lesson.ts` (lesson `icon`; a bad icon is dropped, lesson kept)
- `src/content/lessons.json` (icon and description on 8 stages, icon on 26 lessons)
- `src/ui/lesson-strings.ts`, `src/ui/styles.css` (path strings and styles; old list styles and helpers removed)
- `tests/unit/lesson/lesson-path.test.ts` (new, 11 tests), `tests/unit/lesson/lesson-stages.test.ts` (Khởi đầu test uses `toMatchObject` now that stages carry icon/description)
- `production/qa/evidence/story-037-lesson-path/` (12 screenshots at 390 and 320px + stamp)

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp tab Học (đầu trang, chuyển chặng, popup bài, popup cúp) ở 390 và 320px trong `production/qa/evidence/story-037-lesson-path/`; unit test cho hàm bài gợi ý và phần đọc icon/mô tả.

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-036-lessons-5-7-questions-start-stage.md`
- Unlocks: None

## Completion Notes
**Completed**: 2026-11-24
**Criteria**: 8/8 passing (none deferred)
**Deviations**: Advisory, not logged as tech debt: (1) the top stage bar shows the last stage whose card has scrolled above the screen, so between two cards it can still name the previous stage; (2) stage colours are a fixed 8-colour palette by stage position in `styles.css`, not a per-stage config field; (3) the old flat-list styles and the `stageHeading` / `stageProgressLabel` helpers were removed as unused
**Test Evidence**: `tests/unit/lesson/lesson-path.test.ts` (11 tests); screenshots `production/qa/evidence/story-037-lesson-path/` (12 images at 390 and 320px, stamp unchanged); full suite 595/595
**Reviewed by**: self, no independent review
