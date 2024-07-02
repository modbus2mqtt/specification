import Debug from "debug"
import { M2mGitHub } from "../src/m2mgithub";
import { yamlDir } from "./configsbase";
import { join } from "path";
import { ConfigSpecification } from '../src/configspec';
import { beforeAll } from '@jest/globals';


const debug = Debug("m2mgithub");

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            GITHUB_TOKEN: string;
        }
    }
}

Debug.enable('m2mgithub')
ConfigSpecification['yamlDir'] = yamlDir;
ConfigSpecification.setMqttdiscoverylanguage("en", process.env.GITHUB_TOKEN)
beforeAll(() => {
    ConfigSpecification['yamlDir'] = yamlDir;
    new ConfigSpecification().readYaml();
    M2mGitHub.prototype["createOwnModbus2MqttRepo"]
});
function testWait(github: M2mGitHub, done: any) {
    github.init().then((hasGhToken) => {
        expect(hasGhToken).toBeTruthy()
        let title = "Test"
        let content = "Some Text"
        github.deleteSpecBranch("waterleveltransmitter").then(() => {
            github.commitFiles(yamlDir + "/public", "waterleveltransmitter",
                ["specifications/waterleveltransmitter.yaml",
                    "specifications/files/waterleveltransmitter/files.yaml",
                    "specifications/files/waterleveltransmitter/IMG_1198.jpg"], title, content).then((_sha) => {
                        debug("Commit created successfully")
                        github.createPullrequest(title, content, "waterleveltransmitter").then(() => {
                            done()
                        }).catch((e) => {
                            debug(github.getInfoFromError(e))
                        })
                    }).catch((e) => {

                        debug(github.getInfoFromError(e))
                    })
        }).catch(e => {
            debug(github.getInfoFromError(e))
        })
    })
}
it('init with no github token', done => {
    let github = new M2mGitHub(null, join(yamlDir, "publictest"))
    github['ownOwner'] = "modbus2mqtt"
    github.init().then((hasGhToken) => {
        expect(hasGhToken).toBeFalsy()
        done()
    }).
        catch(() => {
            expect(false).toBeTruthy()
        })


})

it('init', done => {

    let github = new M2mGitHub(process.env.GITHUB_TOKEN, join(yamlDir, "publictest"))
    github['ownOwner'] = "modbus2mqtt"
    testWait(github, done)
    // github.deleteRepository().then(() => {
    //     testWait(github, done)
    // }).catch(e => {
    //     testWait(github, done)
    // })
}, 10000)


