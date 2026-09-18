/**
 * MADA AI - Scraping Scheduler Routes
 * 
 * API endpoints để quản lý scraping schedules
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../lib/auth';
import cron from 'node-cron';
import { 
  getSchedulerStatus, 
  addScrapingJob, 
  removeScrapingJob,
  toggleScrapingJob,
  updateScrapingJob,
  runJobNow,
  runAllJobsNow,
  startScheduler,
  stopScheduler,
} from '../lib/scraping-scheduler';

const router = Router();

// All routes require admin or data_manager role
// eslint-disable-next-line @typescript-eslint/no-explicit-any
router.use(authenticate as any, requireRole('admin', 'data_manager') as any);

// ============== GET /api/scraper/schedule =============

router.get('/schedule', (_req: Request, res: Response) => {
  try {
    const status = getSchedulerStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== POST /api/scraper/schedule/jobs =============

router.post('/schedule/jobs', (req: Request, res: Response) => {
  try {
    const { name, url, category, schedule, enabled = true } = req.body;
    
    if (!name || !url || !schedule) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu thông tin bắt buộc: name, url, schedule',
      });
    }
    
    // Validate cron expression
    if (!cron.validate(schedule)) {
      return res.status(400).json({
        success: false,
        error: 'Biểu thức cron không hợp lệ',
      });
    }
    
    const job = addScrapingJob({
      name,
      url,
      category: category || 'general',
      schedule,
      enabled,
    });
    
    res.json({
      success: true,
      message: 'Đã thêm job thành công',
      data: job,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== PUT /api/scraper/schedule/jobs/:jobId =============

router.put('/schedule/jobs/:jobId', (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const updates = req.body;
    
    // Validate cron if provided
    if (updates.schedule) {
      if (!cron.validate(updates.schedule)) {
        return res.status(400).json({
          success: false,
          error: 'Biểu thức cron không hợp lệ',
        });
      }
    }
    
    const job = updateScrapingJob(jobId, updates);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy job',
      });
    }
    
    res.json({
      success: true,
      message: 'Đã cập nhật job',
      data: job,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== DELETE /api/scraper/schedule/jobs/:jobId =============

router.delete('/schedule/jobs/:jobId', (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    const success = removeScrapingJob(jobId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy job',
      });
    }
    
    res.json({
      success: true,
      message: 'Đã xóa job',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== POST /api/scraper/schedule/jobs/:jobId/toggle =============

router.post('/schedule/jobs/:jobId/toggle', (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { enabled } = req.body;
    
    const success = toggleScrapingJob(jobId, enabled);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy job',
      });
    }
    
    res.json({
      success: true,
      message: `Job ${enabled ? 'đã bật' : 'đã tắt'}`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== POST /api/scraper/schedule/jobs/:jobId/run =============

router.post('/schedule/jobs/:jobId/run', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    // Run job asynchronously
    runJobNow(jobId).catch(err => {
      console.error('Job run error:', err);
    });
    
    res.json({
      success: true,
      message: 'Đang chạy job...',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== POST /api/scraper/schedule/run-all =============

router.post('/schedule/run-all', async (_req: Request, res: Response) => {
  try {
    // Run all jobs asynchronously
    runAllJobsNow().catch(err => {
      console.error('Run all jobs error:', err);
    });
    
    res.json({
      success: true,
      message: 'Đang chạy tất cả jobs...',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== POST /api/scraper/schedule/start =============

router.post('/schedule/start', (_req: Request, res: Response) => {
  try {
    startScheduler();
    
    res.json({
      success: true,
      message: 'Đã khởi động scheduler',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============== POST /api/scraper/schedule/stop =============

router.post('/schedule/stop', (_req: Request, res: Response) => {
  try {
    stopScheduler();
    
    res.json({
      success: true,
      message: 'Đã dừng scheduler',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
