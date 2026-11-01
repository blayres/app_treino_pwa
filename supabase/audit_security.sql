-- Security audit (READ-ONLY). Run in the Supabase SQL Editor and share the result.
-- One result set: section | object | detail.

with
rls as (
  select '1. RLS' as section,
         c.relname::text as object,
         case when c.relrowsecurity then 'enabled' else '>>> DISABLED <<<' end
           || case when c.relforcerowsecurity then ' (forced)' else '' end as detail
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
policies as (
  select '2. Policy' as section,
         tablename || ' · ' || policyname as object,
         cmd || ' to ' || array_to_string(roles, ',')
           || ' | using: ' || coalesce(qual, '—')
           || ' | check: ' || coalesce(with_check, '—') as detail
  from pg_policies
  where schemaname = 'public'
),
table_grants as (
  select '3. Table grant' as section,
         table_name || ' · ' || grantee as object,
         string_agg(privilege_type, ', ' order by privilege_type) as detail
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated', 'public')
  group by table_name, grantee
),
column_grants as (
  select '4. Column grant' as section,
         table_name || '.' || column_name || ' · ' || grantee as object,
         string_agg(privilege_type, ', ' order by privilege_type) as detail
  from information_schema.column_privileges
  where table_schema = 'public' and table_name = 'profiles'
    and grantee in ('anon', 'authenticated') and privilege_type in ('INSERT', 'UPDATE')
  group by table_name, column_name, grantee
),
functions as (
  select '5. Function' as section,
         p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as object,
         case when p.prosecdef then 'SECURITY DEFINER' else 'invoker' end
           || ' | search_path: ' || coalesce(array_to_string(p.proconfig, ','), '>>> not set <<<')
           || ' | anon exec: ' || has_function_privilege('anon', p.oid, 'execute')
           || ' | authenticated exec: ' || has_function_privilege('authenticated', p.oid, 'execute') as detail
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
triggers as (
  select '6. Trigger' as section,
         t.tgrelid::regclass::text || ' · ' || t.tgname as object,
         'calls ' || p.proname || case when t.tgenabled = 'D' then ' (disabled)' else '' end as detail
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
  where not t.tgisinternal
    and t.tgrelid in (
      select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('public', 'auth')
    )
),
admins as (
  select '7. Admin' as section,
         'profile ' || p.id as object,
         coalesce(u.email, '—') as detail
  from public.profiles p
  left join auth.users u on u.id = p.auth_id
  where p.role = 'admin'
)
select * from rls
union all select * from policies
union all select * from table_grants
union all select * from column_grants
union all select * from functions
union all select * from triggers
union all select * from admins
order by section, object;
