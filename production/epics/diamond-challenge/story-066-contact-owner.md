# Story 066: Phụ trách liên hệ và lọc Của tôi / Của vợ chồng

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-28

## Context

**GDD**: `design/game-brief.md` (Danh bạ chung, mã số kép; story 052, 064)
**Requirement**: Phản hồi 2026-11-28: lọc để chỉ theo dõi liên hệ của mình cho đỡ loãng; liên hệ tạo hộ thì đổi được người phụ trách. Chốt: gộp vào ô lọc hiện có thành bảng "Lọc danh sách" (Loại + Phụ trách); sau khi lọc, ô lọc có chấm như danh sách (xám nhạt = của tôi, cam = của vợ/chồng). Mockup đã duyệt.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Mỗi liên hệ có người phụ trách: mặc định là người thêm (cả hai nếu hai người cùng có rồi gộp); đổi trong Sửa thông tin bằng "Phụ trách: Tôi / <tên> / Cả hai"; cả hai vợ chồng đổi được; tên, SĐT, mã số sửa sau không làm mất lựa chọn. Có unit test.
- [x] Chấm sau tên theo người phụ trách: cam = vợ/chồng, tím = cả hai, không chấm = của mình (cả liên hệ của người đã rời mã số).
- [x] Ô lọc mở bảng "Lọc danh sách": Loại (Tất cả / Khách hàng / NPP) và Phụ trách (Tất cả / Của tôi / Của <tên>), có số đếm theo lựa chọn còn lại; liên hệ cả hai phụ trách có ở cả hai; nhãn ô lọc có chấm xám nhạt (của tôi) hoặc cam (của vợ/chồng), "KH" viết tắt.
- [x] Lựa chọn Phụ trách nhớ theo tài khoản (đi cùng cài đặt sắp xếp đã đồng bộ), không cần migration. Mã số một người: không có nhóm Phụ trách và dòng Phụ trách.
- [x] 390 và 320px không tràn ngang.

## Files

- `src/domain/people.ts` (`Person.owners`), `src/ui/people-helpers.ts` (`ownerChoice`, `addedByDot`, `filterByOwner`, `readOwnerFilter`, `buildOwnerChange`, `coMemberIds`), `src/ui/screens/people-screen.tsx` (filter sheet), `src/ui/screens/person-form.tsx` (Phụ trách field), `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/people-ui/contact-owner.test.ts` (8 tests), `tests/unit/people-ui/added-by-dot.test.ts` (now with the former-member id the app always passes); seen failing first
- `production/qa/evidence/story-066-contact-owner/`

## Completion Notes
**Completed**: 2026-11-28
**Criteria**: 5/5 passing (none deferred)
**Deviations**: Advisory: (1) fixes a story 064 bug: contacts added by a former member showed the orange dot, because the app's set of other members always holds the former-member id; (2) the Loại choice (KH / NPP) is still not remembered, as before; only Phụ trách is
**Test Evidence**: unit tests above; screenshots of the "Của tôi" list, the filter sheet and the Phụ trách field at 390 and 320px; full suite passing
**Reviewed by**: self, no independent review
