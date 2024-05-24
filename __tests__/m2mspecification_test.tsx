import { FileLocation, ImodbusEntity, Itext, MessageTypes, ModbusRegisterType, SpecificationFileUsage } from  'specification.shared';
import { ConfigSpecification } from '../src/configspec';
import { ImodbusValues, M2mSpecification, emptyModbusValues } from '../src/m2mspecification';
import { Converters, IdentifiedStates, ImodbusSpecification } from 'specification.shared';
import { yamlDir } from './configsbase';
import { ReadRegisterResult } from '../src/converter';

ConfigSpecification['yamlDir'] = yamlDir;
beforeAll(() => {
    new ConfigSpecification().readYaml()
})
var entText: ImodbusEntity = {
    id: 2, mqttname: "mqtt",
    modbusAddress: 5,
    registerType: ModbusRegisterType.HoldingRegister,
    readonly:true,
    modbusValue: [65 << 8 | 66, 67 << 8 | 68], mqttValue: "", identified: IdentifiedStates.unknown,
    converterParameters: { stringlength: 10 },
    converter: { name: "text", registerTypes: [] }
};

let spec: ImodbusSpecification = {
    "entities": [
        {
            "id": 1, mqttname: "mqtt",
            "converter": { name: "sensor" as Converters, registerTypes: [] }, "modbusAddress": 3, registerType: ModbusRegisterType.HoldingRegister,readonly:true, "icon": "", modbusValue: [2], mqttValue: "1", identified: IdentifiedStates.identified, "converterParameters": { "multiplier": 0.1, "offset": 0, "uom": "cm", "identification": { "min": 0, "max": 200 } }
        },
        { id: 2, mqttname: "mqtt2", "converter": { name: "select" as Converters, registerTypes: [] }, "modbusAddress": 4, registerType: ModbusRegisterType.HoldingRegister,readonly:true, "icon": "", modbusValue: [1], mqttValue: "1", identified: IdentifiedStates.identified, "converterParameters": { "optionModbusValues": [1, 2, 3] } },
        { id: 3, mqttname: "mqtt3", "converter": { name: "select" as Converters, registerTypes: [] }, "modbusAddress": 5, registerType: ModbusRegisterType.HoldingRegister,readonly:false, "icon": "", modbusValue: [1], mqttValue: "1", identified: IdentifiedStates.identified, "converterParameters": { "optionModbusValues": [0, 1, 2, 3] } }],
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
it("copyModbusDataToEntity  identifiation string identified",()=>{
    M2mSpecification.setMqttdiscoverylanguage("en")
    let tspec = structuredClone(spec)
    tspec.entities = [entText]
    let values:ImodbusValues = emptyModbusValues()
    if (entText.converterParameters)
        (entText.converterParameters as Itext).identification = "ABCD"
    let v = 65 << 8 | 66
    let b = Buffer.allocUnsafe(2);
    b.writeInt16BE(v)
    v = 67 << 8 | 68
    let b1 = Buffer.allocUnsafe(2);
    b1.writeInt16BE(v)
    
   values.holdingRegisters.set(5,{data: [v], buffer: b})
   values.holdingRegisters.set(6,{data: [v], buffer: b1})
 

    let e = M2mSpecification.copyModbusDataToEntity(tspec,2, values)
    expect( e.identified ) .toBe(IdentifiedStates.identified)
   
})
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
    tspec.entities[0].registerType = ModbusRegisterType.AnalogInputs
    let mspec = new M2mSpecification(structuredClone(tspec))
    let msgs = mspec.validate("en")
    let count = 0
    msgs.forEach(msg => { if (msg.type == MessageTypes.identifiedByOthers && msg.additionalInformation.length == 1) count++ })
    expect(count).toBe(0)
})