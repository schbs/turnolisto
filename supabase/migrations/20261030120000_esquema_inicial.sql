-- TurnoListo: esquema inicial (Clínica Dental Confluencia, datos ficticios).
-- RLS activada en todas las tablas y sin políticas públicas: el bot y los jobs usan la service role desde el servidor.
-- Las políticas del panel de recepción (usuario autenticado) se suman con el panel (P1-G3).

create extension if not exists btree_gist;

create type estado_turno as enum ('reservado', 'confirmado', 'cancelado', 'ausente');
create type estado_espera as enum ('esperando', 'ofrecido', 'asignado', 'vencido');
create type direccion_mensaje as enum ('entrante', 'saliente');
create type estado_handoff as enum ('pendiente', 'en_curso', 'resuelto');

create table profesionales (
  id text primary key,
  nombre text not null,
  matricula_ficticia text,
  activo boolean not null default true
);

create table prestaciones (
  id text primary key,
  nombre text not null,
  duracion_min integer not null check (duracion_min > 0 and duracion_min % 15 = 0),
  precio_ars integer check (precio_ars >= 0)
);

create table profesional_prestaciones (
  profesional_id text not null references profesionales (id) on delete cascade,
  prestacion_id text not null references prestaciones (id) on delete cascade,
  primary key (profesional_id, prestacion_id)
);

create table pacientes (
  id text primary key,
  nombre text not null,
  -- E.164 argentino (+549…), normalizado por src/domain/telefono.ts.
  telefono text not null unique check (telefono ~ '^\+549[123][0-9]{9}$'),
  email text,
  obra_social text,
  opt_in_whatsapp boolean not null default false,
  creado_en timestamptz not null default now()
);

create table turnos (
  id text primary key,
  paciente_id text not null references pacientes (id),
  profesional_id text not null references profesionales (id),
  prestacion_id text not null references prestaciones (id),
  inicio timestamptz not null,
  fin timestamptz not null,
  estado estado_turno not null default 'reservado',
  calendar_event_id text,
  enviado_48 timestamptz,
  enviado_24 timestamptz,
  enviado_3 timestamptz,
  creado_en timestamptz not null default now(),
  check (fin > inicio),
  -- Segunda barrera contra la doble reserva (la primera es src/domain/agenda.ts).
  constraint turnos_sin_superposicion exclude using gist (
    profesional_id with =,
    tstzrange(inicio, fin) with &&
  ) where (estado in ('reservado', 'confirmado'))
);

create index turnos_inicio_idx on turnos (inicio);
create index turnos_paciente_idx on turnos (paciente_id);

create table lista_espera (
  id text primary key,
  paciente_id text not null references pacientes (id),
  prestacion_id text not null references prestaciones (id),
  profesional_id text references profesionales (id),
  desde date not null,
  hasta date not null,
  estado estado_espera not null default 'esperando',
  creado_en timestamptz not null default now(),
  check (hasta >= desde)
);

create index lista_espera_orden_idx on lista_espera (estado, creado_en);

create table mensajes (
  id bigint generated always as identity primary key,
  -- Idempotencia: Meta puede mandar el mismo mensaje más de una vez.
  wa_message_id text unique,
  paciente_id text references pacientes (id),
  telefono text not null,
  direccion direccion_mensaje not null,
  tipo text not null,
  texto text,
  creado_en timestamptz not null default now()
);

create index mensajes_telefono_idx on mensajes (telefono, creado_en);

create table handoffs (
  id bigint generated always as identity primary key,
  paciente_id text references pacientes (id),
  telefono text not null,
  motivo text not null,
  estado estado_handoff not null default 'pendiente',
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz
);

alter table profesionales enable row level security;
alter table prestaciones enable row level security;
alter table profesional_prestaciones enable row level security;
alter table pacientes enable row level security;
alter table turnos enable row level security;
alter table lista_espera enable row level security;
alter table mensajes enable row level security;
alter table handoffs enable row level security;
