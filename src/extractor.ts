import { chromium } from "playwright";
import * as fs from "fs";

const COOKIES = [
  { name: "TASession", value: "V2ID.7E1CB53C0D7D4B5E94E1CFA5B3BB1F6E*SQ.8*LS.Attraction_Review*HS.recommended*ES.popularity*DS.5*SAS.popularity*FPS.oldFirst*LF.en*FA.1*DF.0*FLO.315636*TRA.true*LD.315636", domain: ".tripadvisor.com", path: "/" },
  { name: "TATravelInfo", value: "V2*A.2*MG.-1*HP.2*FL.3*RS.1", domain: ".tripadvisor.com", path: "/" },
  { name: "TASID", value: "7E1CB53C0D7D4B5E94E1CFA5B3BB1F6E", domain: ".tripadvisor.com", path: "/" },
  { name: "TAUD", value: "LA-1781307105888-1*RDD-1-2026_06_12*LG-327651-2.1.F.*LD-327652-.....", domain: ".tripadvisor.com", path: "/" },
  { name: "datadome", value: "HeMHK78PkxL15IYCXq375a~U~R9hDnYpjCsBpiPvYW~lB5XrxF9Ip1MYviGGCSX32YUuqSOBouaU7W5G9x8PPV7DaghrbOOoAmtmtwEL7rrM0h4cMzLl21f96WNNElop", domain: ".tripadvisor.com", path: "/" },
  { name: "__vt", value: "xXPwKvFuDh9C1JjPABQCT24E-H_BQo6gx1APGQJPtz4aBhmEHW2boAcVeHS65XbPbyJwCktzaSWlsTh8kBqRbnDGBCGpIziLBW_30Ek6qH6q1Ngyt733brLAVLYzev1sseGjHcHNVBa6DtUrN667IGhvkaw", domain: ".tripadvisor.com", path: "/" },
  { name: "TATrkConsent", value: "eyJvdXQiOiJBRFYsQU5BLEZVTkNUSU9OQUwsU09DSUFMX01FRElBIiwiaW4iOiIifQ==", domain: ".tripadvisor.com", path: "/" },
];

const BASE_URL =
  "https://www.tripadvisor.com/Attraction_Review-g294308-d315636-Reviews-Quito_Old_Town-Quito_Pichincha_Province.html";

const TARGET_REVIEWS = 600;

interface Review {
  title: string;
  text: string;
  rating: number;
  date: string;
  user: string;
  userLocation: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms + Math.random() * ms * 0.3));
}

function extractReviewsFromCards(page: import("playwright").Page): Promise<Review[]> {
  return page.evaluate(() => {
    const results: Review[] = [];
    const cards = document.querySelectorAll('[data-automation="reviewCard"]');

    cards.forEach((card) => {
      const html = card.innerHTML;
      const text = card.textContent || "";

      // Rating
      let rating = 0;
      const ratingMatch = html.match(/alt="(\d(?:\.\d)?)\s*of\s*5\s*bubbles"/);
      if (ratingMatch) rating = parseFloat(ratingMatch[1]);
      if (rating === 0) {
        const textRatingMatch = text.match(/(\d(?:\.\d)?)\s*of\s*5\s*bubbles/);
        if (textRatingMatch) rating = parseFloat(textRatingMatch[1]);
      }

      // User
      let user = "";
      const nameSpan = card.querySelector('a[href*="/Profile/"] span');
      if (nameSpan) user = nameSpan.textContent?.trim() || "";
      if (!user) {
        const profileMatch = html.match(/href="\/Profile\/[^"]*"[^>]*>([^<]+)</);
        if (profileMatch) user = profileMatch[1].trim();
      }

      // Location
      let userLocation = "";
      const allSpansForLoc = card.querySelectorAll("span");
      allSpansForLoc.forEach((span) => {
        const t = span.textContent?.trim() || "";
        if (t.match(/^[A-Z][a-z]+(?:,\s*[A-Z][a-z]+)?$/) && !userLocation && t !== user) {
          userLocation = t;
        }
      });

      // Date
      let date = "";
      const dateMatch = text.match(/(?:Written|Reviewed)\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/);
      if (dateMatch) date = dateMatch[1];

      // Title
      let title = "";
      const titleSpans = card.querySelectorAll("a span, span[class*='title']");
      titleSpans.forEach((span) => {
        const t = span.textContent?.trim() || "";
        if (t.length > 5 && t.length < 100 && !t.includes("contributions") && !t.includes("bubbles")) {
          title = t;
        }
      });

      // Review text
      let reviewText = "";
      const allSpans = card.querySelectorAll("span");
      allSpans.forEach((span) => {
        const t = span.textContent?.trim() || "";
        if (
          t.length > 60 && t.length < 2000 &&
          !t.includes("contributions") && !t.includes("bubbles") &&
          !t.includes("Written") && !t.includes("Reviewed") &&
          !t.includes("This review is the subjective") &&
          !t.includes("Tripadvisor performs checks") &&
          !t.includes("Read more") && !t.includes("Show less") &&
          span.children.length < 3
        ) {
          reviewText = t;
        }
      });

      if (reviewText.length > 30) {
        results.push({ title, text: reviewText, rating, date, user, userLocation });
      }
    });

    return results;
  });
}

