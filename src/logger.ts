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

export interface LoggerConfig {
  LOG_LEVEL: string
  isDev: boolean
}

export function buildLoggerOptions(cfg: LoggerConfig) {
  return {
    level: cfg.LOG_LEVEL,
    transport: {
      targets: [
        ...(cfg.isDev
          ? [
              {
                target: 'pino-pretty',
                level: cfg.LOG_LEVEL,
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
                level: cfg.LOG_LEVEL,
                options: {},
              },
            ]),
      ],
    },
  }
}

export const loggerOptions = buildLoggerOptions(config)

export const logger = pino(loggerOptions)

export type Logger = typeof logger
