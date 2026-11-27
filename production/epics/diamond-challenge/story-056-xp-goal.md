# Story 056: Mỗi người tự chọn mục tiêu XP hằng ngày

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: Integration
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-27

## Context

**GDD**: `design/game-brief.md` (mục tiêu ngày, chuỗi ngày)
**Requirement**: Phản hồi 2026-11-27: mục tiêu cho từng người tự chọn số. Đã duyệt: 20–200 XP, bước 5, mặc định 30; vẫn phải học 1 bài và làm 1 việc; áp dụng từ ngày mai; đi theo tài khoản; tuyến trên thấy con số.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Cài đặt "Mục tiêu hằng ngày": − / +, ô số, gợi ý 20 · 30 · 50 · 100, nút "Đặt mục tiêu"; giới hạn và bước lấy từ `xpGoalRange` (20–200, 5).
- [x] Mục tiêu mới ghi `settings_changed { xpGoal: { xp, from } }` với `from` là ngày mai; hôm nay và các ngày đã qua giữ mục tiêu cũ; hiện "Mục tiêu hôm nay" và "Từ ngày mai". Có unit test.
- [x] Mục tiêu hôm nay, chuỗi ngày, nhắc nhở, thành tích và huy hiệu ngày đạt mục tiêu đều tính theo mục tiêu của đúng ngày đó; vẫn cần 1 bài học và 1 việc làm. Có unit test.
- [x] Lựa chọn đi theo tài khoản (máy chủ nhận khoá `xpGoal`, migration `20261127010000`); lựa chọn của vợ/chồng không tính cho mình.
- [x] Ô NPP F1 của tuyến trên ghi "Hôm nay: chưa đạt mục tiêu (75 XP)" (cột `member_progress.goal_xp`, migration `20261127010100`); app vẫn chạy với máy chủ chưa có cột này. Có test tích hợp.
- [x] 390 và 320px không tràn ngang.

## Files

- `src/domain/progress.ts` (`XP_GOAL_RANGE`, `xpGoalByDay`, `readXpGoal`, `buildXpGoalEvent`, per-day goal in `computeProgress`, `goalXp` in `computeShareProgress`), `src/domain/badges.ts`
- `src/ui/screens/goal-card.tsx`, `src/app.tsx`, `src/ui/screens/f1-household-box.tsx`, `src/ui/group-helpers.ts`
- `src/data/member-progress-sync.ts`, `src/data/group-service.ts`, `src/data/progress-sync.ts`
- `src/config/game-config.json` (`xpGoalRange`), `src/ui/strings.ts`, `src/ui/styles.css`
- `supabase/migrations/20261127010000_xp_goal.sql`, `supabase/migrations/20261127010100_member_progress_goal.sql`
- `tests/unit/progress/xp-goal.test.ts` (5 tests, seen failing first), `tests/unit/people-ui/f1-insight.test.ts`, `tests/unit/sync/member-progress-sync.test.ts`, `tests/integration/supabase/member-progress-rls.test.ts`, `tests/integration/supabase/personal-events-rls.test.ts` (2 new, seen failing without the migrations)
- `production/qa/evidence/story-056-xp-goal/`

## Completion Notes
**Completed**: 2026-11-27
**Criteria**: 6/6 passing (none deferred)
**Deviations**: Advisory: (1) two migrations run on the live database at merge; (2) for a shared code the sponsor sees the higher of the two goals; (3) picking several times in one day keeps the last pick for tomorrow
**Test Evidence**: tests above; screenshots of the goal card before and after saving and of Cài đặt at 390 and 320px (fictional data); full suite passes
**Reviewed by**: self, no independent review
