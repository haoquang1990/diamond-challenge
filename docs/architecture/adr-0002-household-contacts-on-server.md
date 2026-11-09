# ADR-0002: Đưa Danh bạ hộ lên server

## Status
Accepted

## Date
2026-11-07

## Last Verified
2026-11-07

## Decision Makers
Người dùng (chủ dự án) + Claude

## Summary
Vợ chồng trong một hộ cần cùng một Danh bạ trên hai điện thoại, trong khi giai đoạn 1 giữ Danh bạ chỉ trên máy. Quyết định: lưu các sự kiện về người của hộ trong bảng chỉ-thêm `contact_events` trên Supabase (Singapore), chỉ thành viên hộ đọc/ghi qua RLS, app vẫn chạy offline và đồng bộ bằng chính nhật ký sự kiện.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Không có engine — web app React 19 / Vite 8 / TypeScript 6 + IndexedDB; server Supabase |
| **Domain** | Networking (đồng bộ), Core (nhật ký sự kiện) |
| **Layer** | Foundation |
| **Knowledge Risk** | NOT ASSESSED — không có `docs/engine-reference/` cho stack này |
| **References Consulted** | `src/data/event-store.ts` (`LogEvent`, `userId`, `syncedAt`), `design/gdd/crm.md` luật 16–25 |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | RLS: người ngoài hộ, tuyến trên, tuyến dưới không đọc được; người chưa đồng ý không ghi được; hai máy offline gộp không mất sự kiện |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (cần `households`, `household_members`) |
| **Enables** | ADR-0003 |
| **Blocks** | Story đồng bộ Danh bạ, màn đồng ý, màn kiểm tra liên hệ trùng |
| **Ordering Note** | Bảng có trong migration hộ; code đồng bộ phía app là story riêng |

## Context

### Problem Statement
Quyết định C: Danh bạ (tên, SĐT, mã, ghi chú, nhãn, việc, lịch sử) dùng chung trong hộ. Brief và crm.md giai đoạn 1 ghi "lưu trên máy"; đây là đảo ngược có chủ ý về quyền riêng tư, cần ghi lý do, rủi ro và biện pháp.

### Constraints
- Nhật ký sự kiện chỉ-thêm là mô hình dữ liệu đã có (story 001); mọi giá trị là hàm thuần trên nhật ký.
- App phải dùng được offline.
- Server ở Singapore (vùng đã chọn ở story 019).

### Requirements
- Chỉ thành viên hộ đọc/ghi; tuyến trên, tuyến dưới, người khác không đọc được.
- Hai người sửa cùng lúc không mất dữ liệu; biết ai làm; XP cho người làm.
- Không gửi gì trước khi người dùng đồng ý.
- Rời hộ mất quyền ngay; xoá tài khoản xoá dữ liệu cá nhân.

## Decision

