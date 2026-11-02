# Story 001: Nhật ký sự kiện cục bộ

> **Epic**: diamond-challenge
> **Status**: In Progress
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-02

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Brief MVP feature 6 — Lưu cục bộ, sẵn sàng đồng bộ

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Mỗi sự kiện có `id` (UUID), `type`, `timestamp` (ISO UTC), `userId` cục bộ, `schemaVersion`, `payload`.
- [ ] Có API `append(event)` và `list({from, to})`; sự kiện chỉ thêm, không sửa/xóa (sửa = sự kiện bù).
- [ ] Lưu bằng IndexedDB; dữ liệu còn nguyên sau khi tải lại trang.
- [ ] Lớp lưu trữ nằm sau một interface (`EventStore`) để thay bằng bản có đồng bộ sau này; có bản in-memory dùng cho test.
- [ ] Mỗi sự kiện có cờ `syncedAt` (null lúc đầu) cho giai đoạn 2.
- [ ] `userId` cục bộ được sinh một lần và giữ nguyên giữa các lần mở.
- [ ] Sự kiện có `schemaVersion` lạ hoặc hỏng bị bỏ qua có cảnh báo, không làm app sập.

---

## Implementation Notes

- Sự kiện tối thiểu: `activity_logged`, `lesson_completed`, `settings_changed`.
- XP, streak, chặng đều tính lại từ nhật ký (story 002), không lưu số dẫn xuất.
- Thời gian lưu UTC; "ngày" tính theo múi giờ của máy (story 002).

---

## Out of Scope

- Story 002: tính XP, mục tiêu ngày, streak.
- Đồng bộ thật lên server (giai đoạn 2).

---

## Files

- `src/data/event-store.ts`
- `src/data/indexeddb-event-store.ts`
- `src/data/memory-event-store.ts`
- `tests/unit/event-log/event-log.test.ts`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/event-log/event-log.test.ts` (advisory at `qa.level: minimal`)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: `story-002-daily-goal-streak.md`, `story-003-log-activity.md`, `story-005-lessons.md`
