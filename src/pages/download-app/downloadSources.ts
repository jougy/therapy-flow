import { useEffect, useState } from "react";

export type DownloadAssetKey =
  | "macDmg"
  | "macZip"
  | "windowsExe"
  | "windowsMsi"
  | "linuxDeb"
  | "linuxRpm"
  | "linuxAppImage";

export const DOWNLOAD_FILENAMES: Record<DownloadAssetKey, string> = {
  macDmg: "Pluri-Health-Mac.dmg",
  macZip: "Pluri-Health-Mac.zip",
  windowsExe: "Pluri-Health-Windows.exe",
  windowsMsi: "Pluri-Health.msi",
  linuxDeb: "pluri-health_amd64.deb",
  linuxRpm: "pluri-health.rpm",
  linuxAppImage: "Pluri-Health-Linux.AppImage",
};

export const LOCAL_DOWNLOAD_PATHS: Record<DownloadAssetKey, string> = {
  macDmg: `/downloads/${DOWNLOAD_FILENAMES.macDmg}`,
  macZip: `/downloads/${DOWNLOAD_FILENAMES.macZip}`,
  windowsExe: `/downloads/${DOWNLOAD_FILENAMES.windowsExe}`,
  windowsMsi: `/downloads/${DOWNLOAD_FILENAMES.windowsMsi}`,
  linuxDeb: `/downloads/${DOWNLOAD_FILENAMES.linuxDeb}`,
  linuxRpm: `/downloads/${DOWNLOAD_FILENAMES.linuxRpm}`,
  linuxAppImage: `/downloads/${DOWNLOAD_FILENAMES.linuxAppImage}`,
};

export const GITHUB_RELEASES_LATEST_API =
  "https://api.github.com/repos/jougy/therapy-flow/releases/latest";

export interface GitHubReleaseAsset {
  name?: string;
  browser_download_url?: string;
}

export function isLocalhostOrigin(hostname?: string): boolean {
  if (!hostname) return false;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function resolveDownloadUrlsFromRelease(
  assets?: GitHubReleaseAsset[] | null
): Record<DownloadAssetKey, string> {
  const resolved: Record<DownloadAssetKey, string> = { ...LOCAL_DOWNLOAD_PATHS };
  if (!Array.isArray(assets) || assets.length === 0) {
    return resolved;
  }

  const assetsByName = new Map<string, string>();
  for (const asset of assets) {
    if (
      typeof asset?.name === "string" &&
      typeof asset?.browser_download_url === "string" &&
      asset.browser_download_url.startsWith("https://")
    ) {
      assetsByName.set(asset.name, asset.browser_download_url);
    }
  }

  (Object.keys(DOWNLOAD_FILENAMES) as DownloadAssetKey[]).forEach((key) => {
    const remoteUrl = assetsByName.get(DOWNLOAD_FILENAMES[key]);
    if (remoteUrl) {
      resolved[key] = remoteUrl;
    }
  });

  return resolved;
}

export function useDownloadUrls(): Record<DownloadAssetKey, string> {
  const [downloadUrls, setDownloadUrls] = useState<Record<DownloadAssetKey, string>>(
    () => ({ ...LOCAL_DOWNLOAD_PATHS })
  );

  useEffect(() => {
    if (typeof window === "undefined" || isLocalhostOrigin(window.location.hostname)) {
      return;
    }

    const controller = new AbortController();

    async function checkPublishedRelease() {
      try {
        const res = await fetch(GITHUB_RELEASES_LATEST_API, {
          headers: { Accept: "application/vnd.github+json" },
          signal: controller.signal,
        });
        if (!res.ok) return;

        const data = (await res.json()) as { assets?: GitHubReleaseAsset[] };
        if (controller.signal.aborted) return;

        setDownloadUrls(resolveDownloadUrlsFromRelease(data?.assets));
      } catch {
        // Mantém os instaladores locais em /downloads/ como fallback seguro.
      }
    }

    void checkPublishedRelease();

    return () => {
      controller.abort();
    };
  }, []);

  return downloadUrls;
}
