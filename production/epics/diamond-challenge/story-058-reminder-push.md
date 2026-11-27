# Story 058: Nhắc mục tiêu bằng thông báo đẩy, gộp thẻ Thông báo

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: Integration
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-28

## Context

**GDD**: `design/game-brief.md` (nhắc nhở, story 007), `design/gdd/accounts.md` (cổ vũ)
**Requirement**: Story 007 chỉ nhắc khi app đang mở. Phản hồi 2026-11-28: thẻ "Thông báo khi được cổ vũ" và "Nhắc mỗi ngày" giống nhau, gộp lại. Mockup thẻ gộp đã duyệt cùng story 058.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Cài đặt có một thẻ "Thông báo": trạng thái máy này (hoặc nút "Bật thông báo trên máy này"), công tắc "Khi có người cổ vũ", công tắc "Nhắc mục tiêu mỗi ngày" và giờ nhắc; bỏ đoạn lưu ý dài.
- [x] Cài đặt thông báo lưu theo tài khoản trong `notification_prefs` (chỉ chủ đọc/ghi; `last_reminded_on` chỉ máy chủ ghi). App gửi giờ nhắc, bật/tắt và múi giờ khi thay đổi (và một lần cho cài đặt cũ). Có unit test và test tích hợp.
- [x] Cứ 15 phút pg_cron gọi `send-reminders`: đến giờ (trong 3 giờ sau giờ nhắc), hôm nay chưa nhắc và chưa đạt mục tiêu thì đẩy "🔥 Giữ chuỗi N ngày nhé!" / "💎 Hôm nay bạn chưa đạt mục tiêu"; mỗi ngày tối đa một lần. Có unit test.
- [x] Tắt "Khi có người cổ vũ" thì `notify-cheer` không gửi cho người đó.
- [x] Thông báo nhắc của máy chủ dùng cùng nhãn với nhắc trong app, nên không hiện hai lần.
- [x] 390 và 320px không tràn ngang.

## Files

- `supabase/migrations/20261128010000_notification_prefs.sql`, `supabase/migrations/20261128010100_reminder_cron.sql`
- `supabase/functions/send-reminders/index.ts`, `supabase/functions/_shared/reminder.ts`, `supabase/functions/notify-cheer/index.ts`, `supabase/config.toml`, `.github/workflows/supabase-deploy.yml`
- `src/data/notification-prefs.ts`, `src/ui/screens/push-card.tsx`, `src/ui/screens/settings-screen.tsx`, `src/app.tsx`, `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/push/reminder-due.test.ts` (7), `tests/unit/push/notification-prefs.test.ts` (3), `tests/integration/supabase/notification-prefs.test.ts` (4); all seen failing first
- `production/qa/evidence/story-058-reminder-push/`

## Completion Notes
**Completed**: 2026-11-28
**Criteria**: 6/6 passing (none deferred)
**Deviations**: Advisory: (1) the cron migration turns on pg_cron and pg_net on the live project and schedules a call every 15 minutes; (2) a reminder time after 21:00 can only be sent until midnight; (3) "đạt mục tiêu" on the server is what the app last sent, so someone who met the goal on another device that did not send yet may still get the reminder; (4) a real push on a phone is not tried yet
**Test Evidence**: tests above; screenshots of the merged card at 390 and 320px (fictional data); full suite 744/744
**Reviewed by**: self, no independent review
