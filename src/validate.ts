import { LogLevelEnum, Logger } from "./log";

<<<<<<< HEAD
=======
let cli = new Command()
let yamlDir = "./validate-yaml"

cli.version(SPECIFICATION_VERSION)
cli.usage("[--yaml <yaml-dir>]")
cli.option("-y, --yaml <yaml-dir>", "set directory for add on configuration")
cli.parse(process.argv)
let options = cli.opts()
if (options['yaml']){
    yamlDir = options['yaml']
   
}
ConfigSpecification.yamlDir = yamlDir
>>>>>>> 1611a76 (remove secret)

let log = new Logger("validate")
log.log(LogLevelEnum.notice,"DONE")