import { config } from '#root/config'
import { pino } from 'pino'

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
