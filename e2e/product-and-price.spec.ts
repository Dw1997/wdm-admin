import { expect, test } from '@playwright/test'
import { E2E_ADMIN, loginAs, watchPageErrors } from './helpers'

test.describe('商品与价格体系', () => {
  test('商品列表展示种子商品，价格体系各页面正常加载', async ({ page }) => {
    const watcher = watchPageErrors(page)
    await loginAs(page, E2E_ADMIN.username, E2E_ADMIN.password)

    await page.goto('/spus/list')
    await expect(page.locator('body')).toContainText('E2E五香瓜子')

    for (const path of ['/spus/categories', '/prices/suggested', '/prices/levels', '/prices/exclusive', '/prices/query']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(new RegExp(path))
    }

    watcher.assertNoErrors()
  })
})
