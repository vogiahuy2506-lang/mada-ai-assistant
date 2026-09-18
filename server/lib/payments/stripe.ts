/**
 * Stripe Paywall Integration - Full Implementation
 * 
 * Xử lý thanh toán và quản lý subscription
 * 
 * Hướng dẫn setup:
 * 1. Tạo tài khoản Stripe: https://dashboard.stripe.com/
 * 2. Lấy API keys từ Stripe Dashboard → Developers → API keys
 * 3. Setup Webhook cho Stripe (stripe listen hoặc webhook endpoint)
 * 4. Thêm vào .env:
 *    STRIPE_SECRET_KEY=sk_live_xxx
 *    STRIPE_WEBHOOK_SECRET=whsec_xxx
 *    STRIPE_PRICE_PRO=price_xxx
 *    STRIPE_PRICE_ENTERPRISE=price_xxx
 */

// @ts-nocheck
import Stripe from 'stripe';
import db from '../db';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2025-06-30',
});

// ============== DATABASE HELPERS ==============

// Simple in-memory store for subscriptions (extend with real DB)
const subscriptions = new Map();
const customers = new Map();

function getDb() {
  try {
    return db;
  } catch {
    return null;
  }
}

function saveSubscription(userId, subscriptionData) {
  const db = getDb();
  if (db) {
    try {
      db.prepare(`
        INSERT OR REPLACE INTO stripe_subscriptions 
        (id, user_id, stripe_customer_id, stripe_subscription_id, plan_id, status, 
         current_period_start, current_period_end, canceled_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        subscriptionData.id,
        userId,
        subscriptionData.stripeCustomerId,
        subscriptionData.stripeSubscriptionId,
        subscriptionData.planId,
        subscriptionData.status,
        subscriptionData.currentPeriodStart,
        subscriptionData.currentPeriodEnd,
        subscriptionData.canceledAt,
        new Date().toISOString(),
        new Date().toISOString()
      );
      return;
    } catch (e) {
      console.error('DB error:', e.message);
    }
  }
  // Fallback to in-memory
  subscriptions.set(userId, subscriptionData);
}

function getSubscriptionByUserId(userId) {
  const db = getDb();
  if (db) {
    try {
      return db.prepare('SELECT * FROM stripe_subscriptions WHERE user_id = ?').get(userId);
    } catch {}
  }
  return subscriptions.get(userId);
}

function getSubscriptionByStripeId(stripeSubscriptionId) {
  const db = getDb();
  if (db) {
    try {
      return db.prepare('SELECT * FROM stripe_subscriptions WHERE stripe_subscription_id = ?').get(stripeSubscriptionId);
    } catch {}
  }
  for (const [userId, sub] of subscriptions) {
    if (sub.stripeSubscriptionId === stripeSubscriptionId) return sub;
  }
  return null;
}

function updateUserPlan(userId, planId) {
  const db = getDb();
  if (db) {
    try {
      db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(planId, userId);
      return;
    } catch (e) {
      console.error('DB error:', e.message);
    }
  }
}

function saveCustomer(userId, stripeCustomerId, email, name) {
  const db = getDb();
  if (db) {
    try {
      db.prepare(`
        INSERT OR REPLACE INTO stripe_customers (id, user_id, stripe_customer_id, email, name, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        `cust_${userId}`,
        userId,
        stripeCustomerId,
        email,
        name,
        new Date().toISOString()
      );
      return;
    } catch (e) {
      console.error('DB error:', e.message);
    }
  }
  // Fallback to in-memory
  customers.set(userId, { stripeCustomerId, email, name });
}

export function getStripeCustomerIdByUserId(userId) {
  const db = getDb();
  if (db) {
    try {
      const row = db.prepare('SELECT stripe_customer_id FROM stripe_customers WHERE user_id = ?').get(userId);
      return row?.stripe_customer_id;
    } catch {}
  }
  return customers.get(userId)?.stripeCustomerId;
}

// ============== TYPES ==============

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  priceId: string;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    queries: number;
    documents: number;
    users: number;
    apiCalls: number;
  };
  stripePriceId: string;
}

