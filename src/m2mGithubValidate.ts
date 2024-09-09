import { join } from 'path'
import * as fs from 'fs'
import { M2mGitHub, githubPublicNames } from './m2mgithub'
import { Octokit } from '@octokit/rest'
let path = require('path')

const debug = require('debug')('m2mgithubvalidate')
export interface IpullRequest {
  files?: string[]
  merged: boolean
  closed: boolean
  pullNumber: number
}
export class M2mGithubValidate {
  private localDir: string
  private octokit: Octokit | null
  constructor(personalAccessToken: string | null) {
    this.octokit = null
    if (personalAccessToken)
      this.octokit = new Octokit({
        auth: personalAccessToken,
      })
  }
  private downloadFile(sha: string, filename: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.octokit!.git.getBlob({
        owner: githubPublicNames.publicModbus2mqttOwner,
        repo: githubPublicNames.modbus2mqttRepo,
        file_sha: sha,
      })
        .then((blob) => {
          try {
            let buffer = Buffer.from(blob.data.content, blob.data.encoding as BufferEncoding)
            let options: fs.ObjectEncodingOptions = { encoding: blob.data.encoding as BufferEncoding }
            let fullFilename = join(this.localDir, filename)
            let dir = path.dirname(fullFilename)
            fs.mkdirSync(dir, { recursive: true })
            fs.writeFileSync(join(this.localDir, filename), buffer, options)
            resolve()
          } catch (e: any) {
            e.step = 'writeFile'
            reject(e)
          }
        })
        .catch((e) => {
          e.step = 'getBlob'
          reject(e)
        })
    })
  }

  listPullRequestFiles(owner: string, sha: string): Promise<{ pr_number: number; files: string[] }> {
    return new Promise<{ pr_number: number; files: string[] }>((resolve, reject) => {
      this.octokit!.rest.repos.listPullRequestsAssociatedWithCommit({
        owner: owner,
        repo: githubPublicNames.modbus2mqttRepo,
        commit_sha: sha,
      })
        .then((data: any) => {
          if (data.data.length <= 0) {
            reject(new Error('No Pull request for for sha ' + sha))
            return
          }
          this.octokit!.pulls.listFiles({
            owner: githubPublicNames.publicModbus2mqttOwner,
            repo: githubPublicNames.modbus2mqttRepo,
            pull_number: data.data[0].number,
          })
            .then((files) => {
              let f: string[] = []
              files.data.forEach((file) => {
                if (['added', 'modified', 'renamed', 'copied', 'changed'].includes(file.status)) f.push(file.filename)
              })
              resolve({ pr_number: data.data[0].number, files: f })
            })
            .catch(reject)
        })
        .catch(reject)
    })
  }
  closePullRequest(pullNumber: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.octokit!.pulls.update({
        owner: githubPublicNames.publicModbus2mqttOwner,
        repo: githubPublicNames.modbus2mqttRepo,
        pull_number: pullNumber,
        state: 'closed',
      })
        .then((res) => {
          this.octokit!.issues.update({
            owner: githubPublicNames.publicModbus2mqttOwner,
            repo: githubPublicNames.modbus2mqttRepo,
            issue_number: parseInt(path.basename(res.data.issue_url)),
            state: 'closed',
          })
            .then(() => {
              resolve()
            })
            .catch((e) => {
              e.step = 'closeIssue'
              reject(e)
            })
        })
        .catch((e) => {
          e.step = 'closePullRequest'
          reject(e)
        })
    })
  }

  addIssueComment(pullNumber: number, text: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.octokit!.issues.createComment({
        owner: githubPublicNames.publicModbus2mqttOwner,
        repo: githubPublicNames.modbus2mqttRepo,
        issue_number: pullNumber,
        body: text,
      })
        .then(() => {
          resolve()
        })
        .catch((e) => {
          e.step = 'addIssueComment'
          reject(e)
        })
    })
  }

  mergePullRequest(pullNumber: number, title?: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.octokit!.pulls.merge({
        owner: githubPublicNames.publicModbus2mqttOwner,
        repo: githubPublicNames.modbus2mqttRepo,
        pull_number: pullNumber,
        commit_title: title,
        merge_method: 'squash',
      })
        .then(() => {
          resolve()
        })
        .catch((e) => {
          e.step = 'mergePullRequest'
          reject(e)
        })
    })
  }
}
