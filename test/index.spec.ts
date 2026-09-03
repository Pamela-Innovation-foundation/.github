// test/index.spec.ts
import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/index';
import { resetGuard, enableGuard, disableGuard } from '../src/config';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('Worker with Project Name Guard', () => {
	beforeEach(() => {
		resetGuard();
	});

	it('responds with guarded project name (unit style)', async () => {
		const request = new IncomingRequest('http://example.com');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const text = await response.text();
		expect(text).toContain('pamela');
		expect(text).not.toContain('My Cool Project');
	});

	it('responds with guarded project name (integration style)', async () => {
		const response = await SELF.fetch('https://example.com');
		const text = await response.text();
		expect(text).toContain('pamela');
		expect(text).not.toContain('My Cool Project');
	});

	it('responds with original name when guard is disabled', async () => {
		disableGuard();
		const request = new IncomingRequest('http://example.com');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const text = await response.text();
		expect(text).toContain('My Cool Project');
		expect(text).not.toContain('pamela');
	});

	it('returns project name from API endpoint', async () => {
		const request = new IncomingRequest('http://example.com/api/project-name');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const data = await response.json();
		expect(data).toEqual({ projectName: 'pamela' });
	});

	it('returns original project name from API when guard is disabled', async () => {
		disableGuard();
		const request = new IncomingRequest('http://example.com/api/project-name');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const data = await response.json();
		expect(data).toEqual({ projectName: 'My Cool Project' });
	});
});
