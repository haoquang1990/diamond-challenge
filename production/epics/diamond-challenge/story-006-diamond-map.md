# Story 006: Bản đồ Con đường Diamond

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Presentation
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-04

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

## Completion Notes
**Completed**: 2026-11-04
**Criteria**: 7/7 passing (production build in Chromium 390×844, screenshots recaptured 2026-11-04 after stories 010–013 changed shared files; phone viewport confirmed by the user on a real phone)
**Deviations**: Advisory, not logged as tech debt: (1) the Con đường milestone still reads "Khách hàng mới" while the person task with the same id new_customer is now named "Chốt khách hàng"; unify the wording in a later story; (2) screenshot 04 was not opened by the reviewer; (3) no screenshot of the map at Emerald or later
**Test Evidence**: screenshots in production/qa/evidence/story-006-diamond-map/ (01–05 plus stamp.txt, stamp unchanged); tests/unit/stages/stages.test.ts (20 tests); full suite 219/219
**Reviewed by**: self, no independent review
