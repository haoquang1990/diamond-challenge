# Story 044: Xếp NPP theo mức tích cực (Tổng XP, XP 7 ngày) kèm chuỗi ngày

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: Integration
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-24

## Context

**GDD**: `design/gdd/accounts.md` (nhóm, số liệu chia sẻ với tuyến trên)
**Requirement**: Phản hồi 2026-11-24: sắp xếp NPP hoạt động tích cực theo XP. Quyết định: hai cách sắp là Tổng XP và XP 7 ngày gần nhất; hiện thêm chuỗi ngày liên tiếp hiện tại; không cần đồng ý lại; gộp vào lần deploy tới.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Mỗi tài khoản (đã đồng ý đồng bộ) gửi 3 số của chính mình lên `member_progress`: tổng XP, XP 7 ngày gần nhất (kể cả hôm nay, theo ngày địa phương), chuỗi ngày hiện tại; chỉ gửi sau khi tiến độ cá nhân đã kéo về ít nhất một lần trên máy, chỉ khi số thay đổi. Hàm tính và bộ gửi có unit test.
- [ ] Bảng mới chỉ chủ tài khoản ghi được; hộ của mình, chuỗi tuyến trên và quản trị đọc được; người khác và tuyến dưới không đọc được. Có test tích hợp trên Postgres.
- [ ] Số của hộ F1 = cộng XP các thành viên, chuỗi = chuỗi dài nhất. Hàm thuần, có unit test.
- [ ] Tab Làm, bộ lọc NPP: thêm lựa chọn sắp "Mới bảo trợ / Tổng XP / XP 7 ngày"; mỗi NPP khớp mã với một hộ F1 hiện "XP 7 ngày · Tổng XP · Chuỗi N ngày"; NPP chưa có số xếp cuối. Khung "Hộ F1" hiện cùng dòng số.
- [ ] Máy chủ chưa có bảng mới thì màn hình vẫn chạy như cũ (không có số XP).
- [ ] 390 và 320px không tràn ngang.

## Out of Scope

- Đồng ý lại theo văn bản mới; bảng xếp hạng nhiều tầng.

## Files

- `supabase/migrations/20261124010000_member_progress.sql` (table, RLS, `can_view_member`)
- `src/domain/progress.ts` (`computeShareProgress`, `SHARE_XP_DAYS`)
- `src/data/member-progress-sync.ts` (new sender), `src/data/group-service.ts` (reads `member_progress`, optional)
- `src/ui/group-helpers.ts` (`householdProgress`, `sortNppByProgress`, `progressByCode`, `householdProgressLabel`), `src/ui/use-group-data.ts` (new)
- `src/ui/screens/people-screen.tsx` (sort chips, XP line), `src/ui/screens/f1-household-box.tsx` (XP line), `src/app.tsx` (sender and group data wiring)
- `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/integration/supabase/member-progress-rls.test.ts` (4 tests, seen failing without the migration), `tests/unit/progress/share-progress.test.ts` (3, seen failing first), `tests/unit/sync/member-progress-sync.test.ts` (4), `tests/unit/people-ui/npp-progress.test.ts` (6)
- `production/qa/evidence/story-044-npp-ranking/`

## Test Evidence

**Story Type**: Integration
**Required evidence**: unit + integration tests above; screenshots of the NPP chip sorted by Tổng XP and XP 7 ngày and the Hộ F1 box at 390 and 320px.

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-042-remove-board-and-group.md`
- Unlocks: None

## Completion Notes
**Completed**: 2026-11-24
**Criteria**: 6/6 passing (none deferred)
**Deviations**: Advisory: (1) numbers are stored per account, not per household, because each device only knows its own XP; the household view adds them up; (2) the 7-day XP and streak change at midnight without any event: they are re-sent when the app comes back to the foreground or goes online; an F1 who does not open the app keeps the last sent numbers; (3) consent text unchanged (user decision); (4) the migration runs on the live Supabase database when merged
**Test Evidence**: tests above; screenshots `production/qa/evidence/story-044-npp-ranking/`; full suite 639/639
**Reviewed by**: self, no independent review
