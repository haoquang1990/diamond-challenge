# Story 041: Thẻ "Cổ vũ nhóm" trên Hôm nay

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-24

## Context

**GDD**: `design/gdd/accounts.md` (cổ vũ, story 028)
**Requirement**: Phản hồi dùng thử 2026-11-24, kế hoạch 039–043 được duyệt 2026-11-24. Quyết định: cổ vũ đặt trên Hôm nay.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Hôm nay có thẻ "Cổ vũ nhóm" liệt kê các hộ F1 chưa được cổ vũ hôm nay, hộ lâu không hoạt động trước, kèm "N ngày chưa hoạt động" hoặc "chưa hoạt động"; mỗi hộ một nút "Cổ vũ" (≥ 44px).
- [ ] Bấm "Cổ vũ" gửi như màn Nhóm cũ (`sendCheer`), hộ đó rời khỏi thẻ; lỗi hiện thông báo. Cổ vũ hết hoặc không có F1 thì thẻ ẩn.
- [ ] Không có mạng: nút tắt và có lý do; dùng dữ liệu nhóm đã lưu nếu có.
- [ ] Người không có tài khoản thì không có thẻ.
- [ ] 390 và 320px không tràn ngang.

## Out of Scope

- Đổi lời cổ vũ hay cách nhận cổ vũ.

## Dependencies

- Depends on: None
- Unlocks: `production/epics/diamond-challenge/story-042-remove-board-and-group.md`

## Files

- `src/ui/screens/group-cheer-card.tsx` (new: `GroupCheerCard`)
- `src/ui/group-helpers.ts` (new: `cheerCandidates`, `householdActivityNote`, `householdNames`; name helpers moved from `my-group-screen.tsx`)
- `src/ui/screens/today-screen.tsx` (`cheerGroup` slot), `src/app.tsx`, `src/ui/screens/my-group-screen.tsx` (imports the moved helpers)
- `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/people-ui/cheer-candidates.test.ts` (3 tests), `tests/unit/people-ui/group-member-name.test.ts` (import path)
- `production/qa/evidence/story-041-cheer-card-today/`

## Completion Notes
**Completed**: 2026-11-24
**Criteria**: 5/5 passing (none deferred)
**Deviations**: Advisory: after the last cheer the card stays with "Đã gửi lời cổ vũ." until Hôm nay is opened again, then hides; the offline state was checked in code, not captured
**Test Evidence**: `tests/unit/people-ui/cheer-candidates.test.ts`; screenshots at 390 and 320px; full suite 613/613
**Reviewed by**: self, no independent review
