# Story 007: Nhắc nhở hằng ngày

> **Epic**: diamond-challenge
> **Status**: In Progress
> **Layer**: Feature
> **Type**: Integration
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-03

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Brief MVP feature 7 — Nhắc nhở hằng ngày

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] **Bước 0 — khảo sát khả thi (làm đầu tiên):** ghi lại bằng nguồn chính thức/thử thực tế trên thiết bị thật xem PWA nhắc nhở cục bộ theo lịch có làm được không (Notification Triggers, service worker, giới hạn trên iOS khi PWA đã cài ra màn hình chính). Kết quả ghi vào `production/qa/evidence/story-007-feasibility.md`. NOT SOURCEABLE nếu chưa có nguồn: không khẳng định từ trí nhớ.
- [ ] Màn Cài đặt cho bật/tắt nhắc nhở và chọn giờ; lựa chọn lưu qua sự kiện `settings_changed`.
- [ ] Xin quyền thông báo đúng lúc (sau khi người dùng bật), xử lý đủ trạng thái: cấp, từ chối, chưa hỏi.
- [ ] Khi từ chối hoặc nền tảng không hỗ trợ: app hiển thị rõ thông báo trong app (banner trên Hôm nay) thay vì im lặng.
- [ ] Không nhắc nếu hôm nay đã đạt mục tiêu ngày.
- [ ] Nội dung nhắc ngắn, nhắc streak hiện tại; bấm vào mở thẳng màn Hôm nay.
- [ ] Phương án dự phòng được chọn dựa trên kết quả Bước 0 và ghi lại (vd. thông báo trong app, lịch .ics, hoặc đẩy từ server ở giai đoạn 2).
- [ ] Đã thử trên ít nhất một thiết bị Android và một thiết bị iOS thật, hoặc ghi rõ thiết bị nào chưa thử được.

---

## Implementation Notes

- Đây là rủi ro lớn nhất của MVP; nếu Bước 0 cho thấy nhắc nhở cục bộ không đáng tin cậy, báo lại để cân nhắc đẩy thông báo từ server (giai đoạn 2) trước khi làm tiếp.

---

## Out of Scope

- Web push từ server và tài khoản (giai đoạn 2).

---

## Files

- `src/notifications/reminders.ts`
- `src/ui/screens/settings-screen.tsx`
- `src/service-worker.ts`
- `production/qa/evidence/story-007-feasibility.md`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `production/qa/evidence/story-007-feasibility.md` (kết quả thử trên thiết bị thật) hoặc tài liệu playtest

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-004-today-screen.md`
- Unlocks: None
