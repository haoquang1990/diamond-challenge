# Story 051: Trang chi tiết liên hệ: tóm tắt, ghi chú tự lưu, popup sửa

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-26

## Context

**GDD**: `design/gdd/crm.md` (danh bạ, story 015 và 034)
**Requirement**: Phản hồi 2026-11-26: thông tin của liên hệ nên hiện ngay, bỏ form sửa luôn mở. Mockup v2 đã duyệt: Tóm tắt (lần gần nhất, số lần từng việc trừ "Thêm tên", liên hệ đầu tiên, ghi chú sửa tại chỗ và tự lưu, ô tự giãn), nút Hoạt động và Lịch sử cạnh nhau, popup Sửa thông tin cho tên, SĐT, mã số.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Đầu trang: tên, nhãn KH/NPP, nút bút "Sửa thông tin"; số điện thoại bấm để gọi; mã số hoặc "Mã số chưa có".
- [x] Tóm tắt: "Lần gần nhất" theo ngày lịch ("Hôm nay" / "N ngày trước"), màu cam kèm ⚠ từ `contactStaleDays` (14) ngày; số lần từng việc, không có "Thêm tên"; ngày liên hệ đầu tiên. Không có tổng XP, không có mốc KH/NPP.
- [x] Ghi chú (FORMHD) sửa ngay trong Tóm tắt, ô tự giãn theo chữ; tự lưu sau `noteAutosaveMs` (1000 ms) không gõ, khi rời ô và khi rời trang; hiện "Đang lưu…" / "✓ Đã lưu" / lỗi. Chỉ ghi ghi chú, không ghi đè tên, SĐT, mã số. Có unit test.
- [x] Nút Hoạt động và Lịch sử cạnh nhau; Lịch sử vẫn mở popup như cũ; Hoàn tác vẫn hiện sau khi ghi việc.
- [x] Popup "Sửa thông tin": Tên, SĐT, Mã số, cảnh báo trùng, Huỷ / Lưu (Lưu chỉ bật khi có thay đổi).
- [x] Ô NPP F1, Tạo tài khoản, Đã gộp giữ nguyên.
- [x] 390 và 320px không tràn ngang.

## Files

- `src/ui/screens/person-form.tsx` (`PersonDetail` layout, note autosave, edit popup; `NoteTextarea` placeholder/blur)
- `src/ui/people-helpers.ts` (`calendarDaysSince`, `summaryCounts`, `createNoteAutosave`)
- `src/ui/people-config.ts` (`CONTACT_STALE_DAYS`, `NOTE_AUTOSAVE_MS`), `src/config/game-config.json` (`contactStaleDays`, `noteAutosaveMs`)
- `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/people-ui/contact-detail.test.ts` (7 tests, seen failing first)
- `production/qa/evidence/story-051-contact-detail/`

## Completion Notes
**Completed**: 2026-11-26
**Criteria**: 7/7 passing (none deferred)
**Deviations**: Advisory: (1) each autosave writes one `person_updated` with only the note, so a long edit can write a few; (2) the orange threshold is a new config value, 14 days, separate from the 3-day F1 threshold; (3) at 320px "Hoạt động" wraps to two lines as before
**Test Evidence**: unit tests above; screenshots of the page, the saved note, the edit popup, the history popup and an NPP contact at 390 and 320px (fictional data); full suite 685/685
**Reviewed by**: self, no independent review
