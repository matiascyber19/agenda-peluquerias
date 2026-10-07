-- Exporta el esquema público de la base como un solo JSON.
-- Es de solo lectura: no modifica nada.
--
-- Uso: Supabase → SQL Editor → pegar → Run → copiar la celda "esquema"
-- y guardarla en supabase/esquema_actual.json.

select jsonb_pretty(jsonb_build_object(
  'tablas', (
    select jsonb_agg(jsonb_build_object(
      'tabla', c.relname,
      'rls_activo', c.relrowsecurity,
      'columnas', (
        select jsonb_agg(jsonb_build_object(
          'nombre', a.attname,
          'tipo', format_type(a.atttypid, a.atttypmod),
          'acepta_null', not a.attnotnull,
          'por_defecto', pg_get_expr(d.adbin, d.adrelid)
        ) order by a.attnum)
        from pg_attribute a
        left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
        where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      )
    ) order by c.relname)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  ),
  'restricciones', (
    select jsonb_agg(jsonb_build_object(
      'tabla', conrelid::regclass::text,
      'nombre', conname,
      'definicion', pg_get_constraintdef(oid)
    ) order by conrelid::regclass::text, conname)
    from pg_constraint
    where connamespace = 'public'::regnamespace
  ),
  'tipos_enum', (
    select jsonb_agg(jsonb_build_object(
      'tipo', t.typname,
      'valores', (
        select jsonb_agg(e.enumlabel order by e.enumsortorder)
        from pg_enum e where e.enumtypid = t.oid
      )
    ))
    from pg_type t
    where t.typnamespace = 'public'::regnamespace and t.typtype = 'e'
  ),
  'politicas_rls', (
    select jsonb_agg(jsonb_build_object(
      'tabla', tablename,
      'nombre', policyname,
      'comando', cmd,
      'roles', roles::text[],
      'using', qual,
      'with_check', with_check
    ) order by tablename, policyname)
    from pg_policies
    where schemaname = 'public'
  ),
  'funciones', (
    select jsonb_agg(jsonb_build_object(
      'nombre', p.proname,
      'security_definer', p.prosecdef,
      'anon_puede_ejecutar', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'definicion', pg_get_functiondef(p.oid)
    ) order by p.proname)
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
  ),
  'triggers', (
    select jsonb_agg(jsonb_build_object(
      'tabla', event_object_table,
      'nombre', trigger_name,
      'evento', event_manipulation,
      'accion', action_statement
    ) order by event_object_table, trigger_name)
    from information_schema.triggers
    where trigger_schema = 'public'
  )
)) as esquema;
