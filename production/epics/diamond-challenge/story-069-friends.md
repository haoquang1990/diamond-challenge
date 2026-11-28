# Story 069: Kết bạn bằng mã số hoặc link, trang Nhóm

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-28

## Context

**GDD**: `design/game-brief.md` (nhóm, cổ vũ; story 028, 061)
**Requirement**: Chốt 2026-11-28: bạn bè là lớp ngang ngoài tuyến; kết bạn hai chiều, theo tài khoản; tìm bằng mã số Amway (chính) hoặc link; không lộ mã nào có tài khoản; giới hạn ~50. Nhóm nằm trên Hôm nay (thẻ "Nhóm" + "Xem tất cả ›"); lời mời chỉ báo "Có lời mời kết bạn mới", tên hiện trong trang Nhóm. Mockup đã duyệt.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] "+ Kết bạn": nhập mã số Amway, "Gửi lời mời" luôn báo đã gửi (cả khi mã không có tài khoản); mã của hộ mình không tạo lời mời; lời mời tới mọi thành viên của hộ đó. "Chia sẻ link kết bạn của tôi" mở bảng chia sẻ hoặc chép link `?ban=<token>`.
- [x] Mở app bằng link: lời mời được gửi sau khi đăng nhập (kể cả phải đăng nhập trước), link biến khỏi thanh địa chỉ, trang Nhóm báo "Đã gửi lời mời kết bạn qua link".
- [x] Trang Nhóm: Lời mời (tên, mã, Bỏ qua / Đồng ý), Bạn bè (tên, mã; bấm vào để Huỷ kết bạn), số lời mời đã gửi. Người gửi lời mời không thấy tên/mã người nhận trước khi được đồng ý.
- [x] Máy chủ: bảng `friendships` chỉ hai người trong cặp đọc được, không ai ghi trực tiếp; gửi ngược lại lời mời đang chờ thì thành bạn; giới hạn `friends_max` (50). Có integration test; client có unit test.
- [x] Hôm nay có thẻ "Nhóm" với "Xem tất cả ›" và dải "🔔 Có lời mời kết bạn mới" khi có lời mời. 390 và 320px không tràn ngang.

## Files

- `supabase/migrations/20261129020000_friends.sql`
- `src/data/friends-service.ts`, `src/ui/screens/group-screen.tsx`, `src/ui/screens/group-today-card.tsx`, `src/ui/screens/today-screen.tsx`, `src/app.tsx`, `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/integration/supabase/friends.test.ts` (9 tests), `tests/unit/friends/friends-service.test.ts` (3 tests); both seen failing first
- `production/qa/evidence/story-069-friends/`

## Completion Notes
**Completed**: 2026-11-28
**Criteria**: 5/5 passing (none deferred)
**Deviations**: Advisory: (1) no push notification for a new friend request yet; it shows on Hôm nay; (2) the Hôm nay "Nhóm" card holds only its header and the invite note until story 070 moves vợ/chồng, tuyến trên/dưới and cheering into it; the old cheer cards stay meanwhile
**Test Evidence**: integration and unit tests above; screenshots of the card, the Nhóm page and Kết bạn at 390 and 320px; full suite passing
**Reviewed by**: self, no independent review
