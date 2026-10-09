-- Migración 006: equipo con roles, comisiones, reglas de reserva y propuestas
--
-- 1. Reglas de reserva configurables por peluquería (antes fijas en la 003):
--    reserva en línea activa, confirmación automática, anticipación mínima,
--    días hacia adelante, intervalo entre horas y máximo de pendientes.
-- 2. Propuestas: la peluquería puede proponer otra hora y el cliente la acepta
--    o la rechaza con un enlace (estado 'propuesta'). Las solicitudes y
--    propuestas sin respuesta vencen solas cuando llega su hora.
-- 3. Comisiones: al registrar un cobro se calcula la comisión del peluquero
--    con su porcentaje; al anular el cobro se borra (si no está pagada).
-- 4. Equipo: cuentas de peluquero y recepcionista con invitación, y permisos
--    por rol en todas las tablas (RLS).
--      dueño          todo
--      recepcionista  agenda, solicitudes, clientes y cobros
--      peluquero      sus propias citas y cobros, y sus comisiones
--    Una cuenta desactivada pierde el acceso.
--
-- Uso: Supabase → SQL Editor → pegar todo el archivo → Run. Se puede ejecutar
-- más de una vez. La última consulta muestra el resultado esperado.

begin;

-- ============================================================
-- 1. Reglas de reserva
-- ============================================================
alter table public.peluquerias
  add column if not exists reserva_activa boolean not null default true,
  add column if not exists reserva_confirmacion_automatica boolean not null default false,
  add column if not exists reserva_anticipacion_min integer not null default 120,
  add column if not exists reserva_dias_max integer not null default 30,
  add column if not exists reserva_intervalo_min integer not null default 15,
  add column if not exists reserva_max_pendientes integer not null default 2;

alter table public.peluquerias drop constraint if exists reglas_reserva_validas;
alter table public.peluquerias add constraint reglas_reserva_validas check (
  reserva_anticipacion_min between 0 and 10080
  and reserva_dias_max between 1 and 180
  and reserva_intervalo_min in (5, 10, 15, 20, 30, 60)
  and reserva_max_pendientes between 1 and 10
);

-- La 004 dejó editables solo ciertas columnas: se suman las reglas.
grant update (reserva_activa, reserva_confirmacion_automatica, reserva_anticipacion_min,
              reserva_dias_max, reserva_intervalo_min, reserva_max_pendientes)
  on table public.peluquerias to authenticated;

-- ============================================================
-- 2. Estado 'propuesta' y datos de la propuesta
-- ============================================================
alter table public.citas drop constraint if exists estado_valido;
alter table public.citas add constraint estado_valido check (
  estado in ('pendiente', 'confirmada', 'completada', 'cancelada', 'no_show',
             'solicitada', 'rechazada', 'propuesta')
);

alter table public.citas
  add column if not exists propuesta_token text,
  add column if not exists inicio_solicitado timestamptz;

create unique index if not exists citas_propuesta_token_idx
  on public.citas (propuesta_token)
  where propuesta_token is not null;

