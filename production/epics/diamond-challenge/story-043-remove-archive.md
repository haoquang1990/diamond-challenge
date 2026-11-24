# Story 043: Bỏ Lưu trữ liên hệ

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-24

## Context

**GDD**: `design/gdd/crm.md`
**Requirement**: Phản hồi dùng thử 2026-11-24, kế hoạch 039–043 được duyệt 2026-11-24. Quyết định: liên hệ luôn ở danh sách kể cả không hoạt động; liên hệ đã lưu trữ hiện lại.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Tab Làm không còn bộ lọc "Đã lưu trữ"; trang chi tiết không còn nút Lưu trữ / Khôi phục.
- [ ] Liên hệ đã lưu trữ trước đây hiện lại trong danh sách như mọi người, ghi được hoạt động, được tính vào số liệu như trước khi lưu trữ. Hàm thuần, có unit test.
- [ ] Sự kiện lưu trữ cũ vẫn đọc được, không lỗi; không tạo sự kiện lưu trữ mới; không migration.
- [ ] 390 và 320px không tràn ngang.

## Dependencies

- Depends on: None
- Unlocks: None

## Files

- `src/domain/people.ts` (`person_archived` / `person_restored` ignored; `archived` always false)
- `src/ui/people-helpers.ts` (`ContactsFilter` without `archived`), `src/ui/screens/people-screen.tsx` (chip and restore rows removed), `src/ui/screens/person-form.tsx` (archive section removed)
- `tests/unit/people/no-archive.test.ts` (3 tests, seen failing first); 7 existing tests updated to the new rule in `people.test.ts`, `people-tasks.test.ts`, `household-board.test.ts`, `contacts-helpers.test.ts` (none skipped)
- `production/qa/evidence/story-043-remove-archive/`

## Completion Notes
**Completed**: 2026-11-24
**Criteria**: 4/4 passing (none deferred)
**Deviations**: Advisory: (1) the `archived` field and the archive event types stay in the code and the database so old logs read without error; (2) contacts that were archived now count again in Thành tích and the Hộ F1 totals sent to the sponsor; (3) unused archive strings remain in `strings.ts`
**Test Evidence**: unit tests above; screenshots of Làm with a previously archived contact and its detail page at 390 and 320px; full suite 622/622
**Reviewed by**: self, no independent review
