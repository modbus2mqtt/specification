import { Ispecification } from "specification.shared";
export interface Idata {
    address:number,
    value:number,
}
export interface IModbusData {
    coils?: Idata[],
    holdingRegisters?: Idata[],
    analogInputs?: Idata[]
}
export interface IfileSpecification extends Ispecification {
    version: string;
    publicSpecification?: IfileSpecification; // used to compare cloned or contributed with public specs on the angular client.
   
    testdata: IModbusData
}