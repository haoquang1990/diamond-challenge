## Architecture Review Report

Date: 2026-11-07
Mode: full
Workflow: minimal
Engine: none configured (stack web: React 19 / Vite 8 / TypeScript 6 + Supabase; `engine.name: Web` không thuộc Godot/Unity/Unreal)
GDDs Reviewed: 2 (`design/gdd/accounts.md`, `design/gdd/crm.md`)
ADRs Reviewed: 3 (ADR-0001, ADR-0002, ADR-0003)
Reviewed-Content-Hash: docs/architecture/adr-0001-household-model.md 06b018e0ead337a6e527641b6cdc06ac33746e79
Reviewed-Content-Hash: docs/architecture/adr-0002-household-contacts-on-server.md c4895aa961b35fd4b8b47c2b3123f929c57a036d
Reviewed-Content-Hash: docs/architecture/adr-0003-transfer-contacts-on-code-merge.md 7fdd14dd60c934a0d6a97692c0b927c87d1942e3
Reviewed-Content-Hash: design/gdd/accounts.md 158ddbce2ac0497c52233ca89b0a1ab76ca41900
Reviewed-Content-Hash: design/gdd/crm.md 7b9c132ffdd4075ef73ef6cbdae92255a7c24124
Reviewed-Content-Hash: docs/architecture/tr-registry.yaml 40771f0c1fcf3633f111894eedb152410882825e
Reviewed-Content-Hash: project.yaml e7a69962e646fb02aae094220e82af156d98b7c0
Reviewed-Content-Hash: .claude/docs/technical-preferences.md 201f925092f3aa87656222992d6d76bca43ad46b
Reviewed-Content-Hash: .claude/skills/architecture-review/SKILL.md 1a9d28aadbcbd26b5fc6b8ed1c64d73ae82b7b73
Reviewed-Content-Hash: .claude/skills/architecture-review/references/1-load.md 9a65759ebdbb2cb1f9744775bfed18cb25e76347
Reviewed-Content-Hash: .claude/skills/architecture-review/references/2-extract-requirements.md d08ea0b0e9ab9760b0d8bfe0cd9115f0bc40f8e2
Reviewed-Content-Hash: .claude/skills/architecture-review/references/3-traceability.md bb7b6b65c5e5e5b8869fa692413aa831615dede7
Reviewed-Content-Hash: .claude/skills/architecture-review/references/4-conflicts.md 0d30f8173b23248a32523a365b606dd1ce9642ab
Reviewed-Content-Hash: .claude/skills/architecture-review/references/5-engine.md 318ecbc1361d430badaf5dd8ce4cfc6ab0dff0ca
Reviewed-Content-Hash: .claude/skills/architecture-review/references/6-document-coverage.md dcce78482ec2ce60048989b6f9d1f797dd0a9a0e
Reviewed-Content-Hash: .claude/skills/architecture-review/references/7-report.md a007fd66bdac87812dc272e4b14cd231174e979d
Reviewed-Content-Hash: .claude/skills/architecture-review/references/8-write.md bf6d8946fc7b9e19eda7f65503a5c8f593a0d2b1
Reviewed-Content-Hash: .claude/skills/architecture-review/references/9-handoff.md fd5f681f4c3517c6a2e388c6d78075d82dded22e

> Ở `workflow: minimal`, review này không bắt buộc. Chạy vì giai đoạn 2 đã có 3 ADR và một migration đang chạy trên dữ liệu thật. `system_overrides` trong `project.yaml` đang trống, nên `accounts` và `crm` vẫn ở mức minimal.

---

### Traceability Summary

Total requirements: 20
✅ Covered (Accepted ADR): 0
🟡 Covered (Proposed ADR): 13
⚠️ Partial: 4
❌ Gaps: 3

### Traceability Matrix

