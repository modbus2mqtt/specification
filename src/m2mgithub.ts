
import { Octokit } from "@octokit/rest"
import { LogLevelEnum, Logger } from "./log";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { Subject, first } from "rxjs";
import * as fs from 'fs';
let path = require("path");

const debug = require('debug')('m2mgithub');


const publicModbus2mqttOwner: string = "volkmarnissen"
const modbus2mqttRepo: string = "modbus2mqtt.config"
const modbus2mqttBranch: string = "main"
const log = new Logger("bus")
interface ITreeParam {
    path: string,
    mode: "100644",
    type: "blob",
    sha: string
}

export class M2mGitHub {

    private ownOwner: string | undefined;
    private octokit: Octokit;
    private static forking: boolean = false;
    private isRunning = false;
    private waitFinished: Subject<void> = new Subject<void>()
    private findOrCreateOwnModbus2MqttRepo(): Promise<void> {
        return new Promise((resolve, reject) => {
            debug("findOrCreateOwnModbus2MqttRepo")
            if (this.ownOwner)
                this.octokit.repos.listForUser({
                    username: this.ownOwner,
                    type: "all"
                }).then(repos => {
                    let found = repos.data.find(repo => { repo.name == modbus2mqttRepo })
                    if (found == null && !M2mGitHub.forking)
                        this.createOwnModbus2MqttRepo().then(resolve)
                    else {
                        if (found != null)
                            M2mGitHub.forking = false;
                        resolve()
                    }
                }).catch(reject)
        })
    }


