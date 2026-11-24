# Story 040: Huỷ bảo trợ

> **Epic**: diamond-challenge
> **Status**: Ready
> **Layer**: Feature
> **Type**: Integration
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-24

## Context

**GDD**: `design/gdd/crm.md` (luật nhãn, việc Bảo trợ)
**Requirement**: Phản hồi dùng thử 2026-11-24, kế hoạch 039–043 được duyệt 2026-11-24. Quyết định: giữ 50 XP; nhãn và số F1 tính lại; bảo trợ lại được.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Liên hệ đã Bảo trợ (chưa huỷ): dòng Bảo trợ trong danh sách Hoạt động bấm được và mở popup "Huỷ bảo trợ" (ghi chú lý do không bắt buộc, ngày giờ, Xác nhận / Huỷ).
- [ ] Xác nhận ghi một sự kiện `sponsorship_cancelled { personId, note? }`; nhãn tính lại như chưa từng bảo trợ (KH nếu đã chốt KH, không thì không nhãn); XP của các lần Bảo trợ giữ nguyên; số F1 (Thành tích, mốc Con đường) giảm theo. Hàm thuần, có unit test (bảo trợ → huỷ → bảo trợ lại; huỷ người đã là KH).
- [ ] Sau khi huỷ, Bảo trợ bật lại; bảo trợ lại thì nhãn NPP với ngày của lần bảo trợ mới.
- [ ] Lịch sử hiện dòng "Huỷ bảo trợ" kèm ghi chú; sự kiện huỷ không tính là hoạt động trong ngày, không cộng XP.
- [ ] Sự kiện đồng bộ trong hộ: thêm vào `CONTACT_EVENT_TYPES` và migration nới ràng buộc `type` của `contact_events`.
- [ ] 390 và 320px: popup vừa màn hình, nút ≥ 44px.

## Out of Scope

- Xoá tài khoản của NPP; huỷ từng lần bảo trợ riêng lẻ.

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-035-activity-button-repeatable-tasks.md`
- Unlocks: None
