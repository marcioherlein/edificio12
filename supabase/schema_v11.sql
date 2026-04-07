-- v11: explicit month closure flag
ALTER TABLE account_balances ADD COLUMN IF NOT EXISTS closed boolean NOT NULL DEFAULT false;
