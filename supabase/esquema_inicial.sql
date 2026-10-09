-- Esquema inicial de la base de Agenda Peluquerías
--
-- Reconstruido desde el esquema exportado de Supabase el 7 de octubre de 2026
-- (supabase/consultas/exportar_esquema.sql), antes de las migraciones.
-- Sirve para crear otra base igual, por ejemplo la de pruebas
-- (docs/base-de-pruebas.md).
--
-- Uso en un proyecto de Supabase NUEVO y vacío: SQL Editor → pegar → Run.
-- Después ejecutar en orden supabase/migraciones/001 a 005.
--
-- No incluye datos. Los permisos de anon y authenticated sobre las tablas se
-- dan explícitamente al final: un proyecto de Supabase puede no darlos solo a
-- las tablas nuevas. RLS es lo que limita qué filas ve cada cuenta.

begin;

create extension if not exists "uuid-ossp" with schema extensions;

-- 1. Tablas
create table public.peluquerias (
  id uuid default uuid_generate_v4() not null,
  nombre character varying(120) not null,
  slug character varying(80) not null,
  direccion text,
  comuna character varying(80),
  telefono character varying(20),
  email character varying(120),
  logo_url text,
  plan character varying(20) default 'trial'::character varying,
  fecha_vencimiento_plan date,
  creado_en timestamp with time zone default now(),
  actualizado_en timestamp with time zone default now()
);

create table public.usuarios (
  id uuid not null,
  peluqueria_id uuid,
  nombre character varying(120) not null,
  email character varying(120) not null,
  rol character varying(20) not null,
  activo boolean default true,
  creado_en timestamp with time zone default now()
);

create table public.peluqueros (
  id uuid default uuid_generate_v4() not null,
  peluqueria_id uuid not null,
  usuario_id uuid,
  nombre character varying(120) not null,
  telefono character varying(20),
  tipo_contrato character varying(20) default 'fijo'::character varying,
  porcentaje_comision integer default 0,
  color_agenda character varying(7) default '#3B82F6'::character varying,
  activo boolean default true,
  creado_en timestamp with time zone default now()
);

create table public.clientes (
  id uuid default uuid_generate_v4() not null,
  peluqueria_id uuid not null,
  nombre character varying(120) not null,
  telefono character varying(20) not null,
  email character varying(120),
  cumpleanos date,
  como_llego character varying(50),
  notas text,
  foto_url text,
  bloqueado boolean default false,
  creado_en timestamp with time zone default now()
);

create table public.servicios (
  id uuid default uuid_generate_v4() not null,
  peluqueria_id uuid not null,
  nombre character varying(120) not null,
  descripcion text,
  duracion_minutos integer not null,
  precio_clp integer not null,
  activo boolean default true,
  creado_en timestamp with time zone default now()
);

create table public.productos (
  id uuid default uuid_generate_v4() not null,
  peluqueria_id uuid not null,
  nombre character varying(150) not null,
  categoria character varying(20) default 'reventa'::character varying,
  precio_costo_clp integer,
  precio_venta_clp integer,
  stock_actual numeric(10,2) default 0,
  stock_minimo numeric(10,2) default 0,
  unidad character varying(20) default 'unidad'::character varying,
  activo boolean default true,
  creado_en timestamp with time zone default now()
);

create table public.citas (
  id uuid default uuid_generate_v4() not null,
  peluqueria_id uuid not null,
  cliente_id uuid not null,
  peluquero_id uuid not null,
  inicio timestamp with time zone not null,
  fin timestamp with time zone not null,
  estado character varying(20) default 'pendiente'::character varying,
  notas text,
  recordatorio_24h_enviado boolean default false,
  recordatorio_1h_enviado boolean default false,
  creado_en timestamp with time zone default now()
);

create table public.cita_servicios (
  id uuid default uuid_generate_v4() not null,
  cita_id uuid not null,
  servicio_id uuid not null,
  precio_congelado_clp integer not null,
  duracion_congelada_min integer not null
);

create table public.horarios (
  id uuid default uuid_generate_v4() not null,
  peluquero_id uuid not null,
  dia_semana smallint not null,
  hora_inicio time without time zone not null,
  hora_fin time without time zone not null,
  activo boolean default true
);

create table public.bloqueos (
  id uuid default uuid_generate_v4() not null,
  peluqueria_id uuid not null,
  peluquero_id uuid,
  inicio timestamp with time zone not null,
  fin timestamp with time zone not null,
  motivo character varying(200)
);

