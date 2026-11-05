# Story 017: Toast cộng XP, popup thành tích, âm thanh và giảm chuyển động

> **Epic**: diamond-challenge
> **Status**: Ready
> **Layer**: Presentation
> **Type**: UI
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-05

## Context

**GDD**: `design/game-brief.md` (chi tiết: `design/quick-specs/achievements-system-2026-11-05.md`, Core Rules 3, 5–9; AC-1 đến AC-9, AC-12, AC-13, AC-15, AC-16)
**Requirement**: Brief MVP feature 8 — Thông báo thành tích (toast, popup)

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Một lớp bọc quanh `EventStore` báo "nhật ký vừa đổi" sau mỗi lần ghi; app kiểm tra mốc mới sau mỗi lần ghi, khi mở app và khi đổi tab (dùng hàm của story 016).
- [ ] Toast: mỗi sự kiện `xp > 0` hiện "+N XP · <tên>" ở mép trên khoảng `toastMs`, `pointer-events: none`, `role="status"`, không chặn thao tác; xếp hàng, không chồng; gộp khi quá 3; chờ khi đang có popup.
- [ ] Popup: hộp thoại chặn màn hình (`role="dialog"`, `aria-modal`, tiêu điểm ở nút), hiện ngay tại màn đang dùng, hiệu ứng kim cương và pháo giấy, tên mốc, câu khích lệ ngẫu nhiên từ cấu hình, nút "Tuyệt vời!" (Enter/Esc đóng); ghi nhận bằng sự kiện lúc popup bắt đầu hiện; tải lại không hiện lại.
- [ ] Nhiều mốc một lúc hiện lần lượt theo luật gộp (tối đa 3, popup thứ 3 gộp phần còn lại); lần mở đầu sau cập nhật ghi nhận im lặng, không bật popup.
- [ ] Thẻ "Bạn đã lên chặng…" trên Hôm nay được thay bằng popup; thẻ "Đã đạt mục tiêu hôm nay" vẫn giữ.
- [ ] Tiếng "ting" chỉ phát từ toast và popup; gỡ các `playTing` trực tiếp ở làm việc cho người, thêm người, bài Học, thẻ chặng (không kêu đôi).
- [ ] Cài đặt có công tắc "Âm thanh thưởng" (`settings_changed { sound: { enabled } }`, mặc định theo `soundDefault`); tắt thì toast và popup đều im; giữ sau tải lại.
- [ ] `prefers-reduced-motion: reduce`: không pháo giấy, không trượt hay nhấp nháy; popup và toast hiện tĩnh.
- [ ] Mobile-first 390×844 và 320px, nút ≥ 44px; XP, streak, mục tiêu ngày, chặng và Bảng 30x30 tính như cũ.

---

## Implementation Notes

- Lớp phủ toast và popup đặt một lần ở `app.tsx`, phía trên mọi màn.
- Pháo giấy làm bằng CSS hoặc canvas nhẹ, không thêm thư viện nặng.
- Chụp ảnh: toast, toast gộp, popup chặng, popup mục tiêu ngày, popup gộp, giảm chuyển động, công tắc âm thanh, 320px.

---

## Out of Scope

- Logic đánh giá mốc (story 016).
- Màn Thành tích, nối vào nhập sao lưu (story 018).

---

## Files

- `src/app.tsx`
- `src/ui/achievements-overlay.tsx`
- `src/ui/play-ting.ts`
- `src/ui/screens/today-screen.tsx`
- `src/ui/screens/person-form.tsx`
- `src/ui/screens/people-screen.tsx`
- `src/ui/screens/lesson-screen.tsx`
- `src/ui/screens/diamond-path-screen.tsx`
- `src/ui/screens/settings-screen.tsx`
- `src/ui/strings.ts`
- `src/ui/styles.css`
- `production/qa/evidence/story-017-achievement-toast-popup/*.png`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp màn hình từng trạng thái, giữ lại trong `production/qa/evidence/`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-016-achievements-model.md`
- Unlocks: `story-018-achievements-screen.md`
