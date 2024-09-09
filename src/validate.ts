import { IbaseSpecification, Imessage, SPECIFICATION_VERSION } from '@modbus2mqtt/specification.shared'
import { LogLevelEnum, Logger } from './log'
import { Command } from 'commander'
import { ConfigSpecification } from './configspec'
import * as fs from 'fs'
import { M2mGithubValidate } from './m2mGithubValidate'
import path from 'path'
import { M2mSpecification } from './m2mspecification'
import { Octokit } from '@octokit/rest'
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
cli.option('-p, --pr_sha <sha>', 'sha of commit which triggered the pull request')
cli.option('-o, --pr_owner <sha>', 'Creator of the pull request')
cli.parse(process.argv)
let pr_sha: string | undefined
let pr_owner: string | undefined
let options = cli.opts()
if (options['yaml']) {
  yamlDir = options['yaml']
} else yamlDir = '.'

if (options['pr_sha']) {
  pr_sha = options['pr_sha']
}
if (options['pr_owner']) {
  pr_owner = options['pr_owner']
}

ConfigSpecification.yamlDir = yamlDir

let log = new Logger('validate')

function logAndExit(e: any) {
  let step = ''
  if (e.step) step = e.step
  log.log(LogLevelEnum.error, step + ' ' + e.message)
  process.exit(5)
}

function validate() {
  if (!fs.existsSync(yamlDir)) fs.mkdirSync(yamlDir, { recursive: true })

  if (pr_sha == undefined) {
    log.log(LogLevelEnum.error, 'No Pull Request sha passed in command line')
    process.exit(2)
  }
  if (pr_owner == undefined) {
    log.log(LogLevelEnum.error, 'No Pull Creator passed in command line')
    process.exit(2)
  }
  if (!process.env.GITHUB_TOKEN) {
    log.log(LogLevelEnum.error, 'No Github Access Token passed to environment variable GITHUB_TOKEN')
    process.exit(2)
  }
  log.log(LogLevelEnum.notice, 'pull request: ' + pr_sha)
  let gh = new M2mGithubValidate(process.env.GITHUB_TOKEN)
  gh.listPullRequestFiles(pr_owner, pr_sha)
    .then((data) => {
      let pr_number = data.pr_number
      ConfigSpecification.yamlDir = yamlDir
      let s = new ConfigSpecification()
      s.readYaml()
      let messages: Imessage[] = []
      let specnames: string = ''
      let lastSpec: IbaseSpecification | undefined
      data.files.forEach((fname) => {
        let specname = fname.substring('specifications/'.length)
        specnames = specnames + ', ' + specname
        let fs = ConfigSpecification.getSpecificationByFilename(specname)
        if (fs) {
          let m2mSpec = new M2mSpecification(fs)
          lastSpec = fs
          messages.concat(m2mSpec.validate('en'))
        }
      })
      if (specnames.length > 0) specnames = specnames.substring(2)
      else logAndExit(new Error('No specifications in pull request ' + pr_number))
      if (messages.length == 0) {
        log.log(LogLevelEnum.notice, 'specifications ' + specnames + ' are valid')
        gh.addIssueComment(
          pr_number!,
          "**$${\\color{green}\\space ' + specnames + '\\space validated\\space successfully}$$**\nSpecifications '" +
            specnames +
            "' have no issues"
        )
          .then(() => {
            log.log(LogLevelEnum.notice, 'Issue Comment added')
            process.exit(0)
          })
          .catch((e) => {
            logAndExit(e)
          })
      } else if (lastSpec) {
        let m: string = ''

        let errors = M2mSpecification.messages2Text(lastSpec, messages)
        log.log(LogLevelEnum.error, 'not all specifications of \\space ' + specnames + '\\space are valid\\space Proceed manually')
        gh.addIssueComment(
          pr_number!,
          "**$${\\color{red}Proceed\\space manually}$$**\nSpecification '" + specnames + "'\\space are not valid.\n" + errors
        )
          .then((e) => {
            logAndExit(e)
          })
          .catch((e) => {
            logAndExit(e)
          })
      } else {
        logAndExit(new Error('No specification found'))
      }
    })
    .catch((e) => {
      logAndExit(e)
    })
}
validate()