create table public.ventas (
  id uuid default uuid_generate_v4() not null,
  peluqueria_id uuid not null,
  cita_id uuid,
  cliente_id uuid,
  peluquero_id uuid,
  total_clp integer not null,
  medio_pago character varying(20) not null,
  fecha timestamp with time zone default now()
);

create table public.venta_items (
  id uuid default uuid_generate_v4() not null,
  venta_id uuid not null,
  tipo character varying(20) not null,
  referencia_id uuid not null,
  nombre character varying(150) not null,
  cantidad numeric(10,2) default 1,
  precio_unitario_clp integer not null,
  subtotal_clp integer not null
);

create table public.comisiones (
  id uuid default uuid_generate_v4() not null,
  peluqueria_id uuid not null,
  peluquero_id uuid not null,
  venta_id uuid not null,
  monto_clp integer not null,
  pagado boolean default false,
  fecha_pago date,
  creado_en timestamp with time zone default now()
);

create table public.gastos (
  id uuid default uuid_generate_v4() not null,
  peluqueria_id uuid not null,
  descripcion character varying(200) not null,
  categoria character varying(40),
  monto_clp integer not null,
  fecha date not null,
  comprobante_url text,
  creado_en timestamp with time zone default now()
);

-- 2. Llaves primarias, únicas y validaciones
alter table public.peluquerias add constraint peluquerias_pkey PRIMARY KEY (id);
alter table public.usuarios add constraint usuarios_pkey PRIMARY KEY (id);
alter table public.peluqueros add constraint peluqueros_pkey PRIMARY KEY (id);
alter table public.clientes add constraint clientes_pkey PRIMARY KEY (id);
alter table public.servicios add constraint servicios_pkey PRIMARY KEY (id);
alter table public.productos add constraint productos_pkey PRIMARY KEY (id);
alter table public.citas add constraint citas_pkey PRIMARY KEY (id);
alter table public.cita_servicios add constraint cita_servicios_pkey PRIMARY KEY (id);
alter table public.horarios add constraint horarios_pkey PRIMARY KEY (id);
alter table public.bloqueos add constraint bloqueos_pkey PRIMARY KEY (id);
alter table public.ventas add constraint ventas_pkey PRIMARY KEY (id);
alter table public.venta_items add constraint venta_items_pkey PRIMARY KEY (id);
alter table public.comisiones add constraint comisiones_pkey PRIMARY KEY (id);
alter table public.gastos add constraint gastos_pkey PRIMARY KEY (id);
alter table public.peluquerias add constraint peluquerias_slug_key UNIQUE (slug);
alter table public.peluqueros add constraint peluqueros_id_peluqueria_id_key UNIQUE (id, peluqueria_id);
alter table public.clientes add constraint clientes_id_peluqueria_id_key UNIQUE (id, peluqueria_id);
alter table public.citas add constraint citas_id_peluqueria_id_key UNIQUE (id, peluqueria_id);
alter table public.peluquerias add constraint plan_valido CHECK (((plan)::text = ANY ((ARRAY['trial'::character varying, 'activo'::character varying, 'suspendido'::character varying])::text[])));
alter table public.usuarios add constraint rol_valido CHECK (((rol)::text = ANY ((ARRAY['dueño'::character varying, 'peluquero'::character varying, 'recepcionista'::character varying])::text[])));
alter table public.peluqueros add constraint tipo_contrato_valido CHECK (((tipo_contrato)::text = ANY ((ARRAY['fijo'::character varying, 'comision'::character varying, 'arriendo_sillon'::character varying])::text[])));
alter table public.productos add constraint categoria_valida CHECK (((categoria)::text = ANY ((ARRAY['reventa'::character varying, 'uso_interno'::character varying])::text[])));
alter table public.productos add constraint unidad_valida CHECK (((unidad)::text = ANY ((ARRAY['unidad'::character varying, 'ml'::character varying, 'g'::character varying])::text[])));
alter table public.citas add constraint citas_check CHECK ((fin > inicio));
alter table public.citas add constraint estado_valido CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'confirmada'::character varying, 'completada'::character varying, 'cancelada'::character varying, 'no_show'::character varying])::text[])));
alter table public.horarios add constraint horarios_check CHECK ((hora_fin > hora_inicio));
alter table public.horarios add constraint horarios_dia_semana_check CHECK (((dia_semana >= 0) AND (dia_semana <= 6)));
alter table public.bloqueos add constraint bloqueos_check CHECK ((fin > inicio));
alter table public.ventas add constraint medio_pago_valido CHECK (((medio_pago)::text = ANY ((ARRAY['efectivo'::character varying, 'transferencia'::character varying, 'debito'::character varying, 'credito'::character varying])::text[])));
alter table public.venta_items add constraint tipo_item_valido CHECK (((tipo)::text = ANY ((ARRAY['servicio'::character varying, 'producto'::character varying])::text[])));

