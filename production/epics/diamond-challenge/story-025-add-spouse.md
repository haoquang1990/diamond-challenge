# Story 025: Màn "Hộ của tôi" và "Thêm vợ/chồng vào hộ"

> **Epic**: diamond-challenge
> **Status**: In Progress
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-09

## Context

**GDD**: `design/gdd/accounts.md` (luật 6–7, 9, 18)
**Requirement**: Giai đoạn 2a mục 5 — "Thêm vợ/chồng vào hộ"

**ADR Governing Implementation**: N/A (minimal — no ADRs). Edge Function `add-household-member` theo `docs/architecture/adr-0001-household-model.md`.
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) + Supabase Edge Functions | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Cài đặt có mục "Hộ của tôi" khi đã đăng nhập: mã số của hộ (hoặc "Chưa có mã"), danh sách thành viên (tên hiển thị hoặc SĐT), "x/2 thành viên" theo `maxHouseholdMembers`.
- [ ] Nút "Thêm vợ/chồng" hiện khi hộ chưa đủ thành viên; đủ thì ẩn kèm ghi chú "Hộ đã đủ 2 thành viên".
- [ ] Form SĐT (mã nước) + tên hiển thị tuỳ chọn; mật khẩu tạm do app sinh. Gửi `add-household-member`; thành công hiện SĐT và mật khẩu tạm một lần (Sao chép, chia sẻ), giống story 024.
- [ ] Lỗi `household_full_or_inactive`, `phone_taken` (gợi ý nhờ quản trị; gộp hai mã thuộc 2b), `not_allowed`, mạng: thông báo rõ, không ghi gì.
- [ ] Form thêm vợ/chồng nhận `householdId` để story 028 dùng lại cho hộ F1 trực tiếp (người bảo trợ thêm hộ).
- [ ] Offline hoặc chưa đăng nhập: nút khoá kèm lý do. Không tạo sự kiện có `xp`.
- [ ] Mobile-first 390×844 và 320px, nút ≥ 44px, không tràn ngang.

---

## Implementation Notes

- Thành viên mới: đăng nhập → đổi mật khẩu → đồng ý (story 021, 023) → nhận Danh bạ hộ; nếu máy họ có Danh bạ cũ thì dò trùng (story 026).
- Chụp ảnh: Hộ của tôi (1/2), form, mật khẩu tạm, Hộ của tôi (2/2), lỗi SĐT đã có tài khoản, 320px.

---

## Out of Scope

- Rời hộ, gộp hai mã (2b).

---

## Files

- `src/ui/screens/household-screen.tsx`, `src/ui/screens/add-member-form.tsx`
- `src/data/account-service.ts`, `src/ui/screens/settings-screen.tsx`
- `src/ui/strings.ts`, `src/ui/styles.css`
- `production/qa/evidence/story-025-add-spouse/`

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
- Unlocks: story 026, 028
