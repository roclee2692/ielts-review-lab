import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })
test.setTimeout(60_000)

async function chooseMock(page) {
  await expect(page.getByRole('dialog', { name: '发送给模型前确认' })).toBeVisible()
  await expect(page.getByRole('button', { name: '需要配置模型' })).toBeDisabled()
  await page.getByRole('button', { name: '使用模拟反馈' }).click()
}

test('阅读复盘：录入到模拟讲解，引用通过逐字校验', async ({ page }) => {
  await page.goto('/ielts/reading')
  await page.getByRole('button', { name: '载入原创示例' }).click()
  await page.getByRole('button', { name: '开始确定性判题' }).click()

  await expect(page.getByRole('heading', { name: '原创示例，非真题' })).toBeVisible()
  await expect(page.getByText('对 1 · 错 3')).toBeVisible()
  await page.getByRole('button', { name: '生成错题讲解' }).first().click()
  await chooseMock(page)

  await expect(page.getByText('模拟反馈（未调用模型）').first()).toBeVisible()
  await expect(page.getByText('定位已逐字校验').first()).toBeVisible()
  await expect(page.getByText('规则判定错因').first()).toBeVisible()
  await expect(page.getByText('单复数').first()).toBeVisible()
  await expect(page.getByRole('link', { name: '全部收入我的替换库' })).toHaveCount(0)
})

test('听力复盘：错题带中文反思，并标出推断依据', async ({ page }) => {
  await page.goto('/ielts/listening')
  await page.getByRole('button', { name: '载入原创示例' }).click()
  await page.getByRole('button', { name: '开始判题' }).click()

  const reflection = page.getByPlaceholder('当时到底发生了什么？').first()
  await expect(reflection).toBeVisible()
  await reflection.fill('我把 eight 听成了 nine，后面改口时走神了。')
  await page.getByRole('button', { name: '保存反思' }).first().click()
  await page.getByRole('button', { name: '生成错题讲解' }).first().click()
  await chooseMock(page)

  await expect(page.getByText('模拟反馈（未调用模型）').first()).toBeVisible()
  await expect(page.getByText('推断', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('文稿定位已校验').first()).toBeVisible()
  await expect(page.getByText('推断依据').first()).toBeVisible()

  await page.goto('/ielts/mistakes')
  await expect(page.getByText('错题库与弱点画像')).toBeVisible()
  await expect(page.getByText(/我把 eight 听成了 nine/).first()).toBeVisible()
})

test('写作路径：直接地址不能越过锁定，提交反馈后解锁', async ({ page }) => {
  await page.goto('/ielts/writing?step=t1-overview')
  await expect(page.getByText('当前节点尚未解锁')).toBeVisible()
  await expect(page.getByRole('textbox', { name: /你的作答/ })).toHaveCount(0)

  await page.goto('/ielts/writing?step=t1-intro')
  const answer = page.getByRole('textbox', { name: /你的作答/ })
  await answer.fill('The line graph compares the percentage of commuters using four transport modes in a medium-sized city between 2000 and 2020.')
  await page.getByRole('button', { name: '提交并获取反馈' }).click()
  await chooseMock(page)
  await expect(page.getByRole('heading', { name: '训练反馈' })).toBeVisible()
  await expect(page.getByText('模拟反馈').first()).toBeVisible()

  await page.goto('/ielts/writing?step=t1-overview')
  await expect(page.getByText('当前节点尚未解锁')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: /你的作答/ })).toBeVisible()
})

test('375px 明暗主题下新页面可访问且不横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/ielts')
  const paths = ['/ielts', '/ielts/reading', '/ielts/listening', '/ielts/mistakes', '/ielts/sets', '/ielts/review', '/ielts/writing', '/ielts/speaking', '/ielts/vocab', '/ielts/settings']
  for (const theme of ['dark', 'light']) {
    await page.evaluate(value => localStorage.setItem('ielts-theme', value), theme)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    for (const path of paths) {
      await page.goto(path)
      await expect(page.locator('h1').first()).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, `${path} overflows at 375px in ${theme}`).toBeLessThanOrEqual(1)
    }
  }
})

