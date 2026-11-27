# user_release_note_states - Technical Summary

## 1. Linha exata no schema.sql
- **Local**: `supabase/schema.sql`, linha 16971-16978
- **Conteúdo**:
  ```sql
  CREATE TABLE IF NOT EXISTS "public"."user_release_note_states" (
      "user_id" "uuid" NOT NULL,
      "last_seen_release_id" "uuid",
      "last_seen_release_order" integer DEFAULT 0 NOT NULL,
      "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
      "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
  );
  ```

## 2. Colunas principais / parâmetros da RPC
- **Colunas da tabela** (sem `_cents` ou `deleted_at` — este padrão não se aplica a esta tabela):
  - `user_id` (uuid, PK, FK → auth.users ON DELETE CASCADE)
  - `last_seen_release_id` (uuid, FK → platform_releases ON DELETE SET NULL)
  - `last_seen_release_order` (integer, DEFAULT 0)
  - `last_seen_at` (timestamptz, DEFAULT now())
  - `created_at` (timestamptz, DEFAULT now())
  - `updated_at` (timestamptz, DEFAULT now())
- **RPC parameter**: A função `public.acknowledge_current_user_release_notes` recebe parâmetro `_release_id uuid DEFAULT NULL::uuid` (schema.sql linha 703)

## 3. Políticas RLS / capabilities
- **RLS enabled**: `alter table public.user_release_note_states enable row level security;` (migração 20260608160000, linha 58)
- **Policy**: `CREATE POLICY "Users read own release note state" ON "public"."user_release_note_states" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));` (schema.sql linha 20179)
- **Capability**: Acesso restrito ao próprio usuário autenticado via comparação `user_id = auth.uid()`. Não há verificação de `current_user_can` ou roles adicionais — apenas o usuário autenticado pode selecionar suas próprias linhas.
- **Foreign keys**: `user_id → auth.users(id) ON DELETE CASCADE`; `last_seen_release_id → platform_releases(id) ON DELETE SET NULL`