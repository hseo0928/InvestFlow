-- Create fundamentals_data table for caching financial statements
-- Supports income statements, balance sheets, ratios, and DCF calculations

CREATE TABLE IF NOT EXISTS fundamentals_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(10) NOT NULL,
  data_type VARCHAR(20) NOT NULL CHECK (data_type IN ('income', 'balance', 'ratios', 'dcf')),
  value_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, data_type)
);

-- Index for fast symbol lookups
CREATE INDEX IF NOT EXISTS idx_fundamentals_symbol ON fundamentals_data(symbol);

-- Index for querying by updated_at (cache TTL)
CREATE INDEX IF NOT EXISTS idx_fundamentals_updated ON fundamentals_data(updated_at DESC);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_fundamentals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp on row update
DROP TRIGGER IF EXISTS trigger_fundamentals_updated_at ON fundamentals_data;
CREATE TRIGGER trigger_fundamentals_updated_at
  BEFORE UPDATE ON fundamentals_data
  FOR EACH ROW
  EXECUTE FUNCTION update_fundamentals_updated_at();

-- Enable Row Level Security
ALTER TABLE fundamentals_data ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous and authenticated users to read
CREATE POLICY "Allow read access to fundamentals_data"
  ON fundamentals_data FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy: Allow service role to insert/update
CREATE POLICY "Allow service role to manage fundamentals_data"
  ON fundamentals_data FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE fundamentals_data IS 'Cached financial fundamentals data from yfinance API';
COMMENT ON COLUMN fundamentals_data.data_type IS 'Type: income, balance, ratios, or dcf';
COMMENT ON COLUMN fundamentals_data.value_json IS 'JSON data containing financial metrics';
