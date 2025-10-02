import { ConverterMap } from '../src/convertermap'
import { Converters, EnumNumberFormat, Ientity, Ispecification, ModbusRegisterType } from '@modbus2mqtt/specification.shared'
import { ConfigSpecification } from '../src/configspec'
import { it, expect, beforeAll } from '@jest/globals'

ConfigSpecification.setMqttdiscoverylanguage('en', undefined)
let spec: Ispecification = {
  entities: [
    {
      id: 1,
      mqttname: 'mqtt',
      converter: 'number' as Converters,
      modbusAddress: 4,
      registerType: ModbusRegisterType.HoldingRegister,
      readonly: true,
      icon: '',
      converterParameters: { multiplier: 0.1, offset: 0, uom: 'cm', identification: { min: 0, max: 200 } },
    },
    {
      id: 2,
      mqttname: 'mqtt2',
      converter: 'select_sensor' as Converters,
      modbusAddress: 2,
      registerType: ModbusRegisterType.HoldingRegister,
      readonly: true,
      icon: '',
      converterParameters: { optionModbusValues: [1, 2, 3] },
    },
    {
      id: 3,
      mqttname: 'mqtt3',
      converter: 'select_sensor' as Converters,
      modbusAddress: 3,
      registerType: ModbusRegisterType.HoldingRegister,
      readonly: true,
      icon: '',
      converterParameters: { optionModbusValues: [0, 1, 2, 3] },
    },
  ],
  status: 2,
  manufacturer: 'unknown',
  model: 'QDY30A',
  filename: 'waterleveltransmitter',
  i18n: [
    {
      lang: 'en',
      texts: [
        { textId: 'e1o.1', text: 'ON' },
        { textId: 'e1o.0', text: 'OFF' },
        { textId: 'e1o.2', text: 'test' },
      ],
    },
  ],
  files: [],
}

it('test sensor converter', () => {
  let entity: Ientity = {
    id: 1,
    mqttname: 'mqtt',
    converter: 'number',
    converterParameters: { multiplier: 0.01, offset: 0 },
    registerType: ModbusRegisterType.HoldingRegister,
    readonly: false,
    modbusAddress: 2,
  }
  spec.entities = [entity]
  let sensorConverter = ConverterMap.getConverter(entity)
  let mqttValue = parseFloat(sensorConverter?.modbus2mqtt(spec, entity.id, [5]) as string)
  expect(mqttValue).toBe(0.05)
})
it('test sensor converter with stringlength', () => {
  let entity: Ientity = {
    id: 1,
    mqttname: 'mqtt',
    converter: 'number',
    converterParameters: { stringlength: 10 },
    registerType: ModbusRegisterType.HoldingRegister,
    readonly: false,
    modbusAddress: 2,
  }
  spec.entities = [entity]
  let sensorConverter = ConverterMap.getConverter(entity)
  let r = [5, 6, 7]
  let mqttValue = sensorConverter?.modbus2mqtt(spec, entity.id, r)
  expect(parseFloat(mqttValue as string)).toBe(5)
})
it('test binary_sensor converter', () => {
  let entity: Ientity = {
    id: 1,
    mqttname: 'mqtt',
    converter: 'binary',
    registerType: ModbusRegisterType.HoldingRegister,
    readonly: false,
    modbusAddress: 2,
  }
  spec.entities = [entity]
  let sensorConverter = ConverterMap.getConverter(entity)
  let mqttValue = sensorConverter?.modbus2mqtt(spec, entity.id, [0])
  expect(mqttValue).toBe('OFF')
  mqttValue = sensorConverter?.modbus2mqtt(spec, entity.id, [1])
  expect(mqttValue).toBe('ON')
  entity = {
    id: 1,
    mqttname: 'mqtt',
    converter: 'binary',
    converterParameters: { optionModbusValues: [0, 1] },
    registerType: ModbusRegisterType.HoldingRegister,
    readonly: false,
    modbusAddress: 2,
  }
  spec.entities = [entity]
  mqttValue = sensorConverter?.modbus2mqtt(spec, entity.id, [2])
  expect(mqttValue).toBe('ON')
})
it('test select_sensor converter', () => {
  let entity: Ientity = {
    id: 1,
    mqttname: 'mqtt',
    converter: 'select',
    converterParameters: { optionModbusValues: [1, 2] },
    registerType: ModbusRegisterType.HoldingRegister,
    readonly: false,
    modbusAddress: 2,
  }
  spec.entities = [entity]
  let sensorConverter = ConverterMap.getConverter(entity)
  let mqttValue = sensorConverter?.modbus2mqtt(spec, entity.id, [1])
  expect(mqttValue).toBe('ON')
  mqttValue = sensorConverter?.modbus2mqtt(spec, entity.id, [2])
  expect(mqttValue).toBe('test')
  entity = {
    id: 1,
    mqttname: 'mqtt',
    converter: 'select',
    converterParameters: { optionModbusValues: [0, 1] },
    registerType: ModbusRegisterType.HoldingRegister,
    readonly: false,
    modbusAddress: 2,
  }
  sensorConverter = ConverterMap.getConverter(entity)
})
let r68 = [(65 << 8) | 66, (67 << 8) | 68]
let r69 = [(65 << 8) | 66, (67 << 8) | 68, 69 << 8]
function executeTextSensorTests(text:string, registers:number[],swapBytes=false) { 
   let entity: Ientity = {
    id: 1,
    mqttname: 'mqtt',
    converter: 'text',
    converterParameters: { stringlength: 10 , swapBytes: swapBytes  },
    registerType: ModbusRegisterType.HoldingRegister,
    readonly: false,
    modbusAddress: 2,
  }
  spec.entities = [entity]
  let sensorConverter = ConverterMap.getConverter(entity)
  let swappedRegisters:number[]=[];
  if(swapBytes ) 
    for( let i=0; i<registers.length; i++) {
        let v = registers[i]    
        let b0 = (registers[i] & 0x00FF) << 8
        let b1 = (registers[i] & 0xFF00) >> 8
        swappedRegisters.push(b1|b0)
      }
  else
    swappedRegisters=registers;
  
  let v = sensorConverter!.mqtt2modbus(spec, entity.id, text)
  expect(v).toEqual(swappedRegisters)  
  let mqttValue = sensorConverter?.modbus2mqtt(spec, entity.id, swappedRegisters)
  expect(mqttValue).toBe(text)
}
it('test text_sensor converter ABCD', () => {
  executeTextSensorTests('ABCD', r68, false );
  executeTextSensorTests('ABCD', r68, true );
});
it('test text_sensor converter ABCDE', () => {
  executeTextSensorTests('ABCDE', r69, false );
  executeTextSensorTests('ABCDE', r69, true );
})

