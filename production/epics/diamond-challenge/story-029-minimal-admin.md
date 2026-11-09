# Story 029: Màn Quản trị tối thiểu (đặt lại mật khẩu, đặt mã số cho hộ)

> **Epic**: diamond-challenge
> **Status**: In Progress
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-09

## Context

**GDD**: `design/gdd/accounts.md` (luật 2, 15, 18)
**Requirement**: Giai đoạn 2a mục 9 — đặt lại mật khẩu, đặt mã số cho hộ

**ADR Governing Implementation**: N/A (minimal — no ADRs). RPC `set_household_code` và Edge Function `reset-password` theo `docs/architecture/adr-0001-household-model.md`.
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) + Supabase | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Mục "Quản trị" trong Cài đặt chỉ hiện với tài khoản `role = admin`; người khác không thấy, và server từ chối nếu họ gọi thẳng.
- [ ] Tìm hộ theo SĐT thành viên (mã nước + số) hoặc theo mã số: hiện thành viên, mã đang hoạt động và các mã "Đã huỷ" kèm ngày.
- [ ] **Đặt lại mật khẩu:** chọn thành viên, app sinh mật khẩu tạm, gọi `reset-password`; thành công hiện mật khẩu tạm một lần (Sao chép, chia sẻ); người đó phải đổi khi đăng nhập lại. Lỗi `not_found`, `admin_only`, mạng: thông báo rõ.
- [ ] **Đặt mã số cho hộ:** nhập mã (chuẩn hoá như story 022), gọi `set_household_code`; mã cũ chuyển "Đã huỷ" (lý do "replaced"); mã trùng với hộ khác đang hoạt động: thông báo rõ, không đổi gì.
- [ ] Màn không hiện Danh bạ của hộ nào. Mật khẩu tạm không lưu vào nhật ký hay localStorage.
- [ ] Offline: các nút khoá kèm lý do. Mobile-first 390×844 và 320px, nút ≥ 44px.

---

## Implementation Notes

- Cần đăng nhập bằng admin `+84948161365` để chụp ảnh; dùng một hộ thử, không đổi mã thật `7004053634`.
- Chụp ảnh: Cài đặt có mục Quản trị, tìm hộ, đặt lại mật khẩu, đặt mã, lỗi trùng mã, 320px.

---

## Out of Scope

- Tạo hộ gốc từ giao diện, sửa hộ bảo trợ, Chờ gán tuyến trên, gộp hai mã (2b hoặc story sau).

---

## Files

- `src/ui/screens/admin-screen.tsx`, `src/ui/screens/settings-screen.tsx`
- `src/data/admin-service.ts`
- `src/ui/strings.ts`, `src/ui/styles.css`
- `production/qa/evidence/story-029-minimal-admin/`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp từng trạng thái, giữ lại trong `production/qa/evidence/`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-021-login-change-password.md`
- Unlocks: None
