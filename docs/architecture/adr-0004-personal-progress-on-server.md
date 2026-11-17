# ADR-0004: Tiến độ cá nhân trên server

## Status
Proposed

## Date
2026-11-17

## Last Verified
2026-11-17

## Decision Makers
Người dùng (chủ dự án), Claude (soạn)

## Summary
XP, streak, thành tích và bài học đã học hiện chỉ nằm trong kho trên máy của từng tài khoản (story 030), nên đổi máy hoặc "Đăng xuất và xoá dữ liệu" là mất. Quyết định: thêm nhật ký cá nhân `personal_events` trên Supabase, chỉ chủ tài khoản đọc/ghi, đồng bộ đẩy/kéo theo `sync_seq` như Danh bạ hộ, gộp với dữ liệu trên máy theo mã sự kiện.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Không có engine — web app React 19 / Vite 8 / TypeScript 6 + IndexedDB; server Supabase |
| **Domain** | Networking (đồng bộ), Core (nhật ký sự kiện) |
| **Layer** | Foundation |
| **Knowledge Risk** | NOT ASSESSED — không có `docs/engine-reference/` cho stack này |
| **References Consulted** | `src/data/event-store.ts` (`EVENT_TYPES`, `LogEvent`), `src/data/contact-sync.ts` (`CONTACT_EVENT_TYPES`, đẩy/kéo theo `sync_seq`), `src/data/account-stores.ts` (kho theo tài khoản, story 030), `supabase/migrations/20261107010000_contact_sync_seq.sql` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | RLS: người khác (kể cả thành viên cùng hộ, tuyến trên, admin qua app) không đọc/ghi được tiến độ của người khác; hai máy offline gộp không mất, không nhân đôi XP; máy mới kéo về đủ XP, streak, thành tích, bài học; xoá tài khoản xoá tiến độ |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (tài khoản, hộ) — Accepted; ADR-0002 (cơ chế đồng bộ `sync_seq`, đồng ý) — Accepted, được sửa bằng amendment |
| **Enables** | None |
| **Blocks** | Story "Đồng bộ tiến độ cá nhân" (chưa viết) |
| **Ordering Note** | Cần story 030 (kho theo tài khoản, đồng ý bắt buộc) đã có trong code — đã xong 2026-11-17 |

## Context

### Problem Statement
Từ story 030 dữ liệu trên máy tách theo tài khoản; Danh bạ đã có trên server nhưng tiến độ cá nhân thì không (ADR-0002: "sự kiện cá nhân không lên server"). Đổi điện thoại, cài lại trình duyệt hay "Đăng xuất và xoá dữ liệu" làm mất XP, streak, thành tích và bài học.

### Constraints
- Chỉ dùng khoá publishable trong app; không secret, không service_role.
- Nhật ký chỉ thêm, không sửa/xoá từ app (giống `contact_events`).
- Đồng ý lưu trên server là bắt buộc (story 030); văn bản phải nói rõ dữ liệu mới được lưu.

### Requirements
- Khôi phục đủ XP, streak, mục tiêu ngày, thành tích, chặng và bài học trên máy mới.
- Chỉ chính người đó đọc/ghi; thành viên cùng hộ và tuyến trên không đọc được.
- Nhiều máy offline cùng lúc: gộp không mất, không nhân đôi.
- Cài đặt riêng của máy (giờ nhắc, bật/tắt nhắc, âm thanh) không lên server.

## Decision

- **Bảng** `personal_events(id uuid pk = id sự kiện do máy tạo, user_id uuid not null default auth.uid() references profiles on delete cascade, type, occurred_at, schema_version, payload jsonb, created_at, sync_seq bigint unique)`.
- **Loại sự kiện được lên server ("tiến độ"):**
  - `lesson_completed`;
  - `activity_logged` **không** có `personId` (hoạt động cá nhân), và sự kiện bù của chúng;
  - `settings_changed` chỉ khi payload là ghi nhận thành tích/chặng: `achievementAcknowledged`, `stageAcknowledged`, `achievementsSeeded`.
  - Server kiểm bằng `check`: `type` trong danh sách trên; `settings_changed` phải có một trong ba khoá đó; `activity_logged` không có `personId`.
