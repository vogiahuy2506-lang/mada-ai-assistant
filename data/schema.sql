-- =====================================================
-- MADA AI Assistant - Database Schema
-- =====================================================

-- Categories table
CREATE TABLE IF NOT EXISTS kb_categories (
  id TEXT PRIMARY KEY,
  name_vi TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL DEFAULT '',
  name_fr TEXT NOT NULL DEFAULT '',
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  description_vi TEXT,
  description_en TEXT,
  description_ar TEXT,
  description_fr TEXT,
  related_url TEXT,
  product_link TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Products table
CREATE TABLE IF NOT EXISTS kb_products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_en TEXT NOT NULL DEFAULT '',
  title_ar TEXT NOT NULL DEFAULT '',
  title_fr TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  description_ar TEXT NOT NULL DEFAULT '',
  description_fr TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  brand TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  price_range TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  product_url TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  iso_codes TEXT NOT NULL DEFAULT '[]',
  wcag_level TEXT NOT NULL DEFAULT '',
  who_gate_area TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  language TEXT NOT NULL DEFAULT 'vi',
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  content_en TEXT,
  content_ar TEXT,
  content_fr TEXT
);

-- Product indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON kb_products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON kb_products(status);
CREATE INDEX IF NOT EXISTS idx_products_featured ON kb_products(featured);
CREATE INDEX IF NOT EXISTS idx_products_created ON kb_products(created_at);
