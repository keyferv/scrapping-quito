import { chromium } from "playwright";
import * as fs from "fs";

// Cookies reales capturadas del navegador del usuario
const COOKIES = [
  { name: "TASession", value: "V2ID.7E1CB53C0D7D4B5E94E1CFA5B3BB1F6E*SQ.8*LS.Attraction_Review*HS.recommended*ES.popularity*DS.5*SAS.popularity*FPS.oldFirst*LF.en*FA.1*DF.0*FLO.315636*TRA.true*LD.315636", domain: ".tripadvisor.com", path: "/" },
  { name: "TATravelInfo", value: "V2*A.2*MG.-1*HP.2*FL.3*RS.1", domain: ".tripadvisor.com", path: "/" },
  { name: "TASID", value: "7E1CB53C0D7D4B5E94E1CFA5B3BB1F6E", domain: ".tripadvisor.com", path: "/" },
  { name: "TAUD", value: "LA-1781307105888-1*RDD-1-2026_06_12*LG-327651-2.1.F.*LD-327652-.....", domain: ".tripadvisor.com", path: "/" },
  { name: "TATrkConsent", value: "eyJvdXQiOiJBRFYsQU5BLEZVTkNUSU9OQUwsU09DSUFMX01FRElBIiwiaW4iOiIifQ==", domain: ".tripadvisor.com", path: "/" },
  { name: "datadome", value: "HeMHK78PkxL15IYCXq375a~U~R9hDnYpjCsBpiPvYW~lB5XrxF9Ip1MYviGGCSX32YUuqSOBouaU7W5G9x8PPV7DaghrbOOoAmtmtwEL7rrM0h4cMzLl21f96WNNElop", domain: ".tripadvisor.com", path: "/" },
  { name: "__vt", value: "xXPwKvFuDh9C1JjPABQCT24E-H_BQo6gx1APGQJPtz4aBhmEHW2boAcVeHS65XbPbyJwCktzaSWlsTh8kBqRbnDGBCGpIziLBW_30Ek6qH6q1Ngyt733brLAVLYzev1sseGjHcHNVBa6DtUrN667IGhvkaw", domain: ".tripadvisor.com", path: "/" },
];

const TARGET_URL =
  "https://www.tripadvisor.com/Attraction_Review-g294308-d315636-Reviews-Quito_Old_Town-Quito_Pichincha_Province.html";

interface GraphQLCapture {
  url: string;
  method: string;
  requestBody: any;
  responseBody: any;
  status: number;
}

async function main() {
  console.log("=== TripAdvisor GraphQL Interceptor ===\n");

  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled", "--start-maximized"],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: "en-US",
  });

  // Anti-deteccion
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  // Cargar cookies reales
  await context.addCookies(COOKIES);

  const page = await context.newPage();
  const capturedRequests: GraphQLCapture[] = [];

  // Interceptar todas las peticiones GraphQL
  page.on("request", async (request) => {
    const url = request.url();
    if (url.includes("/data/graphql") || url.includes("graphql")) {
      try {
        const body = request.postData();
        if (body) {
          const parsed = JSON.parse(body);
          // Solo queries que parezcan de reviews
          const bodyStr = JSON.stringify(parsed);
          if (
            bodyStr.includes("review") ||
            bodyStr.includes("Review") ||
            bodyStr.includes("location") ||
            parsed[0]?.extensions?.preRegisteredQueryId
          ) {
            console.log(`[INTERCEPTED] ${parsed[0]?.extensions?.preRegisteredQueryId || "unknown"}`);
          }
        }
      } catch {}
    }
  });

  // Interceptar respuestas GraphQL
  page.on("response", async (response) => {
    const url = response.url();
    if (url.includes("/data/graphql") || url.includes("graphql")) {
      try {
        const request = response.request();
        const reqBody = request.postData();
        const resBody = await response.json();

        if (reqBody) {
          const parsedReq = JSON.parse(reqBody);
          capturedRequests.push({
            url,
            method: request.method(),
            requestBody: parsedReq,
            responseBody: resBody,
            status: response.status(),
          });

          // Log si parece contener reviews
          const resStr = JSON.stringify(resBody);
          if (
            resStr.includes("reviewText") ||
            resStr.includes("reviewTitle") ||
            resStr.includes("publishedDate") ||
            resStr.includes("rating")
          ) {
            console.log("\n[FOUND] Review data captured!");
            console.log("Query ID:", parsedReq[0]?.extensions?.preRegisteredQueryId);
            
            // Guardar inmediatamente
            fs.writeFileSync(
              "captured_reviews.json",
              JSON.stringify({ request: parsedReq, response: resBody }, null, 2),
              "utf-8"
            );
            console.log("Saved to captured_reviews.json");
          }
        }
      } catch {}
    }
  });

  try {
    console.log("Loading TripAdvisor page...");
    await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 60000 });

    // Verificar si hay captcha
    const content = await page.content();
    if (content.includes("captcha-delivery.com")) {
      console.log("\n[!] CAPTCHA detected. Solve it in the browser...");
      console.log("[!] Waiting up to 2 minutes...");
      
      // Esperar a que el captcha se resuelva
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const c = await page.content();
        if (!c.includes("captcha-delivery.com")) {
          console.log("[OK] CAPTCHA solved!");
          break;
        }
        if (i % 5 === 0) console.log(`[...] Waiting (${i * 2}s)...`);
      }
      
      // Recargar despues del captcha
      await page.waitForTimeout(3000);
    }

    // Scroll para cargar mas reviews
    console.log("\nScrolling to trigger more GraphQL calls...");
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 500 + Math.random() * 300);
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 500));
    }

    // Esperar un poco mas por si hay requests pendientes
    await page.waitForTimeout(3000);

    // Guardar todo lo capturado
    console.log(`\n=== Results ===`);
    console.log(`Total GraphQL requests captured: ${capturedRequests.length}`);

    // Buscar la request de reviews
    const reviewRequest = capturedRequests.find((r) => {
      const str = JSON.stringify(r.responseBody);
      return str.includes("reviewText") || str.includes("reviewTitle");
    });

    if (reviewRequest) {
      console.log("\n[SUCCESS] Review GraphQL request found!");
      console.log("Query ID:", reviewRequest.requestBody[0]?.extensions?.preRegisteredQueryId);
      console.log("Status:", reviewRequest.status);
      
      fs.writeFileSync(
        "review_graphql_full.json",
        JSON.stringify(reviewRequest, null, 2),
        "utf-8"
      );
      console.log("Saved full request+response to review_graphql_full.json");
    } else {
      console.log("\n[INFO] No review data in captured requests.");
      console.log("Saving all captured requests for inspection...");
      
      fs.writeFileSync(
        "all_graphql_captures.json",
        JSON.stringify(capturedRequests, null, 2),
        "utf-8"
      );
      console.log(`Saved ${capturedRequests.length} requests to all_graphql_captures.json`);
    }

    // Tambien guardar los headers que usamos
    fs.writeFileSync(
      "request_headers.json",
      JSON.stringify(
        {
          cookies: COOKIES,
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Avast/148.0.0.0",
        },
        null,
        2
      ),
      "utf-8"
    );

  } catch (error) {
    console.error("Error:", (error as Error).message);
    await page.screenshot({ path: "error_screenshot.png" });
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