async function main() {
  console.log(`=== TripAdvisor Review Extractor (Target: ${TARGET_REVIEWS} reviews) ===\n`);

  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled", "--start-maximized"],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: "en-US",
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  await context.addCookies(COOKIES);
  const page = await context.newPage();

  // Cargar reviews existentes del archivo con más datos
  const allReviews: Review[] = [];
  const seenTexts = new Set<string>();
  const SAVE_FILE = "reviews.json"; // Un solo archivo para todo
  
  // Buscar el archivo con más reviews
  const candidates = ["reviews.json", "reviews_partial.json", "reviews_progress.json"];
  let bestFile = "";
  let bestCount = 0;
  
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      try {
        const data = JSON.parse(fs.readFileSync(file, "utf-8"));
        if (data.length > bestCount) {
          bestCount = data.length;
          bestFile = file;
        }
      } catch {}
    }
  }
  
  if (bestFile) {
    const existing = JSON.parse(fs.readFileSync(bestFile, "utf-8"));
    existing.forEach((r: Review) => {
      allReviews.push(r);
      seenTexts.add(r.text.substring(0, 60));
    });
    console.log(`[Resume] Loaded ${allReviews.length} reviews from ${bestFile}`);
  }

  try {
    // TripAdvisor pagina con ?or10, ?or20, etc. (cada pagina = 10 reviews)
    const totalPages = Math.ceil(TARGET_REVIEWS / 10);
    const startPage = Math.floor(allReviews.length / 10); // Continuar desde donde quedamos
    let consecutiveErrors = 0;

    for (let pageNum = startPage; pageNum < totalPages; pageNum++) {
      const offset = pageNum * 10;
      const url = offset === 0
        ? BASE_URL
        : BASE_URL.replace("-Reviews-", `-Reviews-or${offset}-`);

      console.log(`\n[Page ${pageNum + 1}/${totalPages}] Loading offset ${offset}...`);
      
      // Retry logic
      let loaded = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
          loaded = true;
          break;
        } catch (e) {
          console.log(`  [!] Attempt ${attempt}/3 failed. Retrying...`);
          await sleep(5000 * attempt);
        }
      }

      if (!loaded) {
        consecutiveErrors++;
        console.log(`  [SKIP] Could not load page after 3 attempts.`);
        if (consecutiveErrors >= 3) {
          console.log("\n[!] Too many consecutive errors. Stopping.");
          break;
        }
        continue;
      }
      consecutiveErrors = 0;

      await sleep(3000);

      // Verificar captcha
      const content = await page.content();
      if (content.includes("captcha-delivery.com")) {
        console.log("[!] CAPTCHA detected! Solve it in the browser...");
        for (let i = 0; i < 90; i++) {
          await sleep(2000);
          const c = await page.content();
          if (!c.includes("captcha-delivery.com")) {
            console.log("[OK] CAPTCHA solved!");
            break;
          }
          if (i % 10 === 0 && i > 0) console.log(`[...] Waiting ${i * 2}s...`);
        }
        await sleep(2000);
      }

      // Scroll para asegurar carga completa
      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, 500);
        await sleep(400);
      }

      // Extraer reviews de esta pagina
      const pageReviews = await extractReviewsFromCards(page);

      // Deduplicar por texto
      let newCount = 0;
      for (const review of pageReviews) {
        const key = review.text.substring(0, 60);
        if (!seenTexts.has(key)) {
          seenTexts.add(key);
          allReviews.push(review);
          newCount++;
        }
      }

      console.log(`  Found ${pageReviews.length} reviews (${newCount} new). Total: ${allReviews.length}`);

      // Si no encontramos reviews nuevas, probablemente llegamos al final
      if (newCount === 0 && pageNum > 2) {
        console.log("\n[!] No new reviews found. Reached the end?");
        break;
      }

      // Guardar progreso cada 10 paginas
      if (pageNum % 10 === 0 && pageNum > 0) {
        fs.writeFileSync("reviews_progress.json", JSON.stringify(allReviews, null, 2), "utf-8");
        console.log(`  [Checkpoint] Saved ${allReviews.length} reviews to reviews_progress.json`);
      }

      // Pausa entre paginas para no sobrecargar
      await sleep(3000 + Math.random() * 2000);
    }

    // Guardar resultado final
    console.log(`\n=== COMPLETE ===`);
    console.log(`Total reviews extracted: ${allReviews.length}`);
    
    fs.writeFileSync("reviews.json", JSON.stringify(allReviews, null, 2), "utf-8");
    console.log("Saved to reviews.json");

    // Estadisticas
    const ratings = allReviews.filter(r => r.rating > 0).map(r => r.rating);
    if (ratings.length > 0) {
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      console.log(`\nStats:`);
      console.log(`  Average rating: ${avg.toFixed(1)}/5`);
      console.log(`  Reviews with rating: ${ratings.length}/${allReviews.length}`);
      console.log(`  5-star: ${ratings.filter(r => r === 5).length}`);
      console.log(`  4-star: ${ratings.filter(r => r === 4).length}`);
      console.log(`  3-star: ${ratings.filter(r => r === 3).length}`);
      console.log(`  2-star: ${ratings.filter(r => r === 2).length}`);
      console.log(`  1-star: ${ratings.filter(r => r === 1).length}`);
    }

  } catch (error) {
    console.error("Error:", (error as Error).message);
    // Guardar lo que tengamos hasta ahora
    if (allReviews.length > 0) {
      fs.writeFileSync("reviews_partial.json", JSON.stringify(allReviews, null, 2), "utf-8");
      console.log(`Saved ${allReviews.length} partial reviews to reviews_partial.json`);
    }
    await page.screenshot({ path: "error_screenshot.png" });
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
