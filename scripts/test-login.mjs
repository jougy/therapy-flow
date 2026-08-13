import { createClient } from "@supabase/supabase-js";
import { loadAppEnv } from "./security/common.mjs";
import { createHmac } from "node:crypto";

function base32ToBuffer(base32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let cleaned = base32.toUpperCase().replace(/=+$/, "");
  let bits = "";
  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val === -1) throw new Error("Invalid base32 character: " + cleaned[i]);
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTOTP(secret, timeOffset = 0) {
  const key = base32ToBuffer(secret);
  const epoch = Math.floor((Date.now() / 1000 + timeOffset) / 30);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeUInt32BE(0, 0);
  timeBuffer.writeUInt32BE(epoch, 4);

  const hmac = createHmac("sha1", key).update(timeBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (code % 1000000).toString().padStart(6, "0");
}

async function main() {
  const env = await loadAppEnv();
  const supabaseUrl = env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
  const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: "jougy@gmx.com",
    password: "Senha123456!",
  });

  if (error) {
    console.error("Sign in failed:", error.message);
    return;
  }

  const factorId = "9814d82a-c41b-4a45-a572-2f0f10fbac0a";
  const secret = "JPMFVDBCOVALI64Y3YJ7LYDAZJAADEN2";
  const code = generateTOTP(secret);
  console.log("Generated TOTP code:", code);

  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) {
    console.error("Challenge error:", challenge.error);
    return;
  }

  const verify = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  });

  if (verify.error) {
    console.error("Verify error:", verify.error);
    return;
  }

  console.log("MFA Verification SUCCESS! Session updated.");
  const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  console.log("New MFA level:", mfaData);
}

main();
