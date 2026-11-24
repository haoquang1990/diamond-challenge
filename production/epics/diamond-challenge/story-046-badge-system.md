# Story 046: Hệ thống 150 huy hiệu nhiều bậc

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-24

## Context

**GDD**: N/A (minimal; `design/quick-specs/achievements-system-2026-11-05.md` is the earlier achievements spec)
**Requirement**: Phản hồi 2026-11-24: bỏ trang Con đường, thay bằng trang thành tích "càng nhiều càng tốt". Quyết định: không cộng XP thưởng; thành tích đạt từ trước ghi nhận im lặng; bỏ phần Cấp độ; dùng tên "Huy hiệu"; khoảng 150 huy hiệu (mỗi mốc là một huy hiệu); bỏ ô "Chặng hiện tại" ở Hôm nay; danh mục duyệt 2026-11-24.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Danh mục dữ liệu `src/content/badges.json` (35 thẻ) cộng một huy hiệu "Xong chặng" cho mỗi chặng học = 150 huy hiệu (mỗi mốc một huy hiệu); id duy nhất, icon có trong bộ icon, mốc tăng dần. Có unit test.
- [ ] Các số đo tính từ nhật ký: thói quen (chuỗi dài nhất, ngày đạt mục tiêu, tuần trọn vẹn, tháng chăm chỉ, ngày có hoạt động, cuối tuần, dậy sớm, cú đêm), XP (tổng, ngày cao nhất, 7 ngày cao nhất), học (số bài, đúng hết, ôn lại, ngày học, từng chặng, hết 100 bài), danh sách (liên hệ, ghi chú), việc làm (từng việc, khách khác nhau, NPP khác nhau, đa năng, học và làm, chốt nhanh, chăm sóc bền bỉ), 30x30 và hộ. Bỏ sự kiện đã hoàn tác và của thành viên khác trong hộ. Có unit test.
- [ ] Mỗi mốc đạt là một thành tích `badge:<id>:<mốc>`, bật popup như thành tích cũ; không cộng XP. Huy hiệu đạt trước bản này và huy hiệu có được nhờ tải tiến độ từ máy chủ được ghi nhận im lặng.
- [ ] Popup cũ "Đạt mục tiêu ngày" giữ nguyên; các thành tích cũ trùng với huy hiệu (chặng, chuỗi, liên hệ/KH/NPP) không còn bật popup.

## Files

- `src/content/badges.json` (new), `src/domain/badges.ts` (new: `parseBadges`, `computeBadgeMetrics`, `badgeRows`, `achievedBadgeItems`, `tierColor`, `tierLabel`)
- `src/domain/achievements.ts` (kind `badge`, `badgesSeeded`), `src/data/progress-sync.ts` (`badgesSeeded` synced)
- `src/ui/badges-content.ts` (new), `src/ui/achievements-overlay.tsx` (badges evaluated and seeded; only the daily-goal item from the old config), `src/app.tsx` (silent acknowledge after a progress pull), `src/ui/lesson-icons.ts` (`flame`)
- `tests/unit/badges/badges.test.ts` (10 tests, seen failing first), `tests/unit/achievements/achievements.test.ts` (ack flag)

## Completion Notes
**Completed**: 2026-11-24
**Criteria**: 4/4 passing (none deferred)
**Deviations**: Advisory: (1) contacts, KH and NPP badges count the whole household book; habits, XP, lessons and tasks count only my own events; (2) a badge whose value drops (contacts merged, a customer label lost) shows the lower number on the card but its popup is never repeated; (3) the old stage, streak and people items stay in `game-config.json` but are filtered out at load
**Test Evidence**: `tests/unit/badges/badges.test.ts`; full suite 649/649
**Reviewed by**: self, no independent review
