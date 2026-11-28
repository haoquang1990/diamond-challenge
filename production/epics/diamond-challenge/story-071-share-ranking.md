# Story 071: Chia sẻ với bạn bè và xếp hạng tuần

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-28

## Context

**GDD**: `design/game-brief.md` (nhóm; story 044, 069, 070)
**Requirement**: Chốt 2026-11-28: bạn bè luôn thấy tên, chuỗi ngày, đạt mục tiêu hôm nay, XP tuần, huy hiệu; số việc làm và số KH/NPP chỉ khi người đó bật (mặc định tắt); không bao giờ chia sẻ danh bạ, tên liên hệ, ghi chú. Xếp hạng tuần gồm mình, bạn bè và tuyến dưới, tính lại mỗi thứ Hai. Mockup đã duyệt.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Cài đặt "Chia sẻ với bạn bè": hai công tắc "Số việc làm 7 ngày" và "Số KH và NPP" (mặc định tắt), dòng luôn chia sẻ / không bao giờ chia sẻ; lưu theo tài khoản trên máy chủ.
- [x] Máy chủ chỉ trả số việc làm, KH, NPP của bạn bè khi họ bật; vợ/chồng và tuyến dưới như trước; không ai đọc hoặc đặt công tắc của người khác. Có integration test.
- [x] App gửi XP tuần (từ thứ Hai, theo giờ máy) cùng số liệu chia sẻ; máy chủ cũ vẫn nhận phần còn lại. Có unit test.
- [x] Trang Nhóm: "Xếp hạng tuần này" (tuần dd/mm–dd/mm) gồm bạn, bạn bè và tuyến dưới, dòng của bạn tô xanh; người có số của tuần trước tính 0. Bạn bè đã bật chia sẻ có dòng "12 việc 7 ngày · KH 7 · NPP 2". Thẻ Nhóm trên Hôm nay có "#2 tuần này · còn N XP để vượt …" hoặc "dẫn trước N XP".
- [x] 390 và 320px không tràn ngang.

## Files

- `supabase/migrations/20261129040000_friend_share_week.sql`
- `src/domain/progress.ts` (`xpWeek`, `weekStart`, `weekStartKey`), `src/data/member-progress-sync.ts`, `src/data/nhom-service.ts` (`weeklyRanking`), `src/ui/screens/nhom-panel.tsx`, `src/ui/screens/group-screen.tsx`, `src/ui/screens/friend-share-card.tsx`, `src/ui/screens/settings-screen.tsx`, `src/app.tsx`, `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/nhom/ranking.test.ts` (6 tests), `tests/unit/sync/member-progress-sync.test.ts` (1 changed), `tests/integration/supabase/friend-share.test.ts` (3 tests); seen failing first
- `production/qa/evidence/story-071-share-ranking/`

## Completion Notes
**Completed**: 2026-11-28
**Criteria**: 5/5 passing (none deferred)
**Deviations**: Advisory: (1) "còn N XP để vượt" counts the XP needed to pass, so it is one more than the difference; (2) "huy hiệu mới" is listed as shared but friends do not see badges yet; (3) a friend's or F1's XP of the week updates when their app sends numbers (each change, after sync)
**Test Evidence**: unit and integration tests above; screenshots of the ranking, the card and the switches at 390 and 320px; full suite 834/834
**Reviewed by**: self, no independent review
