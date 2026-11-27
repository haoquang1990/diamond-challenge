# Story 060: Dòng NPP hiện mục tiêu hôm nay và chuỗi ngày; ô NPP F1 gọn hơn

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-28

## Context

**GDD**: `design/gdd/crm.md` (story 044, 050, 052)
**Requirement**: Phản hồi 2026-11-28: dòng NPP hiện luôn đạt mục tiêu hay chưa và chuỗi ngày, gọn, đặt dưới tên (không che tên); trang lọc NPP và trang tất cả giống nhau. Trang chi tiết: số liên hệ, KH, NPP; ô mục tiêu chỉ ghi "Hôm nay".

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Dòng NPP có số liệu F1: dưới tên một dòng chỉ có biểu tượng "◯/✓ 🔥N" (đạt khi số liệu gửi hôm nay báo đạt; mã số kép: một người đạt là đạt; chuỗi dài hơn), giống nhau ở Tất cả và NPP; bỏ "Lên NPP: …" và dòng XP. Có unit test.
- [x] Ô NPP F1: ba ô Liên hệ · KH · NPP (số liên hệ đọc từ máy chủ), hai ô "Hôm nay" (✓/◯) và "🔥 N ngày", khung xanh gom 7 ngày, việc làm, học, XP 7 ngày · tổng XP · mục tiêu, lần mở app.
- [x] 390 và 320px không tràn ngang.

## Files

- `src/ui/screens/people-screen.tsx`, `src/ui/screens/f1-household-box.tsx`, `src/app.tsx`
- `src/ui/group-helpers.ts` (`householdProgress` / `progressByCode` with today's goal), `src/data/group-service.ts` (`contacts`), `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/people-ui/npp-progress.test.ts` (1 new test, seen failing first)
- `production/qa/evidence/story-060-f1-row/`

## Completion Notes
**Completed**: 2026-11-28
**Criteria**: 3/3 passing (none deferred)
**Deviations**: Advisory: (1) the "NPP" label stays on the row; the goal and streak line sits under the name instead; (2) an NPP whose app has not sent numbers yet shows no goal line; (3) "Lên NPP" dates remain in the person's history
**Test Evidence**: unit test above; screenshots of Tất cả, the NPP filter and the NPP F1 box at 390 and 320px (fictional data); full suite 749/749
**Reviewed by**: self, no independent review
