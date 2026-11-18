# Story 031: Bảng `personal_events` trên server (migration, RLS, `sync_seq`)

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Integration
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-18

## Context

**GDD**: `design/gdd/accounts.md` (luật 4, 12) và `design/gdd/crm.md` (luật 16, 18)
**Requirement**: Quyết định của người dùng 2026-11-17: tiến độ cá nhân (XP, streak, thành tích, bài học) đồng bộ lên server theo tài khoản, chỉ chính người đó đọc/ghi.

**ADR Governing Implementation**: N/A (minimal — no ADRs). Thiết kế theo `docs/architecture/adr-0004-personal-progress-on-server.md` (Accepted) và cơ chế `sync_seq` của `docs/architecture/adr-0002-household-contacts-on-server.md`.
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) + Supabase | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Migration mới (timestamp sau `20261109000000`) tạo bảng `personal_events(id uuid pk, user_id uuid not null default auth.uid() references profiles on delete cascade, type, occurred_at, schema_version, payload jsonb, created_at, sync_seq bigint unique not null)`, sequence `personal_events_sync_seq` và trigger cấp `sync_seq` khi insert (giá trị app gửi bị bỏ qua; sequence không mở cho vai trò của app).
- [ ] RLS: `select` và `insert` chỉ khi `user_id = auth.uid()`; `insert` thêm điều kiện tài khoản đã có `contact_consents` với `version >= app_config` phiên bản hiện hành (cấu hình trên server, mặc định 1); **không có** `update` / `delete` cho `authenticated`.
- [ ] Người khác không đọc/ghi được: thành viên cùng hộ, tuyến trên, tuyến dưới, người ngoài hộ, và `anon`; admin cũng không có đường đọc qua app (không policy riêng cho admin).
- [ ] Ràng buộc `check` chặn: `type` ngoài `lesson_completed`, `activity_logged`, `settings_changed`; `activity_logged` có `personId`; `settings_changed` không mang một trong `achievementAcknowledged`, `stageAcknowledged`, `achievementsSeeded`. Giới hạn đã biết (ghi trong migration và ADR): sự kiện bù `activity_logged { compensates }` qua được ràng buộc vì server không biết sự kiện gốc thuộc luồng nào; app phân loại theo sự kiện gốc (story 032).
- [ ] Gửi lại cùng `id` (`on conflict (id) do nothing`) không nhân đôi; hai insert cùng lúc nhận `sync_seq` khác nhau, tăng dần.
- [ ] Xoá tài khoản (xoá `profiles`) xoá luôn các dòng `personal_events` của người đó (`on delete cascade`).
- [ ] Test RLS bằng PGlite (`tests/integration/supabase/personal-events-rls.test.ts`) phủ các tiêu chí trên; không đổi migration cũ, không đưa secret hay service_role key vào app.

---

## Implementation Notes

- Theo mẫu `supabase/migrations/20261107010000_contact_sync_seq.sql` (sequence + trigger security definer, `revoke` execute) và `tests/integration/supabase/group-rls.test.ts` (PGlite, nạp các migration cũ bằng `?raw`).
- Phiên bản đồng ý hiện hành: thêm khoá `contact_consent_version` vào `app_config` (seed `1`, cùng giá trị `contactConsentVersion` trong `game-config.json`); hàm `security definer` đọc giá trị này như `cheers_per_day` ở story 028. Story 033 tăng cả hai cùng lúc.
- Migration chạy lên Supabase thật khi merge vào main; deploy story 031 trước hoặc cùng lúc với story 032.

---

## Out of Scope

- Đồng bộ phía app (story 032), văn bản đồng ý (story 033).
- Lưu cài đặt thiết bị (giờ nhắc, âm thanh, mục tiêu ngày) trên server: ở lại trên máy theo ADR-0004.

---

## Files

- `supabase/migrations/20261118000000_personal_events.sql` (new: `personal_events`, `personal_events_sync_seq` + trigger, check constraints, RLS, `app_config.contact_consent_version`, `contact_consent_version()`, `has_current_contact_consent()`)
- `tests/integration/supabase/personal-events-rls.test.ts` (new, 32 tests)
- `docs/architecture/adr-0004-personal-progress-on-server.md` (Risks: the compensation limit)

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: test RLS `tests/integration/supabase/personal-events-rls.test.ts` (PGlite). Ở `qa.level: minimal` test thường được miễn, nhưng bảng này giữ dữ liệu riêng tư của người dùng nên giữ lại test RLS như story 028.

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-030-require-login.md` (kho theo tài khoản; đồng ý bắt buộc)
- Unlocks: story 032

## Completion Notes
**Completed**: 2026-11-18
**Criteria**: 7/7 passing (migration and RLS run only on PGlite; not applied to the live Supabase)
**Deviations**: Advisory, not logged as tech debt: (1) the migration reaches the live database for the first time on the next deploy, and story 032 needs it there; (2) a compensating `activity_logged { compensates }` passes the server `check`, so the app must classify it by its target (story 032), recorded in the migration and ADR-0004; (3) the consent version lives in two places (`game-config.json` and `app_config.contact_consent_version`) and story 033 must raise both together; (4) only two guards were mutation-tested (the owner condition of the select policy and the consent condition of the insert policy); the grants and the `check` constraints were not; (5) `docs/architecture/adr-0004-personal-progress-on-server.md` (Risks) was edited to record the compensation limit, beyond the planned list
**Test Evidence**: `tests/integration/supabase/personal-events-rls.test.ts` (32 tests, rerun at close: 32/32); full suite 471/471
**Reviewed by**: self, no independent review
