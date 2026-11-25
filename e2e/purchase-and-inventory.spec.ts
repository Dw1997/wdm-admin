import { expect, test } from '@playwright/test'
import { E2E_ADMIN, loginAs, watchPageErrors } from './helpers'

test.describe('进货管理与库存', () => {
  test('供应商、采购清单、采购入库、库存查询页面正常加载且包含种子供应商', async ({ page }) => {
    const watcher = watchPageErrors(page)
    await loginAs(page, E2E_ADMIN.username, E2E_ADMIN.password)

    await page.goto('/suppliers/list')
    await expect(page.locator('body')).toContainText('E2E标准供应商')

    for (const path of [
      '/suppliers/transactions',
      '/inventory/purchase-plans',
      '/inventory/purchases',
      '/inventory/stocks',
    ]) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(new RegExp(path))
    }

    watcher.assertNoErrors()
  })
})
