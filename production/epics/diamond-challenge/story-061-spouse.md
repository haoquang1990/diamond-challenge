# Story 061: Theo dõi tình hình vợ/chồng cùng mã số

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-28

## Context

**GDD**: `design/gdd/accounts.md` (mã số kép, story 049, 050)
**Requirement**: Phản hồi 2026-11-28: chưa có chỗ theo dõi tình trạng của vợ/chồng. Mockup đã duyệt.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Hôm nay có thẻ "Vợ/chồng" (chỉ khi mã số có 2 người): tên, ✓/◯ mục tiêu hôm nay, 🔥 chuỗi, "7 ngày … XP · mở app …", nút "Cổ vũ" (mờ "Đã cổ vũ" khi đã cổ vũ hôm nay); chưa có số liệu thì ghi rõ. Có unit test.
- [x] Thẻ "Cổ vũ nhóm" không còn dòng vợ/chồng; chỉ có F1 thì mới hiện. Có unit test.
- [x] Cài đặt → Mã số của tôi: bấm tên vợ/chồng mở số liệu (Hôm nay, 🔥 N ngày, 7 ngày, việc làm, bài học, huy hiệu, mục tiêu, lần mở app).
- [x] Chỉ dùng số tổng đã chia sẻ (`member_progress`, người cùng mã số được đọc); không migration.
- [x] 390 và 320px không tràn ngang.

## Files

- `src/data/group-service.ts` (spouse progress, `loadMemberProgress`, shared fallback loading)
- `src/ui/group-helpers.ts` (`cheerCardView` without spouses, `spouseCard`), `src/ui/screens/group-cheer-card.tsx`, `src/ui/screens/household-screen.tsx`, `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/people-ui/cheer-card-view.test.ts` (1 new, 2 changed, seen failing first)
- `production/qa/evidence/story-061-spouse/`

## Completion Notes
**Completed**: 2026-11-28
**Criteria**: 5/5 passing (none deferred)
**Deviations**: Advisory: (1) the numbers are what the spouse's app last sent; (2) no "XP hôm nay" (the server keeps 7-day and total XP only)
**Test Evidence**: unit tests above; screenshots of Hôm nay and Mã số của tôi at 390 and 320px (fictional data); full suite 750/750
**Reviewed by**: self, no independent review