test('整套视图：归并三篇阅读、趋势、Markdown 导出与打印样式', async ({ page }) => {
  await page.goto('/ielts')
  await page.evaluate(() => {
    const now = Date.now()
    const make = (part, total, correct, offset) => ({
      id: `e2e-set-${part}`,
      module: 'reading',
      source: `E2E Set Passage ${part}`,
      partNumber: part,
      total,
      correct,
      wrong: total - correct,
      elapsedSeconds: 1200,
      createdAt: now - 100000 + offset,
      causeShares: total === correct ? [] : [{ cause: '同义替换没识别', count: total - correct, share: 1 }],
    })
    localStorage.setItem('irl-ielts-reviews', JSON.stringify([
      make(2, 13, 11, 2), make(1, 13, 10, 1), make(3, 14, 12, 3),
    ]))
  })
  await page.goto('/ielts/sets')
  await expect(page.getByRole('heading', { name: 'E2E Set' })).toBeVisible()
  await expect(page.getByText('估算 Band', { exact: true })).toBeVisible()
  await expect(page.getByText('7.5', { exact: true }).first()).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 Markdown' }).first().click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^ielts-set-report-.*\.md$/)

  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.topbar').first()).toBeHidden()
  await expect(page.getByRole('heading', { name: 'E2E Set' })).toBeVisible()
})

test('今日复习：按错因、替换与收藏词块建队列，评分后持久化', async ({ page }) => {
  await page.goto('/ielts')
  await page.evaluate(() => {
    localStorage.setItem('irl-mistake-records', JSON.stringify({
      version: 2,
      algorithmScores: {},
      migratedAt: Date.now(),
      records: [{
        id: 'ielts:e2e-review:q1', domain: 'ielts', module: 'reading', type: 'tfng',
        source: 'E2E Set Passage 1', questionSummary: 'The library closes early.',
        userAnswer: 'TRUE', correctAnswer: 'FALSE', errorCause: '定位失败',
        locationHint: 'Paragraph A', reflection: '', createdAt: Date.now(),
      }],
    }))
    localStorage.setItem('irl-ielts-vocabulary', JSON.stringify({ favorites: ['t1-01'], custom: [] }))
    localStorage.setItem('irl-ielts-replacements', JSON.stringify([{ id: 'purchase→buy', question: 'purchase', passage: 'buy' }]))
    localStorage.setItem('irl-ielts-review-schedule', JSON.stringify({ version: 1, items: {} }))
  })
  await page.goto('/ielts/review')
  await expect(page.getByRole('heading', { name: '今日复习' })).toBeVisible()
  await expect(page.getByText('定位失败').first()).toBeVisible()
  await expect(page.getByText('错题', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('替换', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('词块', { exact: true }).first()).toBeVisible()

  await page.getByRole('button', { name: '先回忆，显示答案' }).first().click()
  await page.getByRole('button', { name: '记住' }).first().click()
  await expect.poll(() => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('irl-ielts-review-schedule') || '{}').items || {}).length)).toBe(1)
  await page.reload()
  await expect(page.getByText('接下来')).toBeVisible()

  await page.goto('/ielts')
  await expect(page.getByText('今天该复习')).toBeVisible()
})

test('题集库 + 答案速记：同一篇只录一次，用户错因进入复发率', async ({ page }) => {
  await page.goto('/ielts/reading')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: '载入原创示例' }).click()
  await page.getByPlaceholder(/剑 18 Test 2 Passage 3/).fill('原创示例书 Test 1 Passage 1')
  await page.getByLabel(/判题时把原文、题目和答案册存进题集库/).check()
  await page.getByRole('button', { name: '开始确定性判题' }).click()
  await expect(page.getByText('对 1 · 错 3')).toBeVisible()

  // 不等模型：用户直接给第 3 题定错因
  await page.getByLabel('第 3 题错因').selectOption('定位失败')
  await expect(page.getByLabel('第 3 题错因')).toHaveValue('定位失败')
  // 本篇小结的错因占比读取用户确认后的错因
  await expect(page.locator('aside').getByText('定位失败')).toBeVisible()

  // 重做：从题集库载入，只敲一行答案
  await page.goto('/ielts/reading')
  await page.getByLabel('题集库', { exact: true }).selectOption({ label: '原创示例书 Test 1 Passage 1 · 4 题' })
  await page.getByRole('button', { name: '载入', exact: true }).click()
  await expect(page.getByText(/已载入「原创示例书 Test 1 Passage 1」/)).toBeVisible()
  await page.getByLabel('答案速记').fill('1 F 2 two weeks 3 B 4 N')
  await page.getByRole('button', { name: '填入', exact: true }).click()
  await expect(page.getByText('已填入 4 题的我的答案')).toBeVisible()
  await page.getByRole('button', { name: '开始确定性判题' }).click()
  await expect(page.getByText('对 4 · 错 0')).toBeVisible()

  await page.goto('/ielts/mistakes')
  const table = page.getByRole('table')
  await expect(table.getByRole('row', { name: /定位失败/ })).toContainText('0%')
})
