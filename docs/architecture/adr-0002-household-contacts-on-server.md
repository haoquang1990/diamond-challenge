# ADR-0002: Đưa Danh bạ hộ lên server

## Status
Proposed

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

- Bảng `contact_events(id uuid pk = id sự kiện do máy tạo, household_id, author_id → profiles on delete set null, type, occurred_at, schema_version, payload jsonb, created_at)`; `type` giới hạn trong nhóm sự kiện Danh bạ (`person_*`, `activity_logged`, `activity_reassigned`, `person_merged`, `person_not_duplicate`, `person_transferred_out`, và sự kiện bù).
- RLS: `select` khi `is_household_member(household_id)`; `insert` khi là thành viên, `author_id = auth.uid()` và đã có `contact_consents`; **không có** `update` / `delete` cho `authenticated`.
- Bảng `contact_consents(user_id, version, consented_at)`; RPC `record_contact_consent(version)`.
- Đồng bộ: app đẩy sự kiện Danh bạ có `syncedAt` rỗng (`insert … on conflict (id) do nothing`), kéo sự kiện mới theo `created_at`; gộp theo id. Xung đột cùng trường: sự kiện muộn hơn thắng (hàm thuần `derivePeople`).
- Tác giả: `LogEvent.userId` hiện là id ngẫu nhiên của máy. Sau đăng nhập app ghi `settings_changed {accountLinked: {localUserId, accountId}}`; sự kiện có `userId` thuộc tập id đã liên kết là "của mình". Lúc đẩy, `author_id` = tài khoản; sự kiện kéo về lưu với `userId = author_id`.
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
- `contact_events` (PostgREST): `select` theo `household_id` và `created_at > cursor`; `insert` mảng sự kiện.
- RPC: `record_contact_consent(p_version int)`, `has_contact_consent() → boolean`.
- Client (story sau): `syncContacts(store, client, householdId, cursor)`; `isMine(event, linkedIds)`.

### Implementation Guidelines
- App must never đẩy sự kiện Danh bạ khi chưa có consent; server cũng từ chối.
- App must never gửi sự kiện cá nhân lên `contact_events`.
- Mọi giá trị XP/streak must lọc theo `isMine`; Bảng 30x30 must dùng toàn bộ sự kiện hộ.
- Không có đường sửa/xoá sự kiện từ app; sửa = sự kiện mới, hoàn tác = sự kiện bù.
- Khoá service_role must never ở app hay repo.

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
- **Network**: Mỗi lần đồng bộ chỉ gửi sự kiện mới.

## Migration Plan
Bảng và RLS nằm trong migration hộ (ADR-0001). Phía app (story sau): bước đồng ý, đánh dấu sự kiện Danh bạ, đẩy dữ liệu cũ, kéo sự kiện hộ, lọc XP theo `isMine`.

## Validation Criteria
- Test RLS: người ngoài hộ / tuyến trên / tuyến dưới đọc 0 dòng; thành viên đọc đủ; không ghi được sự kiện đứng tên người khác; chưa đồng ý không ghi được; không `update`/`delete` được.
- Test domain (story sau): hai nhật ký offline gộp lại cho cùng kết quả bất kể thứ tự.

## Related
- ADR-0001 (mô hình hộ), ADR-0003 (chuyển liên hệ khi gộp mã)
- `design/gdd/crm.md` luật 16–25, `design/gdd/accounts.md`, `design/game-brief.md`
