import { expect, test } from '@playwright/test'
import { E2E_ADMIN, E2E_SALES, loginAs, watchPageErrors } from './helpers'

test.describe('认证与角色权限', () => {
  test('错误密码登录应展示错误提示并停留在登录页', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('请输入账号').fill(E2E_ADMIN.username)
    await page.getByPlaceholder('请输入密码').fill('wrong_password_123')
    await page.getByRole('button', { name: '登录' }).click()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('.n-alert')).toBeVisible()
  })

  test('管理员登录后可正常进入数据看板且无接口报错', async ({ page }) => {
    const watcher = watchPageErrors(page)
    await loginAs(page, E2E_ADMIN.username, E2E_ADMIN.password)
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.locator('body')).toContainText(/看板|订单|客户|商品/)
    watcher.assertNoErrors()
  })

  test('销售角色（仅移动端权限）登录 Web 管理端应被拦截', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('请输入账号').fill(E2E_SALES.username)
    await page.getByPlaceholder('请输入密码').fill(E2E_SALES.password)
    await page.getByRole('button', { name: '登录' }).click()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('.n-alert')).toBeVisible()
  })
})
