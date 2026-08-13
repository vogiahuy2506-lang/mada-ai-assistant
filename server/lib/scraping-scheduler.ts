/**
 * MADA AI - Scraping Scheduler
 * 
 * Cấu hình cron job cho automatic scraping từ:
 * - at.mada.org.qa
 * - WHO GATE
 * - Các nguồn AT khác
 */

import cron from 'node-cron';
import { logActivity } from '../index';

interface ScrapingJob {
  id: string;
  name: string;
  url: string;
  category: string;
  enabled: boolean;
  schedule: string; // cron expression
  lastRun?: string;
  lastStatus?: 'success' | 'failed';
  lastError?: string;
}

interface SchedulerConfig {
  jobs: ScrapingJob[];
  isRunning: boolean;
}

// Default scraping sources
const DEFAULT_SOURCES: ScrapingJob[] = [
  {
    id: 'mada-main',
    name: 'MADA Main Website',
    url: 'https://at.mada.org.qa',
    category: 'vision,hearing,mobility,cognition',
    enabled: true,
    schedule: '0 2 * * *', // 2:00 AM daily
  },
  {
    id: 'who-gate',
    name: 'WHO GATE Programme',
    url: 'https://www.who.int/health-topics/assistive-technology',
    category: 'general',
    enabled: true,
    schedule: '0 3 * * 0', // 3:00 AM every Sunday
  },
  {
    id: 'iso-at',
    name: 'ISO Assistive Products',
    url: 'https://www.iso.org/standard/76953.html',
    category: 'standards',
    enabled: true,
    schedule: '0 4 1 * *', // 4:00 AM first day of month
  },
  {
    id: 'wcag-docs',
    name: 'WCAG Documentation',
    url: 'https://www.w3.org/WAI/WCAG21/quickref/',
    category: 'standards',
    enabled: true,
    schedule: '0 5 * * *', // 5:00 AM daily
  },
];

// In-memory scheduler state
let schedulerConfig: SchedulerConfig = {
  jobs: [...DEFAULT_SOURCES],
  isRunning: false,
};

const activeJobs: Map<string, cron.ScheduledTask> = new Map();

// ============== SCRAPING FUNCTIONS ==============

