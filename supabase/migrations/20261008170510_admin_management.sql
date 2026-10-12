-- Serialize admin status changes and re-check the actor after acquiring the lock.
create function public.oss_set_admin_active(actor_id uuid, target_id uuid, enabled boolean)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  lock table public.oss_profiles in exclusive mode;
  if not exists(select 1 from public.oss_profiles where id=actor_id and role='admin' and active and archived_at is null) then
    raise exception 'เฉพาะผู้ดูแลที่เปิดใช้งานทำรายการนี้ได้';
  end if;
  if not exists(select 1 from public.oss_profiles where id=target_id and role='admin' and archived_at is null) then
    raise exception 'ไม่พบบัญชีผู้ดูแลระบบ';
  end if;
  if not enabled then
    if (select count(*) from public.oss_profiles where role='admin' and active and archived_at is null) <= 1
       and exists(select 1 from public.oss_profiles where id=target_id and active) then
      raise exception 'ไม่สามารถปิดผู้ดูแลคนสุดท้ายได้';
    end if;
    if actor_id=target_id then
      raise exception 'ไม่สามารถปิดบัญชีที่คุณใช้งานอยู่ได้';
    end if;
  end if;
  update public.oss_profiles set active=enabled where id=target_id and role='admin' and archived_at is null;
end;
$$;
revoke all on function public.oss_set_admin_active(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.oss_set_admin_active(uuid,uuid,boolean) to service_role;
