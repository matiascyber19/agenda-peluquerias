-- Migración 007: invitar peluqueros sin crear su ficha antes
--
-- Antes, para invitar a un peluquero había que crear su ficha en Peluqueros y
-- elegirla en la invitación. Ahora la invitación de peluquero puede ir sin
-- ficha: al aceptarla, la base crea la ficha con el nombre de la persona y la
-- deja vinculada a su cuenta. Así aparece sola en Peluqueros, con su color en
-- la agenda, sus comisiones y las opciones de editarla o desactivarla.
-- Invitar a una ficha que ya existe sigue funcionando igual.
--
-- Uso: Supabase → SQL Editor → pegar todo el archivo → Run. Se puede ejecutar
-- más de una vez. La última consulta muestra el resultado esperado.

begin;

-- 1. La ficha es opcional en las invitaciones de peluquero. Una invitación de
--    recepcionista sigue sin ficha.
alter table public.invitaciones drop constraint if exists invitacion_peluquero_segun_rol;
alter table public.invitaciones drop constraint if exists invitacion_ficha_solo_peluquero;
alter table public.invitaciones add constraint invitacion_ficha_solo_peluquero
  check (peluquero_id is null or rol = 'peluquero');

-- 2. Aceptar la invitación: si es de peluquero y no trae ficha, se crea una
--    con el nombre de la persona y el color de agenda menos usado.
create or replace function public.invitacion_aceptar(p_token text, p_nombre text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_inv invitaciones%rowtype;
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_color text;
begin
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;
  if exists (select 1 from usuarios where id = v_uid) then
    raise exception 'Esta cuenta ya pertenece a una peluquería';
  end if;
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 120 then
    raise exception 'Escribe tu nombre (entre 2 y 120 letras)';
  end if;

  select * into v_inv from invitaciones
   where length(coalesce(p_token, '')) >= 32 and token = p_token
   for update;
  if v_inv.id is null or v_inv.usada_en is not null or v_inv.vence_en <= now() then
    raise exception 'La invitación no es válida o ya venció. Pide una nueva.';
  end if;
  if v_inv.peluquero_id is not null
     and exists (select 1 from peluqueros where id = v_inv.peluquero_id and usuario_id is not null) then
    raise exception 'Ese peluquero ya tiene una cuenta';
  end if;

  insert into usuarios (id, peluqueria_id, nombre, email, rol)
  values (v_uid, v_inv.peluqueria_id, v_nombre, (select email from auth.users where id = v_uid), v_inv.rol);

  if v_inv.peluquero_id is not null then
    update peluqueros set usuario_id = v_uid where id = v_inv.peluquero_id;
  elsif v_inv.rol = 'peluquero' then
    -- Los mismos colores que sugiere la app al crear un peluquero
    select c.color into v_color
      from unnest(array['#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#f97316', '#14b8a6'])
           with ordinality as c(color, orden)
     order by (select count(*) from peluqueros p
                where p.peluqueria_id = v_inv.peluqueria_id
                  and coalesce(p.activo, true)
                  and lower(p.color_agenda) = c.color),
              c.orden
     limit 1;

    insert into peluqueros (peluqueria_id, usuario_id, nombre, color_agenda)
    values (v_inv.peluqueria_id, v_uid, v_nombre, v_color);
  end if;

  update invitaciones set usada_por = v_uid, usada_en = now() where id = v_inv.id;

  return jsonb_build_object(
    'peluqueria', (select nombre from peluquerias where id = v_inv.peluqueria_id),
    'rol', v_inv.rol
  );
end;
$$;

revoke execute on function public.invitacion_aceptar(text, text) from public, anon;
grant execute on function public.invitacion_aceptar(text, text) to authenticated;

commit;

-- Verificación: todo en true
select
  not exists (select 1 from pg_constraint where conname = 'invitacion_peluquero_segun_rol') as ficha_opcional,
  exists (select 1 from pg_constraint where conname = 'invitacion_ficha_solo_peluquero') as ficha_solo_de_peluquero,
  position('insert into peluqueros' in pg_get_functiondef('public.invitacion_aceptar(text, text)'::regprocedure)) > 0
    as crea_la_ficha_al_unirse;
