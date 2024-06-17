import { Converter } from "./converter";
import { NumberConverter } from "./numberConverter";
import { TextConverter } from "./textConverter";
import { SelectConverter } from "./selectConverter";
import { ValueConverter } from "./valueconverter";
import { Ientity, Iconverter, Converters } from '@modbus2mqtt/specification.shared';
import { BinaryConverter } from "./binaryConverter";
import { ConfigSpecification } from "./configspec";

export class ConverterMap extends Map<Converters, Converter> {
    private static converterMap = new ConverterMap();
    private static getConverterMap(): ConverterMap { return ConverterMap.converterMap; }
    
    static getConverters(): Iconverter[] {
        let rc: Iconverter[] = []
        ConverterMap.getConverterMap().forEach((con, name) => {
            let c: Iconverter = {
                name: name,
                registerTypes: con.getModbusRegisterTypes()
            }
            rc.push(c)
        })
        return rc;
    }
    static getIConverter(entity: Ientity): Iconverter | undefined {
        let cv: Converter | undefined = undefined
        if (entity.converter)
            cv = this.getConverterMap().get(entity.converter.name);
        if (cv) {
            let c: Iconverter = {
                name: entity.converter.name,
                registerTypes: cv.getModbusRegisterTypes()
            }
            return c;
        }
        return undefined;
    }
    // static getConverters(): Iconverter[] { 
    //     let rc:Iconverter[] =[]
    //     ConverterMap.getConverterMap().forEach((con, name)=>{
    //         let c:Iconverter={
    //             name: name,
    //             functionCodes:con.getModbusFunctionCodes()
    //         }
    //         rc.push(c)
    //     })
    //     return rc;
    // }
    static getConverter(entity: Ientity): Converter | undefined {
        let cv: Converter | undefined = undefined
        if (entity.converter)
            cv = this.getConverterMap().get(entity.converter.name);
        return cv;
    }
    //@ts-ignore
    private static _initialize = (() => {
        if (ConverterMap.converterMap.size == 0) {
            // read/write not a sensor
            ConverterMap.converterMap.set("number", new NumberConverter());
            ConverterMap.converterMap.set("select", new SelectConverter());
            ConverterMap.converterMap.set("text", new TextConverter());
            ConverterMap.converterMap.set("binary", new BinaryConverter());
            ConverterMap.converterMap.set("value", new ValueConverter());

        }
    })();
}


