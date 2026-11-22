import { createHmac, timingSafeEqual } from 'node:crypto';

export interface HmacSignResult {
  signature: string;
  timestamp: string;
}

export function signPayloadHmac(
  rawBody: string,
  secret: string,
  timestampSec: number = Math.floor(Date.now() / 1000)
): HmacSignResult {
  const payloadToSign = `${timestampSec}.${rawBody}`;
  const digest = createHmac('sha256', secret).update(payloadToSign).digest('hex');
  return {
    signature: `sha256=${digest}`,
    timestamp: String(timestampSec),
  };
}

export function verifyPayloadHmac(
  rawBody: string,
  signatureHeader: string | undefined,
  timestampHeader: string | undefined,
  secret: string,
  toleranceSec: number = 300
): boolean {
  if (!rawBody || !signatureHeader || !timestampHeader || !secret) {
    return false;
  }

  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) {
    return false;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > toleranceSec) {
    return false;
  }

  const payloadToVerify = `${ts}.${rawBody}`;
  const expectedDigest = createHmac('sha256', secret).update(payloadToVerify).digest('hex');
  const expectedSignature = `sha256=${expectedDigest}`;

  try {
    const sigBuffer = Buffer.from(signatureHeader.trim(), 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}
