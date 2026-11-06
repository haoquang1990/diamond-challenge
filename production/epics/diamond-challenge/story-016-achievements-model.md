# Story 016: Mô hình thành tích (cấu hình, đánh giá, ghi nhận, hàng đợi)

> **Epic**: diamond-challenge
> **Status**: In Progress
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-06

## Context

**GDD**: `design/game-brief.md` (chi tiết: `design/quick-specs/achievements-system-2026-11-05.md`, Core Rules 1–5, 8; AC-3 đến AC-11, AC-16)
**Requirement**: Brief MVP feature 8 — Thông báo thành tích (phần tính)

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] `game-config.json` có mục `achievements` (`toastMs`, `maxPopupsPerAction`, `soundDefault`, `encouragements[]`, `items[]` với 5 chặng, 1 mục tiêu ngày, streak 7/30/100, 6 mốc people); đọc và kiểm tra ở biên dữ liệu, mục hỏng bị bỏ qua và báo `problems`, không lỗi.
- [ ] Hàm thuần `evaluateAchievements(events, config, now, timeZone)` trả về các mốc đang đạt cho từng loại `stage`, `daily_goal` (id `daily_goal:YYYY-MM-DD`), `streak`, `people` (ngưỡng số hoặc `"target"` từ `target30x30`), dùng lại `computeProgress`, `computeStageProgress`, `computePeopleStats`; không đọc đồng hồ thật.
- [ ] Mốc đã ghi nhận đọc từ `settings_changed { achievementAcknowledged }` và (cho chặng) `{ stageAcknowledged }`; hàm "mốc mới" = đang đạt mà chưa ghi nhận; hoàn tác tụt dưới mốc rồi đạt lại không tính là mới.
- [ ] Ghi nhận im lặng: khi chưa có `achievementsSeeded`, hàm tạo sự kiện ghi nhận (kèm `silent: true`) cho mọi mốc đang đạt cộng sự kiện `achievementsSeeded`; cùng hàm dùng được sau khi nhập sao lưu.
- [ ] Luật gộp popup: sắp xếp chặng → mục tiêu ngày → streak → people; ≤ `maxPopupsPerAction` thì từng popup, nhiều hơn thì `maxPopupsPerAction − 1` popup đơn và một popup gộp "N thành tích".
- [ ] Hàng đợi toast thuần: từ một sự kiện có `xp > 0` (không phải bù trừ) dựng nội dung "+N XP · <tên>"; quá 3 toast chờ thì gộp "+X XP · N hoạt động".
- [ ] Chọn câu khích lệ ngẫu nhiên qua bộ sinh số được truyền vào (để test tất định), không lặp câu vừa dùng; danh sách trống thì dùng câu mặc định.
- [ ] Thêm một mốc streak mới chỉ bằng cấu hình thì `evaluateAchievements` trả về nó (test).
- [ ] `computeProgress`, streak, chặng và 30x30 không đổi cách tính (test hồi quy với nhật ký mẫu); test Vitest dùng ngày cố định, không đồng hồ thật, không ngẫu nhiên thật.

---

## Implementation Notes

- Không thêm kiểu sự kiện mới: mọi ghi nhận là `settings_changed` để sao lưu/khôi phục dùng được ngay.
- Logic nằm trong `src/domain/achievements.ts`; UI (story 017, 018) chỉ gọi hàm.

---

## Out of Scope

- Toast, popup, âm thanh, Cài đặt (story 017).
- Màn Thành tích, nối vào nhập sao lưu (story 018).

---

## Files

- `src/domain/achievements.ts`
- `src/config/game-config.json`
- `tests/unit/achievements/achievements.test.ts`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/achievements/achievements.test.ts` (advisory at `qa.level: minimal`; dự án vẫn yêu cầu test Vitest cho logic)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-012-person-tasks-labels.md`, `production/epics/diamond-challenge/story-006-diamond-map.md`, `production/epics/diamond-challenge/story-002-daily-goal-streak.md`
- Unlocks: `story-017-achievement-toast-popup.md`, `story-018-achievements-screen.md`
