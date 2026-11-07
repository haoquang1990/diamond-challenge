# Story 020: Mô hình Hộ kinh doanh trên server (hộ, mã số, Danh bạ hộ, gộp mã)

> **Epic**: diamond-challenge
> **Status**: In Progress
> **Layer**: Foundation
> **Type**: Integration
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-07

## Context

**GDD**: `design/gdd/accounts.md` (chi tiết: `design/gdd/crm.md` luật 16–25)
**Requirement**: Quyết định A–F ngày 2026-11-07 (hộ kinh doanh, mã số Amway, Danh bạ dùng chung trong hộ, gộp danh bạ, gộp hai mã)

**ADR Governing Implementation**: `docs/architecture/adr-0001-household-model.md`, `docs/architecture/adr-0002-household-contacts-on-server.md`, `docs/architecture/adr-0003-transfer-contacts-on-code-merge.md`
**ADR Decision Summary**: Tách người khỏi hộ; bảo trợ, mã số và 30x30 thuộc hộ. Danh bạ hộ là bảng chỉ-thêm `contact_events`, chỉ thành viên đọc/ghi, cần đồng ý. Gộp mã là một hàm SQL giao dịch chuyển `household_id` của sự kiện liên hệ, để lại dòng "Đã chuyển", có bản ghi để hoàn tác.
**ADR Version**: unversioned (Proposed 2026-11-07)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) + Supabase | **Risk**: NOT ASSESSED
**Engine Notes**: none

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Migration `supabase/migrations/20261107000000_households.sql` chuyển dữ liệu story 019 sang mô hình hộ: mỗi người một hộ, cây bảo trợ cũ thành cây hộ, số tổng hợp giữ nguyên, **admin `+84948161365` giữ nguyên vai trò**.
- [ ] Hộ tối đa `max_household_members` (2) thành viên; một người một hộ đang hoạt động; mã đang hoạt động duy nhất, mã huỷ giữ ngày; chặn vòng bảo trợ.
- [ ] Tuyến trên đọc được hộ F1, mã, thành viên (tên, SĐT) và số tổng hợp; tuyến dưới không đọc được tuyến trên.
- [ ] Danh bạ hộ (`contact_events`): chỉ thành viên hộ đọc/ghi; tuyến trên, tuyến dưới, admin qua API và người ngoài không đọc được; chưa đồng ý không ghi được; không ghi được dưới tên người khác; không sửa/xoá được.
- [ ] **[2b]** Gộp mã (hàm đã có và có test; bị khoá tới 2b bởi `20261107010000_contact_sync_seq.sql`): xem trước không ghi gì; sau gộp S2 đọc được liên hệ có mã được chuyển, hộ X chỉ thấy dòng "Đã chuyển lên tuyến trên", hộ F1 của Y đổi bảo trợ sang S2, mã Y huỷ; không có S2 thì vào Chờ gán tuyến trên; admin hoàn tác một lần.
- [ ] Rời hộ: mất quyền Danh bạ hộ, vào hộ mới cùng bảo trợ, chưa có mã; thành viên duy nhất không rời được.
- [ ] Edge Function `create-f1-account` tạo hộ F1 với mã của liên hệ; `add-household-member` thêm vợ/chồng; cả hai deploy qua `supabase-deploy.yml`.

---

## Implementation Notes

- Kiểm thử bằng PGlite: `tests/integration/supabase/households-rls.test.ts` (fail khi tắt RLS).
- Chưa có giao diện và chưa có code đồng bộ trong app.

---

## Out of Scope

- Màn đăng nhập, đổi mật khẩu, đồng ý, đồng bộ Danh bạ phía app, lọc XP theo người.
- Màn "Tạo tài khoản", "Thêm vợ/chồng", "Kiểm tra liên hệ trùng", gộp mã, Chờ gán tuyến trên, cây và 4x4.
- Xoá tài khoản và giải thể hộ (chưa có hàm server).

---

## Files

- `supabase/migrations/20261107000000_households.sql`
- `supabase/functions/create-f1-account/index.ts`, `supabase/functions/add-household-member/index.ts`
- `supabase/functions/_shared/phone.ts`, `supabase/functions/_shared/errors.ts`
- `supabase/config.toml`, `supabase/README.md`, `supabase/snippets/make-first-admin.sql`
- `.github/workflows/supabase-deploy.yml`
- `tests/integration/supabase/households-rls.test.ts`, `tests/unit/supabase/phone.test.ts`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/supabase/households-rls.test.ts`; live run of `supabase-deploy.yml` after merge

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-019-supabase-accounts-backend.md`
- Unlocks: các story giao diện giai đoạn 2 (chưa viết): đăng nhập và đổi mật khẩu; đồng ý và đồng bộ Danh bạ hộ (kèm lọc XP theo người); ô mã số Amway trên liên hệ; "Tạo tài khoản" và "Thêm vợ/chồng"; kiểm tra và gộp liên hệ trùng; màn gộp mã và Chờ gán tuyến trên; cây và Bảng 4x4
