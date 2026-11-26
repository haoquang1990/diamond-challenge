# Story 049: Cổ vũ hiện người gửi, cổ vũ vợ/chồng, chọn hoặc tự viết lời

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: Integration
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-26

## Context

**GDD**: `design/gdd/accounts.md` (cổ vũ, story 028)
**Requirement**: Phản hồi 2026-11-26: người được cổ vũ thấy gì; có cổ vũ người cùng mã số không. Người dùng chọn làm cả 3 việc: hiện tên người gửi, cổ vũ vợ/chồng, chọn lời trước khi gửi.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Máy chủ lưu tên người gửi (lấy từ hồ sơ người gửi, không giả mạo được); thẻ nhận được ở Hôm nay ghi "Lời cổ vũ từ <tên>", lời cũ không có tên vẫn ghi như trước.
- [ ] Cổ vũ vợ/chồng: thẻ "Cổ vũ nhóm" có hàng cho thành viên còn lại của NPP mình (một lần mỗi ngày); chỉ người nhận thấy lời đó; không cổ vũ được chính mình hay người ngoài NPP. Migration và test tích hợp trên Postgres.
- [ ] Bấm "Cổ vũ" mở popup chọn một lời có sẵn hoặc tự viết (1–200 ký tự), Gửi / Huỷ. Có unit test.
- [ ] Cổ vũ F1 như cũ (tuyến trên trực tiếp, một lần mỗi ngày).
- [ ] App vẫn chạy với máy chủ chưa có migration (đọc lời theo cách cũ).
- [ ] 390 và 320px không tràn ngang.

## Files

- `supabase/migrations/20261126000000_cheers_spouse_sender.sql` (`to_user_id`, `sender_name`, `is_spouse_in_household`, trigger and insert policy)
- `src/data/group-service.ts` (`spouses`, `sendCheer` with chosen text and receiver, `cleanCheerMessage`, `cheersForMe`, sender name)
- `src/ui/screens/group-cheer-card.tsx` (spouse rows, message picker), `src/ui/screens/today-screen.tsx` (sender in the title), `src/app.tsx`
- `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/integration/supabase/cheers-spouse.test.ts` (4 tests, seen failing without the migration), `tests/unit/people-ui/cheer-send.test.ts` (5 tests)
- `production/qa/evidence/story-049-cheers/`

## Completion Notes
**Completed**: 2026-11-26
**Criteria**: 6/6 passing (none deferred)
**Deviations**: Advisory: (1) the migration runs on the live Supabase database when merged; (2) the sender name is the sender's display name at the time of sending, else their phone; (3) an F1 never sees the sponsor's spouse name unless that spouse sent the cheer
**Test Evidence**: tests above; screenshots of the received card, the spouse row, the picker and the typed text at 390 and 320px; full suite 668/668
**Reviewed by**: self, no independent review
