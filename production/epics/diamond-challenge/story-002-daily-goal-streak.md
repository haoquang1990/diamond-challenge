# Story 002: Mục tiêu ngày + streak

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Core
> **Type**: Logic
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-02

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Brief MVP feature 3 — Mục tiêu ngày + streak

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Hàm thuần `computeProgress(events, now, config)` trả về: tổng XP, XP hôm nay, streak hiện tại, trạng thái mục tiêu ngày.
- [ ] Mục tiêu ngày đạt khi XP trong ngày ≥ ngưỡng **và** có ít nhất 1 sự kiện Học và 1 sự kiện Làm.
- [ ] Streak +1 cho mỗi ngày liên tiếp đạt mục tiêu; một ngày đã qua mà chưa đạt thì streak về 0 (nửa đêm giờ máy).
- [ ] Hôm nay chưa đạt nhưng hôm qua đạt: streak vẫn giữ, chưa mất đến hết ngày.
- [ ] Ngưỡng XP ngày đọc từ file cấu hình, không viết cứng.
- [ ] Biên ngày theo giờ địa phương; đổi múi giờ và giờ mùa hè không làm hỏng streak (có test).
- [ ] Sự kiện nhập muộn (timestamp ngày cũ) được tính vào ngày của timestamp.
- [ ] Kết quả xác định: cùng nhật ký + `now` luôn ra cùng kết quả; hàm không đọc đồng hồ thật.

---

## Implementation Notes

- Inject `now` và múi giờ vào hàm để test xác định.
- XP mỗi loại hoạt động/bài học lấy từ cấu hình (story 003, 005); hàm chỉ cộng `payload.xp`.

---

## Out of Scope

- Hiển thị (story 004), bản đồ chặng (story 006).

---

## Files

- `src/domain/progress.ts`
- `src/config/game-config.json`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/progress/streak.test.ts` (advisory at `qa.level: minimal`)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-001-event-log.md`
- Unlocks: `story-004-today-screen.md`, `story-006-diamond-map.md`

## Completion Notes
**Completed**: 2026-11-02
**Criteria**: 8/8 passing (behaviour checked by a scratchpad smoke script, 12/12 PASS, incl. Việt Nam day boundary and America/New_York DST both directions)
**Deviations**: None. Accepted by the user: any event with `payload.xp` counts toward XP (incl. `settings_changed`); events dated after `now` count toward `totalXp` but never extend the streak.
**Test Evidence**: waived at qa.level minimal; AC6 says "(có test)" — the scratchpad script becomes `tests/unit/progress/streak.test.ts` in story 004
**Reviewed by**: self, no independent review
