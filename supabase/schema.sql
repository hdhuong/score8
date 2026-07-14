-- Billiard Tournament — schema đồng bộ cloud
-- Chạy TOÀN BỘ file này trong Supabase SQL Editor (Project > SQL Editor > New query).
-- An toàn chạy lại nhiều lần (idempotent) — dùng để nâng cấp project đã tạo từ
-- bản Phase 5 lên Phase 7 (thêm cột stage/race_to/members) mà không mất dữ liệu.
--
-- Thiết kế: app không có backend/auth (đúng tinh thần "no server" của PRD).
-- `code` (mã giải 6 ký tự) đóng vai trò capability token: ai biết mã đều
-- đọc/ghi được dữ liệu của giải đó. Chấp nhận được vì dữ liệu không nhạy
-- cảm (tỷ số billiard) và mã đủ khó đoán cho quy mô giải đấu nhỏ.

create table if not exists teams (
  id uuid primary key,
  code text not null,
  name text not null,
  updated_at timestamptz not null default now()
);

create table if not exists matches (
  id uuid primary key,
  code text not null,
  round int not null,
  team1_id uuid not null,
  team2_id uuid not null,
  score1 int,
  score2 int,
  status text not null default 'pending',
  updated_at timestamptz not null default now()
);

-- Phase 7: đội có thể có danh sách thành viên; trận có thể là 'group' hoặc
-- 'final' (chung kết) với race-to riêng.
alter table teams add column if not exists members text[];
alter table matches add column if not exists stage text not null default 'group';
alter table matches add column if not exists race_to int;

create index if not exists teams_code_idx on teams (code);
create index if not exists matches_code_idx on matches (code);

alter table teams enable row level security;
alter table matches enable row level security;

-- Cho phép đọc/ghi công khai (không auth) — xem ghi chú bảo mật ở đầu file.
-- drop + create để an toàn chạy lại (Postgres không hỗ trợ "create policy if not exists").
drop policy if exists "public read teams" on teams;
create policy "public read teams" on teams for select using (true);
drop policy if exists "public write teams" on teams;
create policy "public write teams" on teams for insert with check (true);
drop policy if exists "public update teams" on teams;
create policy "public update teams" on teams for update using (true);

drop policy if exists "public read matches" on matches;
create policy "public read matches" on matches for select using (true);
drop policy if exists "public write matches" on matches;
create policy "public write matches" on matches for insert with check (true);
drop policy if exists "public update matches" on matches;
create policy "public update matches" on matches for update using (true);

-- Bật realtime (INSERT/UPDATE/DELETE) cho 2 bảng — bọc trong kiểm tra tồn tại
-- vì Postgres không hỗ trợ "add table if not exists" cho publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'teams'
  ) then
    alter publication supabase_realtime add table teams;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table matches;
  end if;
end $$;
