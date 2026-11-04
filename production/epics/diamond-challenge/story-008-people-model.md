# Story 008: Mô hình Người + XP chuyển giai đoạn + tính 30x30

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-04

## Context

**GDD**: `design/game-brief.md` (chi tiết: `design/gdd/crm.md`, Core Rules 1–6, 8, 10; Formulas)
**Requirement**: Brief MVP feature 1 — Danh sách Người + giai đoạn; phần tính của feature 5 — Bảng 30x30

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Thêm các kiểu sự kiện `person_added`, `person_updated`, `person_archived`, `person_stage_changed`, `activity_reassigned` vào `src/data/event-store.ts`; `activity_logged` nhận thêm `personId` tùy chọn. Sự kiện cũ vẫn đọc được.
- [ ] Hàm thuần dựng danh sách Người từ nhật ký: tên (mới nhất), ghi chú, đã lưu trữ hay chưa, giai đoạn hiện tại = `to` của lần chuyển cuối chưa bị bù, mặc định `acquaintance`. Không đọc đồng hồ.
- [ ] Giai đoạn và XP đọc từ `game-config.json` mục `personStages` (`acquaintance` 0, `contacted` 5, `demoed` 10, `heard_opp` 20, `customer` 30, `downline` 50).
- [ ] Quy tắc XP chuyển giai đoạn: chỉ khi `to` là giai đoạn kế tiếp ngay **và** người đó chưa từng nhận XP ở giai đoạn `to`; ngược lại `xp = 0`. Chuyển lùi hoặc nhảy bậc được phép nhưng `xp = 0`. Hoàn tác bằng sự kiện bù trừ lại XP và trả giai đoạn.
- [ ] Hàm tạo sự kiện chuyển giai đoạn trả về đúng `xp` cho người gọi; `computeProgress` **không đổi** và tự cộng XP chuyển giai đoạn.
- [ ] Từ chối tên rỗng hoặc chỉ có khoảng trắng (không ghi sự kiện); tên trùng được phép kèm cảnh báo.
- [ ] Hoạt động cũ không có `personId` vẫn tính XP/streak và gán lại được bằng `activity_reassigned` (không đổi XP); hoạt động trỏ tới người không tồn tại hiện là "Người không rõ".
- [ ] Hàm tính số liệu của mình, chỉ đếm người chưa lưu trữ: `customers` (giai đoạn Khách hàng), `f1` (giai đoạn NPP), `contacts` (mọi giai đoạn), `achieved = customers ≥ 30 ∧ f1 ≥ 30`; ngưỡng đọc từ `game-config.json` mục `target30x30` (`contactsTarget` 250, `customersTarget` 30, `f1Target` 30).
- [ ] Test Vitest cho các quy tắc trên, ngày cố định, không dùng đồng hồ thật.

---

## Implementation Notes

- Giữ nguyên nguyên tắc nhật ký chỉ thêm, không lưu số dẫn xuất; mọi thứ tính lại từ nhật ký.
- Đây là phần rủi ro nhất của giai đoạn này vì thay đổi cấu trúc sự kiện: giữ tương thích với dữ liệu đã lưu và với `parseStoredEvent`.
- Quy ước hoàn tác dùng lại `payload.compensates`, giống hoạt động.
- Dùng tên trường `f1` (không dùng "tầng 1"); cây bảo trợ và Bảng 4x4 thuộc giai đoạn 2 (`design/phase-2-notes.md`).

---

## Out of Scope

- Story 009: màn danh sách Người và màn Làm chọn người.
- Story 010: màn Bảng 30x30.
- Story 011: sao lưu và khôi phục.
- Người bảo trợ, tầng, nhánh, Bảng 4x4, tạo tài khoản, đồng bộ (giai đoạn 2).

---

## Files

- `src/data/event-store.ts`
- `src/domain/people.ts`
- `src/config/game-config.json`
- `tests/unit/people/people.test.ts`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/people/people.test.ts` (advisory at `qa.level: minimal`; dự án vẫn yêu cầu test Vitest cho logic)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-001-event-log.md`, `production/epics/diamond-challenge/story-002-daily-goal-streak.md`
- Unlocks: `story-009-people-list.md`, `story-010-board-30x30.md`

## Completion Notes
**Completed**: 2026-11-04
**Criteria**: 9/9 passing (62 Vitest tests; data written by the previous build reads back unchanged in real Chromium and a stage-change event adds its XP to Hôm nay)
**Deviations**: None blocking. Advisory: un-assigning an activity from a person is not supported (only reassigning to another person); an invalid config falls back to unreachable targets and reports `problems`.
**Test Evidence**: tests/unit/people/people.test.ts (62 tests), full suite 168/168
**Reviewed by**: self, no independent review
