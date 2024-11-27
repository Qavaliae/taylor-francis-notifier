import lodash from 'lodash'
import { Db, MongoClient } from 'mongodb'
import { config } from './config'
import { crawl } from './crawl'
import { notify } from './notify'
import { State, Store } from './types'

const client = new MongoClient(config.db.uri)

//--------------------------------------------------------------
// Program entry
//--------------------------------------------------------------

const main = async () => {
  // Establish connection
  await client.connect()
  const db = client.db(config.db.name)

  // Retrieve enabled stores
  const stores = await retrieveStores(db)

  // Process stores
  for (const store of stores) {
    await processStore(store).catch(() => {
      process.exitCode = 1
      console.error(`${store._id}: error processing store`)
    })

    await persistStore(db, store).catch(() => {
      process.exitCode = 1
      console.error(`${store._id}: error persisting store`)
    })
  }
}

// Run processing logic for a specific store
const processStore = async (store: Store): Promise<void> => {
  // Retrieve current state
  const state = await optimisticCrawl(store, 10)

  // If state was updated, notify and persist store with new state
  if (!lodash.isEqual(state, store.state)) {
    console.log(`${store._id}: detected an update to state`)

    store.state = state
    await notify(store)
  } else {
    console.log(`${store._id}: state was not updated`)
  }
}

// Crawl state with retries
const optimisticCrawl = async (
  store: Store,
  maxRetries: number = 3,
  retry: number = 0,
): Promise<State> => {
  console.log(`${store._id}: crawling state...${retry > 0 ? ' (retry)' : ''}`)
  return await crawl(store).catch(async (e) => {
    if (retry == maxRetries - 1) {
      throw e
    }

    return await optimisticCrawl(store, maxRetries, retry + 1)
  })
}

// Retrieve enabled stores in their current states
const retrieveStores = async (db: Db): Promise<Store[]> => {
  const stores = await db.collection('stores').find({ enabled: true }).toArray()
  return stores as Store[]
}

// Persist store
const persistStore = async (db: Db, store: Store) => {
  await db.collection('stores').updateOne({ _id: store._id }, { $set: store })
}

//--------------------------------------------------------------
// Configure program timeout
//--------------------------------------------------------------

setTimeout(() => {
  console.error(`program timed out`)
  process.exit(1)
}, 90e3)

//--------------------------------------------------------------
// Run program
//--------------------------------------------------------------

main().finally(() => {
  // Close database connection
  client.close()

  // Bypass timeout and potentially pending subprocesses
  process.exit()
})
