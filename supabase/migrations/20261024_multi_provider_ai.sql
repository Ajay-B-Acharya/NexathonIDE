-- Migration: Support Multi-Provider and Custom AI Endpoints
-- Upgrades user_ai_credentials table with custom endpoints, custom names, and custom protocol.
-- Fixes decommissioned Llama 3.1 70B Versatile model.

ALTER TABLE user_ai_credentials
  ADD COLUMN IF NOT EXISTS api_endpoint VARCHAR(500),
  ADD COLUMN IF NOT EXISTS custom_provider_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS custom_protocol VARCHAR(50) DEFAULT 'openai';

-- Auto-migrate any previously stored decommissioned llama-3.1-70b-versatile to llama-3.3-70b-versatile
UPDATE user_ai_credentials
  SET selected_model = 'llama-3.3-70b-versatile'
  WHERE selected_model = 'llama-3.1-70b-versatile';
