# Story 015: Gộp Làm và Danh bạ thành một tab Làm

> **Epic**: diamond-challenge
> **Status**: In Progress
> **Layer**: Presentation
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-05

## Context

**GDD**: `design/game-brief.md` (chi tiết: `design/gdd/crm.md`, Core Rules 12–13, AC-11, AC-20, AC-24, AC-25)
**Requirement**: Brief MVP feature 1 — Danh bạ + việc cần làm; feature 2 — hoạt động gắn với một người (phản hồi dùng thử 2026-11-05: màn Làm và Danh bạ trùng nhau)

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Thanh tab chỉ còn 4 tab **Hôm nay · Học · Làm · Con đường**; tab Làm hiện Danh bạ (bộ lọc, thêm người, khôi phục, gán hoạt động cũ), tiêu đề màn "Làm".
- [ ] Nút **Làm** trên Hôm nay mở tab Làm; mục tiêu ngày và nhắc nhở vẫn nói "việc Làm".
- [ ] Màn chọn người riêng (`log-activity-screen.tsx`) bị xóa cùng các chữ chỉ nó dùng; app build và chạy không lỗi.
- [ ] Trang chi tiết người: danh sách việc cần làm nằm trên cùng; tên, số điện thoại, ghi chú thu gọn sau nút "Sửa thông tin"; hoàn thành việc, hoàn tác, nhãn KH/NPP hoạt động như trước.
- [ ] Ô tìm tên ở đầu danh sách lọc theo tên, không phân biệt dấu và hoa thường ("dung" ra "Dũng"), kết hợp được với bộ lọc.
- [ ] Bảng 30x30: bấm dòng KH hoặc NPP F1 mở tab Làm đã lọc sẵn, có nút quay lại Bảng; các chữ "Danh bạ" chỉ tên tab đổi theo.
- [ ] XP, streak, mục tiêu ngày và mốc Con đường không đổi cách tính (hoàn thành việc vẫn là `activity_logged`).
- [ ] Mobile-first (390×844 và 320px), nút chạm ≥ 44px, không tràn ngang.

---

## Implementation Notes

- Chỉ đổi giao diện; không đổi `src/domain/*`, `src/data/*` hay cấu hình.
- Bản sửa "thanh tab cho màn Làm" (commit d858833) không còn cần khi màn chọn người bị xóa.
- Chụp ảnh: thanh tab 4 mục, tab Làm, tìm tên, chi tiết người (việc lên đầu, "Sửa thông tin" mở/thu), hoàn thành việc, Bảng 30x30 → tab Làm đã lọc, Hôm nay.

---

## Out of Scope

- Đổi logic việc cần làm, nhãn hay sao lưu.
- Giai đoạn 2 (tài khoản, đồng bộ, Bảng 4x4).

---

## Files

- `src/app.tsx`
- `src/ui/screens/people-screen.tsx`
- `src/ui/screens/person-form.tsx`
- `src/ui/screens/log-activity-screen.tsx` (xóa)
- `src/ui/screens/today-screen.tsx`
- `src/ui/screens/board-30x30-screen.tsx`
- `src/ui/people-helpers.ts`
- `src/ui/strings.ts`
- `src/ui/styles.css`
- `production/qa/evidence/story-015-merge-lam-danh-ba/*.png`

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

- Depends on: `production/epics/diamond-challenge/story-013-contacts-tab.md`, `production/epics/diamond-challenge/story-014-activity-tab.md`
- Unlocks: None
