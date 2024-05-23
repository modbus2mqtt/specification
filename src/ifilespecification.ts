import { Ispecification } from "specification.shared";

export interface IfileSpecification extends Ispecification {
    version: string;
    testdata: {
        address: number;
        value: number;
    }[]
}