# ADR-0001: Mô hình Hộ kinh doanh (người, hộ, mã số Amway, bảo trợ theo hộ)

## Status
Accepted

## Date
2026-11-07

## Last Verified
2026-11-07

## Decision Makers
Người dùng (chủ dự án) + Claude

## Summary
Vợ chồng dùng chung một mã số Amway nhưng mỗi người có tài khoản và tiến độ riêng, trong khi story 019 gắn bảo trợ vào từng người. Quyết định: tách **người** (`profiles`) khỏi **hộ** (`households`, `household_members`, `household_codes`); cây bảo trợ, mã số và số liệu 30x30 thuộc hộ; XP, streak và thành tích thuộc người.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Không có engine — web app React 19 / Vite 8 / TypeScript 6; server Supabase (Postgres, Auth, Edge Functions) |
| **Domain** | Core (dữ liệu tài khoản, Networking phía server) |
| **Layer** | Foundation |
| **Knowledge Risk** | NOT ASSESSED — không có `docs/engine-reference/` cho stack này |
| **References Consulted** | `supabase/migrations/20261106000000_accounts.sql`, Supabase CLI 3.0.0 `--help` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | Migration chuyển đổi chạy được trên database đang có admin thật; RLS kiểm bằng PGlite và bằng gọi thử với khoá công khai |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | None (story 019 không có ADR) |
| **Enables** | ADR-0002, ADR-0003 |
| **Blocks** | Story migration hộ; mọi story giao diện giai đoạn 2 (đăng nhập, tạo tài khoản, thêm vợ/chồng, cây và 4x4) |
| **Ordering Note** | Migration hộ phải chạy trước migration Danh bạ hộ (ADR-0002) vì `contact_events` tham chiếu `households` |

## Context

### Problem Statement
Story 019 có `profiles.sponsor_id` (bảo trợ theo người). Quyết định A, B ngày 2026-11-07: hai người một mã, 30x30 và 4x4 theo hộ, mã số duy nhất trong các hộ đang hoạt động. Phải đổi trước khi làm giao diện, vì mọi màn giai đoạn 2 dựa trên đơn vị này.

### Constraints
- Database đang chạy thật và có một admin (`+84948161365`); không được mất.
- Không lưu khoá service_role trong repo; hàm cần quyền cao chạy bằng `security definer` hoặc Edge Function.
- Hộ một người phải chạy như hiện tại.

### Requirements
- Một người thuộc đúng một hộ đang hoạt động; hộ có tối đa `max_household_members` (2) người.
- Mỗi hộ tối đa một mã đang hoạt động; mã đang hoạt động duy nhất toàn hệ thống; mã huỷ giữ lại kèm ngày.
- Chặn vòng bảo trợ giữa các hộ.
- Tuyến trên đọc hộ, mã của hộ, tên + SĐT thành viên, số tổng hợp; không gì khác.

## Decision

- `profiles(id → auth.users, phone, display_name, role, must_change_password, created_by, created_at)`: **bỏ** `sponsor_id`.
- `households(id, sponsor_household_id → households, status active|merged|dissolved, created_by, created_at)` với trigger chặn vòng (đi ngược lên từ hộ bảo trợ).
- `household_members(id, household_id, user_id, joined_at, left_at)`: index duy nhất `user_id where left_at is null`; trigger giới hạn số thành viên đọc `app_config.max_household_members`.
- `household_codes(id, household_id, code, status active|cancelled, cancelled_at, cancel_reason)`: index duy nhất `code where status='active'` và `household_id where status='active'`.
- `household_aggregates(household_id, customers, f1, contacts, achieved_30x30, pending_duplicates, needs_recount, updated_at, updated_by)` thay `aggregates`.
- Hàm quyền: `current_household()`, `is_household_member(h)`, `is_self_or_downline_household(h)`, `can_view_household(h) = is_admin() or is_self_or_downline_household(h)`.
- Mọi thay đổi hộ/mã/bảo trợ qua hàm SQL `security definer` (admin hoặc đúng vai trò); tạo tài khoản qua Edge Function gọi `provision_*` (chỉ `service_role` chạy được).

### Architecture Diagram
```
auth.users 1─1 profiles ──┐
                          │ household_members (left_at null: ≤1 per user, ≤2 per household)
households ◄──────────────┘
   │ sponsor_household_id (tree, no cycles)
   ├── household_codes (≤1 active per household, active code unique)
   └── household_aggregates (members write, household + upline read)
```

### Key Interfaces
- RPC (authenticated): `mark_password_changed()`, `set_display_name(text)`, `leave_household()`, `set_household_sponsor(h, sponsor)` (admin), `set_household_code(h, code)` (admin), `cancel_household_code(h, reason)` (admin).
- RPC (service_role, gọi từ Edge Function): `provision_household(new_user, phone, sponsor_household, code, created_by)`, `provision_member(new_user, phone, household, created_by)`.
- Edge Function: `create-f1-account {phone, password, amwayCode, root?}`, `add-household-member {phone, password, householdId?}`, `reset-password` (giữ).

