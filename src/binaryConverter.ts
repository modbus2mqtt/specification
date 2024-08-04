import { Converter } from './converter'
import { Converters, Ientity, Ispecification, ModbusRegisterType } from '@modbus2mqtt/specification.shared'
import { ReadRegisterResult } from './converter'

export class BinaryConverter extends Converter {
  constructor(component?: Converters) {
    if (!component) component = 'number'
    super(component)
  }
  modbus2mqtt(_spec: Ispecification, _entityid: number, value: ReadRegisterResult): number | string {
    return value.data[0] ? 'ON' : 'OFF'
  }

  override mqtt2modbus(_spec: Ispecification, _entityid: number, value: number | string): ReadRegisterResult {
    return value == 'ON' ? { data: [1], buffer: Buffer.from([1]) } : { data: [0], buffer: Buffer.from([0]) }
  }
  override getParameterType(_entity: Ientity): string | undefined {
    return 'Ibinary'
  }
  override getModbusRegisterTypes(): ModbusRegisterType[] {
    return [ModbusRegisterType.Coils, ModbusRegisterType.HoldingRegister]
  }
}
