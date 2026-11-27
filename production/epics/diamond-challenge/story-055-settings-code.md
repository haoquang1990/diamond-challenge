# Story 055: Sắp xếp lại Cài đặt, gọi "hộ" là "mã số" (mã số kép)

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-27

## Context

**GDD**: `design/gdd/accounts.md`
**Requirement**: Phản hồi 2026-11-27: sắp xếp lại trang Cài đặt; chữ "NPP" dùng cho "hộ" không hợp ngữ cảnh, dùng "mã số" / "mã số kép". Mockup và danh sách câu chữ đã duyệt.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Cài đặt chia nhóm: Tài khoản (số đăng nhập, tên hiển thị), Mã số của tôi, Ứng dụng (đưa ra màn hình chính, nhắc nhở gộp quyền thông báo, âm thanh), Dữ liệu (đồng bộ, sao lưu), Khác (quản trị, đăng xuất, xoá dữ liệu viền đỏ ở cuối).
- [x] "Mã số của tôi" hiện ngay trong Cài đặt: mã số, người đứng chung ("Bạn" cho mình), ghi chú mã số kép, nút "Thêm người đứng chung (mã số kép)" khi còn chỗ (mở thẳng form thêm).
- [x] Các câu "NPP" mang nghĩa hộ đổi sang "mã số" theo danh sách đã duyệt; "NPP" nghĩa nhà phân phối giữ nguyên. Nội dung đồng ý không đổi phiên bản.
- [x] 390 và 320px không tràn ngang.

## Files

- `src/ui/screens/settings-screen.tsx` (groups, account card split, slots), `src/ui/screens/household-screen.tsx` (`HouseholdCard`, `useHousehold`, `startAdding`), `src/app.tsx`
- `src/ui/strings.ts`, `src/ui/styles.css`
- `production/qa/evidence/story-055-settings-code/`

## Completion Notes
**Completed**: 2026-11-27
**Criteria**: 4/4 passing (none deferred)
**Deviations**: Advisory: (1) the consent text changed wording only, so nobody is asked to agree again; (2) the "Mục tiêu hằng ngày" group comes with story 056
**Test Evidence**: screenshots of the whole Cài đặt page at 390 and 320px (fictional data); full suite passes
**Reviewed by**: self, no independent review
