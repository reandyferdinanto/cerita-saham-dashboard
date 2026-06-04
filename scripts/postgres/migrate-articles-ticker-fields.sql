-- Migration: Add ticker extraction and metadata fields to articles table
-- Run this migration to support enhanced ticker-article linking

-- Add extracted_tickers JSONB column
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS extracted_tickers JSONB DEFAULT '[]'::jsonb;

-- Add metadata JSONB column
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_articles_extracted_tickers 
ON articles USING GIN (extracted_tickers);

CREATE INDEX IF NOT EXISTS idx_articles_extracted_tickers_ticker 
ON articles ((extracted_tickers->>'ticker'));

CREATE INDEX IF NOT EXISTS idx_articles_metadata 
ON articles USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_articles_metadata_sectors 
ON articles ((metadata->'sectors'));

CREATE INDEX IF NOT EXISTS idx_articles_metadata_sentiment 
ON articles ((metadata->>'sentiment'));

CREATE INDEX IF NOT EXISTS idx_articles_metadata_view_count 
ON articles (((metadata->>'viewCount')::int));

-- Add comments for documentation
COMMENT ON COLUMN articles.extracted_tickers IS 'Array of ticker mentions with relevance scores: [{ticker, fullTicker, relevanceScore, mentionCount, isPrimary, confidence}]';
COMMENT ON COLUMN articles.metadata IS 'Article metadata: {viewCount, bookmarkCount, sentiment, sentimentScore, impactLevel, articleType, sectors, processedAt, tickerExtractionVersion}';

-- Create function to extract tickers from article (to be called after insert/update)
CREATE OR REPLACE FUNCTION extract_article_tickers()
RETURNS TRIGGER AS $$
BEGIN
  -- This function will be implemented in application layer
  -- For now, just ensure the columns exist
  IF NEW.extracted_tickers IS NULL THEN
    NEW.extracted_tickers := '[]'::jsonb;
  END IF;
  
  IF NEW.metadata IS NULL THEN
    NEW.metadata := '{}'::jsonb;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-initialize fields
DROP TRIGGER IF EXISTS trigger_extract_article_tickers ON articles;
CREATE TRIGGER trigger_extract_article_tickers
  BEFORE INSERT OR UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION extract_article_tickers();

-- Backfill existing articles with empty arrays/objects
UPDATE articles 
SET 
  extracted_tickers = COALESCE(extracted_tickers, '[]'::jsonb),
  metadata = COALESCE(metadata, '{}'::jsonb)
WHERE extracted_tickers IS NULL OR metadata IS NULL;

-- Verify migration
SELECT 
  COUNT(*) as total_articles,
  COUNT(*) FILTER (WHERE extracted_tickers IS NOT NULL) as with_extracted_tickers,
  COUNT(*) FILTER (WHERE metadata IS NOT NULL) as with_metadata
FROM articles;

-- Made with Bob
