# Story 006: Bản đồ Con đường Diamond

> **Epic**: diamond-challenge
> **Status**: In Progress
> **Layer**: Presentation
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-03

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Brief MVP feature 4 — Bản đồ Con đường Diamond

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Các chặng đọc từ cấu hình (mặc định: Khởi động → Silver → Gold → Platinum → Emerald → Diamond), mỗi chặng có tên, ngưỡng XP và mốc hoạt động tùy chọn.
- [ ] Chặng mở khóa khi tổng XP đạt ngưỡng và (nếu có) đủ mốc hoạt động; hàm xác định chặng là hàm thuần, có test.
- [ ] Bản đồ hiển thị chặng đã qua, chặng hiện tại (kèm phần trăm tới chặng kế) và các chặng còn khóa.
- [ ] Chạm một chặng xem điều kiện mở khóa.
- [ ] Khi vừa lên chặng mới có phản hồi rõ ràng (một lần, không lặp lại khi tải lại).
- [ ] Có ghi chú nhìn thấy được: đây là lộ trình thói quen, không phải xác nhận danh hiệu chính thức của Amway.
- [ ] Hiển thị tốt trên viewport điện thoại (cuộn dọc), không cần thư viện đồ họa nặng.

---

## Implementation Notes

- Chặng tính lại từ `computeProgress` (story 002), không lưu riêng.
- Không dùng logo hay tài liệu chính thức của Amway.

---

## Out of Scope

- Dữ liệu doanh số/PV/BV thật, xác minh danh hiệu thật.

---

## Files

- `src/domain/stages.ts`
- `src/ui/screens/diamond-path-screen.tsx`
- `src/config/game-config.json`
- `src/app.tsx`
- `src/ui/screens/today-screen.tsx`
- `src/ui/strings.ts`
- `src/ui/styles.css`
- `tests/unit/stages/stages.test.ts`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp màn hình bản đồ ở đầu, giữa và gần Diamond, giữ lại trong `production/qa/evidence/`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-002-daily-goal-streak.md`
- Unlocks: None
