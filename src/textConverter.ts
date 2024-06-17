import { Converter } from "./converter";
import { Ivalue, Ientity, Ispecification, Converters, ModbusRegisterType } from '@modbus2mqtt/specification.shared';
import { ReadRegisterResult } from "./converter";

export class TextConverter extends Converter {
    constructor(component?: Converters) {
        if (!component)
            component = "text"
        super(component);
    }
    private getStringlength(entity: Ientity): number {
        if (entity.converterParameters &&
            "stringlength" in entity.converterParameters && entity.converterParameters.stringlength)
            return entity.converterParameters.stringlength;
        return 0;
    }
    override getModbusLength(entity: Ientity): number {
        return this.getStringlength(entity) / 2;
    }
    override modbus2mqtt(spec: Ispecification, entityid: number, value: ReadRegisterResult): number | string {

        let entity = spec.entities.find(e => e.id == entityid)
        if (entity && entity.converter.name === "value" && entity.converterParameters && (entity.converterParameters as Ivalue).value)
            return (entity.converterParameters as Ivalue).value;
        let idx = value.buffer.findIndex((v) => v == 0)
        if (idx >= 0)
            return value.buffer.subarray(0, idx).toString()
        return value.buffer.toString();
    }
    override getModbusRegisterTypes(): ModbusRegisterType[] {
        return [ModbusRegisterType.HoldingRegister,
            ModbusRegisterType.AnalogInputs];
    }
    override mqtt2modbus(spec: Ispecification, entityid: number, _value: string): ReadRegisterResult {
        let entity = spec.entities.find(e => e.id == entityid)
        if (!entity)
            throw new Error("entity not found in entities")
        let rc: number[] = [];
        for (let i = 0; i < _value.length; i += 2) {
            if (i + 1 < _value.length)
                rc.push(_value.charCodeAt(i) << 8 | _value.charCodeAt(i + 1));
            else
                rc.push(_value.charCodeAt(i) << 8);
        }
        return {
            data: rc,
            buffer: Buffer.from(_value)
        };
    }
    override getParameterType(_entity: Ientity): string | undefined {
        return "Itext";
    }
}