- Bảng `contact_events(id uuid pk = id sự kiện do máy tạo, household_id, author_id → profiles on delete set null, type, occurred_at, schema_version, payload jsonb, created_at, sync_seq bigint unique)`; `type` giới hạn trong nhóm sự kiện Danh bạ (`person_*`, `activity_logged`, `activity_reassigned`, `person_merged`, `person_not_duplicate`, `person_transferred_out`, và sự kiện bù).
- RLS: `select` khi `is_household_member(household_id)`; `insert` khi là thành viên, `author_id = auth.uid()` và đã có `contact_consents`; **không có** `update` / `delete` cho `authenticated`.
- Bảng `contact_consents(user_id, version, consented_at)`; RPC `record_contact_consent(version)`.
- Đồng bộ: app đẩy sự kiện Danh bạ có `syncedAt` rỗng (`insert … on conflict (id) do nothing`), kéo sự kiện của hộ theo **`sync_seq > con trỏ`**; gộp theo id. Xung đột cùng trường: sự kiện muộn hơn thắng theo `occurred_at` (hàm thuần `derivePeople`).
- **`sync_seq`** (sửa 2026-11-07, theo `docs/architecture/architecture-review-2026-11-07.md`): số lấy từ sequence `contact_events_sync_seq`, do trigger cấp khi insert **và mỗi khi `household_id` đổi** (gộp mã, hoàn tác, admin gán Chờ gán tuyến trên). Giá trị app gửi bị bỏ qua; sequence không mở cho vai trò của app. `created_at` chỉ còn để tra cứu, không dùng làm con trỏ: một dòng đổi hộ giữ `created_at` cũ nên máy đã đồng bộ sẽ bỏ sót.
- Tác giả: `LogEvent.userId` hiện là id ngẫu nhiên của máy. Sau đăng nhập app ghi `settings_changed {accountLinked: {localUserId, accountId}}`. Lúc đẩy, `author_id` = tài khoản; sự kiện kéo về lưu với `userId = author_id` (`former-member` khi tác giả đã xoá). **"Của mình" (sửa 2026-11-07, story 023):** một sự kiện là của mình **trừ khi** `userId` là `former-member` hoặc là id tài khoản của thành viên khác trong hộ (danh sách id thành viên lấy lần đồng bộ gần nhất, lưu trên máy). Nhờ vậy file sao lưu từ máy cũ chưa từng đăng nhập vẫn giữ XP.
- Đồng ý theo máy: chỉ đồng bộ khi server đã có đồng ý **và** lựa chọn gần nhất trên máy (`settings_changed {contactSync: {enabled}}`) không phải `false`; bấm "Không đồng ý" trên máy nào thì máy đó không đồng bộ, kể cả khi tài khoản đã đồng ý ở máy khác.
- Sự kiện cá nhân (bài học, hoạt động không gắn người, cài đặt, ghi nhận thành tích) không lên server.
- Rời hộ / xoá tài khoản: quyền theo `household_members.left_at`; xoá profile đặt `author_id = null` ("Thành viên cũ"); hộ giải thể thì xoá `contact_events` của hộ.

### Architecture Diagram
```
máy Lan (IndexedDB) ──push syncedAt=null──► contact_events (household H) ◄──push── máy Minh
        ▲                                          │ RLS: member of H only
        └────────────pull since cursor─────────────┘
derivePeople(all H events) → Danh bạ hộ;  computeProgress(events where userId ∈ mine) → XP của mình
```

### Key Interfaces
- `contact_events` (PostgREST): `select` theo `household_id` và `sync_seq > cursor` (sắp tăng dần theo `sync_seq`); `insert` mảng sự kiện (không gửi `sync_seq`).
- RPC: `record_contact_consent(p_version int)`, `has_contact_consent() → boolean`.
- Client (story sau): `syncContacts(store, client, householdId, cursor)`; `isMine(event, linkedIds)`.

### Implementation Guidelines
- App must never đẩy sự kiện Danh bạ khi chưa có consent; server cũng từ chối.
- App must never gửi sự kiện cá nhân lên `contact_events`.
- Mọi giá trị XP/streak must lọc theo `isMine`; Bảng 30x30 must dùng toàn bộ sự kiện hộ.
- Không có đường sửa/xoá sự kiện từ app; sửa = sự kiện mới, hoàn tác = sự kiện bù.
- Khoá service_role must never ở app hay repo.
- Con trỏ đồng bộ must là `sync_seq` lớn nhất đã nhận; must never dùng `created_at`. Mỗi lần kéo must đọc lùi một khoảng chồng lấn (ví dụ `sync_seq > cursor - 200`) rồi gộp theo `id`, vì hai giao dịch có thể commit không theo thứ tự số (một dòng số nhỏ commit sau dòng số lớn).
- `occurred_at` của sự kiện mới must lớn hơn mọi `occurred_at` đã thấy trong nhật ký hộ trên máy (`max(giờ máy, lớn nhất đã thấy + 1 ms)`), để máy chạy chậm giờ không làm sửa của mình thua sửa cũ hơn — **chỉ khi** giá trị lớn nhất đã thấy không vượt giờ máy quá `contactSync.maxClockSkewMs` (10 phút); vượt quá thì coi máy kia sai giờ và dùng giờ máy mình. Lý do (story 023): nâng không giới hạn làm một sự kiện năm 2030 kéo mọi việc sau đó của cả hộ sang 2030, hỏng XP, streak và mục tiêu ngày hôm nay.

