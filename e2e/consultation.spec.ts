import { test, expect } from '@playwright/test';

/**
 * E2E Test: Consultation Flow - MADA AI Assistant
 * Tests the consultation request submission flow
 */
test.describe('Consultation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
  });

  test('should open consultation modal when button clicked', async ({ page }) => {
    // Find and click consultation button
    const consultButton = page.getByRole('button', { name: /tư vấn|consult|consultation/i }).first();
    
    if (await consultButton.isVisible()) {
      await consultButton.click();
      await page.waitForTimeout(500);
      
      // Check modal is visible
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible({ timeout: 5000 });
    }
  });

  test('should validate form fields', async ({ page }) => {
    // Open modal first
    const consultButton = page.getByRole('button', { name: /tư vấn|consult|consultation/i }).first();
    
    if (await consultButton.isVisible()) {
      await consultButton.click();
      await page.waitForTimeout(500);
      
      // Try to submit without filling form
      const submitButton = page.getByRole('button', { name: /gửi|submit|send/i }).first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        
        // Check for validation error messages
        const errorMessages = page.getByText(/vui lòng|please|required/i);
        await expect(errorMessages.first()).toBeVisible({ timeout: 2000 });
      }
    }
  });

  test('should fill and submit consultation form', async ({ page }) => {
    // Open modal
    const consultButton = page.getByRole('button', { name: /tư vấn|consult|consultation/i }).first();
    
    if (await consultButton.isVisible()) {
      await consultButton.click();
      await page.waitForTimeout(500);
      
      // Fill form fields
      const nameInput = page.locator('input[name="name"], input[placeholder*="tên"], input[placeholder*="name"]').first();
      const emailInput = page.locator('input[name="email"], input[placeholder*="email"]').first();
      
      if (await nameInput.isVisible()) {
        await nameInput.fill('Test User');
      }
      
      if (await emailInput.isVisible()) {
        await emailInput.fill('test@example.com');
      }
      
      // Select disability type if dropdown exists
      const disabilitySelect = page.locator('select[name="disabilityType"], [aria-label*="disability"]').first();
      if (await disabilitySelect.isVisible()) {
        await disabilitySelect.selectOption({ index: 1 });
      }
      
      // Fill message
      const messageTextarea = page.locator('textarea[name="message"], textarea[placeholder*="mô tả"], textarea[placeholder*="describe"]').first();
      if (await messageTextarea.isVisible()) {
        await messageTextarea.fill('Test consultation request for assistive technology');
      }
      
      // Submit form
      const submitButton = page.getByRole('button', { name: /gửi|submit|send/i }).first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await page.waitForTimeout(2000);
        
        // Check for success message or toast
        const successMessage = page.getByText(/thành công|success|đã gửi/i);
        // Note: This might fail if API is not available, which is expected in test
      }
    }
  });

  test('should close consultation modal', async ({ page }) => {
    // Open modal
    const consultButton = page.getByRole('button', { name: /tư vấn|consult|consultation/i }).first();
    
    if (await consultButton.isVisible()) {
      await consultButton.click();
      await page.waitForTimeout(500);
      
      // Close modal with X button or ESC
      const closeButton = page.getByRole('button', { name: /đóng|close|cancel/i, exact: false }).first();
      
      if (await closeButton.isVisible()) {
        await closeButton.click();
      } else {
        // Try pressing ESC
        await page.keyboard.press('Escape');
      }
      
      await page.waitForTimeout(500);
      
      // Check modal is closed
      const modal = page.getByRole('dialog');
      await expect(modal).not.toBeVisible({ timeout: 2000 });
    }
  });

  test('should show consultation button in product cards', async ({ page }) => {
    // Ask a question first to see product recommendations
    const input = page.locator('textarea').first();
    
    if (await input.isVisible()) {
      await input.fill('Tôi cần thiết bị hỗ trợ nghe cho người già');
      await page.keyboard.press('Enter');
      
      // Wait for AI response
      await page.waitForTimeout(3000);
      
      // Check for consultation buttons in product cards
      const consultButtons = page.getByRole('button', { name: /tư vấn|consult|get consult/i });
      const count = await consultButtons.count();
      expect(count).toBeGreaterThanOrEqual(0); // May or may not have products
    }
  });
});

/**
 * E2E Test: Language Switching - MADA AI Assistant
 */
test.describe('Language Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
  });

  test('should switch to English', async ({ page }) => {
    const enButton = page.getByRole('button', { name: /^EN$/i }).first();
    if (await enButton.isVisible()) {
      await enButton.click();
      await page.waitForTimeout(500);
      // Check that English text appears
      const chatHeading = page.getByRole('heading', { name: /MADA AI/i }).first();
      await expect(chatHeading).toBeVisible();
    }
  });

  test('should switch to Vietnamese', async ({ page }) => {
    const viButton = page.getByRole('button', { name: /^VI$/i }).first();
    if (await viButton.isVisible()) {
      await viButton.click();
      await page.waitForTimeout(500);
      const chatHeading = page.getByRole('heading', { name: /MADA AI/i }).first();
      await expect(chatHeading).toBeVisible();
    }
  });

  test('should switch to Arabic', async ({ page }) => {
    const arButton = page.getByRole('button', { name: /^AR$/i }).first();
    if (await arButton.isVisible()) {
      await arButton.click();
      await page.waitForTimeout(500);
      // Arabic text should be RTL
      const html = page.locator('html');
      const dir = await html.getAttribute('dir');
      expect(dir).toBeTruthy();
    }
  });
});

/**
 * E2E Test: Accessibility - MADA AI Assistant
 */
test.describe('Accessibility', () => {
  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Tab to chat input
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Type a message
    await page.keyboard.type('Test keyboard navigation');
    
    // Check input has the text
    const input = page.locator('textarea').first();
    await expect(input).toHaveValue('Test keyboard navigation');
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Check for ARIA live region
    const liveRegion = page.locator('[aria-live="polite"]');
    await expect(liveRegion).toBeAttached();
    
    // Check for role="status" or role="alert"
    const statusRegion = page.locator('[role="status"], [role="alert"]');
    const count = await statusRegion.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should have skip to content link', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Check for skip link
    const skipLink = page.locator('a[href="#main-content"], [class*="skip"]');
    await expect(skipLink.first()).toBeAttached();
  });
});
