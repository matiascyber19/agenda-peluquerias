-- Migración 003: funciones de la reserva en línea (docs/plan-reserva-en-linea.md §6.3 y §6.4)
--
-- Tres funciones públicas, que se pueden llamar sin sesión, y dos auxiliares
-- privadas. Las públicas son SECURITY DEFINER: leen lo justo para reservar y
-- nunca devuelven el correo de la peluquería ni datos de clientes o citas.
--
-- Reglas fijas de la etapa 1: reservas con al menos 2 horas de anticipación,
-- hasta 30 días hacia adelante, horas cada 15 minutos y como máximo 2
-- solicitudes esperando respuesta por cliente.
--
-- Uso: Supabase → SQL Editor → pegar → Run. Se puede ejecutar más de una vez.

begin;

-- 1. Teléfono normalizado: últimos 9 dígitos ("+56 9 6666 6666" = "966666666")
create or replace function public.normalizar_telefono(p_telefono text)
returns text
language sql
immutable
set search_path = ''
as $$
  select right(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), 9)
$$;

create index if not exists clientes_peluqueria_telefono_idx
  on public.clientes (peluqueria_id, public.normalizar_telefono(telefono));

-- 2. Auxiliar privada: valida los servicios elegidos y devuelve la duración total
create or replace function public.reserva_duracion(p_peluqueria_id uuid, p_servicio_ids uuid[])
returns integer
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_cantidad integer := coalesce(cardinality(p_servicio_ids), 0);
  v_validos integer;
  v_total integer;
begin
  if v_cantidad = 0 or v_cantidad > 5 then
    raise exception 'Elige entre 1 y 5 servicios';
  end if;
  if (select count(distinct id) from unnest(p_servicio_ids) as id) <> v_cantidad then
    raise exception 'Elegiste un servicio más de una vez';
  end if;

  select count(*), sum(duracion_minutos)
    into v_validos, v_total
    from servicios
   where peluqueria_id = p_peluqueria_id
     and coalesce(activo, true)
     and id = any (p_servicio_ids);

  if v_validos <> v_cantidad then
    raise exception 'Algún servicio ya no está disponible';
  end if;
  return v_total;
end;
$$;

-- 3. Auxiliar privada: horas de inicio libres para una fecha (hora de Chile),
--    una fila por peluquero libre en esa hora.
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
           now() + interval '2 hours' as primer_inicio
  ),
  candidatos as (
    -- Cada franja del horario se recorre cada 15 minutos (en segundos desde
    -- medianoche), alineado a :00, :15, :30 y :45, hasta donde alcance el servicio.
    select h.peluquero_id,
           (p_fecha::timestamp + make_interval(secs => s)) at time zone 'America/Santiago' as inicio
      from horarios h
      join peluqueros p on p.id = h.peluquero_id
     cross join lateral generate_series(
             ceil(extract(epoch from h.hora_inicio) / 900) * 900,
             extract(epoch from h.hora_fin) - p_duracion * 60,
             900
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
   where p_fecha between r.hoy and r.hoy + 30
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

-- 4. Pública: datos para mostrar la página de reservas. null si el slug no existe.
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

-- 5. Pública: horas libres de un día para los servicios elegidos.
--    p_peluquero_id null = "sin preferencia". null si el slug no existe.
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
  v_duracion integer;
begin
  select id into v_peluqueria_id from peluquerias where slug = p_slug;
  if v_peluqueria_id is null then
    return null;
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

-- 6. Pública: crea la solicitud de reserva (estado 'solicitada').
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
  v_peluqueria_id uuid;
  v_duracion integer;
  v_fecha date;
  v_peluquero_id uuid;
  v_cliente_id uuid;
  v_bloqueado boolean;
  v_cita_id uuid;
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_telefono text := btrim(coalesce(p_telefono, ''));
  v_digitos integer := length(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'));
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_notas text := nullif(btrim(coalesce(p_notas, '')), '');
begin
  select id into v_peluqueria_id from peluquerias where slug = p_slug;
  if v_peluqueria_id is null then
    raise exception 'La peluquería no existe';
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

  v_duracion := reserva_duracion(v_peluqueria_id, p_servicio_ids);

  -- Una reserva a la vez por peluquería, hasta que termine la transacción:
  -- así dos personas no pueden tomar la misma hora al mismo tiempo.
  perform pg_advisory_xact_lock(hashtextextended(v_peluqueria_id::text, 0));

  v_fecha := (p_inicio at time zone 'America/Santiago')::date;

  -- La hora tiene que estar libre. Con "sin preferencia" se asigna el peluquero
  -- libre con menos citas ese día; si empatan, el primero por nombre.
  select h.peluquero_id
    into v_peluquero_id
    from reserva_horas_libres(v_peluqueria_id, v_fecha, v_duracion, p_peluquero_id) h
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
   where peluqueria_id = v_peluqueria_id
     and normalizar_telefono(telefono) = normalizar_telefono(v_telefono)
   order by creado_en
   limit 1;

  if v_cliente_id is null then
    insert into clientes (peluqueria_id, nombre, telefono, email, como_llego)
    values (v_peluqueria_id, v_nombre, v_telefono, v_email, 'reserva en línea')
    returning id into v_cliente_id;
  elsif v_bloqueado then
    -- Mensaje genérico: no se le dice que está bloqueado.
    raise exception 'No pudimos registrar la reserva. Contacta a la peluquería.';
  end if;

  if (select count(*) from citas
       where cliente_id = v_cliente_id
         and estado = 'solicitada'
         and inicio > now()) >= 2 then
    raise exception 'Ya tienes 2 reservas esperando confirmación. Espera la respuesta de la peluquería.';
  end if;

  insert into citas (peluqueria_id, cliente_id, peluquero_id, inicio, fin, estado, notas)
  values (v_peluqueria_id, v_cliente_id, v_peluquero_id, p_inicio,
          p_inicio + make_interval(mins => v_duracion), 'solicitada', v_notas)
  returning id into v_cita_id;

  -- Precio y duración se toman del catálogo, nunca del cliente.
  insert into cita_servicios (cita_id, servicio_id, precio_congelado_clp, duracion_congelada_min)
  select v_cita_id, s.id, s.precio_clp, s.duracion_minutos
    from servicios s
   where s.id = any (p_servicio_ids);

  return jsonb_build_object(
    'cita_id', v_cita_id,
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

-- 7. Permisos: las auxiliares no se pueden llamar desde la API (Supabase da
--    execute a anon y authenticated por defecto); las públicas sí.
revoke execute on function public.reserva_duracion(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.reserva_horas_libres(uuid, date, integer, uuid) from public, anon, authenticated;

revoke execute on function public.reserva_peluqueria(text) from public;
revoke execute on function public.reserva_disponibilidad(text, date, uuid[], uuid) from public;
revoke execute on function public.reserva_crear(text, uuid[], uuid, timestamptz, text, text, text, text) from public;

grant execute on function public.reserva_peluqueria(text) to anon, authenticated;
grant execute on function public.reserva_disponibilidad(text, date, uuid[], uuid) to anon, authenticated;
grant execute on function public.reserva_crear(text, uuid[], uuid, timestamptz, text, text, text, text) to anon, authenticated;

commit;
