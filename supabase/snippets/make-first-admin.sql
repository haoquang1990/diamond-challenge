-- Run once in Supabase Dashboard → SQL Editor, after creating the admin's auth user in
-- Authentication → Users → Add user (email = <E.164 digits>@phone.diamond-challenge.app,
-- with "Auto Confirm User" ticked).
-- Admin: +84948161365 (email 84948161365@phone.diamond-challenge.app).
-- Already done on the live project (2026-11-06); the households migration gave that admin
-- its own household. On a fresh project this creates the profile and a root household.
insert into public.profiles (id, phone, role, must_change_password)
select u.id, '+84948161365', 'admin', false
from auth.users u
where u.email = '84948161365@phone.diamond-challenge.app'
on conflict (id) do update set role = 'admin';

with admin as (select id from public.profiles where phone = '+84948161365'),
     h as (
       insert into public.households (created_by)
       select id from admin
       where not exists (select 1 from public.household_members m join admin on m.user_id = admin.id where m.left_at is null)
       returning id
     )
insert into public.household_members (household_id, user_id)
select h.id, admin.id from h, admin;
