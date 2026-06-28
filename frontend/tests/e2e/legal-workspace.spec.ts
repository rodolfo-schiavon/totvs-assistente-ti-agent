import { test, expect } from "@playwright/test";

const adminUser = process.env.ADMIN_USERNAME || "admin";
const adminPass = process.env.ADMIN_PASSWORD || "ci-password";

test.describe("Legal AI Workspace", () => {
  test("login, consent, dashboard e admin", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[autocomplete="username"]').fill(adminUser);
    await page.locator('input[autocomplete="current-password"]').fill(adminPass);
    await page.getByRole("button", { name: /entrar/i }).click();

    await expect(page).toHaveURL(/consent|dashboard\/executive/);
    if (page.url().includes("/consent")) {
      await page.getByRole("button", { name: /aceito/i }).click();
      await expect(page).toHaveURL(/dashboard\/executive/);
    }

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await page.goto("/dashboard/agent");
    await expect(page.getByText(/como posso ajudar/i)).toBeVisible();

    await page.goto("/dashboard/admin/llm");
    await expect(page.getByRole("heading", { name: /llm|byok|modelo/i })).toBeVisible();

    await page.goto("/dashboard/admin/knowledge");
    await expect(page.getByRole("heading", { name: /base|conhecimento|documentos/i })).toBeVisible();
  });
});