-- Horas libres: ahora con las reglas de cada peluquería
create or replace function public.reserva_horas_libres(
  p_peluqueria_id uuid,
  p_fecha date,
  p_duracion integer,
  p_peluquero_id uuid default null
)
returns table (inicio timestamptz, peluquero_id uuid)
language sql
stable
set search_path = public, pg_temp
as $$
  with reglas as (
    select (now() at time zone 'America/Santiago')::date as hoy,
           now() + make_interval(mins => pq.reserva_anticipacion_min) as primer_inicio,
           pq.reserva_dias_max as dias_max,
           pq.reserva_intervalo_min * 60 as paso
      from peluquerias pq
     where pq.id = p_peluqueria_id
  ),
  candidatos as (
    -- Cada franja se recorre según el intervalo de la peluquería (en segundos
    -- desde medianoche), alineado a sus múltiplos, hasta donde alcance el servicio.
    select h.peluquero_id,
           (p_fecha::timestamp + make_interval(secs => s)) at time zone 'America/Santiago' as inicio
      from horarios h
      join peluqueros p on p.id = h.peluquero_id
     cross join reglas r
     cross join lateral generate_series(
             ceil(extract(epoch from h.hora_inicio) / r.paso) * r.paso,
             extract(epoch from h.hora_fin) - p_duracion * 60,
             r.paso
           ) as s
     where p.peluqueria_id = p_peluqueria_id
       and coalesce(p.activo, true)
       and coalesce(h.activo, true)
       and (p_peluquero_id is null or p.id = p_peluquero_id)
       and h.dia_semana = extract(dow from p_fecha)
  )
  select c.inicio, c.peluquero_id
    from candidatos c
   cross join reglas r
   where p_fecha between r.hoy and r.hoy + r.dias_max
     and c.inicio >= r.primer_inicio
     and not exists (
           select 1
             from citas ci
            where ci.peluquero_id = c.peluquero_id
              and coalesce(ci.estado, '') not in ('cancelada', 'no_show', 'rechazada')
              and ci.inicio < c.inicio + make_interval(mins => p_duracion)
              and ci.fin > c.inicio
         )
     and not exists (
           select 1
             from bloqueos b
            where b.peluqueria_id = p_peluqueria_id
              and (b.peluquero_id is null or b.peluquero_id = c.peluquero_id)
              and b.inicio < c.inicio + make_interval(mins => p_duracion)
              and b.fin > c.inicio
         )
$$;

-- Página pública: suma las reglas que necesita la página
create or replace function public.reserva_peluqueria(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'nombre', p.nombre,
           'telefono', p.telefono,
           'direccion', p.direccion,
           'comuna', p.comuna,
           'reglas', jsonb_build_object(
             'activa', p.reserva_activa,
             'confirmacion_automatica', p.reserva_confirmacion_automatica,
             'dias_max', p.reserva_dias_max
           ),
           'servicios', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', s.id,
                      'nombre', s.nombre,
                      'descripcion', s.descripcion,
                      'duracion_minutos', s.duracion_minutos,
                      'precio_clp', s.precio_clp
                    ) order by s.nombre)
               from servicios s
              where s.peluqueria_id = p.id
                and coalesce(s.activo, true)
           ), '[]'::jsonb),
           -- Solo peluqueros activos con horario: los demás no pueden recibir reservas.
           'peluqueros', coalesce((
             select jsonb_agg(jsonb_build_object('id', pe.id, 'nombre', pe.nombre) order by pe.nombre)
               from peluqueros pe
              where pe.peluqueria_id = p.id
                and coalesce(pe.activo, true)
                and exists (
                      select 1 from horarios h
                       where h.peluquero_id = pe.id and coalesce(h.activo, true)
                    )
           ), '[]'::jsonb)
         )
    from peluquerias p
   where p.slug = p_slug
$$;

create or replace function public.reserva_disponibilidad(
  p_slug text,
  p_fecha date,
  p_servicio_ids uuid[],
  p_peluquero_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_peluqueria_id uuid;
  v_activa boolean;
  v_duracion integer;
begin
  select id, reserva_activa into v_peluqueria_id, v_activa from peluquerias where slug = p_slug;
  if v_peluqueria_id is null then
    return null;
  end if;
  if not v_activa then
    raise exception 'Esta peluquería no está recibiendo reservas en línea';
  end if;
  if p_fecha is null then
    raise exception 'Elige un día';
  end if;

  v_duracion := reserva_duracion(v_peluqueria_id, p_servicio_ids);

  if p_peluquero_id is not null and not exists (
       select 1 from peluqueros
        where id = p_peluquero_id
          and peluqueria_id = v_peluqueria_id
          and coalesce(activo, true)
     ) then
    raise exception 'Ese peluquero no está disponible';
  end if;

  return jsonb_build_object(
    'fecha', p_fecha,
    'duracion_minutos', v_duracion,
    'horas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'inicio', l.inicio,
               'hora', to_char(l.inicio at time zone 'America/Santiago', 'HH24:MI')
             ) order by l.inicio)
        from (
          select distinct h.inicio
            from reserva_horas_libres(v_peluqueria_id, p_fecha, v_duracion, p_peluquero_id) h
        ) l
    ), '[]'::jsonb)
  );
