# Story 052: Danh sách Làm hiện số ngày, sắp xếp theo hoạt động hoặc tên

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-26

## Context

**GDD**: `design/gdd/crm.md` (danh bạ, story 015, 044)
**Requirement**: Phản hồi 2026-11-26: mỗi dòng hiện số ngày tới hôm nay (chỉ số, kèm icon); bộ sắp xếp theo ngày hoạt động gần nhất hoặc theo tên; không có dòng "Sắp xếp: …"; lựa chọn lưu theo tài khoản.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Mỗi dòng: icon đồng hồ và số ngày lịch tới hôm nay (0 = hôm nay), màu cam từ `contactStaleDays` ngày, "—" khi không có ngày; tên dài cắt bằng "…"; người đọc màn hình nghe "N ngày chưa hoạt động".
- [x] Nút ⇅ cạnh ô tìm kiếm mở bảng chọn từ dưới lên: Hoạt động gần nhất (mặc định), Lâu chưa liên hệ, Tên A → Z (tiếng Việt), Mới thêm; khi lọc NPP thêm Mới bảo trợ, Tổng XP, XP 7 ngày (thay hàng nút của story 044). Có unit test.
- [x] Lựa chọn lưu là `settings_changed { contactSort }`, đồng bộ theo tài khoản (máy chủ nhận khoá này từ migration `20261127000000`); vợ/chồng có lựa chọn riêng. Có unit test.
- [x] "Lần gần nhất" ở trang chi tiết dùng cùng ngày với dòng danh sách.
- [x] 390 và 320px không tràn ngang.

## Files

- `src/ui/screens/people-screen.tsx` (sort button and sheet, day count per row; NPP chips removed)
- `src/ui/screens/person-form.tsx` (`Dialog` `variant="sheet"`; detail uses `lastContactAt`)
- `src/ui/people-helpers.ts` (`CONTACT_SORTS`, `sortContacts`, `readContactSort`)
- `src/data/progress-sync.ts` (`contactSort` in `PROGRESS_SETTINGS_KEYS`)
- `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/people-ui/contact-sort.test.ts` (9 tests, seen failing first)
- `production/qa/evidence/story-052-contact-sort/`

## Completion Notes
**Completed**: 2026-11-26
**Criteria**: 5/5 passing (none deferred)
**Deviations**: Advisory: (1) the day count starts from when the contact was added (the app has always counted adding as the first contact), so "—" only shows for a contact without any date; (2) the default order is now "Hoạt động gần nhất" for every filter, where Khách hàng used to start with the longest-uncontacted and NPP with the newest sponsored
**Test Evidence**: unit tests above; screenshots of the list, the sort sheet, the list by name and the NPP sort sheet at 390 and 320px (fictional data); full suite 696/696
**Reviewed by**: self, no independent review
