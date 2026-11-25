# Story 048: Tuyến trên cấp lại mật khẩu tạm cho F1 chưa kích hoạt; link app khi chia sẻ tài khoản

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: Integration
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-25

## Context

**GDD**: `design/gdd/accounts.md` (tạo tài khoản F1, đặt lại mật khẩu)
**Requirement**: Phản hồi 2026-11-25: F1 "chưa hoạt động" nhưng tuyến trên không còn cách nào lấy lại tài khoản và mật khẩu; khi sao chép tài khoản, mật khẩu thì kèm link app. Phương án được duyệt 2026-11-25.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Khung "NPP F1" trên trang chi tiết NPP hiện tài khoản (số điện thoại) của từng thành viên, mỗi người một nút "Cấp lại mật khẩu tạm" (tắt khi không có mạng).
- [ ] Edge Function `reset-password` cho phép tuyến trên trực tiếp đặt mật khẩu tạm cho thành viên NPP F1, chỉ theo `userId` và chỉ khi tài khoản chưa đổi mật khẩu lần đầu (`must_change_password`); tài khoản đã kích hoạt trả `already_active`, người không phải tuyến trên trực tiếp trả `not_allowed`; quản trị như cũ.
- [ ] Cấp lại thành công mở popup một lần: link app, số điện thoại, mật khẩu tạm, Sao chép / Chia sẻ, Xong; lỗi hiện câu tiếng Việt tương ứng. Hàm gọi có unit test.
- [ ] Mọi chỗ sao chép/chia sẻ tài khoản (tạo tài khoản, thêm vợ/chồng, quản trị đặt lại, cấp lại) có dòng "Ứng dụng: <link app>". Có unit test.
- [ ] 390 và 320px không tràn ngang.

## Files

- `supabase/functions/reset-password/index.ts` (sponsor path, `already_active`, `not_allowed`)
- `src/data/account-service.ts` (`resendF1Password`)
- `src/ui/screens/f1-household-box.tsx` (logins, resend button, once-only popup), `src/ui/screens/temp-password-view.tsx` (app link line)
- `src/ui/strings.ts` (`appLink`, `createAccountShareText` with link, resend strings), `src/ui/styles.css`
- `tests/unit/accounts/resend-password.test.ts` (9 tests)
- `production/qa/evidence/story-048-resend-f1-password/`

## Completion Notes
**Completed**: 2026-11-25
**Criteria**: 5/5 passing (none deferred)
**Deviations**: Advisory: (1) the Edge Function change was not run locally (no Deno here); it deploys with the Supabase workflow on merge and its checks mirror `create-f1-account`; (2) the button shows for every member with a phone, the server decides whether the account is still unactivated; (3) the admin screen's reset keeps its own flow, only its share text gains the link
**Test Evidence**: unit tests above; screenshots of the logins, the popup and the already-active error at 390 and 320px; full suite 658/658
**Reviewed by**: self, no independent review
