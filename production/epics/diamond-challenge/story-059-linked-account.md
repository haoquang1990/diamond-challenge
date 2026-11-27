# Story 059: Liên kết thông tin giữa liên hệ và tài khoản F1

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-28

## Context

**GDD**: `design/gdd/accounts.md` (story 024, 048)
**Requirement**: Phản hồi 2026-11-28: khi bảo trợ, thông tin người dùng (tên hiển thị, số điện thoại) không liên kết với nhau. Đã duyệt: với tuyến trên hiện tên lưu trong danh bạ; không đề xuất tên F1 tự đặt.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Tạo tài khoản điền sẵn "Tên hiển thị" bằng tên trong danh bạ (sửa được), kèm ghi chú; tạo xong, liên hệ lưu luôn số đăng nhập của tài khoản.
- [x] F1 đăng nhập lần đầu: màn đặt tên hiện sẵn tên tuyến trên đã nhập.
- [x] Trang chi tiết NPP có tài khoản: "Tài khoản: <tên> · <số>" thay cho "Đã có tài khoản"; số danh bạ khác số tài khoản thì có cảnh báo và nút "Cập nhật số trong danh bạ". Có unit test.
- [x] Ô NPP F1: mỗi dòng đăng nhập ghi tên và số. Có unit test.
- [x] Tuyến trên gọi F1 theo tên trong danh bạ trước (thẻ Cổ vũ, ô NPP F1, danh sách), rồi tên F1 tự đặt, rồi số. Có unit test (2 test cũ đổi theo quy tắc mới).
- [x] 390 và 320px không tràn ngang.

## Files

- `src/ui/screens/create-account-screen.tsx`, `src/ui/screens/change-password-screen.tsx`, `src/ui/screens/person-form.tsx`, `src/ui/screens/people-screen.tsx`, `src/ui/screens/f1-household-box.tsx`, `src/app.tsx`
- `src/ui/group-helpers.ts` (`groupMemberName`, `householdNames`, `f1LoginName`), `src/ui/people-helpers.ts` (`splitE164`, `accountPhoneDiffers`), `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/people-ui/linked-account.test.ts` (3 tests, seen failing first), `tests/unit/people-ui/group-member-name.test.ts`, `tests/unit/people-ui/cheer-candidates.test.ts`
- `production/qa/evidence/story-059-linked-account/`

## Completion Notes
**Completed**: 2026-11-28
**Criteria**: 6/6 passing (none deferred)
**Deviations**: Advisory: (1) the account line needs the group loaded once (online or cached); offline with nothing cached it still says "Đã có tài khoản"; (2) accounts created before this story keep the phone already in the contact until "Cập nhật số trong danh bạ" is tapped
**Test Evidence**: unit tests above; screenshots of an NPP contact with a different phone, after the fix, and the prefilled create-account screen at 390 and 320px (fictional data); full suite 748/748
**Reviewed by**: self, no independent review