| Requirement ID | GDD | Requirement | ADR Coverage | Status |
|---|---|---|---|---|
| TR-accounts-001 | accounts.md | Đăng nhập SĐT + mật khẩu, không tự đăng ký, đổi mật khẩu lần đầu | ADR-0001 (chỉ nhắc `must_change_password`); story 019 | ⚠️ Partial |
| TR-accounts-002 | accounts.md | Một hộ đang hoạt động mỗi người, tối đa M thành viên | ADR-0001 | 🟡 |
| TR-accounts-003 | accounts.md | Tạo hộ F1, thêm vợ/chồng qua Edge Function + service_role | ADR-0001 | 🟡 |
| TR-accounts-004 | accounts.md | Tuyến trên chỉ đọc hộ, mã, thành viên, số tổng hợp | ADR-0001, ADR-0002 | 🟡 |
| TR-accounts-005 | accounts.md | Mã số chuẩn hoá, duy nhất khi hoạt động, huỷ giữ ngày | ADR-0001 | 🟡 |
| TR-accounts-006 | accounts.md | Chặn vòng bảo trợ | ADR-0001 | 🟡 |
| TR-accounts-007 | accounts.md | XP/streak/thành tích theo người, chỉ trên máy | ADR-0002 (`isMine`) | 🟡 |
| TR-accounts-008 | accounts.md | Rời hộ: mất quyền ngay, hộ mới cùng bảo trợ | ADR-0001 (`leave_household`), ADR-0002 | 🟡 |
| TR-accounts-009 | accounts.md | Xoá tài khoản, giải thể hộ | ADR-0002 (một phần); migration chưa có hàm | ⚠️ Partial |
| TR-accounts-010 | accounts.md | Gộp hai mã, Chờ gán tuyến trên, hoàn tác | ADR-0003 | 🟡 |
| TR-accounts-011 | accounts.md | Server dựng cây hộ và tính Bảng 4x4 | — | ❌ Gap |
| TR-accounts-012 | accounts.md | Số tổng hợp hộ đồng bộ, cần tính lại sau gộp | ADR-0001 (`household_aggregates`); mô hình tin cậy chưa ghi | ⚠️ Partial |
| TR-crm-001 | crm.md | Nhật ký sự kiện chỉ-thêm trên máy, giá trị suy ra thuần | — (story 001) | ❌ Gap |
| TR-crm-002 | crm.md | Sao lưu/khôi phục file, gộp theo id | — (story 011) | ❌ Gap |
| TR-crm-003 | crm.md | Danh bạ hộ trên server, chỉ thành viên đọc/ghi | ADR-0002 | 🟡 |
| TR-crm-004 | crm.md | Offline, đồng bộ hai chiều, sự kiện muộn hơn thắng | ADR-0002; xung đột với ADR-0003 | ⚠️ Partial |
| TR-crm-005 | crm.md | Đồng ý trước khi đẩy, server từ chối khi chưa đồng ý | ADR-0002 | 🟡 |
| TR-crm-006 | crm.md | Dò/gộp/tách liên hệ trùng | ADR-0002 (loại sự kiện) | 🟡 |
| TR-crm-007 | crm.md | Dòng "Đã chuyển lên tuyến trên" | ADR-0003 | 🟡 |
| TR-crm-008 | crm.md | Bảng 30x30 theo Danh bạ hộ, cảnh báo trùng | ADR-0001 (`household_aggregates`) | 🟡 |

### Coverage Gaps (no ADR exists)

- ❌ TR-accounts-011: accounts.md → Cây hộ và Bảng 4x4 do server tính. Suggested ADR: "/architecture-decision Server dựng cây hộ và tính Bảng 4x4". Domain: Core (server). Engine Risk: NOT ASSESSED.
- ❌ TR-crm-001: crm.md → Nhật ký sự kiện chỉ-thêm trên máy. Quyết định nằm trong story 001; ở minimal chấp nhận được. Suggested: "/architecture-decision retrofit nhật ký sự kiện". Domain: Core. Engine Risk: NOT ASSESSED.
- ❌ TR-crm-002: crm.md → Sao lưu/khôi phục bằng file. Quyết định nằm trong story 011. Domain: Persistence. Engine Risk: NOT ASSESSED.