// ============== PLANS ==============

export const PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Miễn phí',
    description: 'Dành cho người dùng mới, để trải nghiệm',
    price: 0,
    priceId: '',
    interval: 'month',
    features: [
      '10 câu hỏi mỗi tháng',
      '5 tài liệu trong KB',
      'Basic AI chat',
      'Hỗ trợ email',
    ],
    limits: {
      queries: 10,
      documents: 5,
      users: 1,
      apiCalls: 100,
    },
    stripePriceId: '',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Dành cho cá nhân và người dùng chuyên nghiệp',
    price: 99000,
    priceId: process.env.STRIPE_PRICE_PRO || 'price_pro_monthly',
    interval: 'month',
    features: [
      '100 câu hỏi mỗi tháng',
      '100 tài liệu trong KB',
      'Advanced AI chat với RAG',
      'Upload file (PDF, DOCX)',
      'Web scraping',
      'Priority support',
    ],
    limits: {
      queries: 100,
      documents: 100,
      users: 1,
      apiCalls: 1000,
    },
    stripePriceId: process.env.STRIPE_PRICE_PRO || '',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Dành cho tổ chức và doanh nghiệp',
    price: 299000,
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise_monthly',
    interval: 'month',
    features: [
      'Unlimited câu hỏi',
      'Unlimited tài liệu',
      'Full RAG với Pinecone',
      'Multi-user access',
      'Auto scraping',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee',
    ],
    limits: {
      queries: -1,
      documents: -1,
      users: 10,
      apiCalls: -1,
    },
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE || '',
  },
];

// ============== CUSTOMER MANAGEMENT ==============

export async function createCustomer(email, name, metadata) {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in .env to manage customers.');
  }

  return await stripe.customers.create({
    email,
    name,
    metadata: {
      source: 'mada_ai',
      ...metadata,
    },
  });
}

export async function getOrCreateCustomer(userId, email, name) {
  // Check if customer already exists
  const existingCustomerId = getStripeCustomerIdByUserId(userId);
  
  if (existingCustomerId) {
    try {
      return await stripe.customers.retrieve(existingCustomerId);
    } catch {}
  }

  // Create new customer
  const customer = await createCustomer(email, name, { userId });
  saveCustomer(userId, customer.id, email, name);
  return customer;
}

// ============== SUBSCRIPTION MANAGEMENT ==============

export async function createCheckoutSession(customerId, priceId, successUrl, cancelUrl, userId) {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
    throw new Error('Stripe not configured. Add STRIPE_SECRET_KEY to .env');
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId: userId || '',
      source: 'mada_ai',
    },
    subscription_data: {
      metadata: {
        userId: userId || '',
      },
    },
  });

  return session;
}

export async function createBillingPortalSession(customerId, returnUrl) {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
    throw new Error('Stripe not configured');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}

export async function getSubscription(subscriptionId) {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
    return null;
  }

  return await stripe.subscriptions.retrieve(subscriptionId);
}

export async function cancelSubscription(subscriptionId, atPeriodEnd = true) {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
    throw new Error('Stripe not configured');
  }

  if (atPeriodEnd) {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }
  return await stripe.subscriptions.cancel(subscriptionId);
}

export async function resumeSubscription(subscriptionId) {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
    throw new Error('Stripe not configured');
  }

  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

// ============== USAGE TRACKING ==============

const usageRecords = new Map();

export async function recordUsage(userId, type) {
  const key = `${userId}:${type}:${new Date().toISOString().slice(0, 7)}`;
  const current = usageRecords.get(key) || 0;
  usageRecords.set(key, current + 1);
  
  console.log(`📊 Usage recorded: ${userId} - ${type} (${current + 1}/month)`);
}

