# Quick Spec: Tài khoản Supabase (giai đoạn 2, phần nền)

> **Ngày**: 2026-11-06
> **Nguồn**: `design/phase-2-notes.md` — mục "Tài khoản: đăng ký và đăng nhập", "Đồng bộ số tổng hợp"
> **Loại**: New Small System (hạ tầng, chưa có giao diện)

## Bối cảnh

Giai đoạn 2 cần tài khoản và cây bảo trợ trên server. Story này chỉ dựng phần nền
trên Supabase (bảng, quyền đọc ghi, hàm tạo tài khoản, quy trình triển khai).
Màn đăng nhập, nút "Tạo tài khoản" và đồng bộ số tổng hợp là các story sau.

## Dự án Supabase

| Mục | Giá trị |
|---|---|
| Project URL | `https://ixxtoriatszyeapnyiwh.supabase.co` |
| Project ID | `ixxtoriatszyeapnyiwh` |
| Region | Singapore |
| App URL | `https://haoquang1990.github.io/diamond-challenge/` |

Khoá publishable được phép nằm trong bản build (nó công khai, quyền bị RLS giới hạn).
**Khoá secret / service_role không bao giờ nằm trong code app hay trong repo**; Edge
Function đọc nó từ biến môi trường mà Supabase tự cấp.

## Luật

1. **Không tự đăng ký.** Tắt "Allow new users to sign up". Tài khoản chỉ sinh ra qua Edge Function.
2. **Đăng nhập bằng SĐT + mật khẩu.** Supabase Auth dùng email nội bộ dựng từ SĐT:
   `<số E.164 không dấu +>@phone.diamond-challenge.app` (ví dụ `84912345678@phone.diamond-challenge.app`).
   Không gửi email nào; xác nhận email tắt, tài khoản tạo với `email_confirm: true`.
3. **SĐT** chuẩn hoá về E.164: bỏ khoảng trắng, dấu chấm, gạch; `0xxxxxxxxx` hoặc
   `84xxxxxxxxx` hoặc `+84xxxxxxxxx` thành `+84xxxxxxxxx`; mã nước khác giữ nguyên khi có `+`.
   Phần số sau mã nước dài 8–12 chữ số; sai thì từ chối.
4. **Mật khẩu tạm** dài tối thiểu 8 ký tự. Tài khoản mới có `must_change_password = true`;
   app bắt đổi ở lần đăng nhập đầu rồi gọi `mark_password_changed()`.
5. **`create-f1-account`**: người gọi phải đăng nhập và đã đổi mật khẩu tạm. Tài khoản mới
   có `sponsor_id` = người gọi. Admin gọi với `root: true` thì tạo người gốc (không bảo trợ).
   SĐT đã có tài khoản thì từ chối (409).
6. **`reset-password`**: chỉ admin. Đặt mật khẩu tạm mới và `must_change_password = true`.
7. **Sửa người bảo trợ**: chỉ admin, qua RPC `set_sponsor(user, sponsor)`; vòng lặp (bảo trợ
   cho chính mình hoặc cho người trên mình) bị từ chối bằng trigger.
8. **Quyền đọc**: mỗi người đọc hồ sơ và số tổng hợp của mình và cả tuyến dưới; admin đọc tất cả.
9. **Quyền ghi**: người dùng chỉ ghi số tổng hợp của chính mình; không ai tự sửa `role`,
   `sponsor_id`, `phone` hay tự chèn hồ sơ. Hồ sơ chỉ sinh từ Edge Function (service role).
10. **Chỉ đồng bộ số**: `aggregates` có `customers`, `f1`, `achieved_30x30`, `updated_at`.
    Không có cột tên hay danh bạ.

## Triển khai

- GitHub Actions `supabase-deploy.yml`, chạy khi push lên `main` có đổi trong `supabase/**`
  (và chạy tay được): `supabase link`, `supabase db push`, `supabase functions deploy`.
  Dùng các secret `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`.
- Workflow Pages thêm bước chặn: build hỏng nếu `src/` hoặc `dist/` có `service_role` hay `sb_secret_`.

## Bước làm tay trên Supabase Dashboard

1. Authentication → Sign In / Providers → tắt **Allow new users to sign up**.
2. Authentication → Sign In / Providers → Email → tắt **Confirm email**.
3. Authentication → URL Configuration → **Site URL** = `https://haoquang1990.github.io/diamond-challenge/`;
   **Redirect URLs** thêm `https://haoquang1990.github.io/diamond-challenge/**` và `http://localhost:5173/**`.
4. Tạo admin đầu tiên: Authentication → Users → Add user (email nội bộ của SĐT admin,
   mật khẩu, Auto Confirm), rồi chạy `supabase/snippets/make-first-admin.sql` trong SQL Editor.

## Tiêu chí chấp nhận

- AC-1: Build đọc `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; thiếu hay sai thì app vẫn chạy offline và không tạo client.
- AC-2: Migration tạo `profiles`, `aggregates`, RLS bật trên cả hai, đúng luật 7–10; kiểm tra bằng Postgres cục bộ.
- AC-3: Hai Edge Function đúng luật 2–6; hàm SĐT có unit test.
- AC-4: Workflow deploy chạy khi push `main`; không có secret trong repo; bước chặn secret hoạt động.
- AC-5: Danh sách bước Dashboard và câu SQL tạo admin đầu tiên có trong repo.
