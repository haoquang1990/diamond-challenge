# ADR-0003: Chuyển liên hệ giữa các hộ khi gộp hai mã số

## Status
Proposed

> **Hoãn sang giai đoạn 2b** (quyết định 2026-11-07, tập trung 30x30). Các hàm đã có trên database nhưng bị khoá (`20261107010000_contact_sync_seq.sql` thu quyền gọi của `authenticated`). Khi làm 2b: **phải dùng `sync_seq`** (ADR-0002) để máy hộ nhận kéo được liên hệ chuyển đến (trigger đã cấp số khi `household_id` đổi), và **phải thiết kế lại việc hoàn tác xoá dòng "Đã chuyển"**: việc xoá không đi tới máy đã kéo dòng đó về (cần sự kiện bù thay vì xoá).

## Date
2026-11-07

## Last Verified
2026-11-07

## Decision Makers
Người dùng (chủ dự án) + Claude

## Summary
Khi vợ chồng có hai mã gộp thành một hộ, mã Y bị huỷ và những người đã có mã dưới Y chuyển lên tuyến trên S2, kèm Danh bạ của họ; quyền đọc phải đi theo. Quyết định: một hàm SQL giao dịch `merge_codes` chuyển `household_id` của sự kiện liên hệ sang S2, để lại sự kiện `person_transferred_out` (chỉ tên) cho hộ X, lưu bản ghi `code_merges` đủ để `undo_code_merge` trả lại.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Không có engine — Supabase Postgres (hàm `security definer`) |
| **Domain** | Core (dữ liệu server) |
| **Layer** | Feature |
| **Knowledge Risk** | NOT ASSESSED — không có `docs/engine-reference/` cho stack này |
| **References Consulted** | `design/gdd/accounts.md` luật 19–23, `design/gdd/crm.md` luật 24 |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | Sau gộp: S2 đọc được liên hệ chuyển, X chỉ thấy dòng "Đã chuyển"; hoàn tác trả nguyên trạng |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001, ADR-0002 |
| **Enables** | None |
| **Blocks** | Story màn gộp mã và danh sách Chờ gán tuyến trên |
| **Ordering Note** | Hàm có trong migration hộ để kiểm thử cùng RLS |

## Context

### Problem Statement
Quyết định E: khi mã Y bị huỷ, Amway chuyển tuyến dưới có mã của Y lên tuyến trên của Y (S2). Trong app, Danh bạ của những người đó phải sang S2 (S2 thấy), hộ X không còn thấy chi tiết, người chưa có mã ở lại với X. XP đã nhận không đổi. Phải hoàn tác được.

### Constraints
- Nhật ký chỉ-thêm; RLS của `contact_events` theo `household_id` (ADR-0002).
- Gộp phải là một giao dịch: hoặc xong hết, hoặc không có gì.
- Chỉ admin, hoặc thành viên hộ bảo trợ của hộ giữ mã.

### Requirements
- Xem trước không ghi gì; chạy phải xác nhận.
- S2 không có → "Chờ gán tuyến trên", không ai ngoài admin thấy.
- Hoàn tác một lần, từ chối nếu mã Y đã bị hộ khác dùng.

## Decision

- `preview_code_merge(keep, drop) → jsonb` (chỉ đọc): số liên hệ có mã sẽ chuyển, số hộ F1 đổi bảo trợ, số liên hệ ở lại, S2.
- `merge_codes(keep, drop) → merge_id`, một giao dịch:
  1. Kiểm quyền, trạng thái hai hộ, giới hạn thành viên.
  2. Liên hệ "có mã" trong hộ HY = `personId` có `amwayCode` khác rỗng ở sự kiện `person_added`/`person_updated` mới nhất. Sự kiện của liên hệ = sự kiện có `payload.personId` là liên hệ đó, cộng sự kiện bù trỏ tới chúng.
  3. Có S2 khác HX: `update contact_events set household_id = S2` cho các sự kiện đó; chèn `person_transferred_out {personId, name}` vào HX (tác giả rỗng). S2 = HX: chuyển vào HX, không có dòng "Đã chuyển". Không có S2: `household_id = null` và thêm dòng `pending_upline`.
  4. Các sự kiện còn lại của HY → HX.
  5. Thành viên HY rời HY, vào HX; HY → `merged`; mã Y → `cancelled`; hộ F1 của HY → bảo trợ S2 (hoặc `pending_upline` nếu không có S2).
  6. `household_aggregates.needs_recount = true` cho HX và S2.
  7. `code_merges.snapshot` lưu: id sự kiện đã chuyển và hộ cũ, id sự kiện "Đã chuyển" đã chèn, thành viên, bảo trợ cũ của các hộ F1, id mã Y.
- `undo_code_merge(merge_id)` (admin): đảo từng bước từ snapshot; sự kiện mới S2 ghi cho liên hệ được chuyển đi về HY cùng liên hệ; đánh dấu `undone_at`.
- `assign_pending_upline(pending_id, household)` (admin): chuyển sự kiện / đặt bảo trợ, đánh dấu `assigned`.
- Máy của hộ X xoá chi tiết liên hệ khi nhận `person_transferred_out` (bản trên máy là bộ đệm của server).

