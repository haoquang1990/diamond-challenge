# Story 042: Bỏ màn Bảng 30x30 và Nhóm của tôi; khung "Hộ F1" trong chi tiết NPP

> **Epic**: diamond-challenge
> **Status**: Ready
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-24

## Context

**GDD**: `design/gdd/crm.md`, `design/gdd/accounts.md`
**Requirement**: Phản hồi dùng thử 2026-11-24, kế hoạch 039–043 được duyệt 2026-11-24. Quyết định: bỏ cả hai màn; 30x30 xem ở Thành tích; lọc NPP ở Làm; cổ vũ ở Hôm nay; mỗi người tự thêm vợ/chồng trong Hộ của tôi; số của F1 hiện tổng, không ghi /30, không có "đạt 30x30".

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Con đường không còn nút "Bảng 30x30" và "Nhóm của tôi"; hai màn và lối vào bị xoá; không còn đường nào mở chúng.
- [ ] Cảnh báo liên hệ trùng (nút mở màn Trùng) chuyển lên tab Làm khi có trùng.
- [ ] Trang chi tiết liên hệ NPP có mã số trùng mã của một hộ F1: khung "Hộ F1" hiện "KH x · NPP y", "N ngày chưa hoạt động" nếu có, thời điểm cập nhật; mất mạng thì dùng số đã lưu kèm "cập nhật lúc …"; không khớp hộ nào thì không có khung.
- [ ] Không còn chỗ tuyến trên thêm thành viên cho hộ F1; Hộ của tôi vẫn thêm vợ/chồng như cũ.
- [ ] Thành tích vẫn có "Đủ 250 liên hệ", "Đủ 30 khách hàng", "Đủ 30 NPP F1", "Đạt 30x30" với tiến độ.
- [ ] 390 và 320px không tràn ngang.

## Out of Scope

- Bỏ đồng bộ số tổng hợp lên máy chủ (giữ cho khung Hộ F1).

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-041-cheer-card-today.md`
- Unlocks: None
