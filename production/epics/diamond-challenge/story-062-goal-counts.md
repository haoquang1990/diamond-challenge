# Story 062: Mục tiêu hằng ngày gồm XP, số bài học và số việc làm

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-28

## Context

**GDD**: `design/game-brief.md` (mục tiêu ngày, chuỗi ngày; story 002, 056)
**Requirement**: Phản hồi 2026-11-28: cài đặt mục tiêu chỉ cần tổng XP, số bài học, số việc làm; 0 thì không hiện ở Hôm nay; đổi từ ngày mai có ghi chú nhỏ; gọn, đồng bộ. Mockup bản gọn đã duyệt.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Cài đặt "Mục tiêu hằng ngày": ba dòng XP mỗi ngày (20–200, bước 5), Bài học (0–10), Việc làm (0–20) với − / +; dòng đổi ghi "Hôm nay 1 → từ mai 2"; "Lưu mục tiêu" lưu cả ba, áp dụng từ ngày mai.
- [x] Đạt khi đủ cả ba; 0 bài học hoặc 0 việc làm bỏ phần đó; cài đặt cũ (chỉ XP) nghĩa là 1 bài học và 1 việc làm. Chuỗi, huy hiệu, nhắc nhở, số liệu tuyến trên dùng cùng quy tắc, mỗi ngày theo mục tiêu của ngày đó. Có unit test.
- [x] Hôm nay: "còn N XP", "Bài học x/y", "Việc làm x/y" (ẩn phần đặt 0); có thay đổi chờ thì "Từ mai: …".
- [x] Không migration (khoá `xpGoal` đã được máy chủ nhận từ story 056).
- [x] 390 và 320px không tràn ngang.

## Files

- `src/domain/progress.ts` (`DailyGoal`, `meetsGoal`, `dailyGoalByDay`, `readXpGoal`, `buildXpGoalEvent`, counts in `computeProgress`), `src/domain/badges.ts`, `src/domain/reminders.ts`
- `src/ui/screens/goal-card.tsx`, `src/ui/screens/today-screen.tsx`, `src/ui/strings.ts`, `src/ui/styles.css`, `src/config/game-config.json` (`dailyCountLimits`)
- `tests/unit/progress/xp-goal.test.ts` (3 new, seen failing first; 2 changed), `tests/unit/progress/streak.test.ts` (1 changed)
- `production/qa/evidence/story-062-goal-counts/`

## Completion Notes
**Completed**: 2026-11-28
**Criteria**: 5/5 passing (none deferred)
**Deviations**: Advisory: (1) "Việc làm" counts every task logged in Làm, adding a person included, as "1 việc Làm" did before; (2) the sponsor sees only met / not met and the XP goal, not the lesson and task counts
**Test Evidence**: unit tests above; screenshots of the goal card and the Hôm nay goal at 390 and 320px; full suite 753/753
**Reviewed by**: self, no independent review
