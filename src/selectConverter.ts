import { Converter } from "./converter";
import { Ientity, ModbusFunctionCodes, Ispecification, getSpecificationI18nEntityOptionName, getSpecificationI18nEntityOptionId, IselectOption, Iselect } from 'specification.shared';
import { LogLevelEnum, Logger } from "./log";
import { ReadRegisterResult } from "./converter";

const log = new Logger('selectconverter')
export class SelectConverter extends Converter {
    length: number = 1;
    override isReadOnly(): boolean {
        if (this.component === "button" || this.component === "select")
            return false;
        return true;
    }
    constructor(private mqttdiscoverylanguage:string,component?: string) {
        if (!component)
            component = "select";
        super(component);
    }
    private getOptions(spec: Ispecification, entityid: number): IselectOption[] {
        let entity = spec.entities.find(e => e.id == entityid)
        let mqttdiscoverylanguage = this.mqttdiscoverylanguage
        if (entity && entity.converterParameters) {
            if ("options" in entity.converterParameters && entity.converterParameters.options) {
                return entity.converterParameters.options
            }
            else
                if ("optionModbusValues" in entity.converterParameters && entity.converterParameters.optionModbusValues) {
                    let options: IselectOption[] = []
                    entity.converterParameters.optionModbusValues.forEach(option => {
                        let name = getSpecificationI18nEntityOptionName(spec, mqttdiscoverylanguage, entityid, option)
                        options.push({ key: option, name: name ? name : "" })
                    })
                    return options;
                }
        }
        throw new Error("No options available for entity id: " + entityid);
    }

    override modbus2mqtt(spec: Ispecification, entityid: number, value: ReadRegisterResult): number | string {

        let entity = spec.entities.find(e => e.id == entityid)
        var msg = ""
        if (entity) {
            if ((entity.converterParameters as Iselect).options) {
                let opt = (entity.converterParameters as Iselect)!.options!.find(opt => opt.key == value.data[0])
                return opt && opt.name ? opt.name : ""
            }
            else {
                var rc = getSpecificationI18nEntityOptionName(spec, this.mqttdiscoverylanguage, entityid, value.data[0])
                if (rc)
                    return rc;
            }
            let options = this.getOptions(spec, entityid);
            var msg = "option not found spec: " + spec.filename + " entity id: \"" + entity.id + "\" key:" + value.data[0] + " options: " + JSON.stringify(options);
        }
        else
            msg = "entityid not in entities list: \"" + entityid + "\" key:" + value.data[0];
        return msg;
    }
    override mqtt2modbus(spec: Ispecification, entityid: number, name: string): ReadRegisterResult {
        let entity = spec.entities.find(e => e.id == entityid)
        if (!entity)
            throw new Error("entity not found in entities")

        if (this.component === "binary_sensor")
            return {
                data: [],
                buffer: Buffer.from("")
            }
        let val = getSpecificationI18nEntityOptionId(spec, this.mqttdiscoverylanguage, entityid, name);
        if (val) {
            let buf = Buffer.alloc(2)
            buf.writeInt16BE(val[0])
            return {
                data: val,
                buffer: buf
            };
        }

        let options = this.getOptions(spec, entityid);
        var msg = "unknown option  entity id: " + entity.id + "(assuming: name = 0)" + name + "options: " + options;
        log.log(LogLevelEnum.error, msg);
        return {
            data: [],
            buffer: Buffer.from("")
        };
    }
    override getParameterType(_entity: Ientity): string | undefined {
        switch (this.component) {
            case "binary_sensor":
                return "Ibinary_sensor";
            case "button":
                return undefined;
            default:
                return "Iselect";
        }
    }

    override getModbusFunctionCodes(): ModbusFunctionCodes[] {
        switch (this.component) {
            case "binary_sensor":
                return [ModbusFunctionCodes.readWriteHoldingRegisters,
                ModbusFunctionCodes.readAnalogInputs,
                ModbusFunctionCodes.readWriteCoils];
            case "button":
                return [ModbusFunctionCodes.readWriteHoldingRegisters,
                ModbusFunctionCodes.readAnalogInputs,
                ModbusFunctionCodes.readWriteCoils];
            default:
        }
        return [ModbusFunctionCodes.readWriteHoldingRegisters,
        ModbusFunctionCodes.readAnalogInputs,
        ModbusFunctionCodes.readWriteCoils]
    }
}




