import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode } from "lucide-react";

export interface SignatureQrCodeProps {
  url: string;
  alt?: string;
  className?: string;
}

/**
 * Renderiza um QR Code compacto via `qrcode` apontando para a URL pública
 * de verificação da assinatura eletrônica.
 */
export const SignatureQrCode: React.FC<SignatureQrCodeProps> = ({
  url,
  alt = "QR Code para verificar assinatura eletrônica",
  className = "",
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!url) {
      setDataUrl(null);
      setFailed(true);
      return () => {
        active = false;
      };
    }

    setFailed(false);
    QRCode.toDataURL(url, { width: 120, margin: 1 })
      .then((generated) => {
        if (active) {
          setDataUrl(generated);
        }
      })
      .catch(() => {
        if (active) {
          setDataUrl(null);
          setFailed(true);
        }
      });

    return () => {
      active = false;
    };
  }, [url]);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-white dark:bg-slate-900 border border-emerald-500/25 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0 ${className}`}
      >
        <QrCode className="w-10 h-10 opacity-70" />
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        aria-hidden="true"
        className={`w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-emerald-500/20 animate-pulse shrink-0 ${className}`}
      />
    );
  }

  return (
    <img
      src={dataUrl}
      alt={alt}
      className={`w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-white p-1 border border-emerald-500/25 object-contain shrink-0 ${className}`}
    />
  );
};
