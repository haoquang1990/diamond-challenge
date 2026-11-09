# Story 028: Màn "Nhóm của tôi" (một tầng), cảnh báo không hoạt động, cổ vũ

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-09

## Context

**GDD**: `design/gdd/accounts.md` (luật 10; mục "Nhóm của tôi" chưa có trong GDD, sẽ thêm khi cập nhật phạm vi 2a/2b)
**Requirement**: Giai đoạn 2a mục 8 — hộ F1 trực tiếp, thành viên, số 30x30, cảnh báo 3 ngày không hoạt động, nút cổ vũ

**ADR Governing Implementation**: N/A (minimal — no ADRs). Quyền đọc theo `docs/architecture/adr-0001-household-model.md`; không chạm Danh bạ hộ (ADR-0002).
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) + Supabase | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Màn Con đường có nút "Nhóm của tôi" cạnh "Bảng 30x30" khi đã đăng nhập; chưa đăng nhập thì nút khoá kèm lý do.
- [ ] Danh sách chỉ các hộ F1 **trực tiếp** (`sponsor_household_id` = hộ của mình); không hiện tầng sâu hơn. Mỗi hộ: tên thành viên (tên hiển thị hoặc SĐT), mã số của hộ, KH x/30, NPP F1 x/30, huy hiệu "Đạt 30x30", "cập nhật lúc…"; chưa có số thì "Chưa có số liệu" và coi như chưa đạt.
- [ ] Màn không đọc Danh bạ hay tên khách của hộ F1 (không truy vấn `contact_events`); tuyến dưới không đọc được hộ của tuyến trên.
- [ ] **Không hoạt động:** server ghi `last_activity_at` của hộ khi có sự kiện `activity_logged` mới trong Danh bạ hộ (trigger; tuyến trên chỉ thấy ngày). Hộ F1 có `last_activity_at` cũ hơn `inactiveDays` (mặc định 3, trong cấu hình) hoặc chưa từng có: cảnh báo "N ngày chưa hoạt động" và hộ đó lên đầu danh sách.
- [ ] **Cổ vũ:** nút trên mỗi hộ F1 gửi một câu lấy ngẫu nhiên từ `cheerMessages` trong cấu hình; mỗi hộ F1 nhận tối đa 1 lời cổ vũ/ngày từ hộ bảo trợ (server chặn; nút khoá kèm "Đã cổ vũ hôm nay"). Bảng `cheers` có RLS: chỉ thành viên hộ bảo trợ trực tiếp ghi; chỉ hộ gửi và hộ nhận đọc.
- [ ] Hộ F1 nhận lời cổ vũ thấy một thẻ trên Hôm nay ở lần mở app kế tiếp (không chặn thao tác, đóng được, không hiện lại); không có `xp`.
- [ ] Mỗi hộ F1 còn chỗ có nút "Thêm vợ/chồng" (form của story 025 với `householdId`).
- [ ] Offline: hiện dữ liệu gần nhất kèm "cập nhật lúc…", nút cổ vũ khoá. Mobile-first 390×844 và 320px, nút ≥ 44px.

---

## Implementation Notes

- Migration mới (`last_activity_at` + trigger, bảng `cheers` + RLS + giới hạn 1/ngày) kèm test RLS bằng PGlite; trigger phải tương thích `sync_seq`.
- Chụp ảnh: Nhóm của tôi (có hộ đạt, hộ chưa có số, hộ không hoạt động), sau khi cổ vũ, thẻ cổ vũ trên Hôm nay của hộ F1, chưa có hộ F1 nào, 320px.

---

## Out of Scope

- Cây nhiều tầng, Bảng 4x4, Web Push (2b).

---

## Files

- `supabase/migrations/20261109000000_group_activity_cheers.sql` (new: `households.last_activity_at` + trigger, `cheers` + RLS + daily limit, `app_config.cheers_per_day`)
- `src/data/group-service.ts` (new), `src/ui/screens/my-group-screen.tsx` (new)
- `src/ui/screens/diamond-path-screen.tsx` (entry button), `src/ui/screens/today-screen.tsx` (cheer card), `src/app.tsx`
- `src/config/game-config.json` (`inactiveDays`, `cheerMessages`, `cheersPerDay`), `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/integration/supabase/group-rls.test.ts`
- `production/qa/evidence/story-028-my-group-one-tier/`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp từng trạng thái, giữ lại trong `production/qa/evidence/`; test RLS cho migration mới

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-024-create-f1-account.md`, `production/epics/diamond-challenge/story-025-add-spouse.md`, `production/epics/diamond-challenge/story-027-household-board-30x30.md`
- Unlocks: None

## Completion Notes
**Completed**: 2026-11-09
**Criteria**: 8/8 passing (built app in Chromium 390×844 and 320px with a fake Supabase; the migration was run only on PGlite; not tried on a real phone or against the live Supabase)
**Deviations**: Advisory, not logged as tech debt: (1) the new migration `20261109000000_group_activity_cheers.sql` reaches the live database for the first time when the user deploys; (2) the "Thêm vợ/chồng" button on an F1 household was seen, its form was not opened or submitted from there; (3) the cheer day boundary is 00:00 UTC (07:00 in Vietnam); (4) member phone numbers are shown unformatted; (5) during review the daily-limit trigger was changed so it no longer tells an outsider whether a household was cheered today, with a regression test seen failing on the unfixed migration
**Test Evidence**: screenshots in production/qa/evidence/story-028-my-group-one-tier/ (01–08 plus stamp.txt, stamp unchanged); RLS test `tests/integration/supabase/group-rls.test.ts` (10 tests); full suite 370/370
**Reviewed by**: self, no independent review
