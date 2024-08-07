import { Imessage } from '@modbus2mqtt/specification.shared'
export interface IvalidateIdentificationResult {
  specname: string
  referencedEntity?: number
}
export interface IspecificationValidator {
  validate(language: string, forContribution: boolean): Imessage[]
  validateUniqueName(language: string): boolean
  validateIdentification(language: string): IvalidateIdentificationResult[]
}
