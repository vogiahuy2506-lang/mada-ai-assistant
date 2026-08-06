/**
 * Auto Scraping Scheduler
 * 
 * Tự động scrape dữ liệu từ các nguồn đã cấu hình
 * Chạy định kỳ để cập nhật knowledge base
 * 
 * Usage:
 *   npx tsx server/lib/scraper/scheduler.ts start
 *   npx tsx server/lib/scraper/scheduler.ts run
 *   npx tsx server/lib/scraper/scheduler.ts status
 */

// @ts-nocheck
import cron from 'node-cron';

// ============== TYPES ==============

interface ScheduledSource {
  id: string;
  url: string;
  name: string;
  type: 'web' | 'api';
  frequency: 'hourly' | 'daily' | 'weekly';
  lastRun?: string;
  status: 'active' | 'paused' | 'error';
  lastError?: string;
  lastSuccess?: string;
  documentsAdded?: number;
}

interface SchedulerStats {
  totalJobs: number;
  activeJobs: number;
  sources: ScheduledSource[];
}

// ============== SCHEDULER CLASS ==============

class AutoScraperScheduler {
  private jobs: Map<string, any> = new Map();
  private sources: ScheduledSource[] = [];
  private isRunning = false;

  // Default sources
  private defaultSources: Omit<ScheduledSource, 'id'>[] = [
    { 
      url: 'https://www.who.int/health-topics/disability-and-health', 
      name: 'WHO - Disability & Health', 
      type: 'web', 
      frequency: 'weekly', 
      status: 'active' 
    },
    { 
      url: 'https://www.w3.org/WAI/standards-guidelines/wcag/', 
      name: 'W3C WCAG Guidelines', 
      type: 'web', 
      frequency: 'weekly', 
      status: 'active' 
    },
    { 
      url: 'https://www.accessibilityguides.org/', 
      name: 'Accessibility Guides', 
      type: 'web', 
      frequency: 'weekly', 
      status: 'active' 
    },
    { 
      url: 'https://www.cdc.gov/ncbddd/disabilityandhealth/index.html', 
      name: 'CDC - Disability & Health', 
      type: 'web', 
      frequency: 'weekly', 
      status: 'active' 
    },
  ];

  async initialize(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Scheduler already running');
      return;
    }

    console.log('🚀 Initializing Auto-Scraper Scheduler...');
    console.log('');
    
    // Load sources
    this.sources = this.defaultSources.map((s, i) => ({
      ...s,
      id: `source_${i + 1}`,
    }));

    console.log(`📋 Loaded ${this.sources.length} scheduled sources`);
    this.sources.forEach(s => {
      console.log(`   - ${s.name} (${s.frequency})`);
    });
    console.log('');

