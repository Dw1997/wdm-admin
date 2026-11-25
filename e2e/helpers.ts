import { expect, type Page } from '@playwright/test'

export const E2E_ADMIN = {
  username: process.env.E2E_ADMIN_USER || 'e2e_admin',
  password: process.env.E2E_PASSWORD || 'e2e123456',
}

export const E2E_SALES = {
  username: process.env.E2E_SALES_USER || 'e2e_sales',
  password: process.env.E2E_PASSWORD || 'e2e123456',
}

/** 监控页面运行期未捕获异常与后端 5xx 错误。 */
export function watchPageErrors(page: Page) {
  const pageErrors: string[] = []
  const serverErrors: string[] = []

  page.on('pageerror', (err) => pageErrors.push(err.message))
  page.on('response', (res) => {
    if (res.url().includes('/api/') && res.status() >= 500) {
      serverErrors.push(`${res.status()} ${res.url()}`)
    }
  })

  return {
    assertNoErrors() {
      expect(pageErrors, `页面存在未捕获异常: ${pageErrors.join('; ')}`).toEqual([])
      expect(serverErrors, `存在后端 5xx 接口错误: ${serverErrors.join('; ')}`).toEqual([])
    },
  }
}

export async function loginAs(page: Page, username: string, password: string) {
  await page.goto('/login')
  await page.getByPlaceholder('请输入账号').fill(username)
  await page.getByPlaceholder('请输入密码').fill(password)
  await page.getByRole('button', { name: '登录' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })
}
