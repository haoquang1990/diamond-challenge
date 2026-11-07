# Story 021: Đăng nhập, đổi mật khẩu lần đầu, tên hiển thị

> **Epic**: diamond-challenge
> **Status**: Ready
> **Layer**: Foundation
> **Type**: UI
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-07

## Context

**GDD**: `design/gdd/accounts.md` (luật 1–4)
**Requirement**: Giai đoạn 2a mục 1 — đăng nhập SĐT có mã nước + mật khẩu, đổi mật khẩu lần đầu; app vẫn dùng offline khi chưa đăng nhập

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs). Tham khảo `docs/architecture/adr-0001-household-model.md` (tài khoản thuộc hộ) và `adr-0002-household-contacts-on-server.md` (liên kết `userId` máy với tài khoản).
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) + Supabase Auth | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] App mở được và dùng đầy đủ như giai đoạn 1 khi chưa đăng nhập (offline, không chặn màn nào). Đăng nhập là tuỳ chọn, mở từ Cài đặt.
- [ ] Màn Đăng nhập: chọn mã nước (`countryCodes`, mặc định +84) + số điện thoại + mật khẩu. SĐT chuẩn hoá giống `supabase/functions/_shared/phone.ts`, đăng nhập bằng email nội bộ `<E.164 bỏ +>@phone.diamond-challenge.app` qua `src/config/supabase.ts` (khoá publishable, không có khoá bí mật).
- [ ] Sai SĐT hoặc mật khẩu, mất mạng, server lỗi: thông báo tiếng Việt rõ (qua `strings.ts`), không nói SĐT có tồn tại hay không. Nút đăng nhập tắt khi đang gửi.
- [ ] Tài khoản có `must_change_password = true`: sau đăng nhập phải qua màn Đổi mật khẩu (≥ 8 ký tự, nhập lại khớp, khác mật khẩu tạm) trước khi dùng bất kỳ chức năng server nào. Đổi xong gọi `mark_password_changed()`.
- [ ] Sau lần đổi mật khẩu đầu, hỏi tên hiển thị (1–60 ký tự, bỏ qua được) và lưu bằng `set_display_name`. Tên sửa lại được trong Cài đặt.
- [ ] Phiên đăng nhập giữ sau khi tải lại trang. Có nút Đăng xuất; đăng xuất không xoá nhật ký trên máy.
- [ ] Sau lần đăng nhập đầu trên máy, app ghi một sự kiện cá nhân `settings_changed {accountLinked: {localUserId, accountId}}` (không có `xp`, không đẩy lên server). Đăng nhập lại cùng tài khoản không ghi trùng.
- [ ] Cài đặt hiện trạng thái: "Chưa đăng nhập" hoặc tên/SĐT đang đăng nhập.
- [ ] Mobile-first 390×844 và 320px, nút ≥ 44px, không tràn ngang; bàn phím số cho ô SĐT.

---

## Implementation Notes

- Client Supabase chỉ tạo khi có cấu hình (`getSupabaseClient`); thiếu cấu hình thì ẩn mục Đăng nhập.
- Lọc XP/streak theo tài khoản thuộc story 023; story này chỉ ghi sự kiện liên kết.
- Chụp ảnh: Cài đặt chưa đăng nhập, màn Đăng nhập (lỗi), màn Đổi mật khẩu, màn tên hiển thị, Cài đặt đã đăng nhập, 320px.

---

## Out of Scope

- Quên mật khẩu (admin đặt lại ở story 029).
- Đồng bộ Danh bạ, đồng ý lưu trên server (story 023).

---

## Files

- `src/data/auth-service.ts`
- `src/ui/screens/login-screen.tsx`, `src/ui/screens/change-password-screen.tsx`
- `src/ui/screens/settings-screen.tsx`, `src/app.tsx`, `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/auth/auth-service.test.ts`
- `production/qa/evidence/story-021-login-change-password/`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp từng màn, giữ lại trong `production/qa/evidence/`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-020-households-backend.md`
- Unlocks: story 023, 024, 025, 027, 028, 029