end;
$$;

-- Reserva: respeta las reglas y, con confirmación automática, nace confirmada
create or replace function public.reserva_crear(
  p_slug text,
  p_servicio_ids uuid[],
  p_peluquero_id uuid,
  p_inicio timestamptz,
  p_nombre text,
  p_telefono text,
  p_email text default null,
  p_notas text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_peluqueria peluquerias%rowtype;
  v_duracion integer;
  v_fecha date;
  v_peluquero_id uuid;
  v_cliente_id uuid;
  v_bloqueado boolean;
  v_cita_id uuid;
  v_estado text;
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_telefono text := btrim(coalesce(p_telefono, ''));
  v_digitos integer := length(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'));
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_notas text := nullif(btrim(coalesce(p_notas, '')), '');
begin
  select * into v_peluqueria from peluquerias where slug = p_slug;
  if v_peluqueria.id is null then
    raise exception 'La peluquería no existe';
  end if;
  if not v_peluqueria.reserva_activa then
    raise exception 'Esta peluquería no está recibiendo reservas en línea';
  end if;

  if char_length(v_nombre) < 2 or char_length(v_nombre) > 120 then
    raise exception 'Escribe tu nombre (entre 2 y 120 letras)';
  end if;
  if v_digitos < 8 or v_digitos > 15 or char_length(v_telefono) > 20 then
    raise exception 'El teléfono debe tener entre 8 y 15 dígitos';
  end if;
  if v_email is not null and (char_length(v_email) > 120 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$') then
    raise exception 'El correo no es válido';
  end if;
  if char_length(coalesce(v_notas, '')) > 500 then
    raise exception 'Las notas pueden tener hasta 500 caracteres';
  end if;
  if p_inicio is null then
    raise exception 'Elige una hora';
  end if;

  v_duracion := reserva_duracion(v_peluqueria.id, p_servicio_ids);

  -- Una reserva a la vez por peluquería, hasta que termine la transacción:
  -- así dos personas no pueden tomar la misma hora al mismo tiempo.
  perform pg_advisory_xact_lock(hashtextextended(v_peluqueria.id::text, 0));

  v_fecha := (p_inicio at time zone 'America/Santiago')::date;

  -- La hora tiene que estar libre. Con "sin preferencia" se asigna el peluquero
  -- libre con menos citas ese día; si empatan, el primero por nombre.
  select h.peluquero_id
    into v_peluquero_id
    from reserva_horas_libres(v_peluqueria.id, v_fecha, v_duracion, p_peluquero_id) h
    join peluqueros p on p.id = h.peluquero_id
   where h.inicio = p_inicio
   order by (
             select count(*)
               from citas c
              where c.peluquero_id = h.peluquero_id
                and coalesce(c.estado, '') not in ('cancelada', 'no_show', 'rechazada')
                and (c.inicio at time zone 'America/Santiago')::date = v_fecha
           ),
           p.nombre
   limit 1;

  if v_peluquero_id is null then
    raise exception 'Esa hora ya no está disponible. Elige otra.';
  end if;

  -- El cliente se identifica por teléfono dentro de la peluquería; si no existe, se crea.
  select id, coalesce(bloqueado, false)
    into v_cliente_id, v_bloqueado
    from clientes
   where peluqueria_id = v_peluqueria.id
     and normalizar_telefono(telefono) = normalizar_telefono(v_telefono)
   order by creado_en
   limit 1;

  if v_cliente_id is null then
    insert into clientes (peluqueria_id, nombre, telefono, email, como_llego)
    values (v_peluqueria.id, v_nombre, v_telefono, v_email, 'reserva en línea')
    returning id into v_cliente_id;
  elsif v_bloqueado then
    -- Mensaje genérico: no se le dice que está bloqueado.
    raise exception 'No pudimos registrar la reserva. Contacta a la peluquería.';
  end if;

  -- Tope de reservas pendientes por cliente (con confirmación automática
  -- también cuentan las confirmadas a futuro).
  if (select count(*) from citas
       where cliente_id = v_cliente_id
         and inicio > now()
         and (estado in ('solicitada', 'propuesta')
              or (v_peluqueria.reserva_confirmacion_automatica and estado = 'confirmada'))
     ) >= v_peluqueria.reserva_max_pendientes then
    raise exception 'Ya tienes % reservas pendientes en esta peluquería. Espera su respuesta o contáctala.',
      v_peluqueria.reserva_max_pendientes;
  end if;

  v_estado := case when v_peluqueria.reserva_confirmacion_automatica then 'confirmada' else 'solicitada' end;

  insert into citas (peluqueria_id, cliente_id, peluquero_id, inicio, fin, estado, notas)
  values (v_peluqueria.id, v_cliente_id, v_peluquero_id, p_inicio,
          p_inicio + make_interval(mins => v_duracion), v_estado, v_notas)
  returning id into v_cita_id;

  -- Precio y duración se toman del catálogo, nunca del cliente.
  insert into cita_servicios (cita_id, servicio_id, precio_congelado_clp, duracion_congelada_min)
  select v_cita_id, s.id, s.precio_clp, s.duracion_minutos
    from servicios s
   where s.id = any (p_servicio_ids);

  return jsonb_build_object(
    'cita_id', v_cita_id,
    'estado', v_estado,
    'inicio', p_inicio,
    'fin', p_inicio + make_interval(mins => v_duracion),
    'peluquero', (select nombre from peluqueros where id = v_peluquero_id),
    'servicios', (
      select jsonb_agg(jsonb_build_object(
               'nombre', s.nombre,
               'duracion_minutos', s.duracion_minutos,
               'precio_clp', s.precio_clp
             ) order by s.nombre)
        from servicios s
       where s.id = any (p_servicio_ids)
    ),
    'total_clp', (select sum(precio_clp) from servicios where id = any (p_servicio_ids))
  );
end;
$$;

-- Pública: lo que ve el cliente al abrir el enlace de una propuesta
create or replace function public.propuesta_ver(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'estado', c.estado,
           'vigente', c.estado = 'propuesta' and c.inicio > now(),
           'peluqueria', p.nombre,
           'telefono', p.telefono,
           'inicio', c.inicio,
           'fin', c.fin,
           'inicio_solicitado', c.inicio_solicitado,
           'peluquero', pe.nombre,
           'cliente', split_part(btrim(cl.nombre), ' ', 1),
           'servicios', coalesce((
             select jsonb_agg(jsonb_build_object('nombre', s.nombre, 'precio_clp', cs.precio_congelado_clp)
                              order by s.nombre)
               from cita_servicios cs
               join servicios s on s.id = cs.servicio_id
              where cs.cita_id = c.id
           ), '[]'::jsonb),
           'total_clp', (select coalesce(sum(precio_congelado_clp), 0) from cita_servicios where cita_id = c.id)
         )
    from citas c
    join peluquerias p on p.id = c.peluqueria_id
    left join peluqueros pe on pe.id = c.peluquero_id
    left join clientes cl on cl.id = c.cliente_id
   where length(coalesce(p_token, '')) >= 32
     and c.propuesta_token = p_token
$$;

-- Pública: el cliente acepta o rechaza la hora propuesta
create or replace function public.propuesta_responder(p_token text, p_acepta boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cita_id uuid;
  v_estado text;
  v_inicio timestamptz;
  v_nuevo text := case when p_acepta then 'confirmada' else 'rechazada' end;
begin
  select id, estado, inicio into v_cita_id, v_estado, v_inicio
    from citas
   where length(coalesce(p_token, '')) >= 32
     and propuesta_token = p_token
   for update;

  if v_cita_id is null then
    raise exception 'El enlace no es válido';
  end if;
  if v_estado <> 'propuesta' then
    raise exception 'Esta propuesta ya fue respondida';
  end if;
  if v_inicio <= now() then
    raise exception 'Esta propuesta ya venció';
  end if;

  update citas set estado = v_nuevo where id = v_cita_id;
  return jsonb_build_object('estado', v_nuevo);
end;
$$;

-- Vencimiento: solicitudes y propuestas sin respuesta cuando llega su hora
create or replace function public.vencer_solicitudes()
returns integer
language sql
set search_path = public, pg_temp
as $$
  with vencidas as (
    update public.citas
       set estado = 'rechazada'
     where estado in ('solicitada', 'propuesta')
       and inicio <= now()
    returning 1
  )
  select count(*)::integer from vencidas;
$$;

select cron.schedule('vencer-solicitudes', '*/15 * * * *', 'select public.vencer_solicitudes()');

-- ============================================================
-- 3. Comisiones automáticas
-- ============================================================
create or replace function public.ventas_registrar_comision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_porcentaje integer;
begin
  if new.peluquero_id is null or new.total_clp <= 0 then
    return new;
  end if;
  select coalesce(porcentaje_comision, 0) into v_porcentaje
    from peluqueros where id = new.peluquero_id;
  if coalesce(v_porcentaje, 0) > 0 then
    insert into comisiones (peluqueria_id, peluquero_id, venta_id, monto_clp)
    values (new.peluqueria_id, new.peluquero_id, new.id, round(new.total_clp * v_porcentaje / 100.0));
  end if;
  return new;
end;
$$;

create or replace function public.ventas_anular_comision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from comisiones where venta_id = old.id and coalesce(pagado, false)) then
    raise exception 'La comisión de este cobro ya se pagó: no se puede anular';
  end if;
  delete from comisiones where venta_id = old.id;
  return old;
end;
$$;

drop trigger if exists ventas_registrar_comision on public.ventas;
create trigger ventas_registrar_comision after insert on public.ventas
  for each row execute function public.ventas_registrar_comision();

drop trigger if exists ventas_anular_comision on public.ventas;
create trigger ventas_anular_comision before delete on public.ventas
  for each row execute function public.ventas_anular_comision();

-- ============================================================
-- 4. Equipo y permisos por rol
-- ============================================================

-- Una cuenta desactivada deja de pertenecer a la peluquería
create or replace function public.get_my_peluqueria_id()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select peluqueria_id from public.usuarios where id = auth.uid() and coalesce(activo, true);
$$;

create or replace function public.mi_rol()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select rol::text from public.usuarios where id = auth.uid() and coalesce(activo, true);
$$;

create or replace function public.mi_peluquero_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id
    from public.peluqueros p
    join public.usuarios u on u.id = p.usuario_id
   where u.id = auth.uid() and coalesce(u.activo, true)
   limit 1;
$$;

-- Invitaciones para sumar peluqueros y recepcionistas
create table if not exists public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  peluqueria_id uuid not null references public.peluquerias(id) on delete cascade,
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  rol varchar(20) not null check (rol in ('peluquero', 'recepcionista')),
  peluquero_id uuid,
  creado_por uuid default auth.uid() references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  vence_en timestamptz not null default now() + interval '7 days',
  usada_por uuid references auth.users(id) on delete set null,
  usada_en timestamptz,
  constraint invitacion_peluquero_de_la_peluqueria
    foreign key (peluquero_id, peluqueria_id) references public.peluqueros(id, peluqueria_id) on delete cascade,
  constraint invitacion_peluquero_segun_rol
    check ((rol = 'peluquero') = (peluquero_id is not null))
);
alter table public.invitaciones enable row level security;
-- Explícito: un proyecto de Supabase puede no dar permisos a las tablas nuevas.
grant select, insert, update, delete on table public.invitaciones to authenticated;

-- Pública: datos de una invitación para la página /unirse
create or replace function public.invitacion_ver(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'peluqueria', p.nombre,
           'rol', i.rol,
           'peluquero', pe.nombre,
           'vigente', i.usada_en is null and i.vence_en > now()
         )
    from invitaciones i
    join peluquerias p on p.id = i.peluqueria_id
    left join peluqueros pe on pe.id = i.peluquero_id
   where length(coalesce(p_token, '')) >= 32
     and i.token = p_token
$$;

-- Con sesión: la cuenta recién creada acepta la invitación
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
  end if;

  update invitaciones set usada_por = v_uid, usada_en = now() where id = v_inv.id;

  return jsonb_build_object(
    'peluqueria', (select nombre from peluquerias where id = v_inv.peluqueria_id),
    'rol', v_inv.rol
  );
end;
$$;

-- Con sesión de dueño: activar o desactivar una cuenta del equipo
create or replace function public.equipo_cambiar_estado(p_usuario_id uuid, p_activo boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rol text;
begin
  if public.mi_rol() is distinct from 'dueño' then
    raise exception 'Solo el dueño puede cambiar el equipo';
  end if;
  if p_usuario_id = auth.uid() then
    raise exception 'No puedes desactivar tu propia cuenta';
  end if;
  select rol into v_rol from usuarios
   where id = p_usuario_id and peluqueria_id = public.get_my_peluqueria_id();
  if v_rol is null then
    raise exception 'Esa cuenta no es de tu peluquería';
  end if;
  if v_rol = 'dueño' then
    raise exception 'No se puede desactivar la cuenta del dueño';
  end if;
  update usuarios set activo = coalesce(p_activo, true) where id = p_usuario_id;
end;
$$;

-- Políticas por rol. Se reemplazan las de una sola regla "ALL" por peluquería.
do $$
declare
  v record;
begin
  for v in
    select tablename, policyname from pg_policies
     where schemaname = 'public'
       and tablename in ('bloqueos', 'cita_servicios', 'citas', 'clientes', 'comisiones', 'gastos',
                         'horarios', 'peluquerias', 'peluqueros', 'productos', 'servicios', 'usuarios',
                         'venta_items', 'ventas', 'invitaciones')
  loop
    execute format('drop policy %I on public.%I', v.policyname, v.tablename);
  end loop;
end $$;

-- peluquerias: todos la ven; solo el dueño la configura
create policy peluquerias_ver on public.peluquerias for select
  using (id = (select public.get_my_peluqueria_id()));
create policy peluquerias_editar on public.peluquerias for update
  using (id = (select public.get_my_peluqueria_id()) and (select public.mi_rol()) = 'dueño')
  with check (id = (select public.get_my_peluqueria_id()));

-- usuarios: el dueño ve todo el equipo; los demás, su propia cuenta
create policy usuarios_ver on public.usuarios for select
  using (peluqueria_id = (select public.get_my_peluqueria_id())
         and ((select public.mi_rol()) = 'dueño' or id = (select auth.uid())));

-- Catálogo (peluqueros, servicios, horarios, cierres): todos lo ven; solo el dueño lo cambia
create policy peluqueros_ver on public.peluqueros for select
  using (peluqueria_id = (select public.get_my_peluqueria_id()));
create policy peluqueros_editar on public.peluqueros for all
  using (peluqueria_id = (select public.get_my_peluqueria_id()) and (select public.mi_rol()) = 'dueño')
  with check (peluqueria_id = (select public.get_my_peluqueria_id()) and (select public.mi_rol()) = 'dueño');

create policy servicios_ver on public.servicios for select
  using (peluqueria_id = (select public.get_my_peluqueria_id()));
create policy servicios_editar on public.servicios for all
  using (peluqueria_id = (select public.get_my_peluqueria_id()) and (select public.mi_rol()) = 'dueño')
  with check (peluqueria_id = (select public.get_my_peluqueria_id()) and (select public.mi_rol()) = 'dueño');

create policy horarios_ver on public.horarios for select
  using (peluquero_id in (select p.id from public.peluqueros p
                           where p.peluqueria_id = (select public.get_my_peluqueria_id())));
create policy horarios_editar on public.horarios for all
  using ((select public.mi_rol()) = 'dueño'
         and peluquero_id in (select p.id from public.peluqueros p
                               where p.peluqueria_id = (select public.get_my_peluqueria_id())))
  with check ((select public.mi_rol()) = 'dueño'
              and peluquero_id in (select p.id from public.peluqueros p
                                    where p.peluqueria_id = (select public.get_my_peluqueria_id())));

create policy bloqueos_ver on public.bloqueos for select
  using (peluqueria_id = (select public.get_my_peluqueria_id()));
create policy bloqueos_editar on public.bloqueos for all
  using (peluqueria_id = (select public.get_my_peluqueria_id()) and (select public.mi_rol()) = 'dueño')
  with check (
    peluqueria_id = (select public.get_my_peluqueria_id())
    and (select public.mi_rol()) = 'dueño'
    and (peluquero_id is null
         or peluquero_id in (select p.id from public.peluqueros p
                              where p.peluqueria_id = (select public.get_my_peluqueria_id())))
  );

-- clientes: todos los ven y pueden agregar; dueño y recepción los editan; el dueño los borra
create policy clientes_ver on public.clientes for select
  using (peluqueria_id = (select public.get_my_peluqueria_id()));
create policy clientes_crear on public.clientes for insert
  with check (peluqueria_id = (select public.get_my_peluqueria_id()));
create policy clientes_editar on public.clientes for update
  using (peluqueria_id = (select public.get_my_peluqueria_id())
         and (select public.mi_rol()) in ('dueño', 'recepcionista'))
  with check (peluqueria_id = (select public.get_my_peluqueria_id()));
create policy clientes_borrar on public.clientes for delete
  using (peluqueria_id = (select public.get_my_peluqueria_id()) and (select public.mi_rol()) = 'dueño');

-- citas: dueño y recepción, todas; el peluquero, solo las suyas
create policy citas_ver on public.citas for select
  using (peluqueria_id = (select public.get_my_peluqueria_id())
         and ((select public.mi_rol()) in ('dueño', 'recepcionista')
              or peluquero_id = (select public.mi_peluquero_id())));
create policy citas_crear on public.citas for insert
  with check (peluqueria_id = (select public.get_my_peluqueria_id())
              and ((select public.mi_rol()) in ('dueño', 'recepcionista')
                   or peluquero_id = (select public.mi_peluquero_id())));
create policy citas_editar on public.citas for update
  using (peluqueria_id = (select public.get_my_peluqueria_id())
         and ((select public.mi_rol()) in ('dueño', 'recepcionista')
              or peluquero_id = (select public.mi_peluquero_id())))
  with check (peluqueria_id = (select public.get_my_peluqueria_id())
              and ((select public.mi_rol()) in ('dueño', 'recepcionista')
                   or peluquero_id = (select public.mi_peluquero_id())));
create policy citas_borrar on public.citas for delete
  using (peluqueria_id = (select public.get_my_peluqueria_id()) and (select public.mi_rol()) = 'dueño');

-- cita_servicios: los de las citas que cada uno ve, con servicios de la misma peluquería
create policy cita_servicios_acceso on public.cita_servicios for all
  using (cita_id in (select c.id from public.citas c
                      where c.peluqueria_id = (select public.get_my_peluqueria_id())))
  with check (
    cita_id in (select c.id from public.citas c
                 where c.peluqueria_id = (select public.get_my_peluqueria_id()))
    and servicio_id in (select s.id from public.servicios s
                         where s.peluqueria_id = (select public.get_my_peluqueria_id()))
  );

-- ventas (cobros): dueño y recepción, todas; el peluquero ve y cobra las suyas
create policy ventas_ver on public.ventas for select
  using (peluqueria_id = (select public.get_my_peluqueria_id())
         and ((select public.mi_rol()) in ('dueño', 'recepcionista')
              or peluquero_id = (select public.mi_peluquero_id())));
create policy ventas_crear on public.ventas for insert
  with check (peluqueria_id = (select public.get_my_peluqueria_id())
              and ((select public.mi_rol()) in ('dueño', 'recepcionista')
                   or peluquero_id = (select public.mi_peluquero_id())));
create policy ventas_anular on public.ventas for delete
  using (peluqueria_id = (select public.get_my_peluqueria_id())
         and (select public.mi_rol()) in ('dueño', 'recepcionista'));
create policy ventas_editar on public.ventas for update
  using (peluqueria_id = (select public.get_my_peluqueria_id()) and (select public.mi_rol()) = 'dueño')
  with check (peluqueria_id = (select public.get_my_peluqueria_id()));

create policy venta_items_acceso on public.venta_items for all
  using (venta_id in (select v.id from public.ventas v
                       where v.peluqueria_id = (select public.get_my_peluqueria_id())))
  with check (venta_id in (select v.id from public.ventas v
                            where v.peluqueria_id = (select public.get_my_peluqueria_id())));

-- comisiones: el dueño las administra; cada peluquero ve las suyas
create policy comisiones_ver on public.comisiones for select
  using (peluqueria_id = (select public.get_my_peluqueria_id())
         and ((select public.mi_rol()) = 'dueño' or peluquero_id = (select public.mi_peluquero_id())));
create policy comisiones_editar on public.comisiones for all
  using (peluqueria_id = (select public.get_my_peluqueria_id()) and (select public.mi_rol()) = 'dueño')
  with check (peluqueria_id = (select public.get_my_peluqueria_id()) and (select public.mi_rol()) = 'dueño');

-- Solo el dueño: gastos, productos e invitaciones
create policy gastos_dueno on public.gastos for all
  using (peluqueria_id = (select public.get_my_peluqueria_id()) and (select public.mi_rol()) = 'dueño')
  with check (peluqueria_id = (select public.get_my_peluqueria_id()) and (select public.mi_rol()) = 'dueño');
create policy productos_dueno on public.productos for all
  using (peluqueria_id = (select public.get_my_peluqueria_id()) and (select public.mi_rol()) = 'dueño')
  with check (peluqueria_id = (select public.get_my_peluqueria_id()) and (select public.mi_rol()) = 'dueño');
create policy invitaciones_dueno on public.invitaciones for all
  using (peluqueria_id = (select public.get_my_peluqueria_id()) and (select public.mi_rol()) = 'dueño')
  with check (peluqueria_id = (select public.get_my_peluqueria_id()) and (select public.mi_rol()) = 'dueño');

-- ============================================================
-- 5. Permisos de las funciones
-- ============================================================
-- Públicas (sin sesión)
revoke execute on function public.propuesta_ver(text) from public;
revoke execute on function public.propuesta_responder(text, boolean) from public;
revoke execute on function public.invitacion_ver(text) from public;
grant execute on function public.propuesta_ver(text) to anon, authenticated;
grant execute on function public.propuesta_responder(text, boolean) to anon, authenticated;
grant execute on function public.invitacion_ver(text) to anon, authenticated;

-- Solo con sesión
revoke execute on function public.invitacion_aceptar(text, text) from public, anon;
revoke execute on function public.equipo_cambiar_estado(uuid, boolean) from public, anon;
grant execute on function public.invitacion_aceptar(text, text) to authenticated;
grant execute on function public.equipo_cambiar_estado(uuid, boolean) to authenticated;

-- Internas: nadie las llama desde la API
revoke execute on function public.vencer_solicitudes() from public, anon, authenticated;
revoke execute on function public.ventas_registrar_comision() from public, anon, authenticated;
revoke execute on function public.ventas_anular_comision() from public, anon, authenticated;

commit;

-- Verificación: todo en true
select
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'peluquerias'
             and column_name = 'reserva_confirmacion_automatica') as reglas_de_reserva,
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'citas'
             and column_name = 'propuesta_token') as propuestas,
  exists (select 1 from pg_trigger where tgname = 'ventas_registrar_comision') as comisiones,
  exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'invitaciones') as invitaciones,
  (select count(*) from pg_policies where schemaname = 'public') = 30 as politicas_por_rol,
  exists (select 1 from cron.job where jobname = 'vencer-solicitudes') as vencimiento_programado;