it('test value_sensor converter', () => {
  let entity: Ientity = {
    id: 1,
    mqttname: 'mqtt',
    converter: 'value',
    converterParameters: { value: 'testValue' },
    registerType: ModbusRegisterType.HoldingRegister,
    readonly: false,
    modbusAddress: 2,
  }
  spec.entities = [entity]
  let sensorConverter = ConverterMap.getConverter(entity)
  let mqttValue = sensorConverter?.modbus2mqtt(spec, entity.id, [])
  expect(mqttValue).toBe('testValue')
})

it('test text converter', () => {
  let entity: Ientity = {
    id: 1,
    mqttname: 'mqtt',
    converter: 'text',
    converterParameters: { stringlength: 10 },
    registerType: ModbusRegisterType.HoldingRegister,
    readonly: false,
    modbusAddress: 2,
  }
  spec.entities = [entity]
  let converter = ConverterMap.getConverter(entity)
  let mqttValue = converter?.modbus2mqtt(spec, entity.id, r68)
  expect(mqttValue).toBe('ABCD')
  let modbusValue: any = converter!.mqtt2modbus(spec, entity.id, 'ABCD')
  expect(modbusValue).toEqual([(65 << 8) | 66, (67 << 8) | 68])
  modbusValue = converter!.mqtt2modbus(spec, entity.id, 'ABCDE')
  expect(modbusValue).toEqual([(65 << 8) | 66, (67 << 8) | 68, 69 << 8])
})

