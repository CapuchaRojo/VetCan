-- A6.3.5 Resolution state model

create table if not exists operational_event_state_transitions (
  id bigserial primary key,
  event_id uuid not null references operational_events(id) on delete cascade,
  state text not null check (state in ('open','acknowledged','resolved','failed')),
  transitioned_at timestamptz not null default now(),
  resolved_by text null check (resolved_by in ('automation','human')),
  note text null,
  source text not null default 'n8n',
  idempotency_key text not null
);

create unique index if not exists operational_event_state_transitions_dedupe
  on operational_event_state_transitions(event_id, idempotency_key);

create table if not exists operational_event_state_current (
  event_id uuid primary key references operational_events(id) on delete cascade,
  state text not null check (state in ('open','acknowledged','resolved','failed')),
  opened_at timestamptz not null,
  acknowledged_at timestamptz null,
  resolved_at timestamptz null,
  failed_at timestamptz null,
  resolved_by text null check (resolved_by in ('automation','human')),
  last_transition_at timestamptz not null,
  last_transition_source text not null default 'system',
  updated_at timestamptz not null default now()
);

create or replace function vetcan_seed_operational_event_state()
returns trigger
language plpgsql
as $$
begin
  insert into operational_event_state_current (
    event_id,
    state,
    opened_at,
    last_transition_at,
    last_transition_source,
    updated_at
  )
  values (
    new.id,
    'open',
    coalesce(new.occurred_at, now()),
    coalesce(new.occurred_at, now()),
    'ingest',
    now()
  )
  on conflict (event_id) do nothing;

  insert into operational_event_state_transitions (
    event_id,
    state,
    transitioned_at,
    resolved_by,
    note,
    source,
    idempotency_key
  )
  values (
    new.id,
    'open',
    coalesce(new.occurred_at, now()),
    null,
    'event_ingested',
    'ingest',
    'open:' || new.id::text
  )
  on conflict (event_id, idempotency_key) do nothing;

  return new;
end;
$$;

create or replace function vetcan_apply_operational_event_transition()
returns trigger
language plpgsql
as $$
begin
  insert into operational_event_state_current (
    event_id,
    state,
    opened_at,
    acknowledged_at,
    resolved_at,
    failed_at,
    resolved_by,
    last_transition_at,
    last_transition_source,
    updated_at
  )
  values (
    new.event_id,
    new.state,
    coalesce((select occurred_at from operational_events where id = new.event_id), now()),
    case when new.state = 'acknowledged' then new.transitioned_at else null end,
    case when new.state = 'resolved' then new.transitioned_at else null end,
    case when new.state = 'failed' then new.transitioned_at else null end,
    new.resolved_by,
    new.transitioned_at,
    new.source,
    now()
  )
  on conflict (event_id) do update
  set state = excluded.state,
      acknowledged_at = coalesce(operational_event_state_current.acknowledged_at, excluded.acknowledged_at),
      resolved_at = coalesce(operational_event_state_current.resolved_at, excluded.resolved_at),
      failed_at = coalesce(operational_event_state_current.failed_at, excluded.failed_at),
      resolved_by = coalesce(excluded.resolved_by, operational_event_state_current.resolved_by),
      last_transition_at = excluded.last_transition_at,
      last_transition_source = excluded.last_transition_source,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists vetcan_seed_operational_event_state on operational_events;
create trigger vetcan_seed_operational_event_state
after insert on operational_events
for each row execute procedure vetcan_seed_operational_event_state();

drop trigger if exists vetcan_apply_operational_event_transition on operational_event_state_transitions;
create trigger vetcan_apply_operational_event_transition
after insert on operational_event_state_transitions
for each row execute procedure vetcan_apply_operational_event_transition();

create or replace view operational_event_state_overview as
select
  e.id as event_id,
  e.event_name,
  e.severity,
  e.source,
  e.correlation_id,
  e.occurred_at,
  c.state,
  c.opened_at,
  c.acknowledged_at,
  c.resolved_at,
  c.failed_at,
  c.resolved_by,
  c.last_transition_at,
  c.last_transition_source,
  round(extract(epoch from (now() - e.occurred_at)) / 60.0, 2) as age_minutes
from operational_events e
join operational_event_state_current c
  on c.event_id = e.id;

create or replace view operational_events_open as
select *
from operational_event_state_overview
where state in ('open','acknowledged');

create or replace view operational_events_resolved_today as
select *
from operational_event_state_overview
where state = 'resolved'
  and resolved_at::date = current_date;

create or replace view operational_event_resolution_metrics as
select
  e.id as event_id,
  e.event_name,
  e.severity,
  e.source,
  e.occurred_at,
  c.state,
  c.acknowledged_at,
  c.resolved_at,
  c.failed_at,
  c.resolved_by,
  case
    when c.resolved_at is not null then round(extract(epoch from (c.resolved_at - e.occurred_at)) / 60.0, 2)
    when c.failed_at is not null then round(extract(epoch from (c.failed_at - e.occurred_at)) / 60.0, 2)
    else null
  end as resolution_minutes
from operational_events e
join operational_event_state_current c
  on c.event_id = e.id;
