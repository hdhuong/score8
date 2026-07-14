-- Billiard Tournament — schema đồng bộ cloud (Phase 5)
-- Chạy toàn bộ file này trong Supabase SQL Editor (Project > SQL Editor > New query).
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

create index if not exists teams_code_idx on teams (code);
create index if not exists matches_code_idx on matches (code);

alter table teams enable row level security;
alter table matches enable row level security;

-- Cho phép đọc/ghi công khai (không auth) — xem ghi chú bảo mật ở đầu file.
create policy "public read teams" on teams for select using (true);
create policy "public write teams" on teams for insert with check (true);
create policy "public update teams" on teams for update using (true);

create policy "public read matches" on matches for select using (true);
create policy "public write matches" on matches for insert with check (true);
create policy "public update matches" on matches for update using (true);

-- Bật realtime (INSERT/UPDATE/DELETE) cho 2 bảng.
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table matches;
