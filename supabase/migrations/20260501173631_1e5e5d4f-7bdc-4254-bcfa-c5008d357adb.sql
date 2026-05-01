
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_caregiver_of(UUID, UUID) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.find_user_id_by_email(TEXT) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(TEXT) TO authenticated;
