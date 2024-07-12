import { FileLocation, ImodbusEntity, Itext, MessageTypes, ModbusRegisterType, SPECIFICATION_VERSION, SpecificationFileUsage, SpecificationStatus } from '@modbus2mqtt/specification.shared';
import { ConfigSpecification } from '../src/configspec';
import { ImodbusValues, M2mSpecification, emptyModbusValues } from '../src/m2mspecification';
import { Converters, IdentifiedStates } from '@modbus2mqtt/specification.shared';
import * as fs from 'fs'
import { yamlDir } from './configsbase';
import { Mutex } from 'async-mutex'
import { IfileSpecification } from '../src/ifilespecification';
import { it, expect, beforeAll, describe, afterAll } from '@jest/globals';
import { IpullRequest } from '../src/m2mGithubValidate';
declare global {
    namespace NodeJS {
        interface ProcessEnv {
            GITHUB_TOKEN: string;
        }
    }
}
let singleMutex = new Mutex()
ConfigSpecification.setMqttdiscoverylanguage("en", process.env.GITHUB_TOKEN)
ConfigSpecification['yamlDir'] = yamlDir;

beforeAll(() => {

    new ConfigSpecification().readYaml()
})
var entText: ImodbusEntity = {
    id: 2, mqttname: "mqtt",
    modbusAddress: 5,
    registerType: ModbusRegisterType.HoldingRegister,
    readonly: true,
    modbusValue: [65 << 8 | 66, 67 << 8 | 68], mqttValue: "", identified: IdentifiedStates.unknown,
    converterParameters: { stringlength: 10 },
    converter: { name: "text", registerTypes: [] }
};

let spec: IfileSpecification = {
    "entities": [
        {
            "id": 1, mqttname: "mqtt",
            "converter": { name: "number" as Converters, registerTypes: [] }, "modbusAddress": 3, registerType: ModbusRegisterType.HoldingRegister, readonly: true, "icon": "", "converterParameters": { "multiplier": 0.1, "offset": 0, "uom": "cm", "identification": { "min": 0, "max": 200 } }
        },
        { id: 2, mqttname: "mqtt2", "converter": { name: "select" as Converters, registerTypes: [] }, "modbusAddress": 4, registerType: ModbusRegisterType.HoldingRegister, readonly: true, "icon": "", "converterParameters": { "optionModbusValues": [1, 2, 3] } },
        { id: 3, mqttname: "mqtt3", "converter": { name: "select" as Converters, registerTypes: [] }, "modbusAddress": 5, registerType: ModbusRegisterType.HoldingRegister, readonly: false, "icon": "", "converterParameters": { "optionModbusValues": [0, 1, 2, 3] } }],
    "status": 2, "manufacturer": "unknown", "model": "QDY30A",
    "filename": "waterleveltransmitter_validate",
    i18n: [
        {
            lang: "en", texts: [
                { textId: "name", text: "name" },
                { textId: "e1", text: "e1" },
                { textId: "e2", text: "e2" },
                { textId: "e3", text: "e3" },
                { textId: "e1o.1", text: "ON" },
                { textId: "e1o.0", text: "OFF" },
                { textId: "e1o.2", text: "test" }
            ]
        }
    ],
    files: [{ url: "test", usage: SpecificationFileUsage.documentation, fileLocation: FileLocation.Local },
    { url: "test1", usage: SpecificationFileUsage.img, fileLocation: FileLocation.Local },
    ],
    version: SPECIFICATION_VERSION,
    testdata: {
        holdingRegisters: [
            { address: 3, value: 1 },
            { address: 4, value: 1 },
            { address: 5, value: 1 },
            {
                address: 100, error: "No data available"
            }
        ]
    }
}
describe("simple tests", () => {
    beforeAll(() => {
        singleMutex.acquire()
        new ConfigSpecification().readYaml()
    });

    afterAll(() => {
        singleMutex.release()
    });

    it("copyModbusDataToEntity  identifiation string identified", () => {
        let tspec = structuredClone(spec)
        tspec.entities = [entText]
        let values: ImodbusValues = emptyModbusValues()
        if (entText.converterParameters)
            (entText.converterParameters as Itext).identification = "ABCD"
        let v = 65 << 8 | 66
        let b = Buffer.allocUnsafe(2);
        b.writeInt16BE(v)
        v = 67 << 8 | 68
        let b1 = Buffer.allocUnsafe(2);
        b1.writeInt16BE(v)

        values.holdingRegisters.set(5, { result: { data: [v], buffer: b } })
        values.holdingRegisters.set(6, { result: { data: [v], buffer: b1 } })


        let e = M2mSpecification.copyModbusDataToEntity(tspec, 2, values)
        expect(e.identified).toBe(IdentifiedStates.identified)

    })
    it("validation: Find a specification for the given test data", () => {
        let tspec = structuredClone(spec)
        let mspec = new M2mSpecification(tspec)
        let msgs = mspec.validate("en")
        let count = 0
        msgs.forEach(msg => { if (msg.type == MessageTypes.identifiedByOthers && msg.additionalInformation.length == 1) count++ })
        expect(count).toBe(1)
        count = 0
    })
    it("validation: readWrite FunctionCode instead of read", () => {
        let tspec = structuredClone(spec)
        tspec.entities[0].registerType = ModbusRegisterType.HoldingRegister
        tspec.entities[0].readonly = false
        let mspec = new M2mSpecification(structuredClone(tspec))
        let msgs = mspec.validate("en")
        let count = 0
        msgs.forEach(msg => { if (msg.type == MessageTypes.identifiedByOthers && msg.additionalInformation.length == 1) count++ })
        expect(count).toBe(1)
    })
    it("validation: Find no specification for the given test data", () => {
        let tspec = structuredClone(spec)
        tspec!.entities[0].registerType = ModbusRegisterType.AnalogInputs
        tspec.testdata.holdingRegisters!.splice(0, 1)
        tspec.testdata.analogInputs = [{ address: 3, value: 1 }]
        let mspec = new M2mSpecification(tspec)
        let msgs = mspec.validate("en")
        let count = 0
        msgs.forEach(msg => { if (msg.type == MessageTypes.identifiedByOthers && msg.additionalInformation.length == 1) count++ })
        expect(count).toBe(0)
    })
    it("validation: Find no specification null values don't match", () => {
        let tspec = structuredClone(spec)
        tspec.testdata.holdingRegisters![3].value = 100

        let mspec = new M2mSpecification(tspec)
        let msgs = mspec.validate("en")
        let count = 0
        msgs.forEach(msg => { if (msg.type == MessageTypes.identifiedByOthers && msg.additionalInformation.length == 1) count++ })
        expect(count).toBe(1)
    })
})

