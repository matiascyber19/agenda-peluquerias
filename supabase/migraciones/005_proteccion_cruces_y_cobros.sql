-- Migración 005: la base impide citas cruzadas y cobros dobles
--
-- 1. Un peluquero no puede tener dos citas que se crucen. La app ya lo revisa
--    antes de guardar y la reserva en línea usa un candado, pero dos personas
--    guardando al mismo tiempo desde el panel podían crear un cruce. Ahora lo
--    impide la base, con una restricción EXCLUDE sobre el peluquero y el
--    horario. Aplica a las citas que ocupan horario: todas menos cancelada,
--    no_show y rechazada (las mismas que excluye la app).
-- 2. Una cita tiene como máximo un cobro (índice único en ventas.cita_id).
--
-- Si ya hay citas que se cruzan o citas con más de un cobro, la migración se
-- detiene sin cambiar nada y muestra cuáles son, para corregirlas primero.
--
-- Uso: Supabase → SQL Editor → pegar todo el archivo → Run. Se puede ejecutar
-- más de una vez. La última consulta muestra el resultado esperado.

begin;

-- Necesaria para combinar "mismo peluquero" (=) con "horario cruzado" (&&)
create extension if not exists btree_gist with schema extensions;

-- 0. Revisar los datos que ya existen
do $$
declare
  v_cruces text;
  v_cobros text;
begin
  select string_agg(
           format('  %s y %s, el %s',
                  a.id, b.id,
                  to_char(a.inicio at time zone 'America/Santiago', 'DD-MM-YYYY HH24:MI')),
           e'\n')
    into v_cruces
    from public.citas a
    join public.citas b
      on b.peluquero_id = a.peluquero_id
     and b.id > a.id
     and tstzrange(a.inicio, a.fin, '[)') && tstzrange(b.inicio, b.fin, '[)')
   where coalesce(a.estado, '') not in ('cancelada', 'no_show', 'rechazada')
     and coalesce(b.estado, '') not in ('cancelada', 'no_show', 'rechazada');

  if v_cruces is not null then
    raise exception e'Hay citas del mismo peluquero que se cruzan. Cancela o mueve una de cada par y vuelve a ejecutar:\n%', v_cruces;
  end if;

  select string_agg(format('  cita %s: %s cobros', cita_id, n), e'\n')
    into v_cobros
    from (select cita_id, count(*) as n
            from public.ventas
           where cita_id is not null
           group by cita_id
          having count(*) > 1) dobles;

  if v_cobros is not null then
    raise exception e'Hay citas con más de un cobro. Anula los que sobran y vuelve a ejecutar:\n%', v_cobros;
  end if;
end $$;

-- 1. Sin citas cruzadas para un mismo peluquero
alter table public.citas drop constraint if exists citas_sin_cruces;
alter table public.citas add constraint citas_sin_cruces
  exclude using gist (
    peluquero_id with =,
    tstzrange(inicio, fin, '[)') with &&
  )
  where (estado is null or estado not in ('cancelada', 'no_show', 'rechazada'));

-- 2. Un cobro por cita
create unique index if not exists ventas_una_por_cita
  on public.ventas (cita_id)
  where cita_id is not null;

commit;

-- Verificación: todo en true
select
  exists (select 1 from pg_constraint
           where conname = 'citas_sin_cruces'
             and conrelid = 'public.citas'::regclass) as citas_sin_cruces,
  exists (select 1 from pg_indexes
           where schemaname = 'public'
             and indexname = 'ventas_una_por_cita') as un_cobro_por_cita;

-- Para deshacer (solo si algo falla):
--   alter table public.citas drop constraint if exists citas_sin_cruces;
--   drop index if exists public.ventas_una_por_cita;
