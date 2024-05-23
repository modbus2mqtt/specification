import { Converter } from "./converter";
import { Ientity, Ispecification, ModbusFunctionCodes } from 'specification.shared';
import { NumberConverter } from "./numberConverter";
import { SelectConverter } from "./selectConverter";
import { TextConverter } from "./textConverter";
import { ReadRegisterResult } from "./converter";

export class SensorConverter extends Converter {
    converterImplementation?: Converter;
    constructor(component?: string) {
        if (!component)
            super("sensor");
        else
            super(component);
    }
    getConverterImplementation(entity: Ientity): Converter {
        if (!this.converterImplementation)
            switch (entity.converter.name) {
                case "value_sensor":
                    this.converterImplementation = new TextConverter("sensor");
                    break;
                case "select_sensor":
                    this.converterImplementation = new SelectConverter("sensor");
                    break;
                case "binary_sensor":
                    this.converterImplementation = new SelectConverter("binary_sensor");
                    break;
                case "text_sensor":
                    this.converterImplementation = new TextConverter("sensor");
                    break;
                default:
                    this.converterImplementation = new NumberConverter("sensor");
                    break;
            }
        return this.converterImplementation;
    }
    override modbus2mqtt(spec: Ispecification, entityid: number, value: ReadRegisterResult): number | string {

        let entity = spec.entities.find(e => e.id == entityid)
        if (entity) {
            let cnv = this.getConverterImplementation(entity)
            return cnv.modbus2mqtt(spec, entityid, value) as number;
        }
        throw new Error("No enty for for entityid")
    }
    override getParameterType(entity: Ientity): string | undefined {
        return this.getConverterImplementation(entity).getParameterType(entity);
    }
    override getModbusFunctionCodes(): ModbusFunctionCodes[] {
        switch (this.component) {
            case "text_sensor": return [ModbusFunctionCodes.readWriteHoldingRegisters,
            ModbusFunctionCodes.readAnalogInputs];
            default: return [ModbusFunctionCodes.readWriteHoldingRegisters,
            ModbusFunctionCodes.readAnalogInputs,
            ModbusFunctionCodes.readWriteCoils];
        }
    }
    override getModbusLength(entity: Ientity): number {
        let cnv = this.getConverterImplementation(entity)
        if (cnv)
            return cnv.getModbusLength(entity)
        return super.getModbusLength(entity)
    }
    override isReadOnly(): boolean { return true; }

}