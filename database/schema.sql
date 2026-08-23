-- Schema PostgreSQL di riferimento per il passaggio dalla persistenza JSON dell'MVP.
create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  username varchar(24) not null unique,
  email varchar(320) not null unique,
  password_hash text not null,
  display_name varchar(40) not null,
  bio varchar(280) not null default '',
  status varchar(20) not null default 'offline' check (status in ('online','offline','dnd','banned','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index sessions_user_idx on sessions(user_id);

create table friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references users(id) on delete cascade,
  receiver_id uuid not null references users(id) on delete cascade,
  status varchar(20) not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> receiver_id)
);
create unique index friend_requests_pending_idx on friend_requests(sender_id, receiver_id) where status = 'pending';

create table friendships (
  user_a_id uuid not null references users(id) on delete cascade,
  user_b_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a_id, user_b_id),
  check (user_a_id < user_b_id)
);

create table blocks (
  blocker_id uuid not null references users(id) on delete cascade,
  blocked_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type varchar(80) not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, created_at desc);

create table games (
  id varchar(80) primary key,
  manifest jsonb not null,
  status varchar(20) not null default 'active',
  created_at timestamptz not null default now()
);

create table game_releases (
  id uuid primary key default gen_random_uuid(),
  game_id varchar(80) not null references games(id),
  version varchar(32) not null,
  api_version varchar(32) not null,
  artifact_digest varchar(128) not null,
  signature text,
  status varchar(20) not null default 'available',
  created_at timestamptz not null default now(),
  unique (game_id, version)
);

create table lobbies (
  id uuid primary key default gen_random_uuid(),
  game_id varchar(80) not null references games(id),
  game_release_id uuid not null references game_releases(id),
  host_id uuid not null references users(id),
  max_players integer not null check (max_players > 0),
  privacy varchar(20) not null check (privacy in ('public','private','invite_only')),
  status varchar(20) not null default 'waiting' check (status in ('waiting','starting','in_game','finished','cancelled')),
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  closed_at timestamptz
);

create table lobby_players (
  lobby_id uuid not null references lobbies(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role varchar(20) not null default 'player',
  status varchar(20) not null default 'connected',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (lobby_id, user_id)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references lobbies(id),
  game_id varchar(80) not null references games(id),
  game_release_id uuid not null references game_releases(id),
  status varchar(20) not null default 'in_game',
  result jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table match_players (
  match_id uuid not null references matches(id) on delete cascade,
  user_id uuid not null references users(id),
  seat integer not null,
  result varchar(20),
  primary key (match_id, user_id),
  unique (match_id, seat)
);

create table match_events (
  match_id uuid not null references matches(id) on delete cascade,
  sequence bigint not null,
  event_type varchar(80) not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (match_id, sequence)
);

create table game_snapshots (
  match_id uuid primary key references matches(id) on delete cascade,
  sequence bigint not null,
  state jsonb not null,
  created_at timestamptz not null default now()
);
