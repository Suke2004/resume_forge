-- ============================================================================
-- LaTeXForge — Supabase PostgreSQL Schema & Row-Level Security (RLS) Migration
-- Run this in your Supabase SQL Editor when connecting your project via .env
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. User Workspaces Table (Stores isolated multi-user profiles, projects, skills, templates, and resumes)
create table if not exists public.user_workspaces (
  user_id text primary key,
  email text not null,
  full_name text not null,
  role_headline text not null default '',
  workspace_data jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 2. Normalized Projects Catalogue Table (Optional relational mirror synced automatically)
create table if not exists public.projects (
  id text not null,
  user_id text not null references public.user_workspaces(user_id) on delete cascade,
  title text not null,
  domain text not null check (domain in ('software', 'hardware', 'hybrid')),
  source_description text not null default '',
  verified_facts jsonb not null default '[]'::jsonb,
  default_bullets jsonb not null default '[]'::jsonb,
  technologies jsonb not null default '[]'::jsonb,
  keywords jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '[]'::jsonb,
  github_url text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- 3. Normalized 4-Stage Skills Table (Stage 4 strictly excluded from resume outputs)
create table if not exists public.skills (
  id text not null,
  user_id text not null references public.user_workspaces(user_id) on delete cascade,
  name text not null,
  category text not null,
  stage smallint not null check (stage in (1, 2, 3, 4)),
  primary key (user_id, id)
);

-- 4. Normalized Resume Versions Table
create table if not exists public.resume_versions (
  id text not null,
  user_id text not null references public.user_workspaces(user_id) on delete cascade,
  version_number integer not null,
  company text not null,
  role text not null,
  job_description text not null default '',
  role_mode text not null default 'all',
  selected_project_ids jsonb not null default '[]'::jsonb,
  manually_locked_project_ids jsonb not null default '[]'::jsonb,
  saved_latex_source text not null,
  saved_source_hash text not null,
  compiled_source_hash text,
  is_pdf_stale boolean not null default false,
  job_status text not null default 'COMPLETED',
  compilation_result jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Enable Row Level Security (RLS)
alter table public.user_workspaces enable row level security;
alter table public.projects enable row level security;
alter table public.skills enable row level security;
alter table public.resume_versions enable row level security;

-- RLS Policies for authenticated users (and service_role bypass)
create policy "Users can manage their own workspace"
  on public.user_workspaces
  for all
  using (auth.uid()::text = user_id or current_setting('role', true) = 'service_role')
  with check (auth.uid()::text = user_id or current_setting('role', true) = 'service_role');

create policy "Users can manage their own projects"
  on public.projects
  for all
  using (auth.uid()::text = user_id or current_setting('role', true) = 'service_role')
  with check (auth.uid()::text = user_id or current_setting('role', true) = 'service_role');

create policy "Users can manage their own skills (Stages 1-3 eligible, Stage 4 excluded)"
  on public.skills
  for all
  using (auth.uid()::text = user_id or current_setting('role', true) = 'service_role')
  with check (auth.uid()::text = user_id or current_setting('role', true) = 'service_role');

create policy "Users can manage their own resume versions"
  on public.resume_versions
  for all
  using (auth.uid()::text = user_id or current_setting('role', true) = 'service_role')
  with check (auth.uid()::text = user_id or current_setting('role', true) = 'service_role');
