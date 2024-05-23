//import { ReadRegisterResult } from 'modbus-serial/ModbusRTU';
import {  Ientity, ModbusFunctionCodes, Ispecification } from 'specification.shared';

export interface ReadRegisterResult {
    data: Array<number>;
    buffer: Buffer;
  }
// Base class for all converters
export abstract class Converter {
    constructor(protected component: string) {

    }
    isReadOnly(): boolean { return true; }
    getModbusLength(_entity: Ientity): number { return 1 }

    //@ts-ignore
    generateDiscoverData(entity: Ientity, device: Islave): Idiscover | undefined { return undefined; }
    abstract modbus2mqtt(spec: Ispecification, entityid: number, value: ReadRegisterResult): number | string;
    mqtt2modbus(spec: Ispecification, entityid: number, _value: number | string): ReadRegisterResult {
        let entity = spec.entities.find(e => e.id == entityid)
        if (!entity)
            throw new Error("entity not found in entities")
        if (!this.isReadOnly())
            throw new Error("not implemented");
        else
            throw new Error("mqtt2modbus called for read only entity id " + entity.id);
    }
    // the following methods must work w/o meta data because they are needed for the converter ui
    getRequiredParameters(): string[] { return []; }
    getOptionalParameters(): string[] { return ["value_sensor", "discovertemplate"]; }
    getModbusFunctionCodes(): ModbusFunctionCodes[] { return [ModbusFunctionCodes.readHoldingRegisters] }
    getParameterType(_entity: Ientity): string | undefined { return undefined }
}