export const testConfig = {
    env: process.env.TEST_ENV ?? 'local',

    apiBaseUrl: process.env.API_BASE_URL ?? 'https://restful-booker.herokuapp.com',
    uiBaseUrl: process.env.UI_BASE_URL ?? 'https://sauce-demo.myshopify.com',
    // TODO: This is something to check at some point as next UI tests when shopping is covered enough
    // uiBaseUrl: process.env.UI_BASE_URL ?? "https://www.saucedemo.com",
};