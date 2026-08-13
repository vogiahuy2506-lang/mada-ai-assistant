/**
 * Auto Scraper API Routes
 */

// @ts-nocheck
import express from 'express';
import { dataIngestion } from '../lib/rag/dataIngestion';

const router = express.Router();

// In-memory sources store (in production, use database)
let sources = [
  { id: '1', url: 'https://www.who.int/health-topics/disability-and-health', name: 'WHO - Disability & Health', type: 'web', frequency: 'weekly', status: 'active', lastRun: null, documentsAdded: 0 },
  { id: '2', url: 'https://www.w3.org/WAI/standards-guidelines/wcag/', name: 'W3C WCAG Guidelines', type: 'web', frequency: 'weekly', status: 'active', lastRun: null, documentsAdded: 0 },
  { id: '3', url: 'https://www.accessibilityguides.org/', name: 'Accessibility Guides', type: 'web', frequency: 'weekly', status: 'active', lastRun: null, documentsAdded: 0 },
  { id: '4', url: 'https://www.cdc.gov/ncbddd/disabilityandhealth/index.html', name: 'CDC - Disability & Health', type: 'web', frequency: 'weekly', status: 'active', lastRun: null, documentsAdded: 0 },
];

// ============== LIST SCHEDULED SOURCES ==============

router.get('/sources', (_req, res) => {
  res.json({ success: true, data: sources });
});

// ============== ADD SCHEDULED SOURCE ==============

router.post('/sources', async (req, res) => {
  try {
    const { url, name, type = 'web', frequency = 'daily' } = req.body;

    if (!url || !name) {
      return res.status(400).json({ success: false, error: 'URL and name are required' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid URL format' });
    }

    const id = `source_${Date.now()}`;
    const newSource = {
      id,
      url,
      name,
      type,
      frequency,
      status: 'active',
      lastRun: null,
      documentsAdded: 0,
    };

    sources.push(newSource);

    res.json({ 
      success: true, 
      data: newSource,
      message: `Added source: ${name}` 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== UPDATE SCHEDULED SOURCE ==============

router.patch('/sources/:id', (req, res) => {
  try {
    const { id } = req.params;
    const source = sources.find(s => s.id === id);

    if (!source) {
      return res.status(404).json({ success: false, error: 'Source not found' });
    }

    const { name, frequency, status, url } = req.body;
    
    if (name !== undefined) source.name = name;
    if (frequency !== undefined) source.frequency = frequency;
    if (status !== undefined) source.status = status;
    if (url !== undefined) source.url = url;

    res.json({ success: true, data: source });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== DELETE SCHEDULED SOURCE ==============

router.delete('/sources/:id', (req, res) => {
  try {
    const { id } = req.params;
    const index = sources.findIndex(s => s.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Source not found' });
    }

    sources.splice(index, 1);

    res.json({ success: true, message: 'Source deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== TRIGGER SINGLE SCRAPE ==============

router.post('/sources/:id/run', async (req, res) => {
  try {
    const { id } = req.params;
    const source = sources.find(s => s.id === id);

    if (!source) {
      return res.status(404).json({ success: false, error: 'Source not found' });
    }

    console.log(`\n🔄 Triggering scrape for: ${source.name}`);
    console.log(`   URL: ${source.url}`);

    // Run actual scrape using dataIngestion
    const { dataIngestion } = await import('../rag/dataIngestion');
    
    const result = await dataIngestion.ingestData({
      type: 'web',
      content: '',
      source: source.url,
      title: source.name,
    });

    // Update source stats
    source.lastRun = new Date().toISOString();
    if (result.success) {
      source.status = 'active';
      source.documentsAdded = (source.documentsAdded || 0) + result.documentsAdded;
      console.log(`✅ Scrape completed: ${result.documentsAdded} documents added`);
    } else {
      source.status = 'error';
      console.log(`❌ Scrape failed: ${result.message}`);
    }

    res.json({ 
      success: result.success,
      message: result.success 
        ? `Scrape completed: ${result.documentsAdded} documents added`
        : `Scrape failed: ${result.message}`,
      data: {
        sourceId: id,
        status: source.status,
        documentsAdded: result.documentsAdded,
        category: result.category,
        lastRun: source.lastRun,
      }
    });
  } catch (err) {
    console.error(`❌ Scrape error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== TRIGGER ALL SCRAPES ==============

router.post('/run-all', async (req, res) => {
  try {
    console.log('\n🚀 Triggering scrape for all sources...');

    // Run in background
    (async () => {
      let successCount = 0;
      let failCount = 0;
      let totalDocs = 0;

      for (const source of sources) {
        if (source.status !== 'active') continue;

        console.log(`\n🔄 Scraping: ${source.name}`);
        
        try {
          const result = await dataIngestion.ingestData({
            type: 'web',
            content: '',
            source: source.url,
            title: source.name,
          });

          source.lastRun = new Date().toISOString();
          
          if (result.success) {
            successCount++;
            source.documentsAdded = (source.documentsAdded || 0) + result.documentsAdded;
            totalDocs += result.documentsAdded;
            console.log(`✅ Success: ${result.documentsAdded} docs`);
          } else {
            failCount++;
            console.log(`❌ Failed: ${result.message}`);
          }
        } catch (err) {
          failCount++;
          console.log(`❌ Error: ${err.message}`);
        }

        // Delay between scrapes
        await new Promise(r => setTimeout(r, 2000));
      }

      console.log('\n📊 Scrape Summary:');
      console.log(`   ✅ Success: ${successCount}/${sources.filter(s => s.status === 'active').length}`);
      console.log(`   ❌ Failed: ${failCount}`);
      console.log(`   📄 Total docs: ${totalDocs}`);
    })();

    res.json({ 
      success: true, 
      message: `Started scraping ${sources.length} sources (running in background)`,
      data: {
        totalSources: sources.length,
        activeSources: sources.filter(s => s.status === 'active').length,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============== SCHEDULER STATUS ==============

router.get('/status', (_req, res) => {
  const stats = {
    totalJobs: sources.length,
    activeJobs: sources.filter(s => s.status === 'active').length,
    errorJobs: sources.filter(s => s.status === 'error').length,
    pausedJobs: sources.filter(s => s.status === 'paused').length,
    totalDocuments: sources.reduce((sum, s) => sum + (s.documentsAdded || 0), 0),
  };

  res.json({ success: true, data: stats });
});

// ============== SCRAPER LOGS ==============

router.get('/logs', async (req, res) => {
  try {
    const { dataIngestion } = await import('../rag/dataIngestion');
    const logs = await dataIngestion.getIngestionLogs(50);
    
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