### Cross-ADR Conflicts

## Conflict: ADR-0002 vs ADR-0003
Type: Integration
ADR-0002 claims: máy kéo sự kiện Danh bạ theo `created_at > cursor`.
ADR-0003 claims: gộp mã chuyển sự kiện sang S2 (và hoàn tác trả về HY) chỉ bằng cách đổi `household_id`; `created_at` giữ nguyên; "máy S2 kéo các sự kiện được chuyển ở lần đồng bộ kế tiếp".
Impact: máy S2 đã đồng bộ trước đó có cursor mới hơn `created_at` của sự kiện được chuyển, nên không bao giờ kéo về; tương tự cho HY sau hoàn tác. Đã đối chiếu `supabase/migrations/20261107000000_households.sql`: `merge_codes` không đổi `created_at`, index đồng bộ là `(household_id, created_at)`.
Resolution options:
  1. (Khuyên dùng) Cột `sync_seq` từ một sequence, đặt khi insert và mỗi khi `household_id` đổi (trigger); máy kéo theo `sync_seq`.
  2. Sau gộp/hoàn tác đánh dấu hộ "cần đồng bộ lại toàn bộ"; máy bỏ cursor và kéo lại.

Rủi ro phụ (không phải xung đột): ADR-0002 "sự kiện muộn hơn thắng" dùng `occurred_at` theo giờ máy; máy sai giờ có thể đè thay đổi mới hơn.

### ADR Dependency Order

1. ADR-0001 (Foundation)
2. ADR-0002 (phụ thuộc ADR-0001)
3. ADR-0003 (phụ thuộc ADR-0001, ADR-0002)

Không có vòng. ⚠️ Cả ba ADR đều `Proposed`: ADR-0002 và ADR-0003 dựa trên ADR chưa được chấp nhận.

### GDD Revision Flags

None — không có engine reference để đối chiếu.

### Engine Compatibility Issues

Engine validation: NOT ASSESSED — không có engine được cấu hình hợp lệ và không có `docs/engine-reference/` cho stack web. ADRs with Engine Compatibility section: 3 / 3. Post-Cutoff APIs Used: None. Deprecated API references: không kiểm được.

### Architecture Document Coverage

Architecture document coverage: NOT ASSESSED — no `docs/architecture/architecture.md`.

Ngoài phạm vi GDD: nhắc nhở bằng Web Push mới có trong `design/phase-2-notes.md`, chưa có GDD hay ADR.

---

### Verdict: FAIL

Lý do: xung đột tích hợp ADR-0002 vs ADR-0003 làm mất liên hệ được chuyển khi gộp mã. Ngoài ra độ phủ dựa hoàn toàn trên ADR `Proposed`, Phase 5 và Phase 6 NOT ASSESSED.

### Blocking Issues (must resolve before PASS)

1. Sửa xung đột con trỏ đồng bộ (ADR-0002/ADR-0003) và thêm migration + test, trước story đồng bộ Danh bạ và story gộp mã.
2. Chấp nhận ADR-0001..0003 sau khi sửa (`/architecture-decision accept ADR-NNNN`).

### Required ADRs

1. Sửa ADR-0002 + ADR-0003: đồng bộ theo `sync_seq` (Foundation).
2. Server dựng cây hộ và tính Bảng 4x4 (TR-accounts-011, Core).
3. Xoá tài khoản và giải thể hộ; mô hình tin cậy của số tổng hợp do app gửi (TR-accounts-009, TR-accounts-012).
4. (Tuỳ chọn ở minimal) Retrofit nhật ký sự kiện trên máy và sao lưu file (TR-crm-001, TR-crm-002).
