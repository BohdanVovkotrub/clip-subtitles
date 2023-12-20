const winston = require('winston');
const path = require('path');
const fs = require('fs');
const projectName = 'subtitle-app';
const logsDirectory = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDirectory)) {
  fs.mkdirSync(logsDirectory);
};
const logFileName = path.join(logsDirectory, `${projectName}.log`);

class Logger {
  constructor() {
    this.logger = winston.createLogger({
      level: 'silly',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(info => {
          const { timestamp, level, message } = info;
          const dt = new Date(timestamp);
          const year = (dt.getFullYear()).toString().padStart(2, '0');
          const month = (dt.getMonth() + 1).toString().padStart(2, '0');
          const day = (dt.getDate()).toString().padStart(2, '0');
          const currentHours = (dt.getHours()).toString().padStart(2, '0');
          const currentMin = (dt.getMinutes()).toString().padStart(2, '0');
          const currentSec = (dt.getSeconds()).toString().padStart(2, '0');
          const currentMSec = (dt.getMilliseconds()).toString().padStart(3, '0');
          return `${year}-${month}-${day}T${currentHours}:${currentMin}:${currentSec}.${currentMSec} [${level}]: ${message}`;
        })
      ),
      transports: [
        new winston.transports.File({
          filename: logFileName,
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          tailable: true,
          format: winston.format.combine(
            winston.format.uncolorize()
          )
        }),
        new winston.transports.Console()
      ]
    });

    this.overrideConsole();
  };

  overrideConsole() {
    console.log = message => this.logger.info(message);
    console.error = message => this.logger.error(message);
    console.warn = message => this.logger.warn(message);
    console.info = message => this.logger.info(message);
    console.debug = message => this.logger.debug(message);
  }
};


module.exports = new Logger();