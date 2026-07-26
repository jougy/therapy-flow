type PresignInput = {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  expiresIn: number;
  key: string;
  method: "DELETE" | "GET" | "HEAD" | "PUT";
  query?: Record<string, string | null | undefined>;
  region: string;
  secretAccessKey: string;
};

const encoder = new TextEncoder();

const toHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const sha256Hex = async (value: string) => toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));

const toArrayBuffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const hmac = async (key: ArrayBuffer | Uint8Array | string, value: string) => {
  const rawKey = typeof key === "string" ? toArrayBuffer(encoder.encode(key)) : key instanceof ArrayBuffer ? key : toArrayBuffer(key);
  const cryptoKey = await crypto.subtle.importKey("raw", rawKey, { hash: "SHA-256", name: "HMAC" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value));
};

const encodeRfc3986 = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

const encodeObjectKey = (key: string) => key.split("/").map(encodeRfc3986).join("/");

const formatAmzDate = (date: Date) => date.toISOString().replace(/[:-]|\.\d{3}/g, "");

const getSigningKey = async (secretAccessKey: string, dateStamp: string, region: string) => {
  const dateKey = await hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = await hmac(dateKey, region);
  const serviceKey = await hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
};

export const createPresignedS3Url = async ({
  accessKeyId,
  bucket,
  endpoint,
  expiresIn,
  key,
  method,
  query = {},
  region,
  secretAccessKey,
}: PresignInput) => {
  const endpointUrl = new URL(endpoint);
  const host = `${bucket}.${endpointUrl.host}`;
  const now = new Date();
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const signedHeaders = "host";
  const params = new URLSearchParams();

  for (const [name, value] of Object.entries(query)) {
    if (value) params.set(name, value);
  }
  params.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  params.set("X-Amz-Credential", `${accessKeyId}/${credentialScope}`);
  params.set("X-Amz-Date", amzDate);
  params.set("X-Amz-Expires", String(expiresIn));
  params.set("X-Amz-SignedHeaders", signedHeaders);

  const canonicalQuery = Array.from(params.entries())
    .map(([name, value]) => [encodeRfc3986(name), encodeRfc3986(value)] as const)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");
  const canonicalUri = `/${encodeObjectKey(key)}`;
  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = await getSigningKey(secretAccessKey, dateStamp, region);
  const signature = toHex(await hmac(signingKey, stringToSign));

  params.set("X-Amz-Signature", signature);
  const finalQuery = Array.from(params.entries())
    .map(([name, value]) => [encodeRfc3986(name), encodeRfc3986(value)] as const)
    .map(([name, value]) => `${name}=${value}`)
    .join("&");

  return `${endpointUrl.protocol}//${host}${canonicalUri}?${finalQuery}`;
};
