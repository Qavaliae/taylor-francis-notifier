import { ObjectId } from 'mongodb'

export interface Store {
  _id: ObjectId
  enabled: boolean
  tracker: string
  login: string
  submissionId: string
  cookies: any
  state?: State
  listeners: Listener[]
  credentials: Credentials
}

export interface Credentials {
  username: string
  password: string
}

export type Listener = TelegramListener | MailListener

export interface BaseListener {
  channel: string
  enabled: boolean
}

export interface TelegramListener extends BaseListener {
  channel: 'telegram'
  bot: string
  chatId: string
}

export interface MailListener extends BaseListener {
  channel: 'mail'
  email: string
}

export interface State {
  ref: string
  title?: string
  status?: string
  modified?: string
}
