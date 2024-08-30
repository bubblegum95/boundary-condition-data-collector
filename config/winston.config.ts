import * as winston from 'winston';
import 'winston-daily-rotate-file';
import * as path from 'path';

export const winstonConfig = winston.createLogger({
  format: winston.format.combine(
    winston.format.label({ label: 'BOUNDARY CONDITION' }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ level, message, label, timestamp }) => {
      return `${timestamp} [${label}] ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      level: 'silly',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, label, timestamp }) => {
          return `${timestamp} [${label}] ${level}: ${message}`;
        })
      ),
    }),
    new winston.transports.DailyRotateFile({
      level: 'error',
      filename: 'error-%DATE%.log',
      dirname: path.join(process.cwd(), 'logs/error'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '3d',
    }),
    new winston.transports.DailyRotateFile({
      level: 'warn',
      filename: 'warn-%DATE%.log',
      dirname: path.join(process.cwd(), 'logs/warn'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '3d',
    }),
    new winston.transports.DailyRotateFile({
      level: 'info',
      filename: 'info-%DATE%.log',
      dirname: path.join(process.cwd(), 'logs/info'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '3d',
    }),
    new winston.transports.DailyRotateFile({
      level: 'http',
      filename: 'http-%DATE%.log',
      dirname: path.join(process.cwd(), 'logs/http'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '3d',
    }),
    new winston.transports.DailyRotateFile({
      level: 'verbose',
      filename: 'verbose-%DATE%.log',
      dirname: path.join(process.cwd(), 'logs/verbose'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxFiles: '3d',
    }),
    new winston.transports.DailyRotateFile({
      level: 'debug',
      filename: 'debug-%DATE%.log',
      dirname: path.join(process.cwd(), 'logs/debug'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '3d',
    }),
    new winston.transports.DailyRotateFile({
      level: 'silly',
      filename: 'silly-%DATE%.log',
      dirname: path.join(process.cwd(), 'logs/silly'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '3d',
    }),
  ],
});
