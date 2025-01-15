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
      switch (numberFormat )
      {
        case EnumNumberFormat.float32:
          if (value.buffer && value.buffer.length >= 4) v = value.buffer.readFloatBE()
            else new Error('NumberConverter.modbus2mqtt: Invalid buffer to convert to Float entityid = ' + entityid)
          break;
        case EnumNumberFormat.signedInt16:
          if (value.buffer && value.buffer.length >= 2) v = value.buffer.readInt16BE()
            else new Error('NumberConverter.modbus2mqtt: Invalid buffer to convert to Signed16 int entityid = ' + entityid)
          break;
        case EnumNumberFormat.unsignedInt32:
          if (value.buffer && value.buffer.length >= 4) v = value.buffer.readUint32BE()
            else new Error('NumberConverter.modbus2mqtt: Invalid buffer to convert to Unsigned32 entityid = ' + entityid)
          break;
        case EnumNumberFormat.signedInt32:
            if (value.buffer && value.buffer.length >= 4) v = value.buffer.readInt32BE()
              else new Error('NumberConverter.modbus2mqtt: Invalid buffer to convert to Signed32 entityid = ' + entityid)
            break;
        }
      let multiplier = mspec.getMultiplier(entityid)
      let offset = mspec.getOffset(entityid)
      if (!multiplier) multiplier = 1
      if (!offset) offset = 0
      let dec = mspec.getDecimals(entityid)
      v = v * multiplier + offset
      if( dec != undefined  && dec >=0 && dec < 100)
          return parseFloat(v.toFixed(dec))
      else
        return v

      return v
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
      switch (numberFormat )
      {
        case EnumNumberFormat.float32:
          buf.writeFloatBE(v)
          break;
        case EnumNumberFormat.signedInt16:
          buf.writeInt16BE(v)
          v = buf.readUInt16BE()
          break;
        case EnumNumberFormat.unsignedInt32:
          buf.writeUint32BE(v)
          v = buf.readUint32BE()
          break;
        case EnumNumberFormat.signedInt32:
          buf.writeInt32BE(v)
          v = buf.readInt32BE()
          break;
        default:
          buf = Buffer.allocUnsafe(2)
          buf.writeUInt16BE(v)
      }
      let r: ReadRegisterResult = {
          data: [v],
          buffer: buf,
      }
      return r        
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
      case EnumNumberFormat.signedInt32:
      case EnumNumberFormat.unsignedInt32:
        return 2
      case EnumNumberFormat.signedInt16:
      default:
        return 1
    }
  }
  override getModbusRegisterTypes(): ModbusRegisterType[] {
    return [ModbusRegisterType.HoldingRegister, ModbusRegisterType.AnalogInputs]
  }
}
