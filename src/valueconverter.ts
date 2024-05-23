
import { Converter } from "./converter";
import { Ispecification, Ivalue } from "specification.shared";

export class ValueConverter extends Converter {
    constructor(component?: string) {
        if (!component)
            component = "value"
        super(component);
    }
    modbus2mqtt(spec: Ispecification, entityid: number): string | number {
        let entity = spec.entities.find(e => e.id == entityid)
        if (entity && (entity.converterParameters as Ivalue).value)
            return (entity.converterParameters as Ivalue).value;
        else
            return "";
    }
}
