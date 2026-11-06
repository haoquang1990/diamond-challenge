-- Run once in Supabase Dashboard → SQL Editor, after creating the admin's auth user in
-- Authentication → Users → Add user (email = <E.164 digits>@phone.diamond-challenge.app,
-- e.g. 84912345678@phone.diamond-challenge.app, with "Auto Confirm User" ticked).
-- Replace the phone below with the admin's, in E.164 form (+84...).
insert into public.profiles (id, phone, role, must_change_password)
select u.id, '+84912345678', 'admin', false
from auth.users u
where u.email = '84912345678@phone.diamond-challenge.app'
on conflict (id) do update set role = 'admin';
