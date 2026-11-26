# Story 054: Một cách ghi số điện thoại (+84, không có số 0) và quy tắc số di động Việt Nam

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: Integration
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-26

## Context

**GDD**: `design/gdd/crm.md`, `design/gdd/accounts.md`
**Requirement**: Phản hồi 2026-11-26: kiểm tra số có đúng quy tắc không; thống nhất một cách ghi. Người dùng chọn "+84 và không có số 0", giống số nước ngoài; số sai quy tắc thì báo lỗi; hiện lại tài khoản đăng nhập trước khi tạo.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Mọi chỗ hiện số (danh bạ, chi tiết, trùng liên hệ, tài khoản F1, NPP, admin, cài đặt, lời chia sẻ tài khoản) ghi "+84 912 345 678"; số cũ lưu có 0 cũng hiện như vậy; số nước ngoài "+1 4155550100". Có unit test.
- [x] Ô số (danh bạ, sửa, đăng nhập, tạo tài khoản, thêm vợ/chồng): gõ có hay không có 0 đều được; rời ô thì bỏ 0 và nhóm 3-3-3. Có unit test.
- [x] Số +84 phải là số di động: 9 số sau +84, bắt đầu bằng 3, 5, 7, 8, 9; sai thì báo lỗi và không lưu. Nước khác giữ quy tắc 6–15 chữ số. Có unit test.
- [x] Máy chủ (create-f1-account, add-household-member) cũng từ chối tài khoản +84 mới không phải số di động; đăng nhập không đổi, tài khoản cũ vẫn vào được. Có unit test.
- [x] Tạo tài khoản hiện "Tài khoản đăng nhập: +84 …" trước khi bấm tạo.
- [x] Số cũ có 0 và số mới không có 0 vẫn được coi là một số (trùng liên hệ, popup sửa không báo thay đổi giả).
- [x] 390 và 320px không tràn ngang.

## Files

- `src/domain/people.ts` (`validatePhone` +84 rule, `formatPhoneParts`, `formatE164`, `tidyNationalNumber`, `isVnMobileE164`)
- `supabase/functions/_shared/phone.ts` (`isAllowedNewAccountPhone`), `supabase/functions/create-f1-account/index.ts`, `supabase/functions/add-household-member/index.ts`
- `src/ui/people-helpers.ts` (`formatPhone`, `phoneProblemText`), `src/ui/strings.ts`, `src/ui/group-helpers.ts`
- `src/ui/screens/person-form.tsx`, `login-screen.tsx`, `create-account-screen.tsx`, `add-member-form.tsx`, `admin-screen.tsx`, `f1-household-box.tsx`, `group-cheer-card.tsx`, `household-screen.tsx`, `settings-screen.tsx`, `temp-password-view.tsx`
- `tests/unit/people/phone-format.test.ts` (8 tests, seen failing first); 4 older tests updated to the new rule
- `production/qa/evidence/story-054-phone-format/`

## Completion Notes
**Completed**: 2026-11-26
**Criteria**: 7/7 passing (none deferred)
**Deviations**: Advisory: (1) a saved contact whose +84 number breaks the mobile rule (e.g. a landline) must be fixed or cleared the next time it is edited; (2) the admin phone search still accepts such numbers so older accounts can be found; (3) the Edge Functions are redeployed at merge
**Test Evidence**: tests above; screenshots of login, the edit popup error, the contact header, the create-account preview and the F1 login lines at 390 and 320px (fictional numbers); full suite 708/708
**Reviewed by**: self, no independent review
