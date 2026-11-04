# Story 010: Bảng 30x30

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Presentation
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-04

## Context

**GDD**: `design/game-brief.md` (chi tiết: `design/gdd/crm.md`, Interactions, Formulas, AC-12 đến AC-17)
**Requirement**: Brief MVP feature 5 — Bản đồ Con đường Diamond và Bảng 30x30 (phần Bảng)

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Màn **Bảng 30x30** mở từ màn Con đường bằng một nút rõ ràng, có nút quay lại.
- [ ] Hiện tiến độ của mình: liên hệ x/250, Khách hàng x/30, NPP F1 x/30, mỗi mục có thanh tiến độ; số lấy từ hàm thuần của story 008.
- [ ] Huy hiệu "Đạt 30x30" chỉ hiện khi KH ≥ 30 **và** NPP F1 ≥ 30; mốc phụ liên hệ có dấu đạt riêng khi liên hệ ≥ 250.
- [ ] Người đã lưu trữ không được đếm; chuyển một người lùi khỏi giai đoạn NPP thì số NPP F1 giảm ngay khi mở lại bảng.
- [ ] Các ngưỡng (250, 30, 30) đọc từ `game-config.json` mục `target30x30`; đổi cấu hình thì bảng đổi theo mà không sửa code.
- [ ] Ghi chú luôn hiển thị: "Số liệu tính từ danh sách bạn tự nhập, không phải xác nhận chính thức."
- [ ] Trạng thái rỗng (chưa có ai) hiển thị 0/250, 0/30, 0/30 và dẫn tới màn Người, không lỗi.
- [ ] Bảng không tạo sự kiện nào có `xp`; XP, streak và chặng Con đường không đổi.
- [ ] Mobile-first (390×844), nút chạm ≥ 44px.

---

## Implementation Notes

- Chỉ đọc nhật ký, không ghi gì. Không có cây nhiều tầng, nhánh hay Bảng 4x4 (giai đoạn 2).
- Chụp ảnh các trạng thái: rỗng, đang dở, đạt 30x30, đạt mốc liên hệ.

---

## Out of Scope

- Bảng 4x4, nhánh, điểm sâu, đồng bộ lên server (giai đoạn 2).
- Phân loại người "tích cực / không tích cực".

---

## Files

- `src/ui/screens/board-30x30-screen.tsx`
- `src/ui/screens/diamond-path-screen.tsx`
- `src/app.tsx`
- `src/ui/strings.ts`
- `src/ui/styles.css`
- `production/qa/evidence/story-010-board-30x30/*.png`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp màn hình từng trạng thái, giữ lại trong `production/qa/evidence/`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-008-people-model.md`, `production/epics/diamond-challenge/story-006-diamond-map.md`
- Unlocks: None

## Completion Notes
**Completed**: 2026-11-04
**Criteria**: 9/9 passing (production build in Chromium 390×844 and 320px; AC-8 measured by script event counts, not an image; not tried on a real phone)
**Deviations**: Advisory, not logged as tech debt: (1) dependency story 006 was still In Progress when this started (accepted); (2) screenshots 02 and 05 were not opened by the reviewer, their numbers come from the capture script; (3) changing `target30x30` in the config was not tried in the browser (no hardcoded 250/30 found by grep); (4) not tried on a real phone.
**Test Evidence**: screenshots in production/qa/evidence/story-010-board-30x30/ (00–06 plus stamp.txt, stamp unchanged); full suite 173/173
**Reviewed by**: self, no independent review
