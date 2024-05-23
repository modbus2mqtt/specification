import { Imessage } from "specification.shared";

export interface IspecificationValidator {
    validate(language: string, forContribution: boolean): Imessage[];
    validateUniqueName(language: string): boolean;
    validateIdentification(language: string,): string[];
}

