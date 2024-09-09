import { Converters, ImodbusEntity, ModbusRegisterType } from '@modbus2mqtt/specification.shared'
import { Converter, ReadRegisterResult } from './converter'
import { EnumNumberFormat, Inumber, Ispecification, Ientity } from '@modbus2mqtt/specification.shared'
import { M2mSpecification } from './m2mspecification'

export class NumberConverter extends Converter {
  constructor(component?: Converters) {
    if (!component) component = 'number'
    super(component)
  }
  modbus2mqtt(spec: Ispecification, entityid: number, value: ReadRegisterResult): number | string {
    let entity = spec.entities.find((e) => e.id == entityid)
    let mspec = new M2mSpecification(spec.entities as ImodbusEntity[])
    if (entity) {
      if (value.data.length == 0) throw new Error('NumberConverter.modbus2mqtt: No value in array')

      let numberFormat =
        entity.converterParameters != undefined && (entity.converterParameters as Inumber).numberFormat != undefined
          ? (entity.converterParameters as Inumber).numberFormat
          : EnumNumberFormat.default

      let v = value.data[0]
      if (numberFormat == EnumNumberFormat.float32)
        if (value.buffer && value.buffer.length >= 4) v = value.buffer.readFloatBE()
        else new Error('NumberConverter.modbus2mqtt: Invalid buffer to convert to Float entityid = ' + entityid)
      let multiplier = mspec.getMultiplier(entityid)
      let offset = mspec.getOffset(entityid)
      if (!multiplier) multiplier = 1
      if (!offset) offset = 0
      return parseFloat((v * multiplier + offset).toFixed(5))
    } else throw new Error('entityid not found in entities')
  }

  override mqtt2modbus(spec: Ispecification, entityid: number, value: number | string): ReadRegisterResult {
    let mspec = new M2mSpecification(spec.entities as ImodbusEntity[])
    let multiplier = mspec.getMultiplier(entityid)
    let offset = mspec.getOffset(entityid)

    if (!multiplier) multiplier = 1
    if (!offset) offset = 0
    let entity = spec.entities.find((e) => e.id == entityid)
    if (entity) {
      let numberFormat =
        entity.converterParameters != undefined && (entity.converterParameters as Inumber).numberFormat != undefined
          ? (entity.converterParameters as Inumber).numberFormat
          : EnumNumberFormat.default
      let buf: Buffer = Buffer.allocUnsafe(4)

      value = ((value as number) - offset) / multiplier
      let v = value
      if (numberFormat == EnumNumberFormat.float32) {
        buf.writeFloatBE(v)
      } else {
        buf = Buffer.allocUnsafe(2)
        buf.writeUInt16BE(v)
        let r: ReadRegisterResult = {
          data: [v],
          buffer: buf,
        }
        return r
      }
    }
    throw new Error('entityid not found in entities')
  }
  override getParameterType(_entity: Ientity): string | undefined {
    return 'Inumber'
  }
  override getModbusLength(entity: Ientity): number {
    if (entity.converterParameters == undefined || (entity.converterParameters as Inumber).numberFormat == undefined) return 1
    switch ((entity.converterParameters as Inumber).numberFormat) {
      case EnumNumberFormat.float32:
        return 2
      default:
        return 1
    }
  }
  override getModbusRegisterTypes(): ModbusRegisterType[] {
    return [ModbusRegisterType.HoldingRegister, ModbusRegisterType.AnalogInputs]
  }
}
