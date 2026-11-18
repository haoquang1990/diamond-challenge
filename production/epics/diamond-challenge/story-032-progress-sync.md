# Story 032: Bộ đồng bộ tiến độ cá nhân trong app (đẩy, kéo, offline)

> **Epic**: diamond-challenge
> **Status**: Ready
> **Layer**: Feature
> **Type**: Integration
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-18

## Context

**GDD**: `design/gdd/accounts.md` (luật 4, 12) và `design/gdd/crm.md` (luật 16, 18)
**Requirement**: Quyết định của người dùng 2026-11-17: đổi máy hoặc xoá dữ liệu trên máy không mất XP, streak, thành tích, bài học.

**ADR Governing Implementation**: N/A (minimal — no ADRs). Thiết kế theo `docs/architecture/adr-0004-personal-progress-on-server.md` (Accepted; mục Decision và Implementation Guidelines) và mẫu đồng bộ của `docs/architecture/adr-0002-household-contacts-on-server.md`.
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) + IndexedDB + Supabase | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Hàm thuần `isPersonalProgressEvent(event, byId)` trong `src/data/progress-sync.ts`: đúng với `lesson_completed`; `activity_logged` không có `personId` (và sự kiện bù của nó, lần theo chuỗi `compensates` như `isContactEvent`; đích không rõ thì không đẩy); `settings_changed` chỉ khi mang `achievementAcknowledged`, `stageAcknowledged` hoặc `achievementsSeeded`. Sai với mọi sự kiện Danh bạ và mọi cài đặt thiết bị (`reminder`, `sound`, `dailyGoal`, `accountLinked`, `contactSync`). Một sự kiện chỉ thuộc đúng một luồng (Danh bạ hoặc tiến độ).
- [ ] Đẩy: sự kiện tiến độ có `syncedAt` rỗng lên `personal_events` (`insert … on conflict (id) do nothing`, `user_id` = tài khoản); đặt `syncedAt` chỉ khi server đã nhận. Gồm cả dữ liệu cũ vừa chép sang tài khoản ở story 030. Chưa đăng nhập, chưa đồng ý phiên bản hiện hành: không đẩy gì (kiểm bằng client giả).
- [ ] Kéo: sự kiện của chính tài khoản theo `sync_seq > con trỏ` (con trỏ `progressCursor` lưu trong meta của kho tài khoản, mỗi lần đọc lùi một khoảng chồng lấn, theo trang), gộp theo `id`; kéo hai lần không sinh trùng; sự kiện kéo về lưu với `userId` = id tài khoản và `syncedAt` đã đặt, nên không bị đẩy lại.
- [ ] Máy mới đăng nhập tài khoản đã có tiến độ trên server: sau lần đồng bộ đầu, XP, streak, mục tiêu ngày, thành tích, chặng và bài học đã học khớp với máy cũ (kiểm bằng hai kho `fake-indexeddb` và client giả; hàm tính hiện có không đổi). Popup thành tích đã ghi nhận trên máy cũ không hiện lại.
- [ ] Máy đã có dữ liệu và server cũng có: gộp theo `id`, không mất và không nhân đôi XP (hai kho offline cùng làm, rồi đồng bộ lần lượt cho cùng kết quả).
- [ ] Offline hoặc server lỗi: ghi vào kho như thường, giữ `syncedAt` rỗng; có mạng lại thì đẩy và kéo; mất mạng giữa chừng không mất hay nhân đôi sự kiện. Server từ chối vì mất quyền hoặc chưa đồng ý: dừng đồng bộ tiến độ, báo trạng thái, không xoá dữ liệu trên máy.
- [ ] Chạy cùng nhịp với đồng bộ Danh bạ (sau đăng nhập, khi có mạng lại, "Đồng bộ ngay"); trạng thái đồng bộ trong Cài đặt có chỗ cho tiến độ (lỗi riêng không che lỗi Danh bạ). Không tạo sự kiện có `xp`.
- [ ] Không đưa secret hay service_role key vào app; mật khẩu và token không vào log.

---

## Implementation Notes

- Theo mẫu `src/data/contact-sync.ts` (`CONTACT_EVENT_TYPES`, `isContactEvent`, `selectEventsToPush`, `syncContacts`, `createContactSyncController`, `pullLowerBound`) và wiring trong `src/app.tsx`. Không sửa hành vi đồng bộ Danh bạ; bộ lọc hai luồng phải loại trừ nhau (unit test chéo).
- Cài đặt thiết bị ở lại trên máy; `reminder`, `sound`, `dailyGoal`, `accountLinked`, `contactSync` không bao giờ lên `personal_events` (registry: `push_device_settings_to_server`, `mix_contact_and_progress_streams`).
- Cần migration của story 031 đã chạy trên server; deploy 031 trước hoặc cùng lúc.
- Test: unit test bộ lọc và test tích hợp hai kho + client giả (`tests/unit/data/progress-sync.test.ts`, `tests/integration/progress-sync.test.ts`). Ở `qa.level: minimal` được miễn, nhưng giữ lại vì đây là chỗ có thể mất hoặc nhân đôi XP.

---

## Out of Scope

- Migration và RLS (story 031).
- Văn bản đồng ý và điều kiện chặn xoá dữ liệu (story 033).
- Đồng bộ cài đặt thiết bị; xem lịch sử tiến độ trên server bằng màn hình riêng.

---

## Files

- `src/data/progress-sync.ts` (new)
- `src/data/contact-sync.ts`, `src/data/event-store.ts`, `src/app.tsx`
- `src/ui/screens/settings-screen.tsx`, `src/ui/strings.ts`
- `tests/unit/data/progress-sync.test.ts`, `tests/integration/progress-sync.test.ts`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: test tích hợp hai kho `fake-indexeddb` + client giả (bỏ qua được ở `qa.level: minimal`, giữ lại vì rủi ro nhân đôi/mất XP) và ảnh chụp trạng thái đồng bộ tiến độ trong Cài đặt.

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-031-personal-events-table.md`
- Unlocks: story 033
