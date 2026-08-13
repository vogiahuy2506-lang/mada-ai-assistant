/**
 * Wrapper script để chạy mada-scraper
 * Vấn đề: import.meta.url không match khi chạy trực tiếp
 */

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const categorySlug = getArg('--category') || 'sensory-hearing';
  const maxPagesArg = getArg('--pages');
  const autoDetect = args.includes('--auto-pages') || !maxPagesArg;
  const maxPages = maxPagesArg ? parseInt(maxPagesArg) : 5;
  const language = (getArg('--lang') || 'en') as 'en' | 'ar';
  const ingest = args.includes('--ingest');

  console.log(`\n🚀 MADA Scraper Wrapper`);
  console.log(`   Category: ${categorySlug}`);
  console.log(`   Auto-detect pages: ${autoDetect}`);
  console.log(`   Ingest: ${ingest}`);
  console.log('');

  // Dynamic import để tránh vấn đề import.meta.url
  const scraper = await import('./server/scripts/mada-scraper.ts');

  if (categorySlug === 'all') {
    console.log('\n🌐 Scraping ALL categories...\n');
    for (const cat of scraper.MADA_CATEGORIES) {
      try {
        let pages = maxPages;
        if (autoDetect) {
          console.log(`\n🔍 Auto-detecting pagination for ${cat.slug}...`);
          pages = await scraper.detectTotalPages(cat.slug, language);
        }
        const result = await scraper.runMadaScraper({
          categorySlug: cat.slug,
          maxPages: pages,
          language,
          ingest,
        });
        console.log(`\n✅ ${cat.slug}: Found ${result.totalFound}, Scraped ${result.totalScraped}, Ingested ${result.totalIngested}`);
      } catch (err: any) {
        console.error(`❌ Category ${cat.slug} failed: ${err.message}`);
      }
      // Delay giữa các category
      await new Promise(r => setTimeout(r, 5000));
    }
  } else {
    let pages = maxPages;
    if (autoDetect) {
      console.log(`🔍 Auto-detecting pagination for ${categorySlug}...`);
      pages = await scraper.detectTotalPages(categorySlug, language);
    }
    const result = await scraper.runMadaScraper({
      categorySlug,
      maxPages: pages,
      language,
      ingest,
    });
    console.log(`\n✅ Done! Found ${result.totalFound}, Scraped ${result.totalScraped}, Ingested ${result.totalIngested}`);
  }

  console.log('\n🎉 Scraper completed!');
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
