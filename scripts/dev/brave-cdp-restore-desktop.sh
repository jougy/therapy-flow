#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-9222}"
WIDTH="${2:-1920}"
HEIGHT="${3:-950}"
URL="${4:-http://localhost:8080/espacopessoal}"

node - "$PORT" "$WIDTH" "$HEIGHT" "$URL" <<'NODE'
const { chromium } = require("playwright");

const [port, widthArg, heightArg, url] = process.argv.slice(2);
const width = Number(widthArg);
const height = Number(heightArg);

(async () => {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const pages = browser.contexts().flatMap((context) => context.pages());
  const target = pages.find((page) => page.url().includes("localhost:8080")) || pages[0];

  if (!target) {
    throw new Error("Nenhuma aba encontrada no Brave CDP.");
  }

  await target.bringToFront();
  const client = await target.context().newCDPSession(target);

  try {
    const { windowId } = await client.send("Browser.getWindowForTarget");
    await client.send("Browser.setWindowBounds", {
      windowId,
      bounds: {
        left: 0,
        top: 0,
        width,
        height: height + 130,
        windowState: "normal",
      },
    });
  } catch (error) {
    console.warn(`Nao foi possivel ajustar a janela: ${error.message}`);
  }

  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
    scale: 1,
    screenWidth: width,
    screenHeight: height + 130,
    positionX: 0,
    positionY: 0,
    dontSetVisibleSize: false,
  });
  await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });

  await target.goto(url, { waitUntil: "domcontentloaded" });
  await target.waitForTimeout(500);

  const metrics = await target.evaluate(() => ({
    url: location.href,
    innerWidth,
    outerWidth,
    docClientWidth: document.documentElement.clientWidth,
    rootWidth: Math.round(document.querySelector("#root")?.getBoundingClientRect().width || 0),
    mainWidth: Math.round(document.querySelector("main")?.getBoundingClientRect().width || 0),
  }));

  console.log(JSON.stringify(metrics, null, 2));
  await browser.close();
})();
NODE
