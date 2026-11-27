# Story 057: Thông báo đẩy khi được cổ vũ

> **Epic**: diamond-challenge
> **Status**: In Progress
> **Layer**: Feature
> **Type**: Integration
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-27

## Context

**GDD**: `design/gdd/accounts.md` (cổ vũ, story 028, 049)
**Requirement**: Phản hồi 2026-11-27: thông báo hình như chưa chạy; khi nhận được lời cổ vũ thì người dùng cũng nhận thông báo. Kiểm tra cho thấy nhắc nhở chỉ chạy khi app đang mở; cần thông báo đẩy từ máy chủ. Phương án đã duyệt: story 057 cổ vũ trước, story 058 nhắc đúng giờ.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Cài đặt → Ứng dụng có thẻ "Thông báo khi được cổ vũ": nút "Bật thông báo trên máy này" (hỏi quyền từ cú chạm), hoặc lý do không bật được: iPhone cần app ở màn hình chính, đang bị chặn, trình duyệt không hỗ trợ, chưa cài khoá.
- [x] Máy đã bật được lưu trong `push_subscriptions` (chỉ chủ tài khoản đọc/xoá; ghi qua `register_push_subscription`, một trình duyệt một dòng, chuyển sang tài khoản đăng nhập sau). Có test tích hợp.
- [x] Gửi lời cổ vũ xong, app gọi `notify-cheer`: máy chủ tìm lời cổ vũ vừa gửi (10 phút, chưa đẩy), đánh dấu `notified_at`, đẩy "💎 <người gửi> cổ vũ bạn" + lời tới người nhận (cổ vũ vợ/chồng: đúng người đó; cổ vũ tuyến trên: mọi người cùng mã số; không bao giờ gửi người gửi); xoá đăng ký đã hết hạn. Có unit test phần thuần.
- [x] Service worker hiện thông báo đẩy; chạm vào mở Hôm nay.
- [x] Khoá VAPID do máy chủ tự lo: bước deploy "Ensure push keys" tạo cặp khoá một lần, cất thẳng vào secrets của Supabase (không in ra, không vào repo), giữ nguyên nếu đã có; app lấy khoá công khai qua hàm `push-public-key`. Chưa có khoá thì thẻ ghi máy chủ chưa sẵn sàng và `notify-cheer` trả `not_configured`.
- [ ] Thử thật trên điện thoại: bật thông báo, nhận cổ vũ khi app đóng.
- [x] 390 và 320px không tràn ngang.

## Files

- `supabase/migrations/20261128000000_push_subscriptions.sql`, `supabase/functions/notify-cheer/index.ts`, `supabase/functions/push-public-key/index.ts`, `supabase/functions/_shared/push.ts`, `supabase/config.toml`, `.github/workflows/supabase-deploy.yml`
- `src/notifications/push.ts`, `src/ui/screens/push-card.tsx`, `src/ui/screens/settings-screen.tsx`, `src/app.tsx`, `src/ui/screens/group-cheer-card.tsx`, `src/data/group-service.ts` (`notifyCheer`), `public/sw.js`
- `src/config/game-config.json` (`push.vapidPublicKey`), `src/ui/strings.ts`
- `tests/unit/push/push.test.ts` (5 tests, seen failing first), `tests/integration/supabase/push-subscriptions.test.ts` (5 tests, seen failing without the migration)
- `production/qa/evidence/story-057-cheer-push/`

## Completion Notes
The key pair is created by the deploy; a real push on a phone has not been tried yet.
