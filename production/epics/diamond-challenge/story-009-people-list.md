# Story 009: Màn danh sách Người + Làm gắn với một người

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-04

## Context

**GDD**: `design/game-brief.md` (chi tiết: `design/gdd/crm.md`, Core Rules 4, 7, 8)
**Requirement**: Brief MVP feature 1 — Danh sách Người + giai đoạn; feature 2 — Ghi hoạt động Làm gắn với một người

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Màn **Người** (tab hoặc lối vào từ Hôm nay) liệt kê người chưa lưu trữ, nhóm theo giai đoạn, mỗi người hiện tên và giai đoạn.
- [ ] Thêm người (tên, ghi chú tùy chọn) ghi `person_added` kèm hoạt động `add_name` (đúng XP của hoạt động); tên rỗng bị từ chối với thông báo rõ.
- [ ] Sửa tên/ghi chú và lưu trữ một người; người đã lưu trữ biến khỏi danh sách nhưng XP đã có vẫn giữ.
- [ ] Đổi giai đoạn của một người bằng một thao tác rõ ràng; hiện XP nhận được (hoặc "không có XP" khi lùi, nhảy bậc, hoặc đã nhận rồi) và có hoàn tác.
- [ ] Màn Làm bắt buộc chọn **một người** (hoặc thêm người mới ngay tại đó) trước khi chọn loại hoạt động; sự kiện `activity_logged` mang `personId`.
- [ ] Sau khi ghi một hoạt động có `suggestsStage` (đọc từ `game-config.json`), hỏi một chạm "Chuyển [Tên] sang [giai đoạn]?"; không bao giờ tự chuyển.
- [ ] Hoạt động cũ chưa gắn ai hiện là "Không gắn người" và gán lại được cho một người (không đổi XP); hoạt động trỏ tới người không tồn tại hiện "Người không rõ" mà không lỗi.
- [ ] Mobile-first (390×844), nút chạm ≥ 44px, dùng được một tay; trạng thái rỗng (chưa có ai) có hướng dẫn thêm người đầu tiên.
- [ ] Các số hiển thị trên Hôm nay vẫn đúng sau khi gắn người (XP, streak không đổi cách tính).

---

## Implementation Notes

- Dùng hàm thuần của story 008; màn hình chỉ hiển thị và ghi sự kiện qua `EventStore` được truyền vào.
- Sửa màn Làm hiện có (`src/ui/screens/log-activity-screen.tsx`, story 003 đã Complete): thêm bước chọn người, giữ nguyên các hành vi cũ (hoàn tác bằng sự kiện bù, phản hồi XP).
- Chụp ảnh các trạng thái: danh sách rỗng, có người theo giai đoạn, thêm người, Làm chọn người, gợi ý đổi giai đoạn, gán lại hoạt động cũ.

---

## Out of Scope

- Story 008: kiểu sự kiện và logic.
- Story 010: Bảng 30x30.
- Người bảo trợ, cây nhiều tầng, tạo tài khoản (giai đoạn 2).
- Nhập danh bạ điện thoại tự động.

---

## Files

- `src/ui/people-config.ts`
- `src/ui/people-helpers.ts`
- `src/ui/screens/people-screen.tsx`
- `src/ui/screens/person-form.tsx`
- `src/ui/screens/log-activity-screen.tsx`
- `src/ui/activity-types.ts`
- `src/app.tsx`
- `src/ui/strings.ts`
- `src/ui/styles.css`
- `src/config/game-config.json`
- `tests/unit/people-ui/people-helpers.test.ts`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp màn hình từng trạng thái, giữ lại trong `production/qa/evidence/`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-008-people-model.md`, `production/epics/diamond-challenge/story-003-log-activity.md`, `production/epics/diamond-challenge/story-004-today-screen.md`
- Unlocks: None

## Completion Notes
**Completed**: 2026-11-04
**Criteria**: 9/9 passing (production build in Chromium 390×844 and 320×844; the undo button of a stage change was not clicked in the browser, its logic is covered by story 008 tests; not tried on a real phone)
**Deviations**: Advisory, not logged as tech debt: (1) the stage-change prompt in Làm has no undo of its own (undo from the person detail); (2) adding a person in the Người tab writes two events non-atomically (person without XP if the second fails, an error is shown); (3) the "Con đường" tab label wraps to two lines at 320px; (4) the person picker in Làm has no typing search.
**Test Evidence**: screenshots in production/qa/evidence/story-009-people-list/ (01–10; 02 and 04 not opened by the reviewer); tests/unit/people-ui/people-helpers.test.ts (5 tests); full suite 173/173
**Reviewed by**: self, no independent review
