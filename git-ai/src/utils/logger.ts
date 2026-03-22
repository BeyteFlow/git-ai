import pino from 'pino';

const validLogLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
type LogLevel = (typeof validLogLevels)[number];

const envLogLevel = (process.env.LOG_LEVEL ?? '').trim().toLowerCase();
const level: LogLevel = (validLogLevels as readonly string[]).includes(envLogLevel)
  ? (envLogLevel as LogLevel)
  : 'info';

export const logger = pino({
  level,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
    },
  },
});