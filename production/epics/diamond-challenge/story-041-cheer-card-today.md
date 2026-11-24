# Story 041: Thẻ "Cổ vũ nhóm" trên Hôm nay

> **Epic**: diamond-challenge
> **Status**: Ready
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-24

## Context

**GDD**: `design/gdd/accounts.md` (cổ vũ, story 028)
**Requirement**: Phản hồi dùng thử 2026-11-24, kế hoạch 039–043 được duyệt 2026-11-24. Quyết định: cổ vũ đặt trên Hôm nay.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Hôm nay có thẻ "Cổ vũ nhóm" liệt kê các hộ F1 chưa được cổ vũ hôm nay, hộ lâu không hoạt động trước, kèm "N ngày chưa hoạt động" hoặc "chưa hoạt động"; mỗi hộ một nút "Cổ vũ" (≥ 44px).
- [ ] Bấm "Cổ vũ" gửi như màn Nhóm cũ (`sendCheer`), hộ đó rời khỏi thẻ; lỗi hiện thông báo. Cổ vũ hết hoặc không có F1 thì thẻ ẩn.
- [ ] Không có mạng: nút tắt và có lý do; dùng dữ liệu nhóm đã lưu nếu có.
- [ ] Người không có tài khoản thì không có thẻ.
- [ ] 390 và 320px không tràn ngang.

## Out of Scope

- Đổi lời cổ vũ hay cách nhận cổ vũ.

## Dependencies

- Depends on: None
- Unlocks: `production/epics/diamond-challenge/story-042-remove-board-and-group.md`
