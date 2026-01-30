-- Add config column to branches table to store premium feature flags
ALTER TABLE branches ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

-- Comment for documentation
COMMENT ON COLUMN branches.config IS 'Stores branch-specific feature flags like enable_ai_dynamic_pricing';
