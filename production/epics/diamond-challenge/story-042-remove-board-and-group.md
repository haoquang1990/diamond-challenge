# Story 042: Bỏ màn Bảng 30x30 và Nhóm của tôi; khung "Hộ F1" trong chi tiết NPP

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-24

## Context

**GDD**: `design/gdd/crm.md`, `design/gdd/accounts.md`
**Requirement**: Phản hồi dùng thử 2026-11-24, kế hoạch 039–043 được duyệt 2026-11-24. Quyết định: bỏ cả hai màn; 30x30 xem ở Thành tích; lọc NPP ở Làm; cổ vũ ở Hôm nay; mỗi người tự thêm vợ/chồng trong Hộ của tôi; số của F1 hiện tổng, không ghi /30, không có "đạt 30x30".

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Con đường không còn nút "Bảng 30x30" và "Nhóm của tôi"; hai màn và lối vào bị xoá; không còn đường nào mở chúng.
- [ ] Cảnh báo liên hệ trùng (nút mở màn Trùng) chuyển lên tab Làm khi có trùng.
- [ ] Trang chi tiết liên hệ NPP có mã số trùng mã của một hộ F1: khung "Hộ F1" hiện "KH x · NPP y", "N ngày chưa hoạt động" nếu có, thời điểm cập nhật; mất mạng thì dùng số đã lưu kèm "cập nhật lúc …"; không khớp hộ nào thì không có khung.
- [ ] Không còn chỗ tuyến trên thêm thành viên cho hộ F1; Hộ của tôi vẫn thêm vợ/chồng như cũ.
- [ ] Thành tích vẫn có "Đủ 250 liên hệ", "Đủ 30 khách hàng", "Đủ 30 NPP F1", "Đạt 30x30" với tiến độ.
- [ ] 390 và 320px không tràn ngang.

## Out of Scope

- Bỏ đồng bộ số tổng hợp lên máy chủ (giữ cho khung Hộ F1).

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-041-cheer-card-today.md`
- Unlocks: None

## Files

- Deleted: `src/ui/screens/board-30x30-screen.tsx`, `src/ui/screens/my-group-screen.tsx`
- `src/app.tsx` (routes `board`, `group` and the board filter/back plumbing removed; `renderPersonExtra`), `src/ui/screens/diamond-path-screen.tsx` (two buttons removed)
- `src/ui/screens/f1-household-box.tsx` (new: "Hộ F1"), `src/ui/screens/person-form.tsx` (`extra` slot), `src/ui/screens/people-screen.tsx` (`renderPersonExtra`)
- `src/ui/group-helpers.ts` (`findF1Household`, `f1TotalsLabel`, `codeContactNames`; `householdNames` joins spouses with " & ")
- Small fixes asked on 2026-11-24 while this story was open: Hôm nay loses the big Học / Làm buttons (`today-screen.tsx`); "Cổ vũ nhóm" names each household by both spouses, using my contact name for the household code when a member has no name (`group-cheer-card.tsx`)
- `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/people-ui/f1-household.test.ts` (3 tests), `tests/unit/people-ui/cheer-candidates.test.ts` (+4 name tests)
- `production/qa/evidence/story-042-remove-board-and-group/`

## Completion Notes
**Completed**: 2026-11-24
**Criteria**: 6/6 passing (none deferred)
**Deviations**: Advisory: (1) the duplicates entry already existed on Làm, so nothing moved; (2) the aggregate upload to the server stays (it feeds the Hộ F1 box); (3) unused board strings remain in `strings.ts`; (4) the Hộ F1 box shows only for an NPP contact whose code matches an F1 household code
**Test Evidence**: unit tests above; screenshots of Hôm nay, the NPP detail with Hộ F1, Con đường and Thành tích at 390 and 320px; full suite 620/620
**Reviewed by**: self, no independent review