    private createOwnModbus2MqttRepo(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            debug("createOwnModbus2MqttRepo")

            M2mGitHub.forking = true;
            if (publicModbus2mqttOwner)
                this.octokit.repos.createFork({
                    owner: publicModbus2mqttOwner,
                    repo: modbus2mqttRepo
                }).then(() => {
                    resolve()
                }).catch(reject)
        })
    }



    private checkRepo(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            if (this.ownOwner)
                this.octokit.repos.listForUser({
                    username: this.ownOwner,
                    type: "all"
                }).then(repos => {
                    let found = repos.data.find(repo => repo.name == modbus2mqttRepo)
                    if (found) {
                        debug("checkRepo: sync fork")
                        M2mGitHub.forking = false;
                        this.octokit.request(`POST /repos/${this.ownOwner}/${modbus2mqttRepo}/merge-upstream`, {
                            branch: modbus2mqttBranch
                        }).then((_r) => {
                            resolve(true)
                        }).catch(reject)
                    }
                })
            else
                resolve(false)
        })
    }
    private waitForOwnModbus2MqttRepo(): Promise<void> {
        if (this.isRunning) {
            // some other process is waiting already.
            // Just wait until it's done
            return new Promise<void>((resolve) => {
                this.waitFinished.pipe(first()).subscribe(() => { resolve() })
            })
        }
        else {
            return new Promise<void>((resolve, _reject) => {
                let count = 0

                // Once per second for 30 seconds, then once per minute 
                let interval = setInterval(() => {
                    debug("inInterval")
                    if (!this.isRunning && (count > 30 ? Math.floor(count % 60) == 0 : true)) {
                        this.isRunning = true
                        this.checkRepo().then((available) => {
                            if (available) {
                                this.isRunning = false
                                this.waitFinished.next()
                                clearInterval(interval)
                                resolve()
                            }
                        }).catch((e) => { this.isRunning = false; debug("checkRepo failed: " + e.status); this.waitFinished.next() })
                    }
                    count++;

                }, 1000)
            })

        }

    }

    constructor(personalAccessToken: string, private publicRoot: string) {
        this.octokit = new Octokit({
            auth: personalAccessToken,
        })
    }
    private fetchPublicFiles(): void {
        if (existsSync(join(this.publicRoot, ".git")))
            log.log(LogLevelEnum.notice, execSync("git fetch", { cwd: this.publicRoot }))
        else
            log.log(LogLevelEnum.notice, execSync("git clone https://github.com/" + publicModbus2mqttOwner + "/" + modbus2mqttRepo + ".git " + this.publicRoot))
    }
    createPullrequest(title: string, content: string): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            this.octokit.issues.create({
                owner: publicModbus2mqttOwner,
                repo: modbus2mqttRepo,
                title: title,
                body: content
            }).then(res => {
                this.octokit.pulls.create({
                    owner: publicModbus2mqttOwner,
                    body: content + "\nCloses #" + res.data.number,
                    repo: modbus2mqttRepo,
                    issue: res.data.number,
                    head: this.ownOwner + ":" + modbus2mqttBranch,
                    base: modbus2mqttBranch
                }).then(res => {
                    resolve(res.data.id)
                }).catch((e) => {
                    e.step = "create pull"
                    reject(e)
                })

            }).catch((e) => {
                e.step = "create issue"
                reject(e)
            })
        })
    }
    closePullRequest(pullNumber: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.octokit.pulls.update({
                owner: publicModbus2mqttOwner,
                repo: modbus2mqttRepo,
                pull_number: pullNumber,
                state: "closed"
            }).then((res) => {
                this.octokit.issues.update({
                    owner: publicModbus2mqttOwner,
                    repo: modbus2mqttRepo,
                    issue_number: parseInt(path.basename(res.data.issue_url)),
                    state: "closed"
                }).then(() => { resolve() }).catch(e => { e.step = "closeIssue"; reject(e) })
            }).catch(e => { e.step = "closePullRequest"; reject(e) })
        })
    }

    getInfoFromError(e: any) {
        let msg = JSON.stringify(e)
        if (e.message)
            msg = "ERROR: " + e.message
        if (e.status)
            msg += " status: " + e.status
        if (e.step)
            msg += " in " + e.step
        return msg;
    }

    private uploadFileAndCreateTreeParameter(root: string, filename: string): Promise<ITreeParam> {
        return new Promise<ITreeParam>((resolve, reject) => {
            debug("uploadFileAndCreateTreeParameter")
            let encoding: BufferEncoding = filename.endsWith(".yaml") ? "utf8" : "base64"
            let params = {
                owner: this.ownOwner!,
                repo: modbus2mqttRepo,
                encoding: encoding == "utf8" ? "utf-8" : encoding,
                content: fs.readFileSync(join(root, filename)).toString(encoding)
            }
            this.octokit.git.createBlob(params).then((res => {
                resolve({
                    path: filename,
                    mode: '100644',
                    type: 'blob',
                    sha: res.data.sha
                })
            })).catch((e) => {
                e.step = "createBlob"
                reject(e)
            })
        })
    }
    init(): Promise<void> {

        // checks if fork from public repository is available
        // Otherwise it creates it, but doesn't wait for creation
        // fetches all files from public repo (Works also if no personal repo is available yet)
        return new Promise<void>((resolve, reject) => {
            debug("init")
            try {
                this.fetchPublicFiles()
            } catch (e) {
                reject(e)
            }
            if (!this.ownOwner) {
                this.octokit.users.getAuthenticated().then(user => {
                    this.ownOwner = user.data.login
                    this.findOrCreateOwnModbus2MqttRepo().then(resolve).catch((e) => {
                        this.ownOwner = undefined;
                        reject(e)
                    })
                }).catch(reject)
            }
        })
    }
    deleteRepository(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.ownOwner)
                this.octokit.repos.delete({
                    owner: this.ownOwner,
                    repo: modbus2mqttRepo
                }).then(() => { resolve() }).catch(reject)
        })
    }

    commitFiles(root: string, files: string[], title: string, message: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.waitForOwnModbus2MqttRepo().then(() => {
                debug("start committing")
                let all: Promise<ITreeParam>[] = []
                files.forEach(file => {
                    all.push(this.uploadFileAndCreateTreeParameter(root, file))
                })
                Promise.all(all).then(trees => {
                    debug("getBranch")
                    this.octokit.repos.getBranch({
                        owner: this.ownOwner!,
                        repo: modbus2mqttRepo,
                        branch: modbus2mqttBranch
                    }).then(branch => {
                        this.octokit.request(`GET /repos/${this.ownOwner}/${modbus2mqttRepo}/git/trees/${modbus2mqttBranch}`).then(tree => {
                            debug("createTree")
                            this.octokit.git.createTree({
                                owner: this.ownOwner!,
                                repo: modbus2mqttRepo,
                                tree: trees,
                                base_tree: tree.data.sha
                            }).then((result) => {
                                debug("createCommit")
                                this.octokit.git.createCommit({
                                    owner: this.ownOwner!,
                                    repo: modbus2mqttRepo,
                                    message: title + "\n" + message,
                                    tree: result.data.sha,
                                    parents: [branch.data.commit.sha]
                                }).then((_result) => {
                                    debug("updateRef");
                                    this.octokit.git.updateRef({
                                        owner: this.ownOwner!,
                                        repo: modbus2mqttRepo,
                                        ref: "heads/" + modbus2mqttBranch,
                                        sha: _result.data.sha
                                    }).then(() => {
                                        debug("updated"); resolve()
                                    }).catch((e) => {
                                        e.step = "updateRef"
                                        reject(e)
                                    })
                                }).catch((e) => {
                                    e.step = "createCommit"
                                    reject(e)
                                })
                            }).catch((e) => {
                                e.step = "createTree"
                                reject(e)
                            })
                        }).catch((e) => {
                            e.step = "get base tree"
                            reject(e)
                        })
                    })
                }).catch((e) => {
                    e.step = "get branch"
                    reject(e)
                })
            }).catch((e) => {
                e.step = "waitForOwnModbus2MqttRepo"
                reject(e)
            })
        })
        // commits the given files with message to own repository
        // creates an issue in the public repository
        // creates a pull request to the public repository
        // If there is already a pull request, the new request will be appended

    }
}