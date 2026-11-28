# Story 065: Sửa ghi chú việc làm trong Lịch sử, Tóm tắt gọn

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-28

## Context

**GDD**: `design/game-brief.md` (Danh bạ chung; story 034, 051)
**Requirement**: Phản hồi 2026-11-28: cho sửa ghi chú của việc làm. Lịch sử: bỏ "Tổng XP từ người này", bỏ "Thêm tên vào danh sách: 1" trong đếm; "Thêm vào danh sách" và "Hoạt động gần nhất" cùng dòng với ngày. Mockup đã duyệt.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Lịch sử: việc có ghi chú có nút ✏️, việc chưa có ghi chú có "+ Thêm ghi chú" (không áp dụng cho "Thêm tên vào danh sách", chuyển giai đoạn, Huỷ bảo trợ).
- [x] Bảng "Sửa ghi chú": tên việc và giờ, ô ghi chú cũ, Huỷ / Lưu; xoá hết rồi Lưu là bỏ ghi chú; ghi chú đã sửa có chữ "đã sửa". Cả hai vợ chồng sửa được; chỉ đổi ghi chú, không đổi loại việc, giờ, XP, chuỗi ngày hay ngày liên hệ gần nhất. Có unit test.
- [x] Sự kiện mới `activity_note_changed { personId, activityId, note }` đồng bộ qua Danh bạ chung; migration mở rộng type check của `contact_events`. Có integration test.
- [x] Tóm tắt Lịch sử: bỏ Tổng XP và "Thêm tên vào danh sách: 1"; "Thêm vào danh sách", "Hoạt động gần nhất", "Kể từ lần gần nhất" mỗi mục một dòng, ngày bên phải.
- [x] 390 và 320px không tràn ngang; đóng bảng sửa vẫn giữ trang sau Lịch sử không cuộn.

## Files

- `src/data/event-store.ts`, `src/data/contact-sync.ts` (new type), `src/ui/people-helpers.ts` (`buildNoteChangeEvent`, `personAddedAt`, note changes in `buildPersonHistory`), `src/ui/screens/person-form.tsx` (`NoteEditDialog`, `PencilIcon`, stacked dialogs), `src/ui/strings.ts`, `src/ui/styles.css`
- `supabase/migrations/20261129000000_activity_note_changed.sql`
- `tests/unit/people-ui/note-edit.test.ts` (6 tests), `tests/integration/supabase/activity-note-changed.test.ts` (2 tests); both seen failing first
- `production/qa/evidence/story-065-note-edit/`

## Completion Notes
**Completed**: 2026-11-28
**Criteria**: 5/5 passing (none deferred)
**Deviations**: Advisory: (1) summary dates show the day only (times stay on each row) and "Kể từ lần gần nhất" reads "14 ngày", so each fact fits one line at 320px; (2) a note added later to an activity that had none also shows "đã sửa"
**Test Evidence**: unit and integration tests above; screenshots of Lịch sử, the edit sheet and the result at 390 and 320px; full suite passing
**Reviewed by**: self, no independent review
