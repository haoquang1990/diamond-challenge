# Story 018: Màn Thành tích và khôi phục sao lưu không bật popup

> **Epic**: diamond-challenge
> **Status**: Ready
> **Layer**: Presentation
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-05

## Context

**GDD**: `design/game-brief.md` (chi tiết: `design/quick-specs/achievements-system-2026-11-05.md`, Core Rules 4, 10; AC-8 đến AC-11, AC-13, AC-14, AC-15)
**Requirement**: Brief MVP feature 8 — Thông báo thành tích (xem lại); feature 6 — sao lưu và khôi phục

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Màn Con đường có nút "Thành tích" cạnh "Bảng 30x30", mở màn Thành tích có nút quay lại về Con đường.
- [ ] Màn Thành tích hiện tiêu đề "Đã đạt X/Y"; mốc đã đạt có tên và ngày đạt; mốc chưa đạt hiện xám kèm cách đạt và tiến độ (ví dụ "Khách hàng 12/30", "Streak 3/7").
- [ ] Mục tiêu ngày hiện "Đã đạt mục tiêu ngày N lần", không liệt kê từng ngày.
- [ ] Mốc đạt rồi vẫn hiện là đạt dù sau đó tụt xuống (hoàn tác, lưu trữ); mốc ghi nhận im lặng (dữ liệu cũ) cũng hiện là đã đạt.
- [ ] Thêm một mốc mới vào cấu hình thì có dòng trên màn này mà không sửa code.
- [ ] Sau khi nhập file sao lưu thành công, app ghi nhận im lặng các mốc đang đạt; mở trình duyệt mới, nhập file thì không bật popup nào và màn Thành tích đúng như máy cũ.
- [ ] Lựa chọn tắt âm thanh được giữ sau khi khôi phục sao lưu.
- [ ] Màn chỉ đọc nhật ký; không tạo sự kiện có `xp`.
- [ ] Mobile-first 390×844 và 320px, nút ≥ 44px, không tràn ngang.

---

## Implementation Notes

- Dùng hàm thuần của story 016; không tính lại mốc trong UI.
- Chụp ảnh: Con đường có nút Thành tích, màn Thành tích (đã đạt / chưa đạt), sau khi khôi phục sao lưu ở trình duyệt mới, 320px.

---

## Out of Scope

- Toast và popup (story 017).
- Đồng bộ thành tích lên server (giai đoạn 2).

---

## Files

- `src/ui/screens/achievements-screen.tsx`
- `src/ui/screens/diamond-path-screen.tsx`
- `src/ui/screens/settings-screen.tsx`
- `src/app.tsx`
- `src/ui/strings.ts`
- `src/ui/styles.css`
- `production/qa/evidence/story-018-achievements-screen/*.png`

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

- Depends on: `production/epics/diamond-challenge/story-016-achievements-model.md`, `production/epics/diamond-challenge/story-017-achievement-toast-popup.md`, `production/epics/diamond-challenge/story-011-backup-restore.md`
- Unlocks: None
