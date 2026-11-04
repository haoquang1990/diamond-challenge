# Story 014: Tab Hoạt động + Bảng 30x30 mở Danh bạ đã lọc

> **Epic**: diamond-challenge
> **Status**: In Progress
> **Layer**: Presentation
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-04

## Context

**GDD**: `design/game-brief.md` (chi tiết: `design/gdd/crm.md`, Core Rules 4, 6, 12, 13, Interactions, AC-20, AC-22)
**Requirement**: Brief MVP feature 2 — ghi hoạt động gắn với một người; feature 5 — Bảng 30x30 (liên kết sang Danh bạ)

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Tab/màn "Làm" đổi tên thành **Hoạt động** (nhãn, tiêu đề và các chữ dẫn tới nó, ví dụ nút trên Hôm nay), qua `strings.ts`.
- [ ] Hoạt động: bắt buộc chọn **một người** (hoặc thêm người mới ngay tại đó), rồi chọn một **việc còn trong danh sách của người đó** (đọc từ `personTasks`, kèm XP); ghi `activity_logged` với `taskId` và `personId`, cùng hành động và cùng XP với việc hoàn thành trong trang chi tiết người (story 013).
- [ ] Sau khi ghi, hiện phản hồi XP như cũ và có hoàn tác bằng sự kiện bù; **không còn** câu hỏi "Chuyển [Tên] sang [giai đoạn]?" và app không ghi `person_stage_changed` mới.
- [ ] Người đã làm hết việc không lặp lại thì chỉ còn "Follow-up"; chốt khách hàng hoặc chốt NPP gắn nhãn đúng.
- [ ] Hoạt động cũ chưa gắn ai vẫn hiện "Không gắn người" và gán lại được; hoạt động trỏ tới người không tồn tại hiện "Người không rõ" mà không lỗi.
- [ ] Sau khi hoàn thành một việc, Hôm nay tăng XP, mục tiêu ngày ("có ít nhất 1 Làm") và mốc Con đường như trước (vẫn là `activity_logged`).
- [ ] Bảng 30x30: dòng **Khách hàng** và **NPP F1** bấm được (nút chạm ≥ 44px) và mở **Danh bạ đã lọc sẵn** theo nhãn đó; dòng Liên hệ không bấm được; "Quay lại" từ Danh bạ về lại Con đường hoặc Bảng một cách nhất quán.
- [ ] Bảng 30x30 vẫn không tạo sự kiện nào có `xp`, vẫn hiện ghi chú, và các ngưỡng vẫn đọc từ `game-config.json`.
- [ ] Mobile-first (390×844), nút chạm ≥ 44px, dùng được một tay.

---

## Implementation Notes

- Sửa `log-activity-screen.tsx` (story 003/009): thay danh sách loại hoạt động bằng việc còn lại của người; giữ các hành vi cũ (hoàn tác bằng sự kiện bù, phản hồi XP, chọn/thêm người).
- Danh bạ nhận một bộ lọc ban đầu từ `app.tsx` khi mở từ Bảng 30x30.
- Chụp ảnh các trạng thái: chọn người, chọn việc, hoàn thành + hoàn tác, người chỉ còn Follow-up, Bảng 30x30 với dòng bấm được, Danh bạ lọc sẵn KH và NPP, Hôm nay sau khi hoàn thành.

---

## Out of Scope

- Story 012: kiểu sự kiện và logic.
- Story 013: Danh bạ, bộ lọc, chi tiết người.
- Sao lưu và khôi phục (story 011).

---

## Files

- `src/ui/screens/log-activity-screen.tsx`
- `src/ui/screens/board-30x30-screen.tsx`
- `src/ui/screens/people-screen.tsx`
- `src/app.tsx`
- `src/ui/strings.ts`
- `src/ui/styles.css`
- `tests/unit/reminders/reminders.test.ts`
- `production/qa/evidence/story-014-activity-tab/*.png`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp màn hình từng trạng thái, giữ lại trong `production/qa/evidence/`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-012-person-tasks-labels.md`, `production/epics/diamond-challenge/story-013-contacts-tab.md`, `production/epics/diamond-challenge/story-010-board-30x30.md`
- Unlocks: None
