-- Protection only: no sporting data is inserted, updated or deleted.
DO $$
BEGIN
 IF current_setting('server_version_num')::integer < 150000 THEN
  RAISE EXCEPTION 'security_invoker requires PostgreSQL 15+';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='results' AND policyname='results_delete_account_writer' AND cmd='DELETE') THEN
  RAISE EXCEPTION 'Expected results delete policy is missing';
 END IF;
END $$;
ALTER VIEW public.v_result_timeline SET (security_invoker = true);
ALTER POLICY results_delete_account_writer ON public.results TO authenticated
USING (
 origin = 'manual'::public.result_origin AND is_official = false
 AND EXISTS (
  SELECT 1 FROM public.athletes a
  JOIN public.account_members am ON am.account_id = a.account_id
  WHERE a.id = results.athlete_id
    AND am.user_id = (SELECT auth.uid())
    AND am.status = 'active'::public.member_status
    AND am.role = ANY (ARRAY['owner'::public.member_role,'admin'::public.member_role,'guardian'::public.member_role])
 )
);
