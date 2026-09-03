DROP TABLE IF EXISTS Customers;
CREATE TABLE IF NOT EXISTS Customers (CustomerId INTEGER PRIMARY KEY, CompanyName TEXT, ContactName TEXT);
INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (1, 'Alfreds Futterkiste', 'Maria Anders'), (4, 'Around the Horn', 'Thomas Hardy'), (11, 'Bs Beverages', 'Victoria Ashworth'), (13, 'Bs Beverages', 'Random Name');

DROP TABLE IF EXISTS BlockchainWebhooks;
CREATE TABLE IF NOT EXISTS BlockchainWebhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

DROP TABLE IF EXISTS X402Payments;
CREATE TABLE IF NOT EXISTS X402Payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payer TEXT NOT NULL,
  asset TEXT NOT NULL,
  network TEXT NOT NULL,
  amount TEXT NOT NULL,
  pay_to TEXT NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  method TEXT NOT NULL DEFAULT 'eip3009',
  created_at TEXT NOT NULL
);