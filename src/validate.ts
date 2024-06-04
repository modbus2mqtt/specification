import { SPECIFICATION_VERSION } from "specification.shared";
import { LogLevelEnum, Logger } from "./log";
import { Command } from 'commander'
import { ConfigSpecification } from "./configspec";
import * as fs from 'fs';
import { M2mGithubValidate } from "./m2mGithubValidate";
import { join } from "path";
import path = require("path");
import { M2mSpecification } from "./m2mspecification";
declare global {
    namespace NodeJS {
        interface ProcessEnv {
            GITHUB_TOKEN: string;
            PR_NUMBER:string;
        }
    }
}
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

let log = new Logger("validate")
if( ! fs.existsSync(yamlDir))
    fs.mkdirSync(yamlDir,{recursive:true })
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
let gh = new M2mGithubValidate(process.env.GITHUB_TOKEN,join(yamlDir,"public"))
 gh.init().then(()=>{
    if(process.env.PR_NUMBER == undefined){
        log.log(LogLevelEnum.error, "No Pull Request Number passed to environment variable ")
        process.exit(2)
    }
    let pullNumber = Number.parseInt(process.env.PR_NUMBER)
    gh.getPullRequest(pullNumber).then( pr=>{
        let specname:string|undefined
        pr.files.forEach(file=>{
            if( file.endsWith(".yaml")&& -1 == file.indexOf("/files/")){
                specname = path.parse(file).name
            }
        })
        if( specname != undefined)
            {
                ConfigSpecification.yamlDir = yamlDir
                let s = new ConfigSpecification()
                s.readYaml()
                let fs = ConfigSpecification.getSpecificationByFilename(specname)
                if( fs){
                    let m2mSpec = new M2mSpecification(fs)
                    let messages = m2mSpec.validate("en")
                    if( messages.length == 0){
                        gh.mergePullRequest(pullNumber)
                        process.exit(0)
                    }else{
                        let m:string=""
                        messages.forEach(msg=>{
                        })
                        log.log(LogLevelEnum.error, "specification is not valid " + specname)
                        process.exit(3)
                    }
                }else log.log(LogLevelEnum.error, "specification not found in yaml directory " + specname)
                
            }else {
                gh.addIssueComment(pullNumber, "specification not found in pull request: Proceed manually " + specname).then(()=>{
                    process.exit(4)
                }).catch(e=>{log.log(LogLevelEnum.error, e.message); process.exit(5)}) 
            }
    }).catch(e=>{log.log(LogLevelEnum.error, e.message); process.exit(5)}) 
}).catch(e=>{log.log(LogLevelEnum.error, e.message); process.exit(5)}) 

