-- Tabla del ranking de Snake Cogue Pite. Pegar en Supabase → SQL Editor → Run.
-- Cualquier visitante puede insertar UNA fila válida y leer el top; nadie
-- anónimo puede editar ni borrar. Los CHECK ponen techo a las trampas burdas.

create table if not exists public.puntuaciones (
  id        bigint generated always as identity primary key,
  nombre    text not null check (char_length(nombre) between 1 and 12),
  puntos    integer not null check (puntos between 0 and 5000000),
  cola      integer not null default 0 check (cola between 0 and 2000),
  tiempo    integer not null default 0 check (tiempo between 0 and 86400),
  mecanica  text not null default '' check (char_length(mecanica) <= 60),
  creado    timestamptz not null default now()
);

create index if not exists puntuaciones_puntos_idx on public.puntuaciones (puntos desc, creado asc);

alter table public.puntuaciones enable row level security;

drop policy if exists "leer ranking" on public.puntuaciones;
create policy "leer ranking" on public.puntuaciones
  for select to anon using (true);

drop policy if exists "enviar puntuacion" on public.puntuaciones;
create policy "enviar puntuacion" on public.puntuaciones
  for insert to anon with check (true);

-- Sin políticas de update/delete: los anónimos no pueden tocar lo ya guardado.