- **Ở lại trên máy:** mọi `settings_changed` khác (giờ nhắc, `reminder`, `sound`, `dailyGoal`, `accountLinked`, `contactSync`). Cài đặt thiết bị theo từng máy.
- **RLS:** `select` và `insert` chỉ khi `user_id = auth.uid()` và đã có `contact_consents` với phiên bản hiện hành; không có `update` / `delete` cho `authenticated`. Admin không có đường đọc qua app.
- **`sync_seq`:** sequence riêng `personal_events_sync_seq`, trigger cấp khi insert (giá trị app gửi bị bỏ qua), như ADR-0002.
- **Đồng bộ:** app đẩy sự kiện tiến độ có `syncedAt` rỗng (`insert … on conflict (id) do nothing`), kéo theo `sync_seq > con trỏ` (con trỏ riêng, lưu trong meta của kho tài khoản), gộp theo `id`. Chạy cùng nhịp với đồng bộ Danh bạ (sau đăng nhập, khi có mạng lại, "Đồng bộ ngay").
- **"Của mình":** sự kiện kéo về từ `personal_events` luôn là của mình (cùng `user_id`); lưu với `userId` = id tài khoản. Hàm tính XP/streak hiện có không đổi.
- **Máy đã có dữ liệu + server có dữ liệu:** gộp cả hai theo mã sự kiện (đẩy phần chưa đồng bộ, kéo phần còn thiếu). Kho cũ của máy (story 030) sau khi chép vào tài khoản được đẩy lên như sự kiện chưa đồng bộ.
- **Đồng ý:** thêm vào thông báo một dòng "Tiến độ học và XP của bạn cũng được lưu trên máy chủ, chỉ bạn xem được"; tăng `contactConsentVersion` → người đã đồng ý được hỏi lại một lần (cơ chế có sẵn từ story 030).
- **"Đăng xuất và xoá dữ liệu":** chặn khi còn sự kiện Danh bạ **hoặc** tiến độ chưa đồng bộ; cảnh báo đổi thành "dữ liệu chưa đồng bộ sẽ mất" vì tiến độ đã đồng bộ được khôi phục khi đăng nhập lại.
- **Xoá tài khoản:** `on delete cascade` xoá tiến độ (đúng `accounts.md` luật 12).

### Architecture Diagram
```
 Máy (kho diamond-challenge:<accountId>)
   ├─ sự kiện Danh bạ ──push/pull──► contact_events (theo hộ, ADR-0002)
   ├─ sự kiện tiến độ ──push/pull──► personal_events (theo user_id, ADR-0004)
   └─ cài đặt thiết bị (giờ nhắc, âm thanh) — chỉ trên máy
```

### Key Interfaces
- `PERSONAL_EVENT_TYPES` + hàm thuần `isPersonalProgressEvent(event)` trong `src/data/progress-sync.ts` (bộ lọc duy nhất cho cả đẩy và chặn xoá).
- Bảng `public.personal_events`, sequence `personal_events_sync_seq`, trigger cấp `sync_seq`.
- Con trỏ kéo: meta `progressCursor` trong kho tài khoản.

### Implementation Guidelines
- App must never đẩy sự kiện tiến độ trước khi tài khoản đồng ý phiên bản hiện hành.
- App must never đẩy cài đặt thiết bị (`reminder`, `sound`, `dailyGoal`, `accountLinked`, `contactSync`) hay sự kiện Danh bạ vào `personal_events`.
- App must never sửa/xoá dòng `personal_events`; hoàn tác là sự kiện bù.
- Một sự kiện chỉ thuộc một trong hai luồng: có `personId` (hoặc là sự kiện `person_*`) → Danh bạ; còn lại theo bộ lọc tiến độ → `personal_events`.
- Không dùng `created_at` làm con trỏ; dùng `sync_seq`.

## Alternatives Considered

### Alternative 1: Bản tổng hợp tiến độ
- **Description**: một dòng `personal_progress(user_id, xp, streak, achievements[], lessons[])`, máy ghi sau thì đè.
- **Pros**: đơn giản, ít dữ liệu.
- **Cons**: mất lịch sử từng ngày (streak, mục tiêu ngày cần ngày cụ thể); hai máy ghi đè nhau làm mất tiến độ.
- **Rejection Reason**: không gộp được nhiều máy và không tái tạo được streak.

