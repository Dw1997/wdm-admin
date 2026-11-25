import { expect, test } from '@playwright/test'
import { E2E_ADMIN, loginAs, watchPageErrors } from './helpers'

test.describe('配送管理与客户财务', () => {
  test('安排出车、待送货订单、路线设置、客户与欠款页面正常加载', async ({ page }) => {
    const watcher = watchPageErrors(page)
    await loginAs(page, E2E_ADMIN.username, E2E_ADMIN.password)

    await page.goto('/customers/list')
    await expect(page.locator('body')).toContainText('E2E测试客户A')
    await expect(page.locator('body')).toContainText('E2E测试客户B')

    for (const path of [
      '/delivery/trips',
      '/delivery/pool',
      '/delivery/places',
      '/delivery/freight-lines',
      '/customers/credit',
      '/customers/coupons',
    ]) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(new RegExp(path))
    }

    watcher.assertNoErrors()
  })
})
