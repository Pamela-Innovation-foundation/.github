// test/index.spec.ts
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import worker from '../src/index';
import { TEST_API_KEY } from './constants';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
type BeverageRow = {
	CustomerId: number;
	CompanyName: string;
	ContactName: string;
};

describe('D1 Beverages Worker', () => {
	beforeAll(async () => {
		// Initialize the database with test data
		// Use batch for better performance with multiple inserts
		await env.DB.exec(`DROP TABLE IF EXISTS Customers`);
		await env.DB.exec(`CREATE TABLE IF NOT EXISTS Customers (CustomerId INTEGER PRIMARY KEY, CompanyName TEXT, ContactName TEXT)`);
		
		// Use batch() for efficient multiple inserts
		await env.DB.batch([
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (?, ?, ?)`).bind(1, 'Alfreds Futterkiste', 'Maria Anders'),
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (?, ?, ?)`).bind(4, 'Around the Horn', 'Thomas Hardy'),
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (?, ?, ?)`).bind(11, 'Bs Beverages', 'Victoria Ashworth'),
			env.DB.prepare(`INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (?, ?, ?)`).bind(13, 'Bs Beverages', 'Random Name')
		]);
	});

	it('responds with default message for root path (unit style)', async () => {
		const request = new IncomingRequest('http://example.com');
		const response = await worker.fetch(request, env);
		expect(await response.text()).toMatchInlineSnapshot(`"Pull container from cloud"`);
	});

	it('responds with default message for root path (integration style)', async () => {
		const response = await SELF.fetch('https://example.com');
		expect(await response.text()).toMatchInlineSnapshot(`"Pull container from cloud"`);
	});

	it('returns beverages data from database (unit style)', async () => {
		const request = new IncomingRequest('http://example.com/api/beverages', {
			headers: { 'X-API-Key': TEST_API_KEY },
		});
		const response = await worker.fetch(request, env);
		
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
		
		const data = (await response.json()) as BeverageRow[];
		expect(Array.isArray(data)).toBe(true);
		expect(data.length).toBe(2);
		expect(data[0]).toHaveProperty('CompanyName', 'Bs Beverages');
		expect(data[0]).toHaveProperty('ContactName');
		expect(data[0]).toHaveProperty('CustomerId');
	});

	it('returns beverages data from database (integration style)', async () => {
		const response = await SELF.fetch('https://example.com/api/beverages', {
			headers: { 'X-API-Key': TEST_API_KEY },
		});
		
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
		
		const data = (await response.json()) as BeverageRow[];
		expect(Array.isArray(data)).toBe(true);
		expect(data.length).toBe(2);
	});

	it('rejects requests without API key', async () => {
		const response = await SELF.fetch('https://example.com/api/beverages');

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toMatchObject({
			error: expect.stringContaining('Unauthorized'),
		});
	});

	it('rejects requests with invalid API key', async () => {
		const response = await SELF.fetch('https://example.com/api/beverages', {
			headers: { 'X-API-Key': 'invalid-key' },
		});

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toMatchObject({
			error: expect.stringContaining('Unauthorized'),
		});
	});

	it('returns digital clock HTML page', async () => {
		const response = await SELF.fetch('https://example.com/clock');

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toContain('text/html');
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');

		const html = await response.text();
		expect(html).toContain('Digital Clock');
		expect(html).toContain('America/New_York');
		expect(html).toContain('Asia/Tokyo');
		expect(html).toContain('Europe/London');
		expect(html).toContain('id="clocks"');
		expect(html).toContain('setInterval');
	});
});
