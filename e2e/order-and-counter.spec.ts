import { expect, test } from '@playwright/test'
import { E2E_ADMIN, loginAs, watchPageErrors } from './helpers'

test.describe('订单中心与门店零售', () => {
  test('订单列表、录单、门店零售、退货与打印中心页面正常加载', async ({ page }) => {
    const watcher = watchPageErrors(page)
    await loginAs(page, E2E_ADMIN.username, E2E_ADMIN.password)

    for (const path of [
      '/order-center/list',
      '/order-center/create',
      '/order-center/counter',
      '/order-center/approvals',
      '/order-center/refund',
      '/order-center/print',
      '/finance/credit',
      '/finance/payments',
    ]) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(new RegExp(path))
    }

    watcher.assertNoErrors()
  })
})