-- 3. Llaves foráneas
alter table public.usuarios add constraint usuarios_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.usuarios add constraint usuarios_peluqueria_id_fkey FOREIGN KEY (peluqueria_id) REFERENCES peluquerias(id) ON DELETE CASCADE;
alter table public.peluqueros add constraint peluqueros_peluqueria_id_fkey FOREIGN KEY (peluqueria_id) REFERENCES peluquerias(id) ON DELETE CASCADE;
alter table public.peluqueros add constraint peluqueros_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;
alter table public.clientes add constraint clientes_peluqueria_id_fkey FOREIGN KEY (peluqueria_id) REFERENCES peluquerias(id) ON DELETE CASCADE;
alter table public.servicios add constraint servicios_peluqueria_id_fkey FOREIGN KEY (peluqueria_id) REFERENCES peluquerias(id) ON DELETE CASCADE;
alter table public.productos add constraint productos_peluqueria_id_fkey FOREIGN KEY (peluqueria_id) REFERENCES peluquerias(id) ON DELETE CASCADE;
alter table public.citas add constraint citas_peluqueria_id_fkey FOREIGN KEY (peluqueria_id) REFERENCES peluquerias(id) ON DELETE CASCADE;
alter table public.citas add constraint fk_cita_cliente FOREIGN KEY (cliente_id, peluqueria_id) REFERENCES clientes(id, peluqueria_id) ON DELETE RESTRICT;
alter table public.citas add constraint fk_cita_peluquero FOREIGN KEY (peluquero_id, peluqueria_id) REFERENCES peluqueros(id, peluqueria_id) ON DELETE RESTRICT;
alter table public.cita_servicios add constraint cita_servicios_cita_id_fkey FOREIGN KEY (cita_id) REFERENCES citas(id) ON DELETE CASCADE;
alter table public.cita_servicios add constraint cita_servicios_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES servicios(id) ON DELETE RESTRICT;
alter table public.horarios add constraint horarios_peluquero_id_fkey FOREIGN KEY (peluquero_id) REFERENCES peluqueros(id) ON DELETE CASCADE;
alter table public.bloqueos add constraint bloqueos_peluqueria_id_fkey FOREIGN KEY (peluqueria_id) REFERENCES peluquerias(id) ON DELETE CASCADE;
alter table public.bloqueos add constraint bloqueos_peluquero_id_fkey FOREIGN KEY (peluquero_id) REFERENCES peluqueros(id) ON DELETE CASCADE;
alter table public.ventas add constraint fk_venta_cliente FOREIGN KEY (cliente_id, peluqueria_id) REFERENCES clientes(id, peluqueria_id) ON DELETE RESTRICT;
alter table public.ventas add constraint fk_venta_peluquero FOREIGN KEY (peluquero_id, peluqueria_id) REFERENCES peluqueros(id, peluqueria_id) ON DELETE RESTRICT;
alter table public.ventas add constraint ventas_cita_id_fkey FOREIGN KEY (cita_id) REFERENCES citas(id) ON DELETE SET NULL;
alter table public.ventas add constraint ventas_peluqueria_id_fkey FOREIGN KEY (peluqueria_id) REFERENCES peluquerias(id) ON DELETE CASCADE;
alter table public.venta_items add constraint venta_items_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE;
alter table public.comisiones add constraint comisiones_peluqueria_id_fkey FOREIGN KEY (peluqueria_id) REFERENCES peluquerias(id) ON DELETE CASCADE;
alter table public.comisiones add constraint comisiones_peluquero_id_fkey FOREIGN KEY (peluquero_id) REFERENCES peluqueros(id) ON DELETE RESTRICT;
alter table public.comisiones add constraint comisiones_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE RESTRICT;
alter table public.gastos add constraint gastos_peluqueria_id_fkey FOREIGN KEY (peluqueria_id) REFERENCES peluquerias(id) ON DELETE CASCADE;