### Implementation Guidelines
- App must never write `households`, `household_members`, `household_codes` trực tiếp; chỉ qua RPC/Edge Function.
- Mọi kiểm tra quyền must đi qua `can_view_household` / `is_household_member`; must never so sánh `sponsor_household_id` tại chỗ.
- Mã số must được chuẩn hoá (chỉ chữ số) trước khi ghi; server must từ chối mã sai và mã trùng.
- XP, streak, thành tích must never lưu trên server ở giai đoạn này.

## Alternatives Considered

### Alternative 1: Giữ bảo trợ theo người, thêm liên kết "vợ/chồng"
- **Description**: `profiles.spouse_id`; cây theo người, 30x30 cộng hai người.
- **Pros**: Ít thay đổi bảng.
- **Cons**: Hai người có thể có hai bảo trợ khác nhau; 4x4 phải gộp cặp ở mọi truy vấn; mã số không có chỗ đứng.
- **Rejection Reason**: Sai đơn vị nghiệp vụ (một mã = một hộ), mọi truy vấn cây phức tạp hơn.

### Alternative 2: Hộ là tài khoản dùng chung (một đăng nhập)
- **Description**: Vợ chồng dùng chung một SĐT/mật khẩu.
- **Pros**: Đơn giản nhất.
- **Cons**: Trái quyết định A (mỗi người một tài khoản, XP riêng); không biết ai làm việc nào.
- **Rejection Reason**: Trái yêu cầu.

## Consequences

### Positive
- Cây, mã và 30x30 khớp với cách Amway tính (một mã một hộ).
- Hộ một người là trường hợp thường, không cần nhánh code riêng.

### Negative
- Thêm 4 bảng và một tầng gián tiếp người → hộ trong mọi truy vấn quyền.
- Rời hộ, giải thể, gộp mã thành các thao tác server cần kiểm thử riêng.

## Risks
- **Migration làm mất admin:** migration tạo hộ cho từng profile hiện có và giữ `role`; test kiểm tra admin còn nguyên.
- **Đệ quy cây chậm khi hệ thống lớn:** index `sponsor_household_id`; giới hạn độ sâu 10000 như story 019; đo lại khi có >10k hộ.
- **Trigger giới hạn thành viên bị vượt khi hai yêu cầu đồng thời:** trigger khoá dòng hộ (`for update`) trước khi đếm.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| accounts.md | Luật 6–7: hộ, tối đa 2 thành viên, một hộ mỗi người | `households`, `household_members` + index + trigger |
| accounts.md | Luật 8–9: tạo hộ F1, thêm vợ/chồng | `provision_household`, `provision_member`, hai Edge Function |
| accounts.md | Luật 10: tuyến trên chỉ thấy hộ, mã, thành viên, số tổng hợp | `can_view_household` trên bốn bảng; Danh bạ ở ADR-0002 |
| accounts.md | Luật 13–16: mã chuẩn hoá, duy nhất khi hoạt động, huỷ giữ ngày | `household_codes` + index duy nhất có điều kiện |
| accounts.md | Formulas: tier, nhánh, 30x30 theo hộ | bảo trợ trên `households`, `household_aggregates` |
| crm.md | Formulas: `customers(h)`, `f1(h)` | `household_aggregates` |

## Performance Implications
- **CPU**: đệ quy cây mỗi lần kiểm quyền; chấp nhận được ở quy mô vài nghìn hộ.
- **Memory**: Không đáng kể.
- **Load Time**: Không đổi phía app.
- **Network**: Không đổi.

## Migration Plan
Migration `20261107000000_households.sql`: tạo bảng mới; mỗi `profiles` → một hộ + thành viên; `sponsor_id` → `sponsor_household_id` của hộ tương ứng; `aggregates` → `household_aggregates`; bỏ `profiles.sponsor_id`, `set_sponsor`, `is_self_or_downline`, bảng `aggregates`. Sửa `create-f1-account`, thêm `add-household-member` trong cùng lần deploy.

## Validation Criteria
- `tests/integration/supabase/households-rls.test.ts`: admin còn sau migration, cây cũ thành cây hộ, giới hạn thành viên, mã trùng bị chặn, mã huỷ dùng lại được, tuyến trên đọc đúng phạm vi.
- Sau deploy: gọi thử bằng khoá công khai trả `permission denied`; admin đăng nhập vẫn là admin.

## Related
- `design/gdd/accounts.md`, `design/gdd/crm.md`, `design/phase-2-notes.md`
- ADR-0002 (Danh bạ hộ trên server), ADR-0003 (chuyển liên hệ khi gộp mã)
- Thay thế phần bảo trợ của story 019 (`production/epics/diamond-challenge/story-019-supabase-accounts-backend.md`)
