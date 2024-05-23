import { Converter } from "./converter";
import { NumberConverter } from "./numberConverter";
import { TextConverter } from "./textConverter";
import { SelectConverter } from "./selectConverter";
import { SensorConverter } from "./sensorConverter";
import { ValueConverter } from "./valueconverter";
import { Ientity, Iconverter, Converters } from 'specification.shared';
import { BinaryConverter } from "./binaryConverter";

export class ConverterMap extends Map<Converters, Converter> {
    private static converterMap = new ConverterMap();
    private static getConverterMap(): ConverterMap { return ConverterMap.converterMap; }
    private static mqttdiscoveryLanguage:string;
    static setMqttDiscoveryLanguage(lang:string){
        ConverterMap.mqttdiscoveryLanguage = lang;
    }
    static getConverters(): Iconverter[] {
        let rc: Iconverter[] = []
        ConverterMap.getConverterMap().forEach((con, name) => {
            let c: Iconverter = {
                name: name,
                functionCodes: con.getModbusFunctionCodes()
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
                functionCodes: cv.getModbusFunctionCodes()
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
            ConverterMap.converterMap.set("sensor", new SensorConverter());
            // read only: sensor
            ConverterMap.converterMap.set("text_sensor", new TextConverter());
            ConverterMap.converterMap.set("select_sensor", new SensorConverter());
            ConverterMap.converterMap.set("binary_sensor", new BinaryConverter());
            ConverterMap.converterMap.set("value_sensor", new SensorConverter());
            // read/write not a sensor
            ConverterMap.converterMap.set("number", new NumberConverter());
            ConverterMap.converterMap.set("select", new SelectConverter(ConverterMap.mqttdiscoveryLanguage));
            ConverterMap.converterMap.set("text", new TextConverter());
            ConverterMap.converterMap.set("button", new BinaryConverter());
            ConverterMap.converterMap.set("value", new ValueConverter());

        }
    })();
}


