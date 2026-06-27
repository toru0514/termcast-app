-- ①ネタ管理: 用語マスタ（README §3.1）
create table if not exists terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  reading text not null default '',
  category text not null default '',
  difficulty int not null default 1 check (difficulty between 1 and 3),
  status text not null default 'pending' check (status in ('pending', 'generated', 'published')),
  published_at timestamptz,
  youtube_video_id text,
  tiktok_draft_id text,
  drive_link text,
  created_at timestamptz not null default now()
);

create index if not exists terms_status_idx on terms (status);
create index if not exists terms_pick_idx on terms (status, difficulty);
