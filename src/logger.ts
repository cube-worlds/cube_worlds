import process from 'node:process'
import { config as realConfig } from '#root/config'
import { pino } from 'pino'

const config =
  process.env.NODE_ENV === 'test'
    ? ({
        LOG_LEVEL: 'silent',
        isDev: true,
      } as const)
    : realConfig

export const loggerOptions = {
  level: config.LOG_LEVEL,
  transport: {
    targets: [
      ...(config.isDev
        ? [
            {
              target: 'pino-pretty',
              level: config.LOG_LEVEL,
              options: {
                ignore: 'pid,hostname',
                colorize: true,
                translateTime: true,
              },
            },
          ]
        : [
            {
              target: 'pino/file',
              level: config.LOG_LEVEL,
              options: {},
            },
          ]),
    ],
  },
}

export const logger = pino(loggerOptions)

export type Logger = typeof logger
