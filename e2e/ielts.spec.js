import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })
test.setTimeout(60_000)

async function chooseMock(page) {
  await expect(page.getByRole('dialog', { name: '发送给模型前确认' })).toBeVisible()
  await expect(page.getByRole('button', { name: '需要配置模型' })).toBeDisabled()
  await page.getByRole('button', { name: '使用模拟反馈' }).click()
}

test('阅读复盘：三个框录入 → 先说处境 → 模拟讲解（引用逐字校验）→ 多轮追问', async ({ page }) => {
  await page.goto('/ielts/reading')
  await expect(page.getByText('平行阅读法').first()).toBeVisible()
  await page.getByRole('button', { name: '载入原创示例（非真题）' }).click()
  await page.getByRole('button', { name: '识别并判题' }).click()

  await expect(page.getByRole('heading', { name: '原创示例，非真题' })).toBeVisible()
  await expect(page.getByText('对 1 · 错 3')).toBeVisible()
  await expect(page.getByText('规则判定：单复数')).toBeVisible()

  await page.getByRole('group', { name: '第 3 题做题处境' }).getByRole('button', { name: '首次经过答案句没认出' }).click()
  await expect(page.getByLabel('第 3 题错因')).toHaveValue('同义替换没识别')
  await expect(page.getByLabel('首次经过答案句却没认出')).toHaveValue('1')

  await page.getByRole('button', { name: '② 讲这题' }).nth(1).click()
  await chooseMock(page)
  await expect(page.getByText('模拟反馈（未调用模型）').first()).toBeVisible()
  await expect(page.getByText('引用已逐字校验').first()).toBeVisible()
  await expect(page.getByText('按你点的处境：同义替换没识别')).toBeVisible()

  await page.getByLabel('第 3 题追问').fill('我当时以为 ladder 只是举例，为什么是答案？')
  await page.getByLabel('第 3 题追问').press('Enter')
  await chooseMock(page)
  await expect(page.getByText('我当时以为 ladder 只是举例，为什么是答案？')).toBeVisible()
  await expect(page.getByText('原文证据不足').first()).toBeVisible()

  const report = await page.getByLabel('复盘报告 Markdown').inputValue()
  expect(report).toContain('## 错题表')
  expect(report).toContain('| 3 | 单选题 | A | B | 同义替换没识别 | 按处境 |')
})

test('听力复盘：错题带中文反思，并标出推断依据', async ({ page }) => {
  await page.goto('/ielts/listening')
  await page.getByRole('button', { name: '载入原创示例（非真题）' }).click()
  await page.getByRole('button', { name: '识别并判题' }).click()

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
  const paths = ['/ielts', '/ielts/methods', '/ielts/reading', '/ielts/listening', '/ielts/dictation', '/ielts/mistakes', '/ielts/sets', '/ielts/review', '/ielts/writing', '/ielts/speaking', '/ielts/vocab', '/ielts/settings']
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

test('答案册和自己的答案一个框；题集库重做只补答案；错因进入复发率', async ({ page }) => {
  await page.goto('/ielts/reading')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByLabel('来源').fill('自编 Test 1 Passage 1')
  await page.getByLabel('题目', { exact: true }).fill('Questions 1-2\nWrite TRUE, FALSE or NOT GIVEN.\n1 The garden opened before 2020.\n2 The council paid for it.\nQuestions 3\nWrite ONE WORD ONLY.\n3 Volunteers meet every Saturday ______.')
  await page.getByLabel('答案', { exact: true }).fill('1 TRUE ✓\n2 FALSE 我选NG\n3 morning | mornings')
  await page.getByRole('button', { name: '识别并判题' }).click()
  await expect(page.getByText('对 1 · 错 2')).toBeVisible()
  await expect(page.getByText('规则判定：单复数')).toBeVisible()
  await page.getByLabel('第 2 题错因').selectOption('判断题规则混淆（FALSE 与 NOT GIVEN）')

  // 重做：从题集库载入，答案框只有答案册，系统停下来问“你当时写的是？”
  await page.goto('/ielts/reading')
  await page.getByLabel('题集库', { exact: true }).selectOption({ label: '自编 Test 1 Passage 1' })
  await page.getByRole('button', { name: '识别并判题' }).click()
  await expect(page.getByText('第 1、2、3 题只有答案册，你当时写的是？')).toBeVisible()
  await page.getByLabel('我的答案').fill('1 T 2 F 3 morning')
  await page.getByRole('button', { name: '识别并判题' }).click()
  await expect(page.getByText('对 3 · 错 0')).toBeVisible()

  await page.goto('/ielts/mistakes')
  await expect(page.getByRole('row', { name: /判断题规则混淆/ })).toContainText('0%')
  await expect(page.getByText('平行阅读法 · 执行趋势')).toBeVisible()
})

test('拼写听写：错过的拼写/单复数集中重写，按同一套规则判', async ({ page }) => {
  await page.goto('/ielts')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('irl-mistake-records', JSON.stringify({
      version: 2, migratedAt: 1, algorithmScores: {},
      records: [{ id: 'ielts:r:1', domain: 'ielts', module: 'listening', type: 'gap', source: '原创示例', questionSummary: 'x', userAnswer: 'slots', correctAnswer: 'slot', errorCause: '单复数', ruleCause: '单复数', createdAt: 1, metadata: {} }],
    }))
  })
  await page.goto('/ielts/dictation')
  await page.getByLabel('听写答案').fill('slots')
  await page.getByLabel('听写答案').press('Enter')
  await expect(page.getByText('应为：slot（单复数）')).toBeVisible()
  await page.getByLabel('听写答案').fill('slot')
  await page.getByRole('button', { name: '下一个' }).click()
  await page.getByLabel('听写答案').fill('slot')
  await page.getByLabel('听写答案').press('Enter')
  await expect(page.getByText('正确：slot')).toBeVisible()
})
