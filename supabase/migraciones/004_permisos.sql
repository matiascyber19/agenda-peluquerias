-- Migración 004: permisos más estrictos para las cuentas de la app
--
-- Hasta ahora cada tabla tenía una sola política "ALL" por peluquería. Eso
-- dejaba que una cuenta, llamando directo a la API de Supabase:
--   1. cambiara el plan y el vencimiento de su peluquería, o la borrara;
--   2. cambiara su propio rol o agregara y borrara cuentas de su peluquería;
--   3. asociara a sus citas servicios de otra peluquería (los ids se ven en la
--      página pública de reservas). Esa otra peluquería ya no podría borrar
--      esos servicios, porque cita_servicios los referencia con RESTRICT.
--      Lo mismo con peluqueros de otra peluquería en sus cierres.
--
-- Las funciones SECURITY DEFINER (registrar_peluqueria, reserva_crear y el
-- cierre automático de citas) corren como dueño de la base: no les afecta.
--
-- Uso: Supabase → SQL Editor → pegar todo el archivo → Run. Se puede ejecutar
-- más de una vez. La última consulta muestra el resultado esperado.

begin;

-- 1. peluquerias: la peluquería edita sus datos de perfil y contacto, pero no
--    su plan ni el vencimiento. Crear peluquerías solo con registrar_peluqueria.
revoke insert, update, delete on table public.peluquerias from anon, authenticated;
grant update (nombre, slug, direccion, comuna, telefono, email, logo_url)
  on table public.peluquerias to authenticated;

-- 2. usuarios: la app solo los lee. Las cuentas se crean con registrar_peluqueria.
revoke insert, update, delete on table public.usuarios from anon, authenticated;

-- 3. Lo que se asocia tiene que ser de la misma peluquería
alter policy usuario_ve_servicios_citas on public.cita_servicios
  with check (
    cita_id in (select c.id from public.citas c where c.peluqueria_id = public.get_my_peluqueria_id())
    and servicio_id in (select s.id from public.servicios s where s.peluqueria_id = public.get_my_peluqueria_id())
  );

alter policy usuario_ve_sus_bloqueos on public.bloqueos
  with check (
    peluqueria_id = public.get_my_peluqueria_id()
    and (
      peluquero_id is null
      or peluquero_id in (select p.id from public.peluqueros p where p.peluqueria_id = public.get_my_peluqueria_id())
    )
  );

commit;

-- Verificación: todo en true
select
  not has_table_privilege('authenticated', 'public.peluquerias', 'INSERT, DELETE') as peluquerias_sin_crear_ni_borrar,
  not has_column_privilege('authenticated', 'public.peluquerias', 'plan', 'UPDATE') as plan_bloqueado,
  not has_column_privilege('authenticated', 'public.peluquerias', 'fecha_vencimiento_plan', 'UPDATE') as vencimiento_bloqueado,
  has_column_privilege('authenticated', 'public.peluquerias', 'telefono', 'UPDATE') as contacto_editable,
  not has_table_privilege('authenticated', 'public.usuarios', 'INSERT, UPDATE, DELETE') as usuarios_solo_lectura,
  (select count(*) = 2 from pg_policies
    where schemaname = 'public'
      and policyname in ('usuario_ve_servicios_citas', 'usuario_ve_sus_bloqueos')
      and with_check is not null) as politicas_con_check;

-- Para deshacer (solo si algo falla):
--   grant insert, update, delete on table public.peluquerias, public.usuarios to anon, authenticated;
--   alter policy usuario_ve_servicios_citas on public.cita_servicios
--     with check (cita_id in (select c.id from public.citas c where c.peluqueria_id = public.get_my_peluqueria_id()));
--   alter policy usuario_ve_sus_bloqueos on public.bloqueos
--     with check (peluqueria_id = public.get_my_peluqueria_id());