export async function getUsage(userId) {
  const plan = PLANS[0]; // Default to free
  const db = getDb();
  
  if (db) {
    try {
      const user = db.prepare('SELECT plan FROM users WHERE id = ?').get(userId);
      const foundPlan = PLANS.find(p => p.id === user?.plan);
      if (foundPlan) {
        plan.limits = foundPlan.limits;
      }
    } catch {}
  }

  // Get current usage
  const month = new Date().toISOString().slice(0, 7);
  const queries = usageRecords.get(`${userId}:query:${month}`) || 0;
  const documents = usageRecords.get(`${userId}:document:${month}`) || 0;
  const apiCalls = usageRecords.get(`${userId}:api_call:${month}`) || 0;

  return {
    queriesThisMonth: queries,
    documentsThisMonth: documents,
    apiCallsThisMonth: apiCalls,
    plan: 'free',
    limits: plan.limits,
  };
}

export async function checkQuota(userId, type) {
  const usage = await getUsage(userId);
  
  let current = 0;
  let limit = 0;

  switch (type) {
    case 'query':
      current = usage.queriesThisMonth;
      limit = usage.limits.queries;
      break;
    case 'document':
      current = usage.documentsThisMonth;
      limit = usage.limits.documents;
      break;
    case 'api_call':
      current = usage.apiCallsThisMonth;
      limit = usage.limits.apiCalls;
      break;
  }

  return {
    allowed: limit === -1 || current < limit,
    current,
    limit,
    plan: usage.plan,
  };
}

// ============== WEBHOOK HANDLING - FULL IMPLEMENTATION ==============

export async function handleWebhook(event) {
  console.log(`📨 Webhook received: ${event.type}`);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const subscriptionId = session.subscription;
      
      if (userId && subscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price.id;
          const plan = PLANS.find(p => p.stripePriceId === priceId);
          
          // Save subscription
          saveSubscription(userId, {
            id: `sub_${subscriptionId}`,
            userId,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: subscriptionId,
            planId: plan?.id || 'unknown',
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            canceledAt: null,
          });

          // Update user plan
          updateUserPlan(userId, plan?.id || 'pro');

          console.log(`✅ Subscription activated for user ${userId}, plan: ${plan?.name || 'unknown'}`);
        } catch (err) {
          console.error('❌ Error processing checkout:', err.message);
        }
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const userId = subscription.metadata?.userId;
      
      if (!userId) {
        // Try to find user by subscription ID
        const storedSub = getSubscriptionByStripeId(subscription.id);
        if (storedSub) {
          saveSubscription(storedSub.userId, {
            ...storedSub,
            status: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          });
        }
      } else {
        const priceId = subscription.items.data[0]?.price.id;
        const plan = PLANS.find(p => p.stripePriceId === priceId);
        
        saveSubscription(userId, {
          ...getSubscriptionByUserId(userId),
          status: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          planId: plan?.id || 'unknown',
        });

        // Handle subscription issues
        if (subscription.status === 'canceled' || subscription.status === 'past_due') {
          updateUserPlan(userId, 'free');
          console.log(`⚠️ Subscription ${subscription.status} for user ${userId}`);
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const storedSub = getSubscriptionByStripeId(subscription.id);
      
      if (storedSub) {
        saveSubscription(storedSub.userId, {
          ...storedSub,
          status: 'canceled',
          canceledAt: new Date().toISOString(),
        });
        
        // Downgrade user to free
        updateUserPlan(storedSub.userId, 'free');
        console.log(`❌ Subscription canceled for user ${storedSub.userId}`);
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      console.log(`✅ Payment succeeded for invoice ${invoice.id}`);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log(`⚠️ Payment failed for invoice ${invoice.id}`);
      
      // Try to notify user
      if (invoice.customer) {
        try {
          const customer = await stripe.customers.retrieve(invoice.customer);
          console.log(`   Customer: ${customer.email}`);
        } catch {}
      }
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

// ============== HELPERS ==============

export function getPlanById(planId) {
  return PLANS.find(p => p.id === planId);
}

export function formatPrice(cents) {
  if (cents === 0) return 'Miễn phí';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(cents);
}

export { stripe };
