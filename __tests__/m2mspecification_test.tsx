import { FileLocation, MessageTypes, SpecificationFileUsage } from  'specification.shared';
import { ConfigSpecification } from '../src/configspec';
import { M2mSpecification } from '../src/m2mspecification';
import { Converters, IdentifiedStates, ImodbusSpecification, ModbusFunctionCodes } from 'specification.shared';
import { yamlDir } from './configsbase';

ConfigSpecification['yamlDir'] = yamlDir;
beforeAll(() => {
    new ConfigSpecification().readYaml()
})
let spec: ImodbusSpecification = {
    "entities": [
        {
            "id": 1, mqttname: "mqtt",
            "converter": { name: "sensor" as Converters, functionCodes: [] }, "modbusAddress": 3, functionCode: ModbusFunctionCodes.readHoldingRegisters, "icon": "", modbusValue: [2], mqttValue: "1", identified: IdentifiedStates.identified, "converterParameters": { "multiplier": 0.1, "offset": 0, "uom": "cm", "identification": { "min": 0, "max": 200 } }
        },
        { id: 2, mqttname: "mqtt2", "converter": { name: "select_sensor" as Converters, functionCodes: [] }, "modbusAddress": 4, functionCode: ModbusFunctionCodes.readHoldingRegisters, "icon": "", modbusValue: [1], mqttValue: "1", identified: IdentifiedStates.identified, "converterParameters": { "optionModbusValues": [1, 2, 3] } },
        { id: 3, mqttname: "mqtt3", "converter": { name: "select" as Converters, functionCodes: [] }, "modbusAddress": 5, functionCode: ModbusFunctionCodes.readWriteHoldingRegisters, "icon": "", modbusValue: [1], mqttValue: "1", identified: IdentifiedStates.identified, "converterParameters": { "optionModbusValues": [0, 1, 2, 3] } }],
    "status": 2, "manufacturer": "unknown", "model": "QDY30A",
    "filename": "waterleveltransmitter_test",
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
    files: [{ url:"test", usage:SpecificationFileUsage.documentation, fileLocation: FileLocation.Local},
            { url:"test1", usage:SpecificationFileUsage.img, fileLocation: FileLocation.Local},
    ],
    identified: IdentifiedStates.identified
}

it("validation: Find a specification for the given test data", () => {
    let tspec = structuredClone(spec)
    M2mSpecification.setMqttdiscoverylanguage("en")
    let mspec = new M2mSpecification(tspec)
    let msgs = mspec.validate("en")
    let count = 0
    msgs.forEach(msg => { if (msg.type == MessageTypes.identifiedByOthers && msg.additionalInformation.length == 1) count++ })
    expect(count).toBe(1)
    count = 0
})
it("validation: readWrite FunctionCode instead of read", () => {
    M2mSpecification.setMqttdiscoverylanguage("en")
    let tspec = structuredClone(spec)
    tspec.entities[0].functionCode = ModbusFunctionCodes.readWriteHoldingRegisters
    let mspec = new M2mSpecification(structuredClone(tspec))
    let msgs = mspec.validate("en")
    let count = 0
    msgs.forEach(msg => { if (msg.type == MessageTypes.identifiedByOthers && msg.additionalInformation.length == 1) count++ })
    expect(count).toBe(1)
})
it("validation: Find no specification for the given test data", () => {
    let tspec = structuredClone(spec)
    tspec.entities[0].functionCode = ModbusFunctionCodes.readAnalogInputs
    let mspec = new M2mSpecification(structuredClone(tspec))
    let msgs = mspec.validate("en")
    let count = 0
    msgs.forEach(msg => { if (msg.type == MessageTypes.identifiedByOthers && msg.additionalInformation.length == 1) count++ })
    expect(count).toBe(0)
})