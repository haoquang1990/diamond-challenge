-- Kiểm tra tài khoản chưa có mã số Amway (đề xuất 2026-11-28). CHỈ ĐỌC: không sửa dữ liệu.
-- Chạy trong Supabase › SQL Editor. Phần 1 chỉ ra số đếm; phần 2 liệt kê để bạn tự xem.

-- 1. Số đếm
select
  (select count(*) from public.profiles) as tong_tai_khoan,
  (select count(*) from public.households where status = 'active') as ho_dang_hoat_dong,
  (select count(*) from public.households h
     where h.status = 'active'
       and not exists (select 1 from public.household_codes c where c.household_id = h.id and c.status = 'active')
  ) as ho_chua_co_ma,
  (select count(*) from public.profiles p
     where not exists (select 1 from public.household_members m where m.user_id = p.id and m.left_at is null)
  ) as tai_khoan_khong_thuoc_ho_nao,
  (select count(*) from public.profiles p where p.role = 'admin') as so_admin;

-- 2. Danh sách hộ chưa có mã (tên hiển thị, SĐT, ngày tạo, có tuyến trên không)
select h.id as ho, h.created_at::date as ngay_tao, h.sponsor_household_id is not null as co_tuyen_tren,
       string_agg(coalesce(p.display_name, '(chưa đặt tên)') || ' ' || p.phone || case when p.role = 'admin' then ' [admin]' else '' end, ', ') as thanh_vien
from public.households h
left join public.household_members m on m.household_id = h.id and m.left_at is null
left join public.profiles p on p.id = m.user_id
where h.status = 'active'
  and not exists (select 1 from public.household_codes c where c.household_id = h.id and c.status = 'active')
group by h.id
order by h.created_at;
