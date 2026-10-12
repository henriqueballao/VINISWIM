-- Candidate. Source identity is configured by an authorized owner, then verified
-- by captured publications. Typing a registration never fabricates verification.
BEGIN;
CREATE FUNCTION public.save_official_athlete_source_config(p_athlete_id uuid,p_url text,p_external_id text,
 p_external_name text,p_display_name text DEFAULT NULL,p_config_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE source uuid;config uuid;label text;
BEGIN
 PERFORM 1 FROM public.athletes a JOIN public.account_members m ON m.account_id=a.account_id
 WHERE a.id=p_athlete_id AND m.user_id=auth.uid() AND m.status='active' AND m.role IN('owner','admin','guardian') FOR SHARE OF a,m;
 IF auth.uid() IS NULL OR NOT FOUND THEN RAISE EXCEPTION 'ATHLETE_ACCESS_DENIED'; END IF;
 IF p_url IS NULL OR p_url !~ '^https://(www[.])?swimsystem[.]app(/[^[:space:]]*)?$'
 OR p_external_id IS NULL OR trim(p_external_id) !~ '^[0-9]+$'
 OR length(trim(p_external_name)) NOT BETWEEN 1 AND 200 OR p_external_name IS NULL
 THEN RAISE EXCEPTION 'INVALID_OFFICIAL_SOURCE_CONFIGURATION'; END IF;
 SELECT id INTO source FROM public.sources WHERE code='swimsystem' AND official AND active;
 IF source IS NULL THEN RAISE EXCEPTION 'OFFICIAL_SOURCE_UNAVAILABLE'; END IF;
 IF EXISTS(SELECT 1 FROM public.athlete_identifiers WHERE athlete_id=p_athlete_id AND source_id=source AND active AND verified AND external_id<>trim(p_external_id)) THEN RAISE EXCEPTION 'SOURCE_IDENTITY_CONFLICT'; END IF;
 IF p_config_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.athlete_source_configs WHERE id=p_config_id AND athlete_id=p_athlete_id AND source_id=source) THEN RAISE EXCEPTION 'SOURCE_CONFIGURATION_ACCESS_DENIED'; END IF;
 label=coalesce(nullif(trim(p_display_name),''),'SwimSystem');
 IF length(label)>200 THEN RAISE EXCEPTION 'INVALID_OFFICIAL_SOURCE_CONFIGURATION'; END IF;
 INSERT INTO public.athlete_source_configs(athlete_id,source_id,display_name,source_url,external_id,external_name,active)
 VALUES(p_athlete_id,source,label,trim(p_url),trim(p_external_id),trim(p_external_name),true)
 ON CONFLICT(athlete_id,source_id) DO UPDATE SET display_name=excluded.display_name,source_url=excluded.source_url,
 external_id=excluded.external_id,external_name=excluded.external_name,active=true,updated_at=now() RETURNING id INTO config;
 RETURN jsonb_build_object('ok',true,'config_id',config,'source_code','swimsystem','display_name',label,'ready',true);
END $$;
REVOKE ALL ON FUNCTION public.save_official_athlete_source_config(uuid,text,text,text,text,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.save_official_athlete_source_config(uuid,text,text,text,text,uuid) TO authenticated;
-- Retire the old overloads which marked a typed registration verified=true.
DO $$ DECLARE signature text;BEGIN
 FOREACH signature IN ARRAY ARRAY['public.save_athlete_source_config(uuid,text,text,text)','public.save_athlete_source_config(uuid,text,text,text,text,uuid)'] LOOP
  IF to_regprocedure(signature) IS NOT NULL THEN
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',signature);
  END IF;
 END LOOP;
END $$;
COMMIT;
