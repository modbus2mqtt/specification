import Debug from 'debug'
import { M2mGithubValidate } from '../src/m2mGithubValidate'
import { ConfigSpecification } from '../src/configspec'
import { it, expect, beforeAll, afterAll } from '@jest/globals'
import * as fs from 'fs'
const debug = Debug('m2mgithubvalidate')

let yamlDir = '__tests__/yamlDirValidate'
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GITHUB_TOKEN: string
      GITHUB_TOKEN_PARENT: string
    }
  }
}

Debug.enable('m2mgithubvalidate')
ConfigSpecification['yamlDir'] = yamlDir
beforeAll(() => {
  fs.rmSync(yamlDir, { recursive: true, force: true })
  fs.mkdirSync(yamlDir)
})
afterAll(() => {
  fs.rmSync(yamlDir, { recursive: true, force: true })
})
function testWait(github: M2mGithubValidate, done: any) {
  github
    .init()
    .then(() => {
      let title = 'Test'
      let content = 'Some Text'
      github
        .downloadPullRequest(49)
        .then((pull) => {
          debug('Commit created successfully')
          done()
        })
        .catch((e) => {
          debug(github.getInfoFromError(e))
        })
    })
    .catch((e) => {
      debug(e.message)
    })
}

it.skip('validate test requires GITHUB_TOKEN', (done) => {
  expect(process.env.GITHUB_TOKEN).toBeDefined()
  let github = new M2mGithubValidate(process.env.GITHUB_TOKEN as string, '__tests__/yamlDirValidate')

  testWait(github, done)
}, 10000)
