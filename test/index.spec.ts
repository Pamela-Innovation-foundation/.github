// test/index.spec.ts
import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import worker from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('D1 Beverages Worker', () => {
	beforeAll(async () => {
		// Initialize the database with test data
		// Use batch for better performance with multiple inserts
		await env.DB.exec(`DROP TABLE IF EXISTS Customers`);
		await env.DB.exec(`CREATE TABLE IF NOT EXISTS Customers (CustomerId INTEGER PRIMARY KEY, CompanyName TEXT, ContactName TEXT, Status TEXT DEFAULT 'open')`);
		
		// Use batch() for efficient multiple inserts
		await env.DB.batch([
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(1, 'Alfreds Futterkiste', 'Maria Anders', 'open'),
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(4, 'Around the Horn', 'Thomas Hardy', 'closed'),
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(11, 'Bs Beverages', 'Victoria Ashworth', 'open'),
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(13, 'Bs Beverages', 'Random Name', 'open')
		]);
	});

	it('responds with default message for root path (unit style)', async () => {
		const request = new IncomingRequest('http://example.com');
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toMatchInlineSnapshot(`"Call /api/beverages to see everyone who works at Bs Beverages or /api/customers/open to see all open customers"`);
	});

	it('responds with default message for root path (integration style)', async () => {
		const response = await SELF.fetch('https://example.com');
		expect(await response.text()).toMatchInlineSnapshot(`"Call /api/beverages to see everyone who works at Bs Beverages or /api/customers/open to see all open customers"`);
	});

	it('returns beverages data from database (unit style)', async () => {
		const request = new IncomingRequest('http://example.com/api/beverages');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
		
		const data = await response.json();
		expect(Array.isArray(data)).toBe(true);
		expect(data.length).toBe(2);
		expect(data[0]).toHaveProperty('CompanyName', 'Bs Beverages');
		expect(data[0]).toHaveProperty('ContactName');
		expect(data[0]).toHaveProperty('CustomerId');
	});

	it('returns beverages data from database (integration style)', async () => {
		const response = await SELF.fetch('https://example.com/api/beverages');
		
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
		
		const data = await response.json();
		expect(Array.isArray(data)).toBe(true);
		expect(data.length).toBe(2);
	});

	it('returns all open customers (unit style)', async () => {
		const request = new IncomingRequest('http://example.com/api/customers/open');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
		
		const data = await response.json();
		expect(Array.isArray(data)).toBe(true);
		expect(data.length).toBe(3); // Three customers with 'open' status
		
		// Verify all returned customers have 'open' status
		data.forEach((customer: any) => {
			expect(customer.Status).toBe('open');
			expect(customer).toHaveProperty('CustomerId');
			expect(customer).toHaveProperty('CompanyName');
			expect(customer).toHaveProperty('ContactName');
		});
	});

	it('returns all open customers (integration style)', async () => {
		const response = await SELF.fetch('https://example.com/api/customers/open');
		
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
		
		const data = await response.json();
		expect(Array.isArray(data)).toBe(true);
		expect(data.length).toBe(3); // Three customers with 'open' status
		
		// Verify all returned customers have 'open' status
		data.forEach((customer: any) => {
			expect(customer.Status).toBe('open');
		});
	});

	it('handles database error for beverages endpoint (unit style)', async () => {
		// Drop the table to simulate a database error
		await env.DB.exec(`DROP TABLE IF EXISTS Customers`);
		
		const request = new IncomingRequest('http://example.com/api/beverages');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(500);
		const data = await response.json();
		expect(data).toHaveProperty('error');
		expect(data.error).toBe('Failed to fetch beverages data');
		
		// Recreate table for other tests
		await env.DB.exec(`CREATE TABLE IF NOT EXISTS Customers (CustomerId INTEGER PRIMARY KEY, CompanyName TEXT, ContactName TEXT, Status TEXT DEFAULT 'open')`);
		await env.DB.batch([
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(1, 'Alfreds Futterkiste', 'Maria Anders', 'open'),
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(4, 'Around the Horn', 'Thomas Hardy', 'closed'),
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(11, 'Bs Beverages', 'Victoria Ashworth', 'open'),
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(13, 'Bs Beverages', 'Random Name', 'open')
		]);
	});

	it('handles database error for beverages endpoint (integration style)', async () => {
		// Drop the table to simulate a database error
		await env.DB.exec(`DROP TABLE IF EXISTS Customers`);
		
		const response = await SELF.fetch('https://example.com/api/beverages');
		
		expect(response.status).toBe(500);
		const data = await response.json();
		expect(data).toHaveProperty('error');
		expect(data.error).toBe('Failed to fetch beverages data');
		
		// Recreate table for other tests
		await env.DB.exec(`CREATE TABLE IF NOT EXISTS Customers (CustomerId INTEGER PRIMARY KEY, CompanyName TEXT, ContactName TEXT, Status TEXT DEFAULT 'open')`);
		await env.DB.batch([
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(1, 'Alfreds Futterkiste', 'Maria Anders', 'open'),
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(4, 'Around the Horn', 'Thomas Hardy', 'closed'),
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(11, 'Bs Beverages', 'Victoria Ashworth', 'open'),
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(13, 'Bs Beverages', 'Random Name', 'open')
		]);
	});

	it('handles database error for open customers endpoint (unit style)', async () => {
		// Drop the table to simulate a database error
		await env.DB.exec(`DROP TABLE IF EXISTS Customers`);
		
		const request = new IncomingRequest('http://example.com/api/customers/open');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(500);
		const data = await response.json();
		expect(data).toHaveProperty('error');
		expect(data.error).toBe('Failed to fetch open customers');
		
		// Recreate table for other tests
		await env.DB.exec(`CREATE TABLE IF NOT EXISTS Customers (CustomerId INTEGER PRIMARY KEY, CompanyName TEXT, ContactName TEXT, Status TEXT DEFAULT 'open')`);
		await env.DB.batch([
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(1, 'Alfreds Futterkiste', 'Maria Anders', 'open'),
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(4, 'Around the Horn', 'Thomas Hardy', 'closed'),
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(11, 'Bs Beverages', 'Victoria Ashworth', 'open'),
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(13, 'Bs Beverages', 'Random Name', 'open')
		]);
	});

	it('handles database error for open customers endpoint (integration style)', async () => {
		// Drop the table to simulate a database error
		await env.DB.exec(`DROP TABLE IF EXISTS Customers`);
		
		const response = await SELF.fetch('https://example.com/api/customers/open');
		
		expect(response.status).toBe(500);
		const data = await response.json();
		expect(data).toHaveProperty('error');
		expect(data.error).toBe('Failed to fetch open customers');
		
		// Recreate table for other tests
		await env.DB.exec(`CREATE TABLE IF NOT EXISTS Customers (CustomerId INTEGER PRIMARY KEY, CompanyName TEXT, ContactName TEXT, Status TEXT DEFAULT 'open')`);
		await env.DB.batch([
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(1, 'Alfreds Futterkiste', 'Maria Anders', 'open'),
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(4, 'Around the Horn', 'Thomas Hardy', 'closed'),
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(11, 'Bs Beverages', 'Victoria Ashworth', 'open'),
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(13, 'Bs Beverages', 'Random Name', 'open')
		]);
	});

	it('handles empty result set for beverages (unit style)', async () => {
		// Clear all Bs Beverages entries temporarily
		await env.DB.prepare(`DELETE FROM Customers WHERE CompanyName = ?`).bind('Bs Beverages').run();
		
		const request = new IncomingRequest('http://example.com/api/beverages');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(200);
		const data = await response.json();
		expect(Array.isArray(data)).toBe(true);
		expect(data.length).toBe(0);
		
		// Restore deleted data
		await env.DB.batch([
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(11, 'Bs Beverages', 'Victoria Ashworth', 'open'),
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName, Status) VALUES (?, ?, ?, ?)`).bind(13, 'Bs Beverages', 'Random Name', 'open')
		]);
	});

	it('handles empty result set for open customers (unit style)', async () => {
		// Update all customers to closed status temporarily
		await env.DB.prepare(`UPDATE Customers SET Status = ?`).bind('closed').run();
		
		const request = new IncomingRequest('http://example.com/api/customers/open');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(200);
		const data = await response.json();
		expect(Array.isArray(data)).toBe(true);
		expect(data.length).toBe(0);
		
		// Restore statuses
		await env.DB.prepare(`UPDATE Customers SET Status = ? WHERE CustomerID IN (?, ?, ?)`).bind('open', 1, 11, 13).run();
	});

	it('handles invalid/unknown paths correctly', async () => {
		const testPaths = [
			'/api/unknown',
			'/api/customers',
			'/api',
			'/unknown',
			'/api/beverages/123'
		];
		
		for (const path of testPaths) {
			const response = await SELF.fetch(`https://example.com${path}`);
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toBe('Call /api/beverages to see everyone who works at Bs Beverages or /api/customers/open to see all open customers');
		}
	});
});