### Architecture Diagram
```
HY book ──(personId with amwayCode)──► S2 book      (household_id := S2)
   │                                   HX book gets person_transferred_out {personId, name}
   └──(no code)──────────────────────► HX book      (household_id := HX) → dò trùng (crm.md)
HY F1 households: sponsor := S2       code Y: cancelled      code_merges.snapshot → undo
```

### Key Interfaces
- RPC (authenticated, kiểm quyền bên trong): `preview_code_merge(uuid, uuid)`, `merge_codes(uuid, uuid)`, `undo_code_merge(uuid)` (admin), `assign_pending_upline(uuid, uuid)` (admin).
- Sự kiện mới: `person_transferred_out {personId, name}`.

### Implementation Guidelines
- Chỉ các hàm này được đổi `contact_events.household_id`; app must never có đường làm việc đó.
- Hàm must chạy trong một giao dịch và must từ chối toàn bộ khi một bước lỗi.
- Không sự kiện nào được sửa `payload` hay `author_id`; chỉ đổi `household_id`.
- `person_transferred_out` must chỉ chứa `personId` và `name`.

## Alternatives Considered

### Alternative 1: Sao chép sự kiện sang S2, xoá ở HY
- **Description**: Chèn bản sao với id mới vào S2.
- **Pros**: Mỗi dòng không bao giờ đổi `household_id`.
- **Cons**: Đổi id sự kiện làm hỏng tham chiếu `compensates`; hoàn tác khó; trùng khi máy cũ đẩy lại.
- **Rejection Reason**: Phá tính ổn định của id.

### Alternative 2: Chia sẻ đọc (S2 được quyền đọc một phần Danh bạ HY)
- **Description**: Bảng cấp quyền từng liên hệ cho hộ khác.
- **Pros**: Không di chuyển dữ liệu.
- **Cons**: RLS phức tạp; X vẫn còn chi tiết; trái yêu cầu "chuyển sang S2".
- **Rejection Reason**: Không đúng nghiệp vụ.

## Consequences

### Positive
- Một nơi duy nhất đổi quyền sở hữu liên hệ; RLS hiện có tự đúng sau khi đổi `household_id`.
- Hoàn tác được nhờ snapshot.

### Negative
- `contact_events` không hoàn toàn bất biến: `household_id` đổi được (chỉ qua các hàm này).
- File sao lưu cũ của X vẫn còn chi tiết người đã chuyển (ngoài tầm server).

## Risks
- **Nhận diện "có mã" sai** (mã bị xoá rồi thêm lại, liên hệ đã gộp): dùng sự kiện mới nhất; màn xem trước hiện danh sách tên để người làm kiểm tra.
- **Hoàn tác sau nhiều thay đổi**: từ chối nếu mã Y bị dùng lại hoặc thành viên đã rời HX; ghi rõ trong thông báo.
- **Hoàn tác xoá `person_transferred_out`** (phát hiện khi sửa ADR-0002): máy hộ X đã kéo dòng "Đã chuyển" vẫn giữ nó sau hoàn tác, vì xoá không có `sync_seq` mới. Phải đổi sang sự kiện bù trước khi mở ở 2b.
- **Máy X offline lâu**: chi tiết còn trên máy tới lần đồng bộ; server đã thu quyền nên không đẩy ngược lên được (insert vào HX với personId đã chuyển vẫn được — app phải bỏ qua sự kiện cho liên hệ đã "Đã chuyển").

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| accounts.md | Luật 20: xem trước | `preview_code_merge` |
| accounts.md | Luật 21: chuyển liên hệ có mã, hộ F1, mã huỷ, Chờ gán tuyến trên | `merge_codes` bước 1–5, `pending_upline` |
| accounts.md | Luật 22: tính lại 30x30 và 4x4 | `needs_recount`; 4x4 tính khi đọc |
| accounts.md | Luật 23: admin hoàn tác | `undo_code_merge` + `code_merges.snapshot` |
| crm.md | Luật 24: dòng "Đã chuyển lên tuyến trên" | `person_transferred_out` |

## Performance Implications
- **CPU**: Một lần quét sự kiện của HY mỗi lần gộp; hiếm.
- **Memory**: Snapshot tỉ lệ với số sự kiện chuyển.
- **Load Time**: Không.
- **Network**: Máy S2 kéo các sự kiện được chuyển ở lần đồng bộ kế tiếp, nhờ `sync_seq` mới cấp khi `household_id` đổi.

## Migration Plan
Hàm và bảng `code_merges`, `pending_upline` nằm trong migration hộ. Màn gộp mã là story sau.

## Validation Criteria
- Test: sau gộp S2 đọc được liên hệ chuyển kèm lịch sử, X chỉ đọc được `person_transferred_out`, hộ F1 của HY có bảo trợ S2, mã Y huỷ; không có S2 thì không ai ngoài admin đọc; hoàn tác trả nguyên trạng và lần hai bị từ chối; người không có quyền gọi `merge_codes` bị từ chối.

## Related
- ADR-0001, ADR-0002; `design/gdd/accounts.md` luật 19–23; `design/gdd/crm.md` luật 24
