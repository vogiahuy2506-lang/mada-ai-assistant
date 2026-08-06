/**
 * Stripe Payment Routes - Full Implementation
 */

// @ts-nocheck
import express from 'express';
import { 
  PLANS, 
  createCheckoutSession, 
  createBillingPortalSession,
  cancelSubscription,
  resumeSubscription,
  getSubscription,
  getUsage,
  checkQuota,
  recordUsage,
  formatPrice,
  getOrCreateCustomer,
  stripe,
  getPlanById,
} from '../lib/payments/stripe';

const router = express.Router();

// ============== GET PLANS ==============

router.get('/plans', (_req, res) => {
  const plans = PLANS.map(plan => ({
    ...plan,
    priceDisplay: formatPrice(plan.price),
    isFree: plan.price === 0,
    hasStripe: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_placeholder'),
  }));
  res.json({ success: true, data: plans });
});

// ============== CREATE CHECKOUT SESSION ==============

router.post('/checkout', async (req, res) => {
  try {
    const { planId, userId, userEmail, userName } = req.body;

    if (!planId || planId === 'free') {
      return res.status(400).json({ success: false, error: 'Invalid plan' });
    }

    const plan = PLANS.find(p => p.id === planId);
    if (!plan) {
      return res.status(400).json({ success: false, error: 'Plan not found' });
    }

    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
      return res.status(400).json({ 
        success: false, 
        error: 'Stripe not configured. Please add STRIPE_SECRET_KEY to .env file.',
        setup: {
          step1: 'Create Stripe account at https://dashboard.stripe.com/',
          step2: 'Get API keys from Developers → API keys',
          step3: 'Create Products and Prices in Stripe Dashboard',
          step4: 'Add STRIPE_SECRET_KEY=sk_live_xxx to .env',
          step5: 'Add STRIPE_PRICE_PRO=price_xxx to .env',
          step6: 'Add STRIPE_PRICE_ENTERPRISE=price_xxx to .env',
        }
      });
    }

    if (!plan.stripePriceId) {
      return res.status(400).json({ 
        success: false, 
        error: `Plan ${plan.name} is not configured for payments. Please set STRIPE_PRICE_${plan.id.toUpperCase()} in .env`
      });
    }

    // Get or create Stripe customer
    const customer = await getOrCreateCustomer(userId, userEmail, userName);

    // Create checkout session
    const session = await createCheckoutSession(
      customer.id,
      plan.stripePriceId,
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/success`,
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/cancel`,
      userId
    );

    res.json({ 
      success: true, 
      data: { 
        sessionId: session.id,
        url: session.url,
      } 
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== CREATE PORTAL SESSION ==============

router.post('/portal', async (req, res) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ success: false, error: 'Customer ID required' });
    }

    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
      return res.status(400).json({ success: false, error: 'Stripe not configured' });
    }

    const session = await createBillingPortalSession(
      customerId,
      process.env.FRONTEND_URL || 'http://localhost:5173'
    );

    res.json({ success: true, data: { url: session.url } });
  } catch (error) {
    console.error('Portal error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== CANCEL SUBSCRIPTION ==============

router.post('/cancel', async (req, res) => {
  try {
    const { subscriptionId, atPeriodEnd = true } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ success: false, error: 'Subscription ID required' });
    }

    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
      return res.status(400).json({ success: false, error: 'Stripe not configured' });
    }

    const subscription = await cancelSubscription(subscriptionId, atPeriodEnd);
    
    res.json({ 
      success: true, 
      data: { 
        subscriptionId: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      } 
    });
  } catch (error) {
    console.error('Cancel error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== RESUME SUBSCRIPTION ==============

router.post('/resume', async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ success: false, error: 'Subscription ID required' });
    }

    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
      return res.status(400).json({ success: false, error: 'Stripe not configured' });
    }

    const subscription = await resumeSubscription(subscriptionId);
    
    res.json({ 
      success: true, 
      data: { 
        subscriptionId: subscription.id,
        status: subscription.status,
      } 
    });
  } catch (error) {
    console.error('Resume error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== GET SUBSCRIPTION STATUS ==============

router.get('/subscription/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
      return res.json({ 
        success: true, 
        data: { 
          subscribed: false,
          plan: 'free',
          stripeConfigured: false,
          plans: PLANS,
        } 
      });
    }

    // Get customer ID
    const { getStripeCustomerIdByUserId } = require('../lib/payments/stripe');
    const customerId = getStripeCustomerIdByUserId(userId);
    
    if (!customerId) {
      return res.json({ 
        success: true, 
        data: { 
          subscribed: false,
          plan: 'free',
          stripeConfigured: true,
          plans: PLANS,
        } 
      });
    }

    // Get subscriptions for customer
    try {
      const subscriptions = await stripe.subscriptions.list({ 
        customer: customerId,
        limit: 1,
        status: 'active',
      });

      if (subscriptions.data.length === 0) {
        return res.json({ 
          success: true, 
          data: { 
            subscribed: false,
            plan: 'free',
            stripeConfigured: true,
            plans: PLANS,
          } 
        });
      }

      const sub = subscriptions.data[0];
      const priceId = sub.items.data[0]?.price.id;
      const plan = PLANS.find(p => p.stripePriceId === priceId);

      res.json({
        success: true,
        data: {
          subscribed: ['active', 'trialing'].includes(sub.status),
          subscriptionId: sub.id,
          customerId: customerId,
          planId: plan?.id || 'unknown',
          plan: plan || getPlanById('free'),
          status: sub.status,
          currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          stripeConfigured: true,
          plans: PLANS,
        }
      });
    } catch (stripeError) {
      console.error('Stripe error:', stripeError);
      return res.json({ 
        success: true, 
        data: { 
          subscribed: false,
          plan: 'free',
          stripeConfigured: true,
          plans: PLANS,
          error: stripeError.message,
        } 
      });
    }
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== GET USAGE ==============

router.get('/usage/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const usage = await getUsage(userId);
    
    res.json({ 
      success: true, 
      data: {
        ...usage,
        isUnlimited: {
          queries: usage.limits.queries === -1,
          documents: usage.limits.documents === -1,
          apiCalls: usage.limits.apiCalls === -1,
        },
        usagePercent: {
          queries: usage.limits.queries === -1 ? 0 : Math.min(100, (usage.queriesThisMonth / usage.limits.queries) * 100),
          documents: usage.limits.documents === -1 ? 0 : Math.min(100, (usage.documentsThisMonth / usage.limits.documents) * 100),
          apiCalls: usage.limits.apiCalls === -1 ? 0 : Math.min(100, (usage.apiCallsThisMonth / usage.limits.apiCalls) * 100),
        }
      } 
    });
  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== CHECK QUOTA ==============

router.get('/quota/:userId/:type', async (req, res) => {
  try {
    const { userId, type } = req.params;

    if (!['query', 'document', 'api_call'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid type' });
    }

    const quota = await checkQuota(userId, type);
    
    res.json({ success: true, data: quota });
  } catch (error) {
    console.error('Check quota error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== RECORD USAGE ==============

router.post('/usage', async (req, res) => {
  try {
    const { userId, type } = req.body;

    if (!userId || !type) {
      return res.status(400).json({ success: false, error: 'User ID and type required' });
    }

    // Check quota first
    const quota = await checkQuota(userId, type);
    
    if (!quota.allowed) {
      return res.json({
        success: false,
        error: 'Quota exceeded',
        data: quota,
        upgradeUrl: '/pricing',
      });
    }

    // Record usage
    await recordUsage(userId, type);
    
    res.json({ 
      success: true, 
      data: {
        ...quota,
        current: quota.current + 1
      }
    });
  } catch (error) {
    console.error('Record usage error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== WEBHOOK ==============

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('⚠️ Stripe webhook secret not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle the event
  await handleWebhook(event);

  res.json({ received: true });
});

export default router;
