# Story 043: Bỏ Lưu trữ liên hệ

> **Epic**: diamond-challenge
> **Status**: Ready
> **Layer**: Feature
> **Type**: UI
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-24

## Context

**GDD**: `design/gdd/crm.md`
**Requirement**: Phản hồi dùng thử 2026-11-24, kế hoạch 039–043 được duyệt 2026-11-24. Quyết định: liên hệ luôn ở danh sách kể cả không hoạt động; liên hệ đã lưu trữ hiện lại.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Tab Làm không còn bộ lọc "Đã lưu trữ"; trang chi tiết không còn nút Lưu trữ / Khôi phục.
- [ ] Liên hệ đã lưu trữ trước đây hiện lại trong danh sách như mọi người, ghi được hoạt động, được tính vào số liệu như trước khi lưu trữ. Hàm thuần, có unit test.
- [ ] Sự kiện lưu trữ cũ vẫn đọc được, không lỗi; không tạo sự kiện lưu trữ mới; không migration.
- [ ] 390 và 320px không tràn ngang.

## Dependencies

- Depends on: None
- Unlocks: None
