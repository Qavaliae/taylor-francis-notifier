import dotenv from 'dotenv'

dotenv.config()

const [user, password] = process.env.MAILER_AUTH?.split(':', 2) ?? []

export const config = {
  db: {
    uri: process.env.MONGODB_URI ?? '',
    name: process.env.MONGODB_NAME ?? 'editorial-manager',
  },
  mailer: {
    user,
    password,
  },
}
