-- TurnoListo: lo que necesita el bot para guardar su estado y el panel de recepción para leerlo (P1-G3).

-- Estado de cada conversación de WhatsApp (historial corto, fallos seguidos, pausa por derivación).
create table conversaciones (
  telefono text primary key,
  historial jsonb not null default '[]'::jsonb,
  fallos integer not null default 0,
  pausado boolean not null default false,
  reprogramando text references turnos (id),
  actualizado_en timestamptz not null default now()
);

-- Idempotencia del webhook: cada message_id de Meta se procesa una sola vez.
create table mensajes_procesados (
  id text primary key,
  creado_en timestamptz not null default now()
);

-- Turno liberado que se le ofreció a alguien de la lista de espera.
create table ofertas (
  entrada_id text primary key references lista_espera (id) on delete cascade,
  paciente_id text not null references pacientes (id),
  profesional_id text not null references profesionales (id),
  prestacion_id text not null references prestaciones (id),
  inicio timestamptz not null,
  creado_en timestamptz not null default now()
);

alter table handoffs add column resumen text not null default '';
alter table mensajes add column tipo_detalle text;

-- Personal de la clínica: solo estas cuentas ven el panel (aunque alguien se registre con la clave pública).
create table staff (
  email text primary key,
  nombre text not null
);

create or replace function es_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where email = auth.jwt() ->> 'email');
$$;

alter table conversaciones enable row level security;
alter table mensajes_procesados enable row level security;
alter table ofertas enable row level security;
alter table staff enable row level security;

-- Lectura para el personal en todas las tablas del panel.
create policy staff_lee on profesionales for select to authenticated using (es_staff());
create policy staff_lee on prestaciones for select to authenticated using (es_staff());
create policy staff_lee on pacientes for select to authenticated using (es_staff());
create policy staff_lee on turnos for select to authenticated using (es_staff());
create policy staff_lee on lista_espera for select to authenticated using (es_staff());
create policy staff_lee on mensajes for select to authenticated using (es_staff());
create policy staff_lee on handoffs for select to authenticated using (es_staff());
create policy staff_lee on conversaciones for select to authenticated using (es_staff());

-- Lo que recepción puede cambiar desde el panel: estado de turnos, derivaciones y pausa del bot.
create policy staff_actualiza on turnos for update to authenticated using (es_staff()) with check (es_staff());
create policy staff_actualiza on handoffs for update to authenticated using (es_staff()) with check (es_staff());
create policy staff_actualiza on conversaciones for update to authenticated using (es_staff()) with check (es_staff());
