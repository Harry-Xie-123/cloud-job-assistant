create table if not exists candidate_profiles (
  profile_key text primary key,
  profile jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists jobs (
  id text primary key,
  company text not null,
  title text not null,
  location text not null default '',
  type text not null default 'Saved',
  platform text not null default 'Manual',
  source_url text not null default '',
  external_apply_url text not null default '',
  closing_date date,
  start_date date,
  required_skills jsonb not null default '[]'::jsonb,
  degree_disciplines jsonb not null default '[]'::jsonb,
  work_rights jsonb not null default '[]'::jsonb,
  status text not null default 'saved',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_status_idx on jobs(status);
create index if not exists jobs_closing_date_idx on jobs(closing_date);
create index if not exists jobs_platform_idx on jobs(platform);

create table if not exists application_events (
  id bigserial primary key,
  job_id text not null references jobs(id) on delete cascade,
  status text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists application_events_job_id_idx on application_events(job_id);
