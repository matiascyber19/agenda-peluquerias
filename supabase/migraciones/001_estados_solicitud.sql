-- Migración A: estados de la reserva en línea (docs/plan-reserva-en-linea.md §6.1)
--
-- Agrega 'solicitada' (reserva en línea esperando respuesta) y 'rechazada'
-- (solicitud que el encargado rechazó) a los estados válidos de una cita.
-- No rompe nada: todas las filas actuales siguen siendo válidas.
--
-- Uso: Supabase → SQL Editor → pegar → Run.

begin;

alter table public.citas drop constraint estado_valido;

alter table public.citas add constraint estado_valido check (
  estado in (
    'pendiente', 'confirmada', 'completada', 'cancelada', 'no_show',
    'solicitada', 'rechazada'
  )
);

commit;

-- Verificación (ejecutar después): debe listar los 7 estados.
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'estado_valido';
