import * as log from 'npmlog';
export enum LogLevelEnum {
    verbose = "verbose",
    timing = "timing",
    http = "http",
    notice = "notice",
    warn = "warn",
    error = "error"
}
/*
 * Logger is a gateway to npmlog.
 * It is a workaround to log in jest test environment by forwarding the log to console.log
 * In productive mode, npmlog is called directly.
 * Logger makes it easy to set a source file specific prefix.
 */
export class Logger {
    static isInitialized = false;

    constructor(private prefix: string) { }

    public static logLevel: LogLevelEnum = LogLevelEnum.notice;
    log(level: LogLevelEnum, message: any, ...args: any[]) {
        if (!Logger.isInitialized) {
            Logger.init()
        }
        log.log(level, this.prefix, message, ...args)
    }
    private static init(): void {
        Logger.isInitialized = true
        //log.level = Logger.logLevel
        if (process.env['JEST_WORKER_ID'] !== undefined) {
            log.on("log", Logger.forwardToConsole)
        }
        else {
            Object.defineProperty(log, 'heading', {
                get: () => {
                    var d = new Date()
                    return d.toLocaleDateString() + " " + d.toLocaleTimeString()
                }
            })
            //  log.headingStyle = { bg: '', fg: 'white' }
        }


    }
    private static forwardToConsole(message: any) {
        console.log(message.level + " " + message.prefix + ": " + message.message)
    }
}