it('test number converter ignore decimal places when returning float', () => {
  let entity: Ientity = {
    id: 1,
    mqttname: 'mqtt',
    converter: 'number',
    converterParameters: { multiplier: 0.01, offset: 0, decimals: 1 },
    registerType: ModbusRegisterType.HoldingRegister,
    readonly: false,
    modbusAddress: 2,
  }
  spec.entities = [entity]
  let converter = ConverterMap.getConverter(spec.entities[0])
  let mqttValue = parseFloat(converter?.modbus2mqtt(spec, entity.id, [6]) as string)
  expect(mqttValue).toBe(0.06)
  let modbusValue = converter?.mqtt2modbus(spec, entity.id, 0.07)
  // rounding is not relevant
  expect(Math.abs(modbusValue![0] - 7)).toBeLessThan(0.00001)

  entity = {
    id: 1,
    mqttname: 'mqtt',
    converter: 'number',
    converterParameters: { multiplier: 0.01, offset: 20 },
    registerType: ModbusRegisterType.HoldingRegister,
    readonly: false,
    modbusAddress: 2,
  }
  spec.entities = [entity]
  modbusValue = converter?.mqtt2modbus(spec, entity.id, 20.07)
  expect(Math.abs(modbusValue![0] - 7)).toBeLessThan(0.00001)
})
function executeNumberFormatTest(inNumber:number,format:EnumNumberFormat,expectedRegisters:number[], swapWords=false, swapBytes=false) {
  let entity: Ientity = {
    id: 1,
    mqttname: 'mqtt',
    converter: 'number',
    converterParameters: { multiplier: 1, offset: 0, numberFormat:format, swapWords: swapWords, swapBytes: swapBytes },
    registerType: ModbusRegisterType.HoldingRegister,
    readonly: false,
    modbusAddress: 2,
  }
  spec.entities = [entity]

  let converter = ConverterMap.getConverter(spec.entities[0])
  let modbusValue: number[] | undefined = converter?.mqtt2modbus(spec, entity.id, inNumber)
  let swappedRegisters=expectedRegisters;
  if(swapWords && expectedRegisters.length==2) {
    swappedRegisters=[expectedRegisters[1],expectedRegisters[0]];
  }
  if(swapBytes ) {
    let b0 = (swappedRegisters[0] & 0x00FF) << 8
    let b1 = (swappedRegisters[0] & 0xFF00) >> 8
    if(expectedRegisters.length<2) {
      swappedRegisters=[b1|b0]
    }else {
      let b2 = (swappedRegisters[1] & 0x00FF) << 8
      let b3 = (swappedRegisters[1] & 0xFF00) >> 8
      swappedRegisters=[b1|b0,b3|b2]
    }
  } 
  expect(modbusValue!).toEqual(swappedRegisters)
  let mqtt: number = converter?.modbus2mqtt(spec, entity.id, modbusValue!) as number
  expect(mqtt-inNumber).toBeLessThan(0.00001)
}
function executeNumberFormatTests(inNumber:number,format:EnumNumberFormat,expectedRegisters:number[]) {
  executeNumberFormatTest(inNumber,format,expectedRegisters,false,false)
  executeNumberFormatTest(inNumber,format,expectedRegisters,false,true)
  if(format in [EnumNumberFormat.float32,EnumNumberFormat.signedInt32,EnumNumberFormat.unsignedInt32]){
    executeNumberFormatTest(inNumber,format,expectedRegisters,true,true) 
    executeNumberFormatTest(inNumber,format,expectedRegisters,true,false)
  } 

}

it('test number float', () => {
  executeNumberFormatTests( 17.3,EnumNumberFormat.float32,[0x418A,0x6666] );
})

it('test number signed int16', () => {
  executeNumberFormatTests( -3,EnumNumberFormat.signedInt16,[65533] );
})

it('test number signed int32 - positive', () => {
    executeNumberFormatTests(20,EnumNumberFormat.signedInt32,[0,20]) 
})

it('test number signed int32 - positive max', () => {
  executeNumberFormatTests(2147483647,EnumNumberFormat.signedInt32,[32767,65535])
});
it('test number signed int32 - negative max', () => {
 executeNumberFormatTests(-1147483647,EnumNumberFormat.signedInt32,[0xBB9A,0xCA01])
});

it('test number unsigned int32 - max', () => {
   executeNumberFormatTests(4294967295,EnumNumberFormat.unsignedInt32,[65535,65535]) 
})

it('test select converter', () => {
  let entity: Ientity = {
    id: 1,
    mqttname: 'mqtt',
    converter: 'select',
    converterParameters: { optionModbusValues: [1, 2] },
    registerType: ModbusRegisterType.HoldingRegister,
    readonly: false,
    modbusAddress: 2,
  }
  spec.entities = [entity]
  let converter = ConverterMap.getConverter(entity)
  let modbusValue = converter?.mqtt2modbus(spec, entity.id, 'test')
  expect(modbusValue![0]).toBe(2)
  entity = {
    id: 1,
    mqttname: 'mqtt',
    converter: 'select',
    converterParameters: { optionModbusValues: [1, 2] },
    registerType: ModbusRegisterType.HoldingRegister,
    readonly: false,
    modbusAddress: 2,
  }
  converter = ConverterMap.getConverter(entity)
  modbusValue = converter?.mqtt2modbus(spec, entity.id, 'ON')
})
it('test button converter', () => {
  let entity: Ientity = {
    id: 1,
    mqttname: 'mqtt',
    converter: 'binary',
    registerType: ModbusRegisterType.HoldingRegister,
    readonly: false,
    modbusAddress: 2,
  }
  spec.entities = [entity]
  let converter = ConverterMap.getConverter(entity)
  let modbusValue = converter?.mqtt2modbus(spec, entity.id, 'ON')
  expect(modbusValue![0]).toBe(1)
  modbusValue = converter?.mqtt2modbus(spec, entity.id, 'OFF')
  expect(modbusValue![0]).toBe(0)
})