-- 4. Funciones
CREATE OR REPLACE FUNCTION public.actualizar_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_peluqueria_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT peluqueria_id FROM public.usuarios WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.registrar_peluqueria(p_nombre_peluqueria character varying, p_slug character varying, p_nombre_usuario character varying)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_email TEXT;
    v_peluqueria_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;

    IF EXISTS (SELECT 1 FROM public.usuarios WHERE id = v_user_id) THEN
        RAISE EXCEPTION 'El usuario ya tiene una peluquería asociada';
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

    INSERT INTO public.peluquerias (nombre, slug)
    VALUES (p_nombre_peluqueria, p_slug)
    RETURNING id INTO v_peluqueria_id;

    INSERT INTO public.usuarios (id, peluqueria_id, nombre, email, rol)
    VALUES (v_user_id, v_peluqueria_id, p_nombre_usuario, v_email, 'dueño');

    RETURN v_peluqueria_id;
END;
$function$;

-- 5. Triggers
create trigger trigger_peluquerias_updated before update on public.peluquerias
  for each row execute function public.actualizar_timestamp();

-- 6. Seguridad por fila (RLS): cada cuenta ve solo los datos de su peluquería
alter table public.peluquerias enable row level security;
alter table public.usuarios enable row level security;
alter table public.peluqueros enable row level security;
alter table public.clientes enable row level security;
alter table public.servicios enable row level security;
alter table public.productos enable row level security;
alter table public.citas enable row level security;
alter table public.cita_servicios enable row level security;
alter table public.horarios enable row level security;
alter table public.bloqueos enable row level security;
alter table public.ventas enable row level security;
alter table public.venta_items enable row level security;
alter table public.comisiones enable row level security;
alter table public.gastos enable row level security;

create policy usuario_ve_su_peluqueria on public.peluquerias
  as permissive for all to public
  using ((id = get_my_peluqueria_id()));

create policy usuario_ve_sus_usuarios on public.usuarios
  as permissive for all to public
  using ((peluqueria_id = get_my_peluqueria_id()));

create policy usuario_ve_sus_peluqueros on public.peluqueros
  as permissive for all to public
  using ((peluqueria_id = get_my_peluqueria_id()));

create policy usuario_ve_sus_clientes on public.clientes
  as permissive for all to public
  using ((peluqueria_id = get_my_peluqueria_id()));

create policy usuario_ve_sus_servicios on public.servicios
  as permissive for all to public
  using ((peluqueria_id = get_my_peluqueria_id()));

create policy usuario_ve_sus_productos on public.productos
  as permissive for all to public
  using ((peluqueria_id = get_my_peluqueria_id()));

create policy usuario_ve_sus_citas on public.citas
  as permissive for all to public
  using ((peluqueria_id = get_my_peluqueria_id()));

create policy usuario_ve_servicios_citas on public.cita_servicios
  as permissive for all to public
  using ((cita_id IN ( SELECT citas.id
   FROM citas
  WHERE (citas.peluqueria_id = get_my_peluqueria_id()))));

create policy usuario_ve_sus_horarios on public.horarios
  as permissive for all to public
  using ((peluquero_id IN ( SELECT peluqueros.id
   FROM peluqueros
  WHERE (peluqueros.peluqueria_id = get_my_peluqueria_id()))));

create policy usuario_ve_sus_bloqueos on public.bloqueos
  as permissive for all to public
  using ((peluqueria_id = get_my_peluqueria_id()));

create policy usuario_ve_sus_ventas on public.ventas
  as permissive for all to public
  using ((peluqueria_id = get_my_peluqueria_id()));

create policy usuario_ve_items_ventas on public.venta_items
  as permissive for all to public
  using ((venta_id IN ( SELECT ventas.id
   FROM ventas
  WHERE (ventas.peluqueria_id = get_my_peluqueria_id()))));

create policy usuario_ve_sus_comisiones on public.comisiones
  as permissive for all to public
  using ((peluqueria_id = get_my_peluqueria_id()));

create policy usuario_ve_sus_gastos on public.gastos
  as permissive for all to public
  using ((peluqueria_id = get_my_peluqueria_id()));

-- 7. Permisos de las cuentas sobre las tablas (RLS decide las filas)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

commit;
