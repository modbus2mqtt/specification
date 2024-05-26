//import { ReadRegisterResult } from 'modbus-serial/ModbusRTU';
import {  Ientity, ModbusRegisterType, Ispecification, Converters } from 'specification.shared';

export interface ReadRegisterResult {
    data: Array<number>;
    buffer: Buffer;
  }
// Base class for all converters
export abstract class Converter {
    constructor(protected component:Converters ) {

    }
    getModbusLength(_entity: Ientity): number { return 1 }

    abstract modbus2mqtt(spec: Ispecification, entityid: number, value: ReadRegisterResult): number | string;
    abstract mqtt2modbus(spec: Ispecification, entityid: number, _value: number | string):ReadRegisterResult
    // the following methods must work w/o meta data because they are needed for the converter ui
    getRequiredParameters(): string[] { return []; }
    getOptionalParameters(): string[] { return ["value_sensor", "discovertemplate"]; }
    abstract getModbusRegisterTypes(): ModbusRegisterType[] 
    getParameterType(_entity: Ientity): string | undefined { return undefined }
}