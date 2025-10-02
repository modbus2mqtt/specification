import { Converter } from './converter'
import { Ivalue, Ientity, Ispecification, Converters, ModbusRegisterType, Itext } from '@modbus2mqtt/specification.shared'
import { ReadRegisterResult } from './converter'

export class TextConverter extends Converter {
  constructor(component?: Converters) {
    if (!component) component = 'text'
    super(component)
  }
  private getStringlength(entity: Ientity): number {
    if (entity.converterParameters && 'stringlength' in entity.converterParameters && entity.converterParameters.stringlength)
      return entity.converterParameters.stringlength
    return 0
  }
  override getModbusLength(entity: Ientity): number {
    return this.getStringlength(entity) / 2
  }
  override modbus2mqtt(spec: Ispecification, entityid: number, value: number[]): number | string {
    let entity = spec.entities.find((e) => e.id == entityid)
    if (entity && entity.converter === 'value' && entity.converterParameters && (entity.converterParameters as Ivalue).value)
      return (entity.converterParameters as Ivalue).value
    let cvP = entity?.converterParameters as Itext
    let buffer = Buffer.allocUnsafe(cvP.stringlength * 2)
    for (let idx = 0; idx < (cvP.stringlength + 1) / 2; idx++) {
      let v:number = value[idx];
      if(cvP.swapBytes) {
            let b1 = (v  & 0xFF00) >> 8
            let b0 = (v  & 0x00FF) << 8
            v = b0 | b1
      }
      buffer.writeUInt16BE(v, idx * 2)
    }
    let idx = buffer.findIndex((v) => v == 0)
    if (idx >= 0) return buffer.subarray(0, idx).toString()
    return buffer.toString()
  }
  override getModbusRegisterTypes(): ModbusRegisterType[] {
    return [ModbusRegisterType.HoldingRegister, ModbusRegisterType.AnalogInputs]
  }
  override mqtt2modbus(spec: Ispecification, entityid: number, _value: string): number[] {
    let entity = spec.entities.find((e) => e.id == entityid)
    if (!entity) throw new Error('entity not found in entities')
    let rc: number[] = []
    for (let i = 0; i < _value.length; i += 2) {
      let v:number= (i + 1 < _value.length?_value.charCodeAt(i) << 8 | _value.charCodeAt(i + 1):_value.charCodeAt(i) << 8)
      if(entity.converterParameters && 'swapBytes' in entity.converterParameters && entity.converterParameters.swapBytes) {
            let b1 = (v  & 0xFF00) >> 8
            let b0 = (v  & 0x00FF) << 8
            v = b0 | b1
      }
      rc.push(v)
    }
    return rc
  }
  override getParameterType(_entity: Ientity): string | undefined {
    return 'Itext'
  }
}
