# Story 023: Đồng ý lưu trên server và đồng bộ Danh bạ hộ

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Integration
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-07

## Context

**GDD**: `design/gdd/crm.md` (luật 16–18, 25) và `design/gdd/accounts.md` (luật 4)
**Requirement**: Giai đoạn 2a mục 3 — thông báo đồng ý; đồng bộ Danh bạ hộ theo `sync_seq` (đẩy dữ liệu cũ, hai chiều, offline, sửa cùng lúc)

**ADR Governing Implementation**: N/A (minimal — no ADRs). Thiết kế theo `docs/architecture/adr-0002-household-contacts-on-server.md` (sau khi sửa sang `sync_seq`).
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) + IndexedDB + Supabase | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Sau lần đổi mật khẩu đầu (hoặc khi bật trong Cài đặt), app hiện thông báo đồng ý: Danh bạ (tên, SĐT, mã số, ghi chú, nhãn, việc, lịch sử) lưu trên server ở Singapore để đồng bộ trong hộ, chỉ thành viên hộ xem qua app, quản trị dự án có thể truy cập dữ liệu trên server. Đồng ý gọi `record_contact_consent(version)`; không đồng ý thì app dùng như giai đoạn 1, hỏi lại được trong Cài đặt.
- [ ] Chưa đăng nhập hoặc chưa đồng ý: không có sự kiện Danh bạ nào được gửi lên server (kiểm bằng client giả).
- [ ] Sau khi đồng ý: đẩy toàn bộ sự kiện Danh bạ cũ trên máy (`syncedAt` rỗng) lên `contact_events` với `author_id` = tài khoản, `insert … on conflict (id) do nothing`; đặt `syncedAt` chỉ khi server đã nhận. Sự kiện cá nhân (bài học, hoạt động không gắn người, cài đặt, ghi nhận thành tích) không bao giờ được gửi.
- [ ] Kéo sự kiện của hộ theo `sync_seq > con trỏ` (lưu trên máy), mỗi lần đọc lùi một khoảng chồng lấn, gộp theo `id`; kéo hai lần không sinh trùng. Không dùng `created_at` làm con trỏ.
- [ ] Offline: ghi vào nhật ký trên máy như thường; có mạng lại thì đẩy và kéo. Mất mạng giữa chừng không mất hay nhân đôi sự kiện.
- [ ] Hai thành viên sửa cùng lúc: giữ mọi sự kiện; cùng một trường thì sự kiện muộn hơn thắng; `occurred_at` của sự kiện mới luôn lớn hơn mọi `occurred_at` đã thấy trong hộ (giảm lỗi máy sai giờ).
- [ ] Lịch sử liên hệ ghi rõ ai làm (tên hiển thị hoặc SĐT; "Thành viên cũ" khi tác giả đã xoá). XP, streak, mục tiêu ngày và mốc `stage`/`daily_goal`/`streak` chỉ tính sự kiện có `userId` thuộc tài khoản của mình (gồm id máy đã liên kết ở story 021).
- [ ] Server từ chối vì mất quyền (rời hộ, đổi hộ): dừng đồng bộ, hiện thông báo, không xoá dữ liệu trên máy trong story này.
- [ ] Sao lưu và khôi phục file vẫn chạy; sự kiện khôi phục được đẩy lên như sự kiện chưa đồng bộ.

---

## Implementation Notes

- Test tích hợp: hai kho `fake-indexeddb` + client giả (bộ nhớ hoặc PGlite với ba migration), không gọi server thật.
- Chụp ảnh: thông báo đồng ý, trạng thái đồng bộ trong Cài đặt, lịch sử có "ai làm".

---

## Out of Scope

- Rời hộ, xoá tài khoản, xoá Danh bạ hộ trên máy.
- Dò và gộp liên hệ trùng (story 026), Bảng 30x30 theo hộ (story 027).

---

## Files

- `src/data/contact-sync.ts` (new), `src/ui/screens/consent-screen.tsx` (new)
- `src/data/event-store.ts`, `src/data/indexeddb-event-store.ts`, `src/data/memory-event-store.ts`
- `src/domain/progress.ts`, `src/domain/stages.ts`, `src/domain/achievements.ts`, `src/notifications/reminders.ts`
- `src/app.tsx`, `src/config/game-config.json`
- `src/ui/screens/settings-screen.tsx`, `src/ui/screens/people-screen.tsx`, `src/ui/screens/person-form.tsx`, `src/ui/screens/today-screen.tsx`, `src/ui/screens/diamond-path-screen.tsx`, `src/ui/screens/achievements-screen.tsx`
- `src/ui/achievements-overlay.tsx`, `src/ui/achievements-helpers.ts`, `src/ui/people-helpers.ts`, `src/ui/strings.ts`, `src/ui/styles.css`
- `docs/architecture/adr-0002-household-contacts-on-server.md` (amendment from user decisions)
- `production/qa/evidence/story-023-consent-household-contact-sync/`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: test tích hợp (bỏ qua được ở `qa.level: minimal`) và ảnh chụp các màn có thay đổi

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-021-login-change-password.md`, `production/epics/diamond-challenge/story-020-households-backend.md`, `supabase/migrations/20261107010000_contact_sync_seq.sql` (commit 307d19a; phải deploy lên server trước khi thử thật)
- Unlocks: story 026, 027, 028

## Completion Notes
**Completed**: 2026-11-07
**Criteria**: 9/9 passing (built app in Chromium 390×844 and 320px with two simulated devices and a third account against a fake PostgREST; the later-edit-wins rule checked on `derivePeople`; not tried on a real phone or against the live Supabase)
**Deviations**: Advisory, not logged as tech debt: (1) never tried against the live Supabase (server RLS is covered by the PGlite tests of stories 019/020); (2) the two-device fake-server scenario is not in the repo, so no automated test re-runs the sync (waived at `qa.level: minimal`); (3) "last synced" is kept in memory only and only the Làm list refreshes right after a pull; (4) 8 files outside the planned list were touched so that "mine" applies everywhere XP is computed, all listed in `## Files`; (5) the agent's two new source files tripped the write-guard hook's subagent warning, the user reviewed the whole changeset here; (6) depends-on story 020 was still In Progress, accepted by the user; (7) three user decisions changed the ADR-0002 design (10-minute clock-skew limit, "mine" inverted, a local "Không đồng ý" wins) and are recorded in its Amendments
**Test Evidence**: screenshots in production/qa/evidence/story-023-consent-household-contact-sync/ (01–07, a sample backup and stamp.txt, stamp unchanged); full suite 352/352
**Reviewed by**: self, no independent review
