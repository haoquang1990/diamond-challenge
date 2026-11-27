-- Story 056: today's XP goal the member picked, so the sponsor sees "chưa đạt mục tiêu (75 XP)".
alter table public.member_progress
  add column goal_xp integer check (goal_xp between 1 and 1000);
