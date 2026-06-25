import { test, expect } from "@playwright/test";
import { testConfig } from "../../src/core/test-config";

test.describe("@api Auth - CreateToken", () => {
  test("Create a new auth token", async ({ request }) => {
    const response = await request.post(`${testConfig.apiBaseUrl}/auth`, {
      data: { username: "admin", password: "password123" },
    });

    expect(response.ok()).toBeTruthy;
    expect(response.headers()["content-type"]).toContain("application/json");

    const responseBody = await response.json();

    expect(responseBody).toHaveProperty("token");
    expect(responseBody.token).not.toBeFalsy();
    expect(responseBody.token.length).toBeGreaterThanOrEqual(0);
  });
});
