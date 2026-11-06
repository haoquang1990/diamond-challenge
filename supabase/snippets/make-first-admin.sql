-- Run once in Supabase Dashboard → SQL Editor, after creating the admin's auth user in
-- Authentication → Users → Add user (email = <E.164 digits>@phone.diamond-challenge.app,
-- e.g. 84912345678@phone.diamond-challenge.app, with "Auto Confirm User" ticked).
-- Admin: +84948161365 (email 84948161365@phone.diamond-challenge.app).
insert into public.profiles (id, phone, role, must_change_password)
select u.id, '+84948161365', 'admin', false
from auth.users u
where u.email = '84948161365@phone.diamond-challenge.app'
on conflict (id) do update set role = 'admin';
