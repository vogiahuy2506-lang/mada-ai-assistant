import * as cheerio from 'cheerio';

const NEURO_SLUGS = [
  '1-2-switch',
  'amaneo-assistive-mouse-adapter',
  'animated-sandbox',
  'assessment-switch-kit',
  'mogo-super-evaluation-kit',
  'open-sesame-app',
  'quha-zono-2',
  'sesame-enable-touch-free-control',
  'soundbeam-6',
  'td-pilot',
  'tobii-pceye-5',
  'xbox-adaptive-controller',
];

async function scrapeProduct(slug: string) {
  const url = `https://at.mada.org.qa/technology/${slug}/`;
  console.log(`Fetching: ${url}`);

  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('h1.entry-title').text().trim() || slug;
    const fullContent = $(".entry-content").text().trim();
    const firstPara = $(".entry-content p").first().text().trim();

    const metadata: Record<string, string> = {};
    $(".entry-content p").each((_, el) => {
      const text = $(el).text().trim();
      if (text.includes("Operating System") || text.includes("Manufacturer")) {
        const parts = text.split(":");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join(":").trim();
          metadata[key] = value;
        }
      }
    });

    const image = $(".post_thumbnail img, .entry-content img").first().attr("src") || "";

    console.log(`  OK: ${title}`);

    return {
      slug,
      title,
      description: firstPara,
      fullContent,
      operatingSystem: metadata["Operating System"] || "N/A",
      manufacturer: metadata["Manufacturer"] || "N/A",
      image,
    };
  } catch (error) {
    console.error(`  ERROR scraping ${slug}:`, error);
    return null;
  }
}

async function main() {
  console.log("Scraping MADA Neuromusculoskeletal products...\n");

  const results = [];
  for (const slug of NEURO_SLUGS) {
    const result = await scrapeProduct(slug);
    if (result) results.push(result);
    await new Promise(r => setTimeout(r, 500));
  }

  const fs = await import("fs");
  fs.writeFileSync("neuro-products.json", JSON.stringify(results, null, 2));
  console.log("\nSaved to neuro-products.json");
  console.log("Total products:", results.length);
}

main().catch(console.error);