it("closeContribution", done => {
    singleMutex.acquire()
    let yamlDir = "__tests__/yamlDircloseContribute"

    ConfigSpecification.setMqttdiscoverylanguage("en", process.env.GITHUB_TOKEN)
    ConfigSpecification['yamlDir'] = "__tests__/yamlDircloseContribute"
    fs.rmSync(yamlDir, { recursive: true, force: true });
    fs.mkdirSync(yamlDir);
    let tspec = structuredClone(spec)
    let mspec = new M2mSpecification(tspec)
    new ConfigSpecification().writeSpecificationFromFileSpec(tspec, tspec.filename, undefined)
    tspec.pullNumber = 81
    mspec.closeContribution().then(() => {
        done()
        fs.rmSync(yamlDir, { recursive: true, force: true });
        singleMutex.release()
    }).catch(e => {
        fs.rmSync(yamlDir, { recursive: true, force: true });
        console.log("error" + e.message)
        expect(1).toBeFalsy()
    })

})
class TestM2mSpecification extends M2mSpecification {
    rcs: { merged: boolean, closed: boolean }[] = [
        { merged: false, closed: false }, //0
        { merged: true, closed: false },
        { merged: false, closed: false },
        { merged: false, closed: false },
        { merged: false, closed: false },
        { merged: false, closed: false }, //5
        { merged: false, closed: false },
        { merged: false, closed: false },
        { merged: false, closed: false },
        { merged: false, closed: false },
        { merged: false, closed: true }

    ]
    private idx = 0
    override closeContribution(): Promise<IpullRequest> {
        return new Promise<IpullRequest>((resolve, reject) => {
            if (this.idx >= this.rcs.length)
                reject(new Error("not enough test data provided"))
            resolve({
                pullNumber: 16,
                merged: this.rcs[this.idx].merged,
                closed: this.rcs[this.idx++].closed
            })
        })
    }
}
it("startPolling", done => {
    let specP = structuredClone(spec)
    specP.pullNumber = 16
    specP.status = SpecificationStatus.contributed
    ConfigSpecification.githubPersonalToken = "abcd"
    let m = new TestM2mSpecification(specP)
    //Speed up test set short intervals
    m['ghPollInterval'] = [1, 2, 3, 4]
    let o = m.startPolling(
        (e) => {
            expect(true).toBeFalsy()
        })
    let callCount = 0
    let expectedCallCount = 2
    o?.subscribe({
        next(pullRequest) {
            switch (callCount) {
                case 0: expect(pullRequest.merged).toBeFalsy()
                    break;
                case 1: expect(pullRequest.merged).toBeTruthy()
                    break;
            }
            callCount++;
            if (callCount > expectedCallCount)
                expect(callCount).toBe(expectedCallCount)
        },
        complete() {
            expect(M2mSpecification['ghContributions'].has(specP.filename)).toBeFalsy()
            expect(callCount).toBe(2)
            expect(m['ghPollIntervalIndexCount']).toBe(2)
            expect(m['ghPollIntervalIndex']).toBe(0)
            expectedCallCount = 11
            o = m.startPolling(
                (e) => {
                    expect(true).toBeFalsy()
                })
            o?.subscribe({
                next(pullRequest) {
                    switch (callCount) {
                        case 0: expect(pullRequest.closed).toBeFalsy()
                            break;
                        case 1: expect(pullRequest.closed).toBeTruthy()
                            break;
                    }
                    callCount++;
                    if (callCount > expectedCallCount)
                        expect(callCount).toBe(expectedCallCount)
                },
                complete() {
                    expect(M2mSpecification['ghContributions'].has(specP.filename)).toBeFalsy()
                    expect(callCount).toBe(expectedCallCount)
                    expect(m['ghPollIntervalIndexCount']).toBe(0)
                    expect(m['ghPollIntervalIndex']).toBe(1)
                    done()
                }
            })
        }
    })

})