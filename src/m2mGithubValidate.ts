import { Octokit } from "@octokit/rest"
import { LogLevelEnum, Logger } from "./log";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { basename, join } from "path";
import { Subject, first } from "rxjs";
import * as fs from 'fs';
import { M2mGitHub, githubPublicNames } from "./m2mgithub";
let path = require("path");

const debug = require('debug')('m2mgithubvalidate');
export interface IpullRequest {
    files?:string[],
    merged:boolean,
    closed:boolean,
    pullNumber:number

}
export class M2mGithubValidate extends M2mGitHub{
    private localDir:string;
    constructor(personalAccessToken: string, private yamlDir: string){
        super(personalAccessToken,join( yamlDir,"public" ))
        this.localDir =join( yamlDir,"local" )
    }
    private downloadFile(sha:string, filename:string):Promise<void>{
        return new Promise<void>((resolve, reject)=>{
            this.octokit.git.getBlob({
                owner: githubPublicNames.publicModbus2mqttOwner,
                repo: githubPublicNames.modbus2mqttRepo,
                file_sha: sha
            }).then( blob=>{
                try{
                       
                    let buffer = Buffer.from(blob.data.content,blob.data.encoding as BufferEncoding)
                    let options:fs.ObjectEncodingOptions = {encoding:blob.data.encoding as BufferEncoding}
                    let fullFilename = join(this.localDir,filename )
                    let dir = path.dirname(fullFilename);
                    fs.mkdirSync(dir, {recursive: true})
                    fs.writeFileSync( join(this.localDir,filename ),buffer,options)  
                    resolve()           
                }catch(e:any){
                    e.step = "writeFile"; reject(e)
                }
            }).catch((e)=>{ e.step = "getBlob"; reject(e)})
        })
    }
    downloadPullRequest(pullNumber:number):Promise<IpullRequest>{
    return new Promise<IpullRequest>((resolve, reject)=>{
        this.octokit.pulls.get({
            owner: githubPublicNames.publicModbus2mqttOwner,
            repo: githubPublicNames.modbus2mqttRepo,
            pull_number: pullNumber
        }).then( pull=>{
            debug("listFiles")
            this.octokit.pulls.listFiles({
                owner: githubPublicNames.publicModbus2mqttOwner,
                repo: githubPublicNames.modbus2mqttRepo,
                pull_number: pullNumber
            }).then(files=>{
                let f:string[] = []
                let filePromises:Promise<void>[] = []
                files.data.forEach(file=>{
                    f.push( file.filename )
                    filePromises.push(this.downloadFile(file.sha,file.filename))
                })
                Promise.all(filePromises).then(()=>{
                    debug("success")
                    let pr:IpullRequest    = {
                     merged: pull.data.merged,
                     closed: pull.data.closed_at != null,
                     pullNumber: pull.data.number,
                     files:  f          
                    }  
                    resolve(pr)              
                }).catch(e=>{ 
                    if( e.step == undefined) e.step="downloadFile"
                    debug( JSON.stringify(e))
                    reject(e)
                })
            }).catch(e=>{ 
                if( e.step == undefined) e.step="listFiles"
                debug( JSON.stringify(e))
                reject(e)
            })
        }).catch(e=>{ 
            if( e.step == undefined) e.step="getPull"
            debug( JSON.stringify(e))
            reject(e)
        })
    })
    }
    closePullRequest(pullNumber: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.octokit.pulls.update({
                owner: githubPublicNames.publicModbus2mqttOwner,
                repo: githubPublicNames.modbus2mqttRepo,
                pull_number: pullNumber,
                state: "closed"
            }).then((res) => {
                this.octokit.issues.update({
                    owner: githubPublicNames.publicModbus2mqttOwner,
                    repo: githubPublicNames.modbus2mqttRepo,
                    issue_number: parseInt(path.basename(res.data.issue_url)),
                    state: "closed"
                }).then(() => { resolve() }).catch(e => { e.step = "closeIssue"; reject(e) })
            }).catch(e => { e.step = "closePullRequest"; reject(e) })
        })
    }

    addIssueComment(pullNumber:number, text:string):Promise<void>{
        return new Promise<void>((resolve, reject)=>{
            this.octokit.issues.createComment({
                owner: githubPublicNames.publicModbus2mqttOwner,
                repo: githubPublicNames.modbus2mqttRepo,
                issue_number: pullNumber,
                body: text
            }).then(()=>{ resolve()}).catch(reject)
        })
    }

    override init():Promise<void>{
        return new Promise<void>((resolve, reject)=>{
            try{
                this.fetchPublicFiles()
            resolve();
            }catch(e){
                reject(e)
            }
            
        })
        
    }
    mergePullRequest(pullNumber:number, title?:string):Promise<void>{
        return new Promise<void>((resolve, reject) => {
            this.octokit.pulls.merge({
            owner: githubPublicNames.publicModbus2mqttOwner,
            repo: githubPublicNames.modbus2mqttRepo,
            pull_number: pullNumber,
            commit_title:title,
            merge_method:"squash"
        }).then((res) => {
            resolve()
        }).catch(e => { e.step = "mergePullRequest"; reject(e) })
    })
    }
}
