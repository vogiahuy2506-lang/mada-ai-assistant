// Guardrail Tests

import { describe, it, expect } from 'vitest';
import { MedicalGuardrail } from '../src/guardrails/medical-guardrail.js';
import { ScopeGuardrail } from '../src/guardrails/scope-guardrail.js';
import { ContentGuardrail } from '../src/guardrails/content-guardrail.js';
import { GuardrailsOrchestrator } from '../src/guardrails/index.js';

describe('MedicalGuardrail', () => {
  const guardrail = new MedicalGuardrail();

  it('should BLOCK medical diagnosis requests', async () => {
    const result = await guardrail.check('Tôi bị tiểu đường, chẩn đoán giúp tôi');
    expect(result.passed).toBe(false);
    expect(result.action).toBe('BLOCK');
    expect(result.triggeredRule).toBe('MEDICAL_DIAGNOSIS');
  });

  it('should BLOCK English diagnosis requests', async () => {
    const result = await guardrail.check('I have diabetes, diagnose me');
    expect(result.passed).toBe(false);
    expect(result.action).toBe('BLOCK');
  });

  it('should REDIRECT treatment requests', async () => {
    const result = await guardrail.check('Tôi nên uống thuốc gì cho bệnh này?');
    expect(result.passed).toBe(false);
    expect(result.action).toBe('REDIRECT');
  });

  it('should REDIRECT symptom queries', async () => {
    const result = await guardrail.check('Triệu chứng của bệnh ung thư là gì?');
    expect(result.passed).toBe(false);
    expect(result.action).toBe('REDIRECT');
  });

  it('should ALLOW AT-related requests', async () => {
    const result = await guardrail.check('Thiết bị nào cho người khiếm thị?');
    expect(result.passed).toBe(true);
    expect(result.action).toBe('ALLOW');
  });

  it('should return correct blocked response in Vietnamese', () => {
    const response = guardrail.getBlockedResponse('vi');
    expect(response).toContain('Mada AT Assistant');
    expect(response).toContain('bác sĩ');
  });

  it('should return correct blocked response in English', () => {
    const response = guardrail.getBlockedResponse('en');
    expect(response).toContain('Mada AT Assistant');
    expect(response).toContain('medical professional');
  });
});

describe('ScopeGuardrail', () => {
  const guardrail = new ScopeGuardrail();

  it('should ALLOW AT-related keywords', async () => {
    const result = await guardrail.check('OrCam MyEye có giá bao nhiêu?');
    expect(result.passed).toBe(true);
    expect(result.action).toBe('ALLOW');
  });

  it('should REDIRECT legal advice requests', async () => {
    const result = await guardrail.check('Tôi cần tư vấn pháp lý về quyền nuôi con');
    expect(result.passed).toBe(false);
    expect(result.action).toBe('REDIRECT');
    expect(result.customResponse).toContain('pháp lý');
  });

  it('should REDIRECT financial advice requests', async () => {
    const result = await guardrail.check('Tôi nên đầu tư vào đâu?');
    expect(result.passed).toBe(false);
    expect(result.action).toBe('REDIRECT');
  });

  it('should return all AT categories', () => {
    const categories = guardrail.getScopeCategories();
    expect(categories).toContain('vision');
    expect(categories).toContain('hearing');
    expect(categories).toContain('mobility');
  });
});

describe('ContentGuardrail', () => {
  const guardrail = new ContentGuardrail();

  it('should ALLOW normal text', async () => {
    const result = await guardrail.check('Tôi cần thiết bị hỗ trợ khiếm thị');
    expect(result.passed).toBe(true);
    expect(result.action).toBe('ALLOW');
  });

  it('should ALLOW but warn on PII', async () => {
    const result = await guardrail.check('Liên hệ tôi: email@example.com');
    expect(result.passed).toBe(true);
    expect(result.triggeredRule).toBe('PII_DETECTED');
  });

  it('should BLOCK self-harm content', async () => {
    const result = await guardrail.check('Tôi muốn tự tử');
    expect(result.passed).toBe(false);
    expect(result.action).toBe('BLOCK');
  });

  it('should mask PII in text', () => {
    const masked = guardrail.maskPII('Email: test@example.com, Phone: 0912345678');
    expect(masked).toContain('[EMAIL]');
    expect(masked).toContain('[PHONE]');
    expect(masked).not.toContain('test@example.com');
  });
});

describe('GuardrailsOrchestrator', () => {
  const orchestrator = new GuardrailsOrchestrator();

  it('should pass all checks for valid AT request', async () => {
    const result = await orchestrator.check('Tìm thiết bị đọc sách cho người mù');
    expect(result.passed).toBe(true);
    expect(result.action).toBe('ALLOW');
  });

  it('should fail on medical diagnosis', async () => {
    const result = await orchestrator.check('Chẩn đoán cho tôi xem tôi bị bệnh gì');
    expect(result.passed).toBe(false);
    expect(result.action).toBe('BLOCK');
  });

  it('should mask sensitive data', () => {
    const masked = orchestrator.maskSensitiveData('Contact: john@example.com');
    expect(masked).toContain('[EMAIL]');
  });
});
