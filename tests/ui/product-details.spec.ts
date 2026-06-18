import { test, expect } from '@playwright/test';
import { testConfig } from '../../src/core/test-config';

// test.beforeEach(async ({ page }) => {
//     await page.goto(testConfig.uiBaseUrl + '/products/noir-jacket');
// });

test('check product details and add to cart', async ({ page }) => {
    await page.goto(testConfig.uiBaseUrl + '/products/noir-jacket');
    
    await expect(page).toHaveTitle('Noir jacket – Sauce Demo');
    await expect(page.locator("h1[itemprop='name']")).toContainText("Noir jacket");
    await expect(page.locator("span.product-price")).toHaveText("£60.00");

    await page.getByRole("combobox", { name: 'Size' }).selectOption("M");
    await page.getByRole("combobox", { name: 'Color' }).selectOption("Red");
    await page.getByRole("button", { name: 'Add to Cart' }).click();

    await expect(page.locator("#cart-target-desktop")).toContainText("(1)");
    // await page.pause();
});