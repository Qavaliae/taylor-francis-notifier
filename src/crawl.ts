import { notifyTelegram } from './notify'
import { State, Store } from './types'

import puppeteer, {
  Browser,
  ElementHandle,
  KeyboardTypeOptions,
  Page,
} from 'puppeteer'

/**
 * Retrieve current state
 */
export const crawl = async (store: Store): Promise<State> => {
  // Launch the browser and open a new blank page

  const browser = await puppeteer.launch()
  const [page] = await browser.pages()
  await configureTimeout(browser)

  // Restore cookies

  await loadCookies(store, browser)

  // Go to entry

  await gotoEntry(page, store.tracker, 5e3).catch(async () => {
    console.log(`${store._id}: login required (?)`)
    notifyTelegram(store.listeners, `${store._id}: login required (?)`)

    await tryLogin(await browser.newPage(), store)
    await gotoEntry(page, store.tracker)
  })

  // Persist cookies

  await persistCookies(store, browser)

  // Fetch data

  const submissions = await page.$$('.submission-list-item')
  const matchingSubmission = submissions.find(async (submission) => {
    const submissionId = await read(submission, '.detail.submission-id span')
    return submissionId == store.submissionId
  })

  // Gather state

  if (await matchingSubmission?.$('.notch-down')) {
    const toggler = await matchingSubmission?.$('.toggle-indicator')
    await toggler?.click()
    await matchingSubmission?.waitForSelector('.notch-up')
  }

  const state: State = {
    ref: store.submissionId,
    title: await read(matchingSubmission, '.detail.title div'),
    status: await read(matchingSubmission, '.detail.status span'),
    modified: await read(
      matchingSubmission,
      '.submission-stage .current-status .date',
    ),
  }

  // Close browser

  await browser.close()

  return state
}

const read = async (
  elt: ElementHandle | undefined,
  selector: string,
): Promise<string | undefined> => {
  const content = elt?.$eval(selector, (el) => el.textContent?.trim())
  return (await content) ?? undefined
}

const gotoEntry = async (page: Page, entry: string, timeout?: number) => {
  await page.bringToFront()
  await page.goto(entry, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.submission-list', { timeout })
}

const tryLogin = async (page: Page, { login, credentials }: Store) => {
  // Load login page

  await page.bringToFront()
  await page.goto(login, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.login-inner-wrapper')

  // Input and submit credentials

  const { username, password } = credentials
  const opts: KeyboardTypeOptions = { delay: 100 }

  await page.type('.login-inner-wrapper #inputEmail', username, opts)
  await page.type('.login-inner-wrapper #inputPassword', password, opts)

  await page.click('.login-inner-wrapper #loginBtn')
  await page.waitForNavigation()
}

const configureTimeout = async (browser: Browser) => {
  for (const page of await browser.pages()) {
    page.setDefaultTimeout(20e3)
  }
}

const loadCookies = async (store: Store, browser: Browser) => {
  if (!Array.isArray(store.cookies)) {
    return
  }

  console.log(`${store._id}: loading cookies...`)

  for (const page of await browser.pages()) {
    await page.setCookie(...store.cookies)
  }

  console.log(`${store._id}: loaded cookies`)
}

const persistCookies = async (store: Store, browser: Browser) => {
  let cookies = []

  for (const page of await browser.pages()) {
    cookies.push(...(await page.cookies()))
  }

  store.cookies = cookies
}
