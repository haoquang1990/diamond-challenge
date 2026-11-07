# Story 024: "Tạo tài khoản" cho liên hệ NPP có mã số

> **Epic**: diamond-challenge
> **Status**: Ready
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-07

## Context

**GDD**: `design/gdd/accounts.md` (luật 8, 18) và `design/gdd/crm.md` (luật 1, `linkedUserId`)
**Requirement**: Giai đoạn 2a mục 4 — tạo hộ F1 + thành viên đầu từ liên hệ NPP có mã, hiện mật khẩu tạm để gửi Zalo

**ADR Governing Implementation**: N/A (minimal — no ADRs). Edge Function `create-f1-account` theo `docs/architecture/adr-0001-household-model.md`.
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) + Supabase Edge Functions | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Trang chi tiết liên hệ có nhãn NPP, chưa có `linkedUserId`, khi đã đăng nhập: có nút "Tạo tài khoản". Liên hệ chưa có mã: nút khoá kèm gợi ý "Nhập mã số Amway trước". Chưa đăng nhập hoặc offline: nút khoá kèm lý do.
- [ ] Form: SĐT (mã nước, điền sẵn từ SĐT của liên hệ nếu có) và tên hiển thị (tuỳ chọn). Mật khẩu tạm do app sinh (≥ 10 ký tự, không ký tự dễ nhầm).
- [ ] Gửi `create-f1-account {phone, password, amwayCode, displayName}` với mã của liên hệ. Lỗi `phone_taken`, `code_taken`, `change_password_first`, `invalid_code`, mạng: thông báo tiếng Việt rõ, không ghi sự kiện.
- [ ] Thành công: hiện SĐT và mật khẩu tạm **một lần** với nút "Sao chép" và nút chia sẻ của hệ thống (Web Share, để gửi Zalo); nhắc người nhận phải đổi mật khẩu khi đăng nhập. Mật khẩu tạm không lưu vào nhật ký, localStorage hay log.
- [ ] Thành công ghi `person_updated {personId, linkedUserId}`; liên hệ hiện "Đã có tài khoản" và nút "Tạo tài khoản" biến mất.
- [ ] Liên hệ đã có tài khoản bị gỡ nhãn NPP (hoàn tác) hoặc lưu trữ: tài khoản vẫn giữ; trang chi tiết cảnh báo người này đã có tài khoản.
- [ ] Không tạo sự kiện có `xp`.
- [ ] Mobile-first 390×844 và 320px, nút ≥ 44px, không tràn ngang.

---

## Implementation Notes

- Kiểm thử thật lần đầu trên server: dùng một SĐT thử, rồi xem hộ, mã và thành viên trên Dashboard; đây cũng là bằng chứng còn thiếu của story 020 (AC-7).
- Chụp ảnh: nút khoá (chưa có mã), form, lỗi trùng mã, màn mật khẩu tạm, liên hệ "Đã có tài khoản", 320px.

---

## Out of Scope

- Tạo hộ gốc (admin), thêm vợ/chồng (story 025).

---

## Files

- `src/data/account-service.ts`
- `src/ui/screens/create-account-screen.tsx`, `src/ui/screens/people-screen.tsx`
- `src/data/event-store.ts`, `src/domain/people.ts` (`linkedUserId`)
- `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/accounts/temp-password.test.ts`
- `production/qa/evidence/story-024-create-f1-account/`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp từng trạng thái, giữ lại trong `production/qa/evidence/`; một lần tạo thật trên server

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-021-login-change-password.md`, `production/epics/diamond-challenge/story-022-amway-code-on-contacts.md`
- Unlocks: story 028
