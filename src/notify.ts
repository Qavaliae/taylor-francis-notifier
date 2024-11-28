import axios from 'axios'
import { config } from './config'
import { Listener, State, Store } from './types'
import { mailer } from './utils/mailer'

export const notify = async (store: Store) => {
  if (!store.state) {
    throw new Error(`${store._id}: cannot notify falsy state`)
  }

  const message = composeMessage(store.state)

  for (const listener of store.listeners.filter((e) => e.enabled)) {
    switch (listener.channel) {
      case 'telegram':
        const { bot, chatId } = listener
        const url = `https://api.telegram.org/${bot}/sendMessage`

        await axios.post(url, {
          chat_id: chatId,
          text: message,
        })

        console.log(`${store._id}: notified via telegram`)
        break

      case 'mail':
        const { email } = listener

        await mailer
          .sendMail({
            from: {
              name: 'Taylor & Francis',
              address: config.mailer.user,
            },
            to: email,
            subject: 'Notification',
            text: message,
          })
          .catch(() => {})

        console.log(`${store._id}: notified via email`)
        break

      default:
        console.error(`${store._id}: unsupported channel`)
        break
    }
  }
}

export const notifyTelegram = async (
  listeners: Listener[],
  message: string,
) => {
  const listener = listeners
    .filter((e) => e.enabled)
    .find((e) => e.channel == 'telegram')

  if (!listener) {
    throw Error('Could not find any telegram listener')
  }

  const { bot, chatId } = listener
  const url = `https://api.telegram.org/${bot}/sendMessage`

  await axios.post(url, {
    chat_id: chatId,
    text: message,
  })
}

export const composeMessage = (state: State): string => {
  return (
    `Ref: ${state.ref}\n\n` +
    `${state.title}\n\n` +
    `➶ ${state.status ?? 'N/A'}\n` +
    `➶ ${state.modified ?? 'N/A'}`
  )
}