## Alternatives Considered

### Alternative 1: Giữ trên máy, đồng bộ trực tiếp hai máy (P2P / file)
- **Description**: Hai máy trao đổi file sao lưu hoặc kết nối trực tiếp.
- **Pros**: Server không có tên khách.
- **Cons**: Không tự đồng bộ; hai máy phải cùng lúc trực tuyến; dễ lệch.
- **Rejection Reason**: Không đạt "dùng chung" hằng ngày.

### Alternative 2: Mã hoá đầu-cuối (khoá hộ trên máy, server chỉ giữ bản mã)
- **Description**: Payload mã hoá bằng khoá chia sẻ giữa thành viên.
- **Pros**: Server và admin không đọc được Danh bạ.
- **Cons**: Gộp mã (ADR-0003) cần server đọc mã số liên hệ; quản lý khoá khi đổi máy/quên mật khẩu; mất khoá = mất dữ liệu.
- **Rejection Reason**: Phức tạp quá mức giai đoạn này và chặn ADR-0003. Có thể xem lại sau.

### Alternative 3: Bảng quan hệ (`contacts`, `activities`) thay vì nhật ký
- **Description**: Lưu trạng thái hiện tại, cập nhật dòng.
- **Pros**: Truy vấn server dễ.
- **Cons**: Hai người sửa cùng lúc đè nhau; mất lịch sử; phải viết lại toàn bộ domain.
- **Rejection Reason**: Trái mô hình nhật ký đã có.

## Consequences

### Positive
- Dùng lại nguyên domain hiện có (hàm thuần trên nhật ký); offline tự nhiên.
- Không mất dữ liệu khi sửa đồng thời; biết ai làm gì.

### Negative
- Tên, SĐT, ghi chú về người khác nằm trên server; admin dự án (qua Dashboard) đọc được.
- Nhật ký hộ lớn dần; tải lần đầu chậm hơn với hộ nhiều sự kiện.

## Risks
- **Lộ Danh bạ qua lỗi RLS:** test RLS bắt buộc trong CI (fail khi tắt RLS); không cấp `update/delete`; không cấp gì cho `anon`.
- **Tranh chấp khi vợ chồng chia tay:** rời hộ mất quyền ngay, được xuất file trước; dữ liệu ở lại với hộ.
- **Mất máy:** đổi mật khẩu (admin đặt lại) thu phiên; dữ liệu trên server không mất.
- **Admin dự án đọc được Danh bạ:** ghi rõ trong thông báo đồng ý; giới hạn người có quyền Dashboard.
- **Phiên bản app cũ gửi sự kiện sai dạng:** `type` giới hạn bằng check; payload kiểm khi đọc bằng `parseStoredEvent`.
- **Giờ máy sai trong luật "sửa muộn hơn thắng":** thứ tự sửa cùng trường dựa trên `occurred_at` do máy ghi. Máy chạy **nhanh** giờ (ví dụ đặt sai năm) sẽ thắng mọi sửa thật sự mới hơn cho tới khi đồng hồ thật vượt qua; máy chạy **chậm** giờ luôn thua. Biện pháp: app ghi `occurred_at` lớn hơn mọi giá trị đã thấy trong hộ (giới hạn ảnh hưởng của máy chậm, và sau khi kéo về một sự kiện "tương lai" thì sửa kế tiếp vẫn thắng nó). Chưa làm: server chặn `occurred_at` xa hơn hiện tại quá 24 giờ; lịch sử luôn hiện cả hai sửa để người dùng sửa lại được.
- **Commit không theo thứ tự `sync_seq`:** một dòng có số nhỏ commit sau khi máy đã kéo dòng số lớn hơn thì bị bỏ sót nếu chỉ kéo `> cursor`. Biện pháp: đọc lùi khoảng chồng lấn (Implementation Guidelines); gộp theo `id` nên kéo trùng không hại.
- **Xoá dòng trên server không đi tới máy:** kéo theo `sync_seq` chỉ thấy dòng mới hoặc dòng đổi hộ. Ở 2a app không xoá sự kiện; hàm hoàn tác gộp mã (ADR-0003, 2b) có xoá và phải được thiết kế lại trước khi mở.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| crm.md | Luật 16: Danh bạ hộ trên server, chỉ thành viên đọc/ghi | `contact_events` + RLS thành viên |
| crm.md | Luật 17: offline, gộp theo sự kiện, ai làm, XP cho người làm | id sự kiện từ máy, `on conflict do nothing`, `author_id`, `isMine` |
| crm.md | Luật 18: đồng ý trước khi đẩy | `contact_consents`, chặn insert khi chưa đồng ý |
| crm.md | Luật 25: sao lưu bằng file vẫn giữ; xuất trước khi rời hộ | không đổi định dạng file |
| accounts.md | Luật 4: XP theo người, chỉ trên máy | sự kiện cá nhân không lên server; lọc `isMine` |
| accounts.md | Luật 11–12: rời hộ, xoá tài khoản | quyền theo `left_at`; `author_id on delete set null` |

