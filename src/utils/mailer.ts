import nodemailer from 'nodemailer'
import { config } from '../config'

export const mailer = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: config.mailer.user,
    pass: config.mailer.password,
  },
})
