import { chromium } from "playwright";
import * as fs from "fs";

interface Review {
  title: string;
  text: string;
  rating: number;
  date: string;
  user: string;
  userLocation: string;
}

const URL =
  "https://www.tripadvisor.com/Attraction_Review-g294308-d315636-Reviews-Quito_Old_Town-Quito_Pichincha_Province.html";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms + Math.random() * ms * 0.3));
}

async function waitForCaptchaSolve(page: import("playwright").Page): Promise<void> {
  // Esperar hasta que desaparezca el iframe de DataDome
  console.log("[!] If a CAPTCHA appears, solve it in the browser...");
  
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    const content = await page.content();
    const hasCaptcha =
      content.includes("captcha-delivery.com") ||
      content.includes("DataDome") ||
      content.includes("verify you are human");
    
    if (!hasCaptcha) {
      console.log("[OK] CAPTCHA passed!");
      return;
    }
    
    if (i % 5 === 0) {
      console.log(`[...] Still waiting for CAPTCHA (${i * 2}s)...`);
    }
  }
  
  throw new Error("CAPTCHA timeout - could not solve in 2 minutes");
}

async function extractReviews(page: import("playwright").Page): Promise<Review[]> {
  return await page.evaluate(() => {
    const results: Review[] = [];

    // TripAdvisor selectores conocidos
    const selectors = [
      '[data-automation="reviewCard"]',
      'div[data-test-target="HR_CC_CARD"]',
      '.review-container',
    ];

    let cards: NodeListOf<Element> | null = null;
    for (const sel of selectors) {
      cards = document.querySelectorAll(sel);
      if (cards.length > 0) {
        console.log(`Found cards with selector: ${sel}`);
        break;
      }
    }

    if (!cards || cards.length === 0) return results;

    cards.forEach((card) => {
      const title =
        card.querySelector('[data-automation="reviewTitle"]')?.textContent?.trim() ??
        card.querySelector("a span")?.textContent?.trim() ??
        "";

      const text =
        card.querySelector('[data-automation="reviewText"]')?.textContent?.trim() ??
        card.querySelector("q")?.textContent?.trim() ??
        "";

      const ratingEl =
        card.querySelector('[data-automation="bubbleRatingImage"]') ??
        card.querySelector('img[alt*="star"]');
      let rating = 0;
      if (ratingEl) {
        const alt = ratingEl.getAttribute("alt") ?? "";
        const match = alt.match(/(\d)/);
        if (match) rating = parseInt(match[1]);
      }

      const date =
        card.querySelector('[data-automation="reviewDate"]')?.textContent?.trim() ?? "";

      const user =
        card.querySelector('[data-automation="memberName"]')?.textContent?.trim() ?? "";

      const userLocation =
        card.querySelector('[data-automation="memberLocation"]')?.textContent?.trim() ?? "";

      if (text.length > 20) {
        results.push({ title, text, rating, date, user, userLocation });
      }
    });

    return results;
  });
}

async function main() {
  console.log("=== TripAdvisor Reviews Scraper ===\n");
  console.log("Target: Quito Old Town (ID: 315636)\n");

  // Usar Chrome real del sistema (mucho menos detectable)
  const browser = await chromium.launch({
    headless: false,
    channel: "chrome", // Usa Chrome instalado en Windows
    args: [
      "--disable-blink-features=AutomationControlled",
      "--start-maximized",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: "en-US",
    timezoneId: "America/Guayaquil",
    geolocation: { latitude: -0.1807, longitude: -78.4678 },
    permissions: ["geolocation"],
  });

  // Anti-deteccion
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: "denied" } as PermissionStatus)
        : originalQuery(parameters);
  });

  const page = await context.newPage();

  try {
    console.log("Loading TripAdvisor...");
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });

    // Verificar si hay captcha y esperar resolucion manual
    await sleep(2000);
    const content = await page.content();
    const hasCaptcha =
      content.includes("captcha-delivery.com") ||
      content.includes("DataDome") ||
      content.includes("verify you are human");

    if (hasCaptcha) {
      await waitForCaptchaSolve(page);
      await sleep(3000);
    }

    // Scroll humano
    console.log("Scrolling to load reviews...");
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, 300 + Math.random() * 400);
      await sleep(600 + Math.random() * 800);
    }

    // Extraer reviews
    console.log("Extracting reviews...");
    const reviews = await extractReviews(page);

    if (reviews.length > 0) {
      console.log(`\n=== ${reviews.length} Reviews Found ===\n`);
      reviews.slice(0, 10).forEach((r, i) => {
        console.log(`--- Review ${i + 1} ---`);
        console.log(`User: ${r.user} (${r.userLocation})`);
        console.log(`Rating: ${r.rating}/5`);
        console.log(`Date: ${r.date}`);
        if (r.title) console.log(`Title: ${r.title}`);
        console.log(`Text: ${r.text.substring(0, 300)}`);
        console.log();
      });

      fs.writeFileSync("reviews.json", JSON.stringify(reviews, null, 2), "utf-8");
      console.log(`Saved ${reviews.length} reviews to reviews.json`);
    } else {
      console.log("\nNo reviews extracted. Saving debug...");
      fs.writeFileSync("debug_page.html", await page.content(), "utf-8");
      await page.screenshot({ path: "debug_screenshot.png", fullPage: true });
      console.log("Saved debug_page.html + debug_screenshot.png");
    }
  } catch (error) {
    console.error("Error:", (error as Error).message);
    await page.screenshot({ path: "error_screenshot.png", fullPage: true });
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