async function runScrapingJob(job: ScrapingJob): Promise<void> {
  const startTime = Date.now();
  logActivity('info', `Starting scraping job: ${job.name}`, 'ScraperScheduler');

  try {
    // Simulate scraping (replace with actual scraper logic)
    const response = await fetch(job.url, {
      headers: {
        'User-Agent': 'MADA-AI-Scraper/1.0 (+https://mada.ai)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const itemsFound = (html.match(/<a/gi) || []).length; // Count links as proxy for content

    const duration = Date.now() - startTime;
    
    // Update job status
    job.lastRun = new Date().toISOString();
    job.lastStatus = 'success';
    job.lastError = undefined;

    logActivity('success', 
      `Scraping job ${job.name} completed: ${itemsFound} items found in ${duration}ms`, 
      'ScraperScheduler'
    );

    // Trigger knowledge base update if scraping was successful
    await triggerKnowledgeBaseUpdate(job);
  } catch (error) {
    job.lastRun = new Date().toISOString();
    job.lastStatus = 'failed';
    job.lastError = error instanceof Error ? error.message : String(error);

    logActivity('error', 
      `Scraping job ${job.name} failed: ${error}`, 
      'ScraperScheduler'
    );
  }
}

async function triggerKnowledgeBaseUpdate(job: ScrapingJob): Promise<void> {
  try {
    // Call the data ingestion endpoint
    const response = await fetch(`http://localhost:${process.env.PORT || 3001}/api/data/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: job.url,
        type: 'web',
        title: `Scraped: ${job.name}`,
      }),
    });

    if (!response.ok) {
      logActivity('warn', `Failed to trigger KB update for ${job.name}`, 'ScraperScheduler');
    }
  } catch (error) {
    logActivity('warn', `Could not trigger KB update: ${error}`, 'ScraperScheduler');
  }
}

// ============== SCHEDULER FUNCTIONS ==============

/**
 * Start the scraping scheduler
 */
export function startScheduler(): void {
  if (schedulerConfig.isRunning) {
    logActivity('warn', 'Scraper scheduler is already running', 'ScraperScheduler');
    return;
  }

  schedulerConfig.isRunning = true;
  logActivity('info', 'Starting scraper scheduler...', 'ScraperScheduler');

  for (const job of schedulerConfig.jobs) {
    if (job.enabled) {
      scheduleJob(job);
    }
  }

  logActivity('success', `Scraper scheduler started with ${activeJobs.size} active jobs`, 'ScraperScheduler');
}

/**
 * Stop the scraping scheduler
 */
export function stopScheduler(): void {
  if (!schedulerConfig.isRunning) {
    logActivity('warn', 'Scraper scheduler is not running', 'ScraperScheduler');
    return;
  }

  // Cancel all active jobs
  for (const [jobId, task] of activeJobs) {
    task.stop();
    logActivity('info', `Stopped job: ${jobId}`, 'ScraperScheduler');
  }
  activeJobs.clear();
  schedulerConfig.isRunning = false;

  logActivity('info', 'Scraper scheduler stopped', 'ScraperScheduler');
}

/**
 * Schedule a single job
 */
function scheduleJob(job: ScrapingJob): void {
  if (activeJobs.has(job.id)) {
    // Job already scheduled
    return;
  }

  // Validate cron expression
  if (!cron.validate(job.schedule)) {
    logActivity('error', `Invalid cron expression for job ${job.id}: ${job.schedule}`, 'ScraperScheduler');
    return;
  }

  const task = cron.schedule(job.schedule, () => {
    runScrapingJob(job);
  }, {
    scheduled: true,
    timezone: process.env.TIMEZONE || 'Asia/Qatar',
  });

  activeJobs.set(job.id, task);
  logActivity('info', `Scheduled job ${job.id} with cron: ${job.schedule}`, 'ScraperScheduler');
}

/**
 * Add a new scraping job
 */
export function addScrapingJob(newJob: Omit<ScrapingJob, 'id'>): ScrapingJob {
  const job: ScrapingJob = {
    ...newJob,
    id: `job-${Date.now()}`,
  };

  schedulerConfig.jobs.push(job);

  if (job.enabled) {
    scheduleJob(job);
  }

  logActivity('success', `Added scraping job: ${job.name}`, 'ScraperScheduler');
  return job;
}

/**
 * Remove a scraping job
 */
export function removeScrapingJob(jobId: string): boolean {
  const index = schedulerConfig.jobs.findIndex(j => j.id === jobId);
  if (index === -1) {
    return false;
  }

  // Stop the task if running
  const task = activeJobs.get(jobId);
  if (task) {
    task.stop();
    activeJobs.delete(jobId);
  }

  schedulerConfig.jobs.splice(index, 1);
  logActivity('info', `Removed scraping job: ${jobId}`, 'ScraperScheduler');
  return true;
}

/**
 * Enable/disable a job
 */
export function toggleScrapingJob(jobId: string, enabled: boolean): boolean {
  const job = schedulerConfig.jobs.find(j => j.id === jobId);
  if (!job) {
    return false;
  }

  job.enabled = enabled;

  if (enabled) {
    scheduleJob(job);
  } else {
    const task = activeJobs.get(jobId);
    if (task) {
      task.stop();
      activeJobs.delete(jobId);
    }
  }

  logActivity('info', `Job ${job.name} ${enabled ? 'enabled' : 'disabled'}`, 'ScraperScheduler');
  return true;
}

/**
 * Run a job immediately (manual trigger)
 */
export async function runJobNow(jobId: string): Promise<void> {
  const job = schedulerConfig.jobs.find(j => j.id === jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  logActivity('info', `Manual trigger for job: ${job.name}`, 'ScraperScheduler');
  await runScrapingJob(job);
}

/**
 * Run all jobs immediately (manual trigger)
 */
export async function runAllJobsNow(): Promise<void> {
  logActivity('info', 'Manual trigger for all scraping jobs', 'ScraperScheduler');
  
  for (const job of schedulerConfig.jobs.filter(j => j.enabled)) {
    await runScrapingJob(job);
  }
}

/**
 * Get scheduler status and job list
 */
export function getSchedulerStatus(): {
  isRunning: boolean;
  jobs: ScrapingJob[];
  stats: {
    totalJobs: number;
    enabledJobs: number;
    activeJobs: number;
  };
} {
  return {
    isRunning: schedulerConfig.isRunning,
    jobs: schedulerConfig.jobs,
    stats: {
      totalJobs: schedulerConfig.jobs.length,
      enabledJobs: schedulerConfig.jobs.filter(j => j.enabled).length,
      activeJobs: activeJobs.size,
    },
  };
}

/**
 * Update job configuration
 */
export function updateScrapingJob(jobId: string, updates: Partial<ScrapingJob>): ScrapingJob | null {
  const job = schedulerConfig.jobs.find(j => j.id === jobId);
  if (!job) {
    return null;
  }

  const wasEnabled = job.enabled;
  
  // Apply updates
  Object.assign(job, updates);

  // Handle schedule change
  if (updates.schedule && updates.schedule !== job.schedule) {
    // Reschedule if job is enabled
    if (job.enabled) {
      const oldTask = activeJobs.get(job.id);
      if (oldTask) {
        oldTask.stop();
        activeJobs.delete(job.id);
      }
      scheduleJob(job);
    }
  } else if (updates.enabled !== undefined && updates.enabled !== wasEnabled) {
    // Toggle enabled state
    if (updates.enabled) {
      scheduleJob(job);
    } else {
      const task = activeJobs.get(job.id);
      if (task) {
        task.stop();
        activeJobs.delete(job.id);
      }
    }
  }

  return job;
}

/**
 * Run daily summary report
 */
export function scheduleDailySummary(): void {
  // Run at 8:00 AM every day
  cron.schedule('0 8 * * *', () => {
    const status = getSchedulerStatus();
    const failedJobs = status.jobs.filter(j => j.lastStatus === 'failed');
    
    if (failedJobs.length > 0) {
      logActivity('warn', 
        `Daily summary: ${failedJobs.length}/${status.jobs.length} jobs failed yesterday`, 
        'ScraperScheduler'
      );
    } else {
      logActivity('success', 
        `Daily summary: All ${status.jobs.length} scraping jobs completed successfully`, 
        'ScraperScheduler'
      );
    }
  }, {
    scheduled: true,
    timezone: process.env.TIMEZONE || 'Asia/Qatar',
  });
}
