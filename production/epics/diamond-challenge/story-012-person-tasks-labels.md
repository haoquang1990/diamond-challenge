# Story 012: Việc cần làm + nhãn KH/NPP + chuyển dữ liệu cũ

> **Epic**: diamond-challenge
> **Status**: In Progress
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-04

## Context

**GDD**: `design/game-brief.md` (chi tiết: `design/gdd/crm.md`, Core Rules 1–9, 15, Formulas, AC-1 đến AC-5, AC-12 đến AC-16, AC-21 đến AC-23)
**Requirement**: Brief MVP feature 1 — Danh bạ + việc cần làm + nhãn KH/NPP; feature 2 — hoạt động gắn với một người; phần tính của feature 5 — Bảng 30x30

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Cấu hình `game-config.json` có mục `personTasks` (6 việc: `contact` 5, `demo` 10, `opp` 20, `follow_up` 10 lặp lại được, `new_customer` 30 nhãn KH, `new_npp` 50 nhãn NPP) và `countryCodes` (mặc định `+84` Việt Nam); đọc và kiểm tra giống `parsePeopleConfig`, cấu hình hỏng thì báo `problems`, không lỗi.
- [ ] Hàm thuần "việc còn lại của người": việc không lặp lại biến mất khi có một sự kiện chưa bị bù; `follow_up` luôn còn; hoàn tác (`compensates`) thì việc hiện lại; người đã lưu trữ không có việc nào.
- [ ] Hàm tạo sự kiện hoàn thành việc trả về `activity_logged {activityType: taskId, taskId, xp, personId}` với `xp` lấy từ cấu hình; từ chối người đã lưu trữ và việc không tồn tại (không ghi sự kiện).
- [ ] Nhãn suy ra từ nhật ký theo thứ tự: `new_customer` → KH, `new_npp` → NPP, **NPP thay KH và không quay lại KH**; hoàn tác việc chốt thì nhãn được tính lại; mỗi người tối đa một nhãn.
- [ ] Đọc dữ liệu cũ, không sửa nhật ký: `person_stage_changed` cũ cho nhãn (`customer` → KH, `downline` → NPP, còn lại không nhãn) và việc đã làm (giai đoạn từng nhận XP: `contacted` → `contact`, `demoed` → `demo`, `heard_opp` → `opp`, cộng `activity_logged` cũ có `personId` thuộc `demo`/`opp`); `activity_logged {new_customer}` cũ không có `taskId` **không** gắn nhãn; giai đoạn không còn trong cấu hình bị bỏ qua, không lỗi.
- [ ] **Tổng XP và `computeProgress` không đổi:** một nhật ký mẫu có dữ liệu giai đoạn cũ cho cùng tổng XP, mục tiêu ngày và mốc chặng trước và sau thay đổi.
- [ ] `computePeopleStats` đếm `customers`, `f1`, `contacts` theo nhãn trên người chưa lưu trữ, ngưỡng đọc từ `target30x30`; khớp các ví dụ AC-12 (31 KH + 29 NPP chưa đạt, một KH chốt NPP thì đạt), AC-13, AC-14, AC-15.
- [ ] `lastContactAt` (hoạt động mới nhất chưa bị bù, trừ `add_name`, nếu không có thì ngày thêm) và `nppAt` (thời điểm đặt nhãn NPP hiệu lực), cùng hàm sắp xếp: KH tăng dần theo `lastContactAt`, NPP giảm dần theo `nppAt`. Không đọc đồng hồ.
- [ ] Thêm sự kiện `person_restored` vào `src/data/event-store.ts`; trạng thái lưu trữ là sự kiện mới nhất giữa `person_archived` và `person_restored`; `activity_logged`, `person_added` và `person_updated` nhận thêm `taskId` / `phone` tùy chọn; sự kiện cũ vẫn đọc được qua `parseStoredEvent`.
- [ ] Kiểm tra số điện thoại: chỉ chữ số (bỏ khoảng trắng khi lưu), 6–15 chữ số, để trống được, mã nước phải nằm trong `countryCodes`; test Vitest cho các quy tắc trên, ngày cố định, không dùng đồng hồ thật.

---

## Implementation Notes

- Giữ nguyên nguyên tắc nhật ký chỉ thêm, không lưu số dẫn xuất; mọi thứ tính lại từ nhật ký. Quy ước hoàn tác dùng lại `payload.compensates`.
- Hoàn thành việc **vẫn ghi `activity_logged`** (không tạo kiểu sự kiện mới) vì mục tiêu ngày dùng "có ít nhất một `activity_logged` hôm nay" (`progress.ts`) và mốc Con đường đếm `activity_logged` theo `activityType` (`stages.ts`). Giữ id `new_customer` để mốc không đổi.
- Giữ `personStages` trong cấu hình chỉ để đọc dữ liệu cũ; `planStageChange` / `buildStageChangeEvent` không còn dùng cho giao diện mới nhưng vẫn phải đọc được sự kiện cũ.
- Gỡ cứng `CUSTOMER_STAGE_ID` / `F1_STAGE_ID` khỏi phần đếm; số đếm đi qua nhãn.

---

## Out of Scope

- Màn hình (story 013 và 014).
- Sao lưu và khôi phục (story 011), trừ việc kiểu `person_restored` phải được `parseStoredEvent` chấp nhận.
- Giai đoạn 2: tạo tài khoản, đồng bộ số tổng hợp, Bảng 4x4.

---

## Files

- `src/domain/people.ts`
- `src/data/event-store.ts`
- `src/config/game-config.json`
- `src/ui/people-config.ts`
- `tests/unit/people/people-tasks.test.ts`
- `tests/unit/people/people.test.ts`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/people/people-tasks.test.ts` (advisory at `qa.level: minimal`; dự án vẫn yêu cầu test Vitest cho logic)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-008-people-model.md`
- Unlocks: `story-013-contacts-tab.md`, `story-014-activity-tab.md`, `story-011-backup-restore.md`
