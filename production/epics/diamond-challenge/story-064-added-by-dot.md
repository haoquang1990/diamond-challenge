# Story 064: Chấm sau tên liên hệ: vợ/chồng thêm, cả hai cùng có

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-28

## Context

**GDD**: `design/game-brief.md` (Danh bạ chung, mã số kép; story 026, 060)
**Requirement**: Phản hồi 2026-11-28: một ký hiệu để biết liên hệ do vợ/chồng thêm, một ký hiệu cho liên hệ chung trước khi gộp mã số. Chốt: chỉ một chấm tròn cuối tên, hai màu, chỉ trên danh sách, không chú thích; dòng NPP giữ icon mục tiêu và chuỗi ngày như hiện tại. Mockup trên giao diện thật đã duyệt.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Danh sách Làm: chấm cam sau tên khi người đứng chung mã số thêm liên hệ; chấm tím khi cả hai cùng có (hai liên hệ của hai người đã gộp làm một); liên hệ của mình không có chấm.
- [x] Tên dài bị cắt "…" vẫn thấy chấm; dòng NPP giữ icon mục tiêu và chuỗi ngày dưới tên.
- [x] Mã số một người, liên hệ của người đã rời mã số: không chấm. Tách cặp đã gộp thì mất chấm tím. Có unit test.
- [x] Không chú thích, không đổi trang chi tiết. Không migration.
- [x] 390 và 320px không tràn ngang.

## Files

- `src/domain/people.ts` (`Person.addedBy`), `src/ui/people-helpers.ts` (`addedByDot`), `src/ui/screens/people-screen.tsx`, `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/people-ui/added-by-dot.test.ts` (6 tests, seen failing first)
- `production/qa/evidence/story-064-added-by-dot/`

## Completion Notes
**Completed**: 2026-11-28
**Criteria**: 5/5 passing (none deferred)
**Deviations**: Advisory: the dot has a screen-reader label ("vợ/chồng thêm", "cả hai cùng có") but no visible text, as asked
**Test Evidence**: unit tests above; screenshots of the Làm list at 390 and 320px; full suite passing
**Reviewed by**: self, no independent review