## Performance Implications
- **CPU**: `derivePeople` duyệt toàn bộ nhật ký hộ như hiện nay.
- **Memory**: Nhật ký hộ trên máy ≈ tổng nhật ký của các thành viên.
- **Load Time**: Lần đầu kéo toàn bộ nhật ký hộ; sau đó theo cursor.
- **Network**: Mỗi lần đồng bộ chỉ gửi sự kiện mới; kéo thêm một khoảng chồng lấn nhỏ.

## Migration Plan
Bảng và RLS nằm trong migration hộ (ADR-0001); cột `sync_seq`, sequence và trigger trong `supabase/migrations/20261107010000_contact_sync_seq.sql` (đánh số dòng sẵn có theo thứ tự `created_at`). Phía app (story sau): bước đồng ý, đánh dấu sự kiện Danh bạ, đẩy dữ liệu cũ, kéo sự kiện hộ, lọc XP theo `isMine`.

## Validation Criteria
- Test RLS: người ngoài hộ / tuyến trên / tuyến dưới đọc 0 dòng; thành viên đọc đủ; không ghi được sự kiện đứng tên người khác; chưa đồng ý không ghi được; không `update`/`delete` được.
- Test đồng bộ `tests/integration/supabase/contact-sync-seq.test.ts`: đánh số dữ liệu cũ, số mới khi insert, bỏ qua số app gửi, không đổi khi không đổi hộ, dòng đổi hộ (gộp, hoàn tác, gán) tới được con trỏ `sync_seq` trong khi con trỏ `created_at` bỏ sót.
- Test domain (story 023): hai nhật ký offline gộp lại cho cùng kết quả bất kể thứ tự.

## Amendments
- 2026-11-07: con trỏ đồng bộ đổi từ `created_at` sang `sync_seq` (xung đột ADR-0002/ADR-0003 trong `docs/architecture/architecture-review-2026-11-07.md`); thêm rủi ro giờ máy sai, commit không theo thứ tự, xoá không đồng bộ. Trả về Proposed để duyệt lại; chấp nhận lại cùng ngày sau khi người dùng đọc bản sửa.

- 2026-11-07 (story 023, người dùng chọn): giới hạn nâng `occurred_at` trong 10 phút lệch giờ; "của mình" đảo thành "mọi thứ trừ sự kiện của thành viên khác"; lựa chọn "Không đồng ý" trên máy thắng đồng ý của tài khoản.

## Related
- ADR-0001 (mô hình hộ), ADR-0003 (chuyển liên hệ khi gộp mã)
- `design/gdd/crm.md` luật 16–25, `design/gdd/accounts.md`, `design/game-brief.md`
