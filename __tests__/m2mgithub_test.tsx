import Debug from "debug"
import { M2mGitHub } from "../src/m2mgithub";
import { yamlDir } from "./configsbase";
import { join } from "path";
import { ConfigSpecification } from '../src/configspec';


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
beforeAll(() => {
    ConfigSpecification['yamlDir'] = yamlDir;
    new ConfigSpecification().readYaml();
    M2mGitHub.prototype["createOwnModbus2MqttRepo"]
});
function testWait(github: M2mGitHub, done: any) {
    github.init().then(() => {
        let title = "Test"
        let content = "Some Text"
        github.commitFiles(yamlDir + "/public", ["specifications/waterleveltransmitter.yaml"], title, content).then(() => {
            debug("Commit created successfully")
            github.createPullrequest(title, content).then(done).catch((e) => {
                debug(github.getInfoFromError(e))
            })
        }).catch((e) => {

            debug(github.getInfoFromError(e))
        })
    }).catch(e => {
        debug(e.message)
    })

}

xit('init', done => {
    expect(process.env.GITHUB_TOKEN).toBeDefined()
    let github = new M2mGitHub(process.env.GITHUB_TOKEN, join(yamlDir, "publictest"))
    github['ownOwner'] = "modbus2mqtt"
    github.deleteRepository().then(() => {
        testWait(github, done)
    }).catch(e => {
        testWait(github, done)
    })
})