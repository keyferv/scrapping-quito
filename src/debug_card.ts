import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: "en-US",
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  await ctx.addCookies([
    {
      name: "TASession",
      value: "V2ID.7E1CB53C0D7D4B5E94E1CFA5B3BB1F6E*SQ.8*LS.Attraction_Review*HS.recommended*ES.popularity*DS.5*SAS.popularity*FPS.oldFirst*LF.en*FA.1*DF.0*FLO.315636*TRA.true*LD.315636",
      domain: ".tripadvisor.com",
      path: "/",
    },
    {
      name: "datadome",
      value: "HeMHK78PkxL15IYCXq375a~U~R9hDnYpjCsBpiPvYW~lB5XrxF9Ip1MYviGGCSX32YUuqSOBouaU7W5G9x8PPV7DaghrbOOoAmtmtwEL7rrM0h4cMzLl21f96WNNElop",
      domain: ".tripadvisor.com",
      path: "/",
    },
  ]);
  const page = await ctx.newPage();
  await page.goto(
    "https://www.tripadvisor.com/Attraction_Review-g294308-d315636-Reviews-Quito_Old_Town-Quito_Pichincha_Province.html",
    { waitUntil: "domcontentloaded", timeout: 45000 }
  );
  await page.waitForTimeout(5000);

  const cardData = await page.evaluate(() => {
    const card = document.querySelector('[data-automation="reviewCard"]');
    if (!card) return { html: "NO CARD", text: "" };
    return {
      html: card.innerHTML.substring(0, 3000),
      text: card.textContent?.substring(0, 1000) || "",
    };
  });

  console.log("=== TEXT ===");
  console.log(cardData.text);
  console.log("\n=== HTML (first 1500) ===");
  console.log(cardData.html.substring(0, 1500));

  // Buscar rating en el HTML
  const ratingPatterns = [
    /alt="[^"]*(\d(?:\.\d)?)\s*of\s*5[^"]*"/g,
    /aria-label="[^"]*(\d(?:\.\d)?)\s*of\s*5[^"]*"/g,
    /(\d(?:\.\d)?)\s*of\s*5\s*bubbles/g,
    /class="[^"]*star[^"]*"/g,
  ];

  console.log("\n=== Rating patterns ===");
  for (const pattern of ratingPatterns) {
    const matches = cardData.html.match(pattern);
    if (matches) console.log(pattern.source, "->", matches.slice(0, 3));
  }

  await browser.close();
}

main().catch(console.error);
