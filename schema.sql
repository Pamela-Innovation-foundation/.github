DROP TABLE IF EXISTS Customers;
CREATE TABLE IF NOT EXISTS Customers (CustomerId INTEGER PRIMARY KEY, CompanyName TEXT, ContactName TEXT);
INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (1, 'Alfreds Futterkiste', 'Maria Anders'), (4, 'Around the Horn', 'Thomas Hardy'), (11, 'Bs Beverages', 'Victoria Ashworth'), (13, 'Bs Beverages', 'Random Name');

DROP TABLE IF EXISTS BlockchainWebhooks;
CREATE TABLE IF NOT EXISTS BlockchainWebhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  webhook_id TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_blockchain_webhooks_webhook_id
  ON BlockchainWebhooks (webhook_id)
  WHERE webhook_id IS NOT NULL;