# Story 050: Tuyến trên xem hoạt động của F1 và gợi ý lời cổ vũ

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: Integration
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-26

## Context

**GDD**: `design/gdd/accounts.md` (cổ vũ, story 028; số liệu chia sẻ, story 044)
**Requirement**: Phản hồi 2026-11-26: tuyến trên nên thấy gì từ F1 để cổ vũ, nhắc nhở. Người dùng chọn cả 4 nhóm: mục tiêu hôm nay + 7 ngày, việc làm 7 ngày theo loại, học và huy hiệu, mở app và kích hoạt; và có gợi ý lời cổ vũ.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] App của mỗi người gửi thêm vào `member_progress`: ngày tính, đạt mục tiêu hôm nay, số ngày hoạt động trong 7 ngày, số việc 7 ngày theo loại (liên hệ, demo, OPP, bán hàng, bảo trợ), số bài đã học, lần học gần nhất, huy hiệu mới 7 ngày, lần mở app gần nhất. Chỉ chủ tài khoản ghi được; NPP mình, tuyến trên và admin đọc được. Migration và test tích hợp trên Postgres.
- [x] Tuyến trên trực tiếp (và admin) biết tài khoản nào của F1 chưa kích hoạt (chưa đổi mật khẩu đầu) qua hàm `f1_member_activation`; người khác không biết được.
- [x] Ô "NPP F1" ở trang chi tiết NPP hiện: hôm nay đạt/chưa đạt mục tiêu, "x/7 ngày" hoạt động, việc làm 7 ngày, số bài đã học và lần gần nhất, huy hiệu mới 7 ngày, lần mở app cuối; tài khoản chưa kích hoạt có nhãn "Chưa kích hoạt" và chỉ tài khoản đó có nút "Cấp lại mật khẩu tạm".
- [x] Thẻ "Cổ vũ nhóm" ghi một dòng nhắc theo thứ tự: chưa đăng nhập, chuỗi sắp đứt, đã đạt mục tiêu, 7 ngày chưa hoạt động.
- [x] Popup cổ vũ đưa các lời gợi ý theo hoạt động lên đầu ("Gợi ý theo hoạt động"), rồi tới "Lời cổ vũ chung". Có unit test.
- [x] App vẫn chạy với máy chủ chưa có migration (đọc và gửi theo cột của story 044).
- [x] 390 và 320px không tràn ngang.

## Files

- `supabase/migrations/20261126010000_member_progress_insights.sql` (new columns, `f1_member_activation`)
- `src/domain/progress.ts` (`computeShareProgress` story 050 numbers)
- `src/data/member-progress-sync.ts` (full row, fallback to story 044 columns)
- `src/data/group-service.ts` (reads the new columns with fallback, activation)
- `src/ui/group-helpers.ts` (`householdInsight`, `insightNote`, `suggestCheers`, `tasks7dLabel`, `agoLabel`, `localDayKey`)
- `src/ui/screens/f1-household-box.tsx`, `src/ui/screens/group-cheer-card.tsx`, `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/progress/share-progress.test.ts`, `tests/unit/sync/member-progress-sync.test.ts`, `tests/unit/people-ui/f1-insight.test.ts` (6 tests), `tests/integration/supabase/member-progress-rls.test.ts` (2 new tests, seen failing without the migration)
- `production/qa/evidence/story-050-f1-insights/`

## Completion Notes
**Completed**: 2026-11-26
**Criteria**: 7/7 passing (none deferred)
**Deviations**: Advisory: (1) the migration runs on the live Supabase database when merged; (2) the numbers are what the F1's app last sent, so they are as fresh as the F1's last app open; (3) the F1 insight helper tests were written together with the code rather than seen failing first
**Test Evidence**: tests above; screenshots of the cheer card, the suggested lines and the NPP F1 box at 390 and 320px (fictional data)
**Reviewed by**: self, no independent review
