import { SPECIFICATION_VERSION } from '@modbus2mqtt/specification.shared'
import { LogLevelEnum, Logger } from './log'
import { Command } from 'commander'
import { ConfigSpecification } from './configspec'
import * as fs from 'fs'
import { M2mGithubValidate } from './m2mGithubValidate'
import path from 'path'
import { M2mSpecification } from './m2mspecification'
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GITHUB_TOKEN: string
      PR_NUMBER: string
    }
  }
}
let cli = new Command()
let yamlDir = './validate-yaml'
cli.version(SPECIFICATION_VERSION)
cli.usage('[--yaml <yaml-dir>] [--pr_number <pull request number>')
cli.option('-y, --yaml <yaml-dir>', 'set directory for add on configuration')
cli.option('-p, --pr_number <number>', 'set pull request number')
cli.parse(process.argv)
let pr_number:number| undefined
let options = cli.opts()
if (options['yaml']) {
  yamlDir = options['yaml']
}
else
  yamlDir = "validation_dir"

if (options['pr_number']) {
    pr_number = Number.parseInt(options['pr_number'])
}
ConfigSpecification.yamlDir = yamlDir

let log = new Logger('validate')

function logAndExit(e:any){
  let step = ""
  if( e.step)
    step =e.step
  log.log(LogLevelEnum.error, step + " " + e.message)
  process.exit(5)

}
if (!fs.existsSync(yamlDir)) fs.mkdirSync(yamlDir, { recursive: true })
// read gh token and pull request number from env
// download files
// validate
// merge pull request if validate is OK
// if not OK
//    close Pull request
// Owner:
// if contributed
// Find closed or merged Pull request by branch name branch name == filename
//  check closed pull request
//  if merged:
//     delete contributed directory
//  else
//     move contributed to local
//  delete branch
//  sync public directory
let gh = new M2mGithubValidate(process.env.GITHUB_TOKEN, yamlDir)
gh.init()
  .then((hasGhToken) => {
    if (process.env.PR_NUMBER && pr_number== undefined) {
      log.log(LogLevelEnum.error, 'No Pull Request Number passed to environment variable PR_NUMBER')
      process.exit(2)
    }
    if (!hasGhToken) {
      log.log(LogLevelEnum.error, 'No Github Access Token passed to environment variable GITHUB_TOKEN')
      process.exit(2)
    }
    log.log(LogLevelEnum.notice, "pull request: " + pr_number)
    
    if(pr_number== undefined && process.env.PR_NUMBER)
      pr_number = Number.parseInt(process.env.PR_NUMBER)
    gh.downloadPullRequest(pr_number!)
      .then((pr) => {
        let specname: string | undefined
        if (pr.files != undefined)
          pr.files.forEach((file) => {
            if (file.endsWith('.yaml') && -1 == file.indexOf('/files.yaml')) {
              specname = path.parse(file).name
              //'specname file exists ' + specname + '=' + file
            }
          })
        if (specname != undefined) {
          ConfigSpecification.yamlDir = yamlDir
          let s = new ConfigSpecification()
          s.readYaml()
          let fs = ConfigSpecification.getSpecificationByFilename(specname)
          if (fs) {
            let m2mSpec = new M2mSpecification(fs)
            let messages = m2mSpec.validate('en')
            if (messages.length == 0) {
              log.log(LogLevelEnum.notice, 'specification ' + specname + 'is valid')
              gh.addIssueComment(
                    pr_number!,
                    "**$${\\color{green}Validated\\space successfully}$$**\nSpecification '" +
                      specname +
                      "' has no issues"
                  )
                    .then(() => {
                      process.exit(0)
                    })
                    .catch((e) => {
                      logAndExit(e)
                    })
                .catch((e) => {
                  log.log(LogLevelEnum.error, 'Merge ' + pr_number + ' failed (' + e.status + ') ' + e.message)
                  log.log(LogLevelEnum.error, 'Request: ' + e.request.url)
                  logAndExit(e)
                })
            } else {
              let m: string = ''
              let errors = m2mSpec.messages2Text(messages)
              log.log(LogLevelEnum.error, 'specification is not valid ' + specname + 'Proceed manually')
              gh.addIssueComment(
                pr_number!,
                "**$${\\color{red}Proceed\\space manually}$$**\nSpecification '" + specname + "' is not valid.\n" + errors
              )
                .then((e) => {
                  logAndExit(e)
                })
                .catch((e) => {
                  logAndExit(e)
                })
            }
          } else log.log(LogLevelEnum.error, 'specification not found in yaml directory ' + specname)
        } else {
          gh.addIssueComment(
            pr_number!,
            "**$${\\color{red}Proceed\\space manually}$$**\nSpecification '" + specname + "' not found in pull request"
          )
            .then((e) => {
              logAndExit(e)
            })
            .catch((e) => {
              logAndExit(e)
            })
        }
      })
      .catch((e) => {
        logAndExit(e)
      })
  })
  .catch((e) => {
    logAndExit(e)
  })
