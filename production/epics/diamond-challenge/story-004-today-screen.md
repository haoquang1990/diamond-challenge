# Story 004: Màn Hôm nay

> **Epic**: diamond-challenge
> **Status**: In Progress
> **Layer**: Presentation
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-03

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Brief MVP feature 5 — Màn Hôm nay

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Là màn mặc định khi mở app; hiển thị streak, thanh XP ngày (XP hôm nay / ngưỡng), chặng hiện tại.
- [ ] Có hai nút lớn **Học** và **Làm** dẫn tới story 005 và 003.
- [ ] Hiển thị rõ phần còn thiếu để đạt mục tiêu ngày (vd. "còn 1 việc Làm").
- [ ] Khi đạt mục tiêu ngày, màn đổi sang trạng thái hoàn thành (streak +1 thấy được).
- [ ] Số liệu lấy từ `computeProgress` (story 002) và cập nhật ngay sau khi ghi Làm/Học.
- [ ] Trạng thái rỗng (người dùng mới, chưa có sự kiện) hiển thị đúng, không lỗi.
- [ ] Thân thiện mobile (viewport ~390×844), điều hướng cơ bản giữa Hôm nay / Học / Làm / Con đường.
- [ ] App dùng được khi không có mạng sau lần tải đầu (PWA cơ bản: manifest + cache tài nguyên tĩnh).

---

## Implementation Notes

- Dựng khung dự án Vite + React + TypeScript + Vitest ở story này nếu chưa có (phiên bản ghi trong `package.json`).
- Ảnh chụp ở trạng thái rỗng, đang dở và đã hoàn thành mục tiêu.
- Cài Vitest, lưu script kiểm tra story 001 thành tests/unit/event-log/event-log.test.ts; kiểm tra trên trình duyệt thật (Playwright) rằng dữ liệu còn sau khi tải lại trang.

---

## Out of Scope

- Bản đồ chi tiết (story 006), nhắc nhở (story 007).

---

## Files

- `src/app.tsx`
- `src/main.tsx`
- `index.html`
- `src/ui/strings.ts`
- `src/ui/styles.css`
- `src/ui/screens/today-screen.tsx`
- `src/ui/screens/coming-soon-screen.tsx`
- `src/ui/screens/log-activity-screen.tsx`
- `public/manifest.webmanifest`
- `public/icon.svg`
- `public/sw.js`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `tests/unit/event-log/event-log.test.ts`
- `tests/unit/progress/streak.test.ts`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp màn hình từng trạng thái, giữ lại trong `production/qa/evidence/`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-002-daily-goal-streak.md`, `production/epics/diamond-challenge/story-003-log-activity.md`
- Unlocks: `story-005-lessons.md`, `story-007-reminders.md`
