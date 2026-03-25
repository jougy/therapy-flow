export const TEST_LOGIN = {
  cnpjDigits: "12345678000190",
  cnpjFormatted: "12.345.678/0001-90",
  email: "teste@therapyflow.local",
  password: "123456",
};

export const isLocalSupabaseUrl = (url: string | undefined) => {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

type AuthResult = {
  data: { user: { id: string } | null };
  error: { message: string } | null;
};

type SignUpResult = {
  data: { user: { id: string } | null; session?: unknown | null };
  error: { message: string } | null;
};

type SupabaseLikeClient = {
  auth: {
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<AuthResult>;
    signUp: (payload: {
      email: string;
      password: string;
      options: { emailRedirectTo: string };
    }) => Promise<SignUpResult>;
    signOut: () => Promise<unknown>;
  };
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

const ensureClinicMatch = async (client: SupabaseLikeClient, userId: string) => {
  const { data, error } = await client.rpc("validate_user_clinic", {
    _user_id: userId,
    _cnpj: TEST_LOGIN.cnpjDigits,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    await client.auth.signOut();
    throw new Error("A conta de teste existe, mas está vinculada a outro CNPJ.");
  }
};

export const ensureTestLogin = async (client: SupabaseLikeClient, emailRedirectTo: string) => {
  const loginResult = await client.auth.signInWithPassword({
    email: TEST_LOGIN.email,
    password: TEST_LOGIN.password,
  });

  if (loginResult.error?.message.toLowerCase().includes("email not confirmed")) {
    throw new Error("A conta de teste existe, mas este projeto exige confirmacao de e-mail para entrar.");
  }

  if (!loginResult.error && loginResult.data.user) {
    await ensureClinicMatch(client, loginResult.data.user.id);
    return { created: false };
  }

  const signUpResult = await client.auth.signUp({
    email: TEST_LOGIN.email,
    password: TEST_LOGIN.password,
    options: { emailRedirectTo },
  });

  if (signUpResult.error) {
    throw new Error(signUpResult.error.message);
  }

  if (signUpResult.data.user) {
    const setupResult = await client.rpc("handle_signup", {
      _user_id: signUpResult.data.user.id,
      _email: TEST_LOGIN.email,
      _cnpj: TEST_LOGIN.cnpjDigits,
    });

    if (setupResult.error) {
      throw new Error(setupResult.error.message);
    }
  }

  if (!signUpResult.data.session) {
    return { created: true, requiresEmailConfirmation: true };
  }

  const secondLoginResult = await client.auth.signInWithPassword({
    email: TEST_LOGIN.email,
    password: TEST_LOGIN.password,
  });

  if (secondLoginResult.error || !secondLoginResult.data.user) {
    throw new Error(secondLoginResult.error?.message ?? "Nao foi possivel acessar a conta de teste.");
  }

  await ensureClinicMatch(client, secondLoginResult.data.user.id);

  return { created: true };
};