    this.isRunning = true;
    console.log('✅ Scheduler initialized');
  }

  private getCronExpression(frequency: string): string {
    switch (frequency) {
      case 'hourly': return '0 * * * *';
      case 'daily': return '0 2 * * *';
      case 'weekly': return '0 3 * * 0';
      default: return '0 2 * * *';
    }
  }

  async scheduleJob(source: ScheduledSource): Promise<void> {
    const cronExpr = this.getCronExpression(source.frequency);
    
    const task = cron.schedule(cronExpr, async () => {
      await this.runScrape(source);
    }, { scheduled: true });

    this.jobs.set(source.id, task);
    console.log(`📅 Scheduled: ${source.name} (${cronExpr})`);
  }

  async scheduleAllJobs(): Promise<void> {
    for (const source of this.sources) {
      if (source.status === 'active') {
        await this.scheduleJob(source);
      }
    }
  }

  async runScrape(source: ScheduledSource): Promise<void> {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🔄 [${source.name}] Starting scrape...`);
    console.log(`   URL: ${source.url}`);
    console.log('='.repeat(50));
    
    const startTime = Date.now();

    try {
      // Dynamic import to avoid circular dependency
      const { dataIngestion } = await import('../rag/dataIngestion');
      
      // Run actual scrape
      const result = await dataIngestion.ingestData({
        type: 'web',
        content: '',
        source: source.url,
        title: source.name,
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      if (result.success) {
        console.log(`\n✅ [${source.name}] Completed successfully!`);
        console.log(`   📊 Documents added: ${result.documentsAdded}`);
        console.log(`   🏷️ Category: ${result.category || 'unknown'}`);
        console.log(`   ⏱️ Duration: ${duration}s`);
        
        source.status = 'active';
        source.lastRun = new Date().toISOString();
        source.lastSuccess = new Date().toISOString();
        source.documentsAdded = (source.documentsAdded || 0) + result.documentsAdded;
        source.lastError = undefined;
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log(`\n❌ [${source.name}] Failed after ${duration}s`);
      console.log(`   Error: ${error.message}`);
      
      source.status = 'error';
      source.lastRun = new Date().toISOString();
      source.lastError = error.message;
    }
  }

  async triggerScrape(sourceId: string): Promise<void> {
    const source = this.sources.find(s => s.id === sourceId);
    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }
    await this.runScrape(source);
  }

  async triggerAllScrape(): Promise<void> {
    console.log(`\n${'='.repeat(60)}`);
    console.log('🚀 TRIGGERING SCRAPE FOR ALL SOURCES');
    console.log('='.repeat(60));
    
    let successCount = 0;
    let failCount = 0;

    for (const source of this.sources) {
      await this.runScrape(source);
      
      if (source.status === 'active') {
        successCount++;
      } else {
        failCount++;
      }
      
      // Delay between scrapes to avoid rate limiting
      console.log('\n⏳ Waiting 3 seconds before next scrape...\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('='.repeat(60));
    console.log('📊 SCRAPE SUMMARY');
    console.log('='.repeat(60));
    console.log(`   ✅ Success: ${successCount}/${this.sources.length}`);
    console.log(`   ❌ Failed: ${failCount}/${this.sources.length}`);
    console.log(`   📝 Total documents added: ${this.sources.reduce((sum, s) => sum + (s.documentsAdded || 0), 0)}`);
    console.log('='.repeat(60));
  }

  getStats(): SchedulerStats {
    return {
      totalJobs: this.sources.length,
      activeJobs: this.sources.filter(s => s.status === 'active').length,
      sources: this.sources,
    };
  }

  async shutdown(): Promise<void> {
    console.log('\n🛑 Stopping Auto-Scraper Scheduler...');
    this.jobs.forEach((task, id) => {
      task.stop();
      console.log(`   Stopped job: ${id}`);
    });
    this.jobs.clear();
    this.isRunning = false;
    console.log('✅ Scheduler stopped');
  }
}

// Singleton instance
const autoScraper = new AutoScraperScheduler();

// ============== CLI RUNNER ==============

const args = process.argv.slice(2);

async function main() {
  await autoScraper.initialize();

  if (args[0] === 'start') {
    await autoScraper.scheduleAllJobs();
    console.log('\n📡 Scheduler running. Press Ctrl+C to stop.\n');
    
    // Keep running
    await new Promise(() => {});
  } else if (args[0] === 'run') {
    await autoScraper.triggerAllScrape();
    await autoScraper.shutdown();
    process.exit(0);
  } else if (args[0] === 'status') {
    const stats = autoScraper.getStats();
    console.log('\n📊 Scheduler Status:');
    console.log(`   Total Sources: ${stats.totalJobs}`);
    console.log(`   Active Jobs: ${stats.activeJobs}`);
    console.log('\n📋 Sources:');
    stats.sources.forEach(s => {
      const statusIcon = s.status === 'active' ? '✅' : s.status === 'error' ? '❌' : '⏸️';
      console.log(`   ${statusIcon} ${s.name}`);
      console.log(`      Frequency: ${s.frequency}`);
      console.log(`      URL: ${s.url}`);
      if (s.lastRun) {
        console.log(`      Last run: ${new Date(s.lastRun).toLocaleString()}`);
      }
      if (s.documentsAdded) {
        console.log(`      Total docs: ${s.documentsAdded}`);
      }
      if (s.lastError) {
        console.log(`      ⚠️ Last error: ${s.lastError}`);
      }
      console.log('');
    });
    process.exit(0);
  } else if (args[0] === 'run-one') {
    const sourceId = args[1];
    if (!sourceId) {
      console.error('Usage: run-one <source-id>');
      process.exit(1);
    }
    await autoScraper.triggerScrape(sourceId);
    await autoScraper.shutdown();
    process.exit(0);
  } else {
    console.log('\n📖 Auto-Scraper Scheduler');
    console.log('');
    console.log('Usage:');
    console.log('   npx tsx server/lib/scraper/scheduler.ts start      # Start scheduler (runs continuously)');
    console.log('   npx tsx server/lib/scraper/scheduler.ts run       # Run all scrapes once');
    console.log('   npx tsx server/lib/scraper/scheduler.ts run-one <id>  # Run single scrape');
    console.log('   npx tsx server/lib/scraper/scheduler.ts status    # Show status');
    console.log('');
    console.log('Examples:');
    console.log('   npm run scraper:start   # Start scheduler');
    console.log('   npm run scraper:run    # Run once');
    console.log('   npm run scraper:status # Show status');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
