import puppeteer, { Browser, Frame, KeyboardTypeOptions, Page } from 'puppeteer'
import { State, Store } from './types'

const Constants = {
  manuscriptNumber: 1,
  title: 2,
  statusDate: 4,
  currentStatus: 5,
}

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
    await tryLogin(page, store)
    await gotoEntry(page, store.tracker)
  })

  // Persist cookies

  await persistCookies(store, browser)

  // Fetch data

  const iframe = await navigateToContentIframe(page)
  const rows = await iframe.$$eval('#datatable tbody tr', (rows) => {
    return rows.map((row) => {
      const cells = row.querySelectorAll('td')
      return Array.from(cells).map((cell) => cell.textContent?.trim())
    })
  })

  // Close browser

  await browser.close()

  // Gather state

  const state: State = {
    ref: store.submissionId,
  }

  const match = rows.find((row) => row[Constants.manuscriptNumber] == state.ref)
  if (match !== undefined) {
    state.title = match[Constants.title]
    state.status = match[Constants.currentStatus]
    state.modified = match[Constants.statusDate]
  }

  return state
}

const gotoEntry = async (page: Page, entry: string, timeout?: number) => {
  await page.goto(entry, { waitUntil: 'networkidle2' })
  const iframe = await navigateToContentIframe(page)
  await iframe.waitForSelector('#datatable', { timeout })
}

const tryLogin = async (page: Page, { login, credentials }: Store) => {
  // Load login page

  await page.goto(login, { waitUntil: 'networkidle2' })
  const iframe = await navigateToContentIframe(page)
  await iframe.waitForSelector('#loginButtonsDiv')

  // Input and submit credentials

  const { username, password } = credentials
  const opts: KeyboardTypeOptions = { delay: 100 }

  await iframe.type('#userNamePasswordDiv #username', username, opts)
  await iframe.type('#userNamePasswordDiv #passwordTextbox', password, opts)

  await iframe.click('#loginButtonsDiv input[name="authorLogin"]')
  await page.waitForNavigation()
}

const navigateToContentIframe = async (page: Page): Promise<Frame> => {
  await page.waitForSelector('iframe[name=content]')
  let iframeElement = await page.$('iframe[name=content]')

  let iframe = await iframeElement?.contentFrame()
  if (!iframe) {
    throw Error('could not switch to content iframe')
  }

  return iframe
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
