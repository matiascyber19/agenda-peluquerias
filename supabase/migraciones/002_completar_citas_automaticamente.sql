-- Migración 002: cierre automático de citas (docs/plan-reserva-en-linea.md §6.2)
--
-- Una cita 'confirmada' pasa sola a 'completada' una hora después de su fin.
-- La peluquería solo marca las excepciones ("No llegó", "Cancelada") desde el
-- detalle de la cita. Las citas 'pendiente' y 'solicitada' no se tocan.
--
-- Uso: Supabase → SQL Editor → pegar → Run. Se puede ejecutar más de una vez:
-- la función se reemplaza y el job con el mismo nombre se sobrescribe.

-- 1. Activar pg_cron (equivale a Integrations → Cron en el dashboard)
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- 2. Función que cierra las citas confirmadas que ya terminaron
create or replace function public.completar_citas_terminadas()
returns integer
language sql
set search_path = public, pg_temp
as $$
  with cerradas as (
    update public.citas
       set estado = 'completada'
     where estado = 'confirmada'
       and fin < now() - interval '1 hour'
    returning 1
  )
  select count(*)::integer from cerradas;
$$;

-- Solo la tarea programada la ejecuta: nadie puede llamarla desde la API.
revoke execute on function public.completar_citas_terminadas() from public, anon, authenticated;

-- 3. Ejecutarla cada 15 minutos
select cron.schedule(
  'completar-citas-terminadas',
  '*/15 * * * *',
  'select public.completar_citas_terminadas()'
);

-- Verificación (después de ejecutar):
--   select jobname, schedule, command, active from cron.job;
--   select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
-- Para desactivarla:
--   select cron.unschedule('completar-citas-terminadas');
