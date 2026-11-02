# Story 003: Ghi hoạt động Làm

> **Epic**: diamond-challenge
> **Status**: In Progress
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-02

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Brief MVP feature 1 — Ghi hoạt động Làm

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Màn **Làm** liệt kê các loại hoạt động từ file cấu hình (vd. thêm danh sách, demo, opp, follow-up, khách hàng mới), mỗi loại có tên và XP.
- [ ] Chọn một loại, nhập ghi chú tùy chọn, bấm lưu → thêm sự kiện `activity_logged` vào nhật ký (story 001) với đúng XP.
- [ ] Ghi một hoạt động mất tối đa 3 lần chạm từ màn Hôm nay (với ghi chú để trống).
- [ ] Sau khi lưu có phản hồi rõ (hiện XP vừa nhận, hiệu ứng "ting" ngắn) và quay lại Hôm nay.
- [ ] Có thể ghi nhiều hoạt động cùng loại trong một ngày; XP cộng dồn.
- [ ] Có "hoàn tác" ngay sau khi lưu, bằng một sự kiện bù trong nhật ký (không xóa sự kiện).
- [ ] Bố cục mobile-first, nút chạm ≥ 44px, dùng được bằng một tay.
- [ ] Thêm loại hoạt động mới chỉ cần sửa file cấu hình, không sửa code.

---

## Implementation Notes

- Loại hoạt động và XP nằm trong `src/config/game-config.json` (dùng chung với story 002).
- Chụp ảnh màn hình ở viewport điện thoại (vd. 390×844) làm bằng chứng.

---

## Out of Scope

- Màn Hôm nay (story 004). Danh sách khách/contact đầy đủ (ngoài MVP).

---

## Files

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite.config.ts`
- `index.html`
- `src/main.tsx`
- `src/app.tsx`
- `src/config/game-config.json`
- `src/ui/activity-types.ts`
- `src/ui/play-ting.ts`
- `src/ui/strings.ts`
- `src/ui/screens/log-activity-screen.tsx`
- `src/ui/styles.css`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp màn hình giữ lại trong `production/qa/evidence/` (không được miễn ở `qa.level: minimal`)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-001-event-log.md`
- Unlocks: `story-004-today-screen.md`
