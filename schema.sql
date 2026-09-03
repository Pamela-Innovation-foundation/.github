DROP TABLE IF EXISTS Customers;
CREATE TABLE IF NOT EXISTS Customers (CustomerId INTEGER PRIMARY KEY, CompanyName TEXT, ContactName TEXT);
INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (1, 'Alfreds Futterkiste', 'Maria Anders'), (4, 'Around the Horn', 'Thomas Hardy'), (11, 'Bs Beverages', 'Victoria Ashworth'), (13, 'Bs Beverages', 'Random Name');

DROP TABLE IF EXISTS BlockchainWebhooks;
CREATE TABLE IF NOT EXISTS BlockchainWebhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

DROP TABLE IF EXISTS Landmarks;
CREATE TABLE IF NOT EXISTS Landmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO Landmarks (name, location, description, created_at) VALUES
  ('NEOM The Line', 'Saudi Arabia', 'A 170km linear smart city in the desert, construction milestone reached.', '2024-01-15'),
  ('Fehmarnbelt Tunnel', 'Denmark-Germany', 'The world''s longest immersed tunnel connecting Denmark and Germany, major progress in 2024.', '2024-03-22'),
  ('Grand Egyptian Museum', 'Giza, Egypt', 'The largest archaeological museum in the world, opened near the Pyramids of Giza.', '2024-06-01'),
  ('Dangla Suspension Bridge', 'Tibet, China', 'A record-breaking high-altitude suspension bridge completed in 2024.', '2024-07-10'),
  ('Sydney Metro West', 'Sydney, Australia', 'Major underground metro rail line connecting Sydney CBD to western suburbs.', '2024-09-05'),
  ('Iconic Tower', 'Cairo, Egypt', 'Africa''s tallest skyscraper at 385 meters, topped out in the New Administrative Capital.', '2024-11-20'),
  ('Peljesac Bridge', 'Croatia', 'A cable-stayed bridge connecting southern Croatia, fully operational since early 2024.', '2024-02-14'),
  ('Ram Mandir', 'Ayodhya, India', 'A grand Hindu temple inaugurated in January 2024 at a historic religious site.', '2024-01-22');