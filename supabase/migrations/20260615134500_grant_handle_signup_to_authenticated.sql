GRANT EXECUTE ON FUNCTION public.handle_signup(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_signup(uuid, text, text, public.subscription_plan, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.validate_user_clinic(uuid, text) TO authenticated;
