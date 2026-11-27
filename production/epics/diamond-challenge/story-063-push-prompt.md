# Story 063: Thẻ "Bật thông báo" trên Hôm nay

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-27

## Context

**GDD**: `design/game-brief.md` (thông báo; story 057, 058)
**Requirement**: Phản hồi 2026-11-27: "App có để được mặc định là bật thông báo không?" Không bật sẵn được (điện thoại bắt người dùng tự cho phép), nên làm gần như mặc định: một lần bấm trên Hôm nay. Mockup 4 trường hợp đã duyệt.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Máy chưa bật thông báo: Hôm nay có thẻ "Bật thông báo" (Để sau / Bật). Bấm Bật: điện thoại hỏi quyền, máy đăng ký nhận đẩy, bật cả Cổ vũ và Nhắc mỗi ngày (giữ giờ đang đặt, mặc định 20:00), thẻ xanh "Đã bật thông báo" rồi tự ẩn sau 5 giây.
- [x] iPhone mở trong Safari: thẻ hướng dẫn 3 bước đưa app ra màn hình chính, chỉ có "Để sau".
- [x] Thông báo bị chặn: thẻ chỉ cách mở lại trong Cài đặt của điện thoại, "Đã hiểu" ẩn hẳn.
- [x] "Để sau" ẩn 3 ngày (config `pushPrompt.snoozeDays`), nhớ theo tài khoản trên máy. Máy đã nhận thông báo, trình duyệt không hỗ trợ hoặc máy chủ chưa có khoá: không hiện thẻ. Có unit test.
- [x] 390 và 320px không tràn ngang. Không migration.

## Files

- `src/domain/push-prompt.ts`, `src/ui/screens/push-prompt-card.tsx`, `src/ui/screens/today-screen.tsx`, `src/app.tsx`, `src/ui/strings.ts`, `src/ui/styles.css`, `src/config/game-config.json` (`pushPrompt`)
- `tests/unit/push/push-prompt.test.ts` (10 tests, seen failing first)
- `production/qa/evidence/story-063-push-prompt/`

## Completion Notes
**Completed**: 2026-11-27
**Criteria**: 5/5 passing (none deferred)
**Deviations**: Advisory: (1) the "Nhắc mỗi ngày" switch is kept per device, as before; turning it on here turns it on for this phone; (2) the screenshots use a stubbed push service, so the real permission prompt still needs a check on a phone
**Test Evidence**: unit tests above; screenshots of the ask, iPhone, blocked and done cards at 390 and 320px; full suite 766/766
**Reviewed by**: self, no independent review
