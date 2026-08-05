// Guardrails Orchestrator - Combines all guardrails

import { GuardrailResult } from '../models/session.model.js';
import { MedicalGuardrail } from './medical-guardrail.js';
import { ScopeGuardrail } from './scope-guardrail.js';
import { ContentGuardrail } from './content-guardrail.js';
import { createLogger } from '../utils/logger.js';
import { guardrailTriggers } from '../utils/metrics.js';

const logger = createLogger('Guardrails');

export interface GuardrailConfig {
  enableMedical: boolean;
  enableScope: boolean;
  enableContent: boolean;
}

export class GuardrailsOrchestrator {
  private medicalGuardrail: MedicalGuardrail;
  private scopeGuardrail: ScopeGuardrail;
  private contentGuardrail: ContentGuardrail;
  private config: GuardrailConfig;

  constructor(config?: Partial<GuardrailConfig>) {
    this.medicalGuardrail = new MedicalGuardrail();
    this.scopeGuardrail = new ScopeGuardrail();
    this.contentGuardrail = new ContentGuardrail();
    this.config = {
      enableMedical: config?.enableMedical ?? true,
      enableScope: config?.enableScope ?? true,
      enableContent: config?.enableContent ?? true,
    };
  }

  async check(input: string, language: string = 'vi'): Promise<GuardrailResult> {
    const startTime = Date.now();

    logger.debug('Starting guardrail checks', { inputLength: input.length });

    // Step 1: Content moderation (fastest check)
    if (this.config.enableContent) {
      const contentResult = await this.contentGuardrail.check(input);

      if (!contentResult.passed) {
        guardrailTriggers.inc({ type: 'content', action: contentResult.action });
        return this.finalizeResult(contentResult, startTime);
      }
    }

    // Step 2: Medical guardrail (most important)
    if (this.config.enableMedical) {
      const medicalResult = await this.medicalGuardrail.check(input);

      if (!medicalResult.passed) {
        guardrailTriggers.inc({ type: 'medical', action: medicalResult.action });

        // If blocked, add the standard response
        if (medicalResult.action === 'BLOCK') {
          medicalResult.customResponse = this.medicalGuardrail.getBlockedResponse(language);
        }

        return this.finalizeResult(medicalResult, startTime);
      }
    }

    // Step 3: Scope guardrail
    if (this.config.enableScope) {
      const scopeResult = await this.scopeGuardrail.check(input);

      if (!scopeResult.passed) {
        guardrailTriggers.inc({ type: 'scope', action: scopeResult.action });
        return this.finalizeResult(scopeResult, startTime);
      }
    }

    const result: GuardrailResult = {
      passed: true,
      action: 'ALLOW',
      reason: 'All guardrail checks passed',
    };

    return this.finalizeResult(result, startTime);
  }

  private finalizeResult(result: GuardrailResult, startTime: number): GuardrailResult {
    const duration = Date.now() - startTime;
    logger.debug('Guardrail check completed', {
      passed: result.passed,
      action: result.action,
      durationMs: duration,
    });
    return result;
  }

  // Utility methods
  maskSensitiveData(text: string): string {
    return this.contentGuardrail.maskPII(text);
  }

  getAvailableCategories() {
    return this.scopeGuardrail.getScopeCategories();
  }
}
