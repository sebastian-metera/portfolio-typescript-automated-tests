import { test, expect} from '@playwright/test';
import { testConfig } from '../../src/core/test-config';

test('get healthcheck', async ({ request }) => {
    const response = await request.get(`${testConfig.apiBaseUrl}/ping`);
    
    expect(response.status()).toBe(201);
    expect(await response.text()).toEqual('Created');
});