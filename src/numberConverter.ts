import { Converters, ImodbusEntity, ModbusRegisterType } from '@modbus2mqtt/specification.shared'
import { Converter, ReadRegisterResult } from './converter'
import { EnumNumberFormat, Inumber, Ispecification, Ientity } from '@modbus2mqtt/specification.shared'
import { M2mSpecification } from './m2mspecification'

export class NumberConverter extends Converter {
  constructor(component?: Converters) {
    if (!component) component = 'number'
    super(component)
  }
  modbus2mqtt(spec: Ispecification, entityid: number, value: number[]): number | string {
    let entity = spec.entities.find((e) => e.id == entityid)
    let mspec = new M2mSpecification(spec.entities as ImodbusEntity[])
    if (entity) {
      if (value.length == 0) throw new Error('NumberConverter.modbus2mqtt: No value in array')

      let numberFormat =
        entity.converterParameters != undefined && (entity.converterParameters as Inumber).numberFormat != undefined
          ? (entity.converterParameters as Inumber).numberFormat
          : EnumNumberFormat.default
      let swapWords =
        entity.converterParameters != undefined && (entity.converterParameters as Inumber).swapWords != undefined
          ? (entity.converterParameters as Inumber).swapWords
          : false
      let swapBytes =
        entity.converterParameters != undefined && (entity.converterParameters as Inumber).swapBytes != undefined
          ? (entity.converterParameters as Inumber).swapBytes
          : false;
      if( swapWords && value.length >=2) {
            let tmp = value[0]
            value[0] = value[1]
            value[1] = tmp
      }
      if( swapBytes ) 
        for( let i=0; i<value.length; i++) {
            let v = value[i]
            let b1 = (v & 0xFF00) >> 8
            let b0 = (v & 0x00FF) << 8
            value[i] = b0 | b1
        }
      let buffer16 = Buffer.allocUnsafe(4)
      let buffer32 = Buffer.allocUnsafe(4)
      let v: number = 0;
      switch (numberFormat) {
        case EnumNumberFormat.float32:

          buffer32.writeUInt16BE(value[0])
          buffer32.writeUInt16BE(value[1], 2)
          v = buffer32.readFloatBE()
          break
        case EnumNumberFormat.signedInt16:
          buffer16.writeUInt16BE(value[0])
          v = buffer16.readInt16BE()
          break
        case EnumNumberFormat.unsignedInt32:
          buffer32.writeUInt16BE(value[0])
          buffer32.writeUInt16BE(value[1], 2)
          v = buffer32.readUint32BE()
          break
        case EnumNumberFormat.signedInt32:
          buffer32.writeUInt16BE(value[0])
          buffer32.writeUInt16BE(value[1], 2)
          v = buffer32.readInt32BE()
          break
        default:
          v = value[0]
          break
      }
      let multiplier = mspec.getMultiplier(entityid)
      let offset = mspec.getOffset(entityid)
      if (!multiplier) multiplier = 1
      if (!offset) offset = 0
      let dec = mspec.getDecimals(entityid)
      v = v * multiplier + offset
      return v

    } else throw new Error('entityid not found in entities')
  }

  override mqtt2modbus(spec: Ispecification, entityid: number, value: number | string): number[] {
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
            let swapWords =
      entity.converterParameters != undefined && (entity.converterParameters as Inumber).swapWords != undefined
          ? (entity.converterParameters as Inumber).swapWords
          : false
      let swapBytes =
        entity.converterParameters != undefined && (entity.converterParameters as Inumber).swapBytes != undefined
          ? (entity.converterParameters as Inumber).swapBytes
          : false;
      let buf: Buffer = Buffer.allocUnsafe(4)

      value = ((value as number) - offset) / multiplier
      let v:number = value
      let rc32:number[]|undefined=undefined;
      switch (numberFormat) {
        case EnumNumberFormat.float32:
          buf.writeFloatBE(v)
          rc32 = [buf.readUInt16BE(0), buf.readUInt16BE(2)]
          break;
        case EnumNumberFormat.signedInt16:
          buf.writeInt16BE(v)
          v = buf.readUInt16BE();
          break;
        case EnumNumberFormat.unsignedInt32:
          buf.writeUint32BE(v)
          rc32 = [buf.readUInt16BE(0), buf.readUInt16BE(2)]
          break;
        case EnumNumberFormat.signedInt32:
          buf.writeInt32BE(v)
          rc32 = [buf.readUInt16BE(0), buf.readUInt16BE(2)]
          break;
        default:
          
      }
      if( rc32 ) {
        if( swapWords && rc32.length >=2) {
            let tmp = rc32[0]
            rc32[0] = rc32[1]
            rc32[1] = tmp
        }
        if( swapBytes ) 
          for( let i=0; i<rc32.length; i++) {
              let v = rc32[i]
              let b1 = (v & 0xFF00) >> 8
              let b0 = (v & 0x00FF) << 8
              rc32[i] = b0 | b1
          }
        }
        else {
          if(swapBytes) {
            let b1 = (v  & 0xFF00) >> 8
            let b0 = (v  & 0x00FF) << 8
            v = b0 | b1
          }
          return [v]
        }
        return rc32 as number[]
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
