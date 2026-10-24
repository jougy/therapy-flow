import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
import { createPresignedS3Url } from "../_shared/b2-s3.ts";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const requiredEnv = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Variavel de ambiente ausente: ${key}`);
  return value;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const bucketName = requiredEnv("B2_BUCKET_NAME");
    const b2Region = requiredEnv("B2_REGION");
    const b2Endpoint = requiredEnv("B2_S3_ENDPOINT");
    const b2KeyId = requiredEnv("B2_APPLICATION_KEY_ID");
    const b2ApplicationKey = requiredEnv("B2_APPLICATION_KEY");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Fetch newly promoted candidate words not yet integrated
    const { data: promotedCandidates, error: queryError } = await admin
      .from("global_word_candidates")
      .select("word")
      .eq("status", "promoted")
      .is("promoted_at", null);

    if (queryError) {
      throw queryError;
    }

    if (!promotedCandidates || promotedCandidates.length === 0) {
      return json({ message: "Nenhuma nova palavra para promover", promotedCount: 0 });
    }

    const newWords = promotedCandidates.map((c) => c.word.toLowerCase().trim());
    const dictionaryKey = "dictionaries/clinical_whitelist.json";

    // 2. Fetch existing dictionary from B2 via Presigned GET
    let existingWords: string[] = [];
    try {
      const getUrl = await createPresignedS3Url({
        accessKeyId: b2KeyId,
        bucket: bucketName,
        endpoint: b2Endpoint,
        expiresIn: 300,
        key: dictionaryKey,
        method: "GET",
        region: b2Region,
        secretAccessKey: b2ApplicationKey,
      });

      const b2Res = await fetch(getUrl);
      if (b2Res.ok) {
        const remoteJson = await b2Res.json();
        existingWords = Array.isArray(remoteJson.words) ? remoteJson.words : [];
      }
    } catch (err) {
      console.warn("Dicionario ainda nao existente no B2, criando novo:", err);
    }

    // 3. Merge, deduplicate, and sort alphabetically
    const combinedSet = new Set<string>([...existingWords, ...newWords]);
    const mergedList = Array.from(combinedSet).sort((a, b) => a.localeCompare(b, "pt-BR"));

    const nowIso = new Date().toISOString();
    const versionTag = nowIso.slice(0, 10).replace(/-/g, ".");

    const payload = {
      version: versionTag,
      updatedAt: nowIso,
      totalWords: mergedList.length,
      words: mergedList,
    };

    // 4. Upload updated dictionary back to B2 via Presigned PUT
    const putUrl = await createPresignedS3Url({
      accessKeyId: b2KeyId,
      bucket: bucketName,
      endpoint: b2Endpoint,
      expiresIn: 600,
      key: dictionaryKey,
      method: "PUT",
      region: b2Region,
      secretAccessKey: b2ApplicationKey,
    });

    const uploadRes = await fetch(putUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload, null, 2),
    });

    if (!uploadRes.ok) {
      throw new Error(`Falha no upload para o B2: status ${uploadRes.status}`);
    }

    // 5. Update Postgres records marking promoted_at
    const { error: updateError } = await admin
      .from("global_word_candidates")
      .update({ promoted_at: nowIso })
      .in(
        "word",
        promotedCandidates.map((c) => c.word)
      );

    if (updateError) {
      console.error("Aviso: Falha ao marcar promoted_at:", updateError);
    }

    return json({
      success: true,
      promotedCount: newWords.length,
      totalWords: mergedList.length,
      version: versionTag,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Erro na sincronizacao do dicionario B2:", message);
    return json({ error: message }, 500);
  }
});
