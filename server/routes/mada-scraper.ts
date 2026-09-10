/**
 * MADA Scraper API Routes
 *
 * Exposes endpoints to trigger MADA scraper from admin UI / cron.
 * Supports per-category scraping, all categories, and single URL.
 */

import express from 'express';
import { runMadaScraper, scrapeCategoryListing, scrapeProductDetail, ingestProductDetail, MADA_CATEGORIES } from '../scripts/mada-scraper';

const router = express.Router();

// ============== LIST CATEGORIES ==============

router.get('/categories', (_req, res) => {
  res.json({
    success: true,
    data: MADA_CATEGORIES.map(c => ({
      slug: c.slug,
      name: c.name,
      bot: c.bot,
      description: c.description,
      pages: c.page,
    })),
  });
});

// ============== SCRAPE CATEGORY (with optional ingest) ==============

router.post('/scrape', async (req, res) => {
  try {
    const { category = 'sensory-hearing', pages = 5, language = 'en', ingest = true } = req.body;

    console.log(`\n🔌 API: Scrape request — category=${category}, pages=${pages}, ingest=${ingest}`);

    // Run in background so we can return immediately
    const jobId = `mada_${Date.now()}`;

    // Schedule background job
    (async () => {
      try {
        const result = await runMadaScraper({
          categorySlug: category,
          maxPages: pages,
          language,
          ingest,
          onProgress: (_msg) => {
            // We could push to a job-state store; for now, log
          },
        });
        console.log(`\n✅ Job ${jobId} done:`, result);
      } catch (err: any) {
        console.error(`\n❌ Job ${jobId} failed:`, err.message);
      }
    })();

    res.json({
      success: true,
      jobId,
      message: `Started scraping "${category}" in background. Check logs for progress.`,
      data: {
        category,
        pages,
        language,
        ingest,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== SCRAPE SINGLE PRODUCT (test) ==============

router.post('/scrape-one', async (req, res) => {
  try {
    const { url, language = 'en', ingest = false } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: 'url is required' });
    }

    console.log(`\n🔌 API: Single product scrape — ${url}`);

    const slug = url.split('/').filter(Boolean).pop() || 'unknown';
    const item = {
      postId: 'api',
      slug,
      title: slug,
      detailUrl: url,
      thumbnailUrl: '',
      categories: [],
      language: language as 'en' | 'ar',
    };

    const detail = await scrapeProductDetail(item);

    if (ingest) {
      const result = await ingestProductDetail(detail);
      return res.json({
        success: true,
        data: {
          detail,
          ingest: result,
        },
      });
    }

    res.json({
      success: true,
      data: { detail },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== LIST ONLY (no detail scrape) ==============

router.post('/list', async (req, res) => {
  try {
    const { category = 'sensory-hearing', pages = 5, language = 'en' } = req.body;

    const products = await scrapeCategoryListing(category, pages, language);

    res.json({
      success: true,
      data: {
        count: products.length,
        products,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== SCRAPE ALL CATEGORIES ==============

router.post('/scrape-all', async (req, res) => {
  try {
    const { pages = 5, language = 'en', ingest = true } = req.body;

    const jobId = `mada_all_${Date.now()}`;
    console.log(`\n🔌 API: Scrape ALL — jobId=${jobId}`);

    (async () => {
      for (const cat of MADA_CATEGORIES) {
        try {
          console.log(`\n${'='.repeat(60)}\n Category: ${cat.slug}\n${'='.repeat(60)}`);
          await runMadaScraper({
            categorySlug: cat.slug,
            maxPages: pages,
            language,
            ingest,
          });
        } catch (err: any) {
          console.error(`❌ ${cat.slug} failed: ${err.message}`);
        }
      }
      console.log(`\n🎉 Job ${jobId} completed all categories`);
    })();

    res.json({
      success: true,
      jobId,
      message: `Started scraping ${MADA_CATEGORIES.length} categories in background`,
      data: {
        categories: MADA_CATEGORIES.map(c => c.slug),
        pages,
        language,
        ingest,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
