# Supabase (giai đoạn 2 — story 019)

Dự án: `ixxtoriatszyeapnyiwh` (Singapore) · `https://ixxtoriatszyeapnyiwh.supabase.co`
Spec: `design/quick-specs/supabase-accounts-2026-11-06.md`

| Đường dẫn | Nội dung |
|---|---|
| `migrations/20261106000000_accounts.sql` | Bảng `profiles`, `aggregates`; RLS; chặn vòng bảo trợ; RPC `mark_password_changed`, `set_sponsor` |
| `functions/create-f1-account` | Tạo tài khoản F1, người gọi là người bảo trợ; admin `root: true` tạo người gốc |
| `functions/reset-password` | Admin đặt mật khẩu tạm mới, bắt đổi lại |
| `snippets/make-first-admin.sql` | Chạy một lần trong SQL Editor để có admin đầu tiên |

Đăng nhập: email nội bộ dựng từ SĐT, ví dụ `+84912345678` → `84912345678@phone.diamond-challenge.app`.

## Triển khai

`.github/workflows/supabase-deploy.yml` chạy khi push lên `main` có đổi trong `supabase/**`
(hoặc chạy tay ở tab Actions). Secret cần có trong GitHub: `SUPABASE_ACCESS_TOKEN`,
`SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`.

**Khoá secret / service_role không bao giờ nằm trong repo hay app.** Edge Function nhận
`SUPABASE_SERVICE_ROLE_KEY` từ Supabase lúc chạy. Workflow Pages chạy
`tools/ci/check-no-secrets.mjs` và dừng build nếu thấy khoá bí mật.

## Bước làm tay trên Dashboard

1. **Authentication → Sign In / Providers**: tắt **Allow new users to sign up**.
2. **Authentication → Sign In / Providers → Email**: tắt **Confirm email**.
3. **Authentication → URL Configuration**:
   - Site URL: `https://haoquang1990.github.io/diamond-challenge/`
   - Redirect URLs: `https://haoquang1990.github.io/diamond-challenge/**` và `http://localhost:5173/**`
4. **Admin đầu tiên** (sau khi workflow đã chạy migration): Authentication → Users → Add user →
   email `<SĐT E.164 bỏ dấu +>@phone.diamond-challenge.app`, mật khẩu, tick Auto Confirm User;
   rồi sửa SĐT trong `snippets/make-first-admin.sql` và chạy nó ở SQL Editor.