### Alternative 2: Sao lưu cả file lên Supabase Storage
- **Description**: đẩy file JSON nhật ký (như "Xuất sao lưu") lên Storage theo tài khoản; máy mới khôi phục.
- **Pros**: tái dùng định dạng sao lưu sẵn có.
- **Cons**: thay cả file mỗi lần; hai máy ghi đè; file chứa cả Danh bạ (trùng với `contact_events`).
- **Rejection Reason**: không gộp được, dễ mất dữ liệu khi dùng hai máy.

## Consequences

### Positive
- Đổi máy, xoá dữ liệu trên máy hay cài lại trình duyệt không mất tiến độ.
- Tái dùng mô hình đồng bộ đã kiểm (append-only, `sync_seq`, gộp theo id).

### Negative
- Thêm một bảng, một sequence, một bộ đồng bộ; tốn dung lượng server theo số sự kiện.
- Người đã đồng ý phải bấm đồng ý lại một lần.
- Ghi nhận thành tích đã đồng bộ nên máy mới không hiện lại popup cũ.

## Risks
- **Phân loại nhầm sự kiện** (một sự kiện Danh bạ lọt vào `personal_events` hoặc ngược lại): một bộ lọc thuần duy nhất có unit test; server `check` chặn `activity_logged` có `personId`.
- **Nhân đôi XP khi gộp:** gộp theo `id`, `on conflict (id) do nothing`; test hai máy offline.
- **Kho cũ được chép cho tài khoản rồi đẩy lên:** chỉ tài khoản nhận kho cũ (story 030) đẩy phần tiến độ đó; có test.
- **Lượng sự kiện lớn:** kéo theo trang (`limit`) như Danh bạ.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| accounts.md | Luật 4: XP, streak, thành tích, bài học tính theo người | Lưu theo `user_id`, chỉ người đó đọc; cách tính không đổi |
| accounts.md | Luật 12: xoá tài khoản xoá dữ liệu cá nhân | `on delete cascade` |
| crm.md | Luật 16: sự kiện cá nhân ở lại trên máy | **Thay đổi:** sự kiện tiến độ lên `personal_events`; cài đặt thiết bị vẫn ở lại máy |
| crm.md | Luật 18: đồng ý trước khi lưu trên server | Văn bản thêm tiến độ; tăng phiên bản, hỏi lại một lần |

## Performance Implications
- **CPU**: lọc thêm một lần mỗi lượt đồng bộ; không đáng kể.
- **Memory**: không đổi (sự kiện đã nằm trong kho).
- **Load Time**: lần đầu trên máy mới kéo toàn bộ tiến độ (vài trăm đến vài nghìn sự kiện) theo trang.
- **Network**: tương đương đồng bộ Danh bạ; chạy cùng nhịp.

## Migration Plan
1. Migration mới: bảng, sequence, trigger, RLS, `check`.
2. App: `progress-sync.ts` (lọc, đẩy, kéo), chạy cùng nhịp với `contact-sync`.
3. Lần đầu sau cập nhật: mọi sự kiện tiến độ trên máy (kể cả kho cũ đã chép ở story 030) có `syncedAt` rỗng nên được đẩy lên.
4. Tăng `contactConsentVersion`, cập nhật văn bản đồng ý.
5. Sửa điều kiện chặn "Đăng xuất và xoá dữ liệu" và câu cảnh báo.
6. Sửa `crm.md` luật 16, `accounts.md` luật 4; amendment ADR-0002.

## Validation Criteria
- Test RLS (PGlite): người khác, thành viên cùng hộ, tuyến trên không đọc/ghi được; chưa đồng ý phiên bản hiện hành thì không ghi được; `check` chặn sự kiện Danh bạ và cài đặt thiết bị.
- Unit test bộ lọc tiến độ.
- Thử trên bản build: máy A học bài và lên XP → máy B (trình duyệt khác) đăng nhập cùng tài khoản thấy đủ XP, streak, thành tích, bài học; "Đăng xuất và xoá dữ liệu" rồi đăng nhập lại thấy lại tiến độ.

## Related
- ADR-0002 (Danh bạ hộ trên server) — sửa bằng amendment: dòng "Sự kiện cá nhân … không lên server" thu hẹp lại thành "cài đặt thiết bị không lên server; sự kiện tiến độ theo ADR-0004".
- ADR-0001 (mô hình hộ, tài khoản)
- `design/gdd/accounts.md` luật 4, 12; `design/gdd/crm.md` luật 16, 18
- `production/epics/diamond-challenge/story-030-require-login.md`
