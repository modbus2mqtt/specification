

import { IspecificationValidator, IvalidateIdentificationResult } from "./ispecificationvalidator";
import { IspecificationContributor } from "./ispecificationContributor";
let JSZip = require("jszip");
let path = require("path");
import { join } from "path";
import * as fs from 'fs';
import { IModbusData, Idata, IfileSpecification } from "./ifilespecification";
import { M2mGitHub } from "./m2mgithub";
import { Imessage, MessageTypes, MessageCategories, VariableTargetParameters, getParameterType, validateTranslation, ModbusRegisterType, ImodbusData } from '@modbus2mqtt/specification.shared';
import { ReadRegisterResult } from "./converter";
import { Ispecification, IbaseSpecification, SpecificationStatus, getSpecificationI18nName, ImodbusSpecification, getSpecificationI18nEntityName, SpecificationFileUsage, FileLocation, IdentifiedStates, ISpecificationText, ImodbusEntity, Inumber, IminMax, Iselect, Itext } from '@modbus2mqtt/specification.shared';
import { ConfigSpecification } from "./configspec";
import { ConverterMap } from "./convertermap";
import { LogLevelEnum, Logger } from "./log";
import { Mutex } from "async-mutex"
import { Observable, Subject, Subscription, merge } from "rxjs";
import { IpullRequest } from "./m2mGithubValidate";

const log = new Logger('m2mSpecification')
const debug = require('debug')('m2mspecification');

const maxIdentifiedSpecs = 0
export interface ImodbusValues {
    holdingRegisters: Map<number, ReadRegisterResult | null>,
    analogInputs: Map<number, ReadRegisterResult | null>,
    coils: Map<number, ReadRegisterResult | null>
}
export function emptyModbusValues(): ImodbusValues {
    return {
        holdingRegisters: new Map<number, ReadRegisterResult | null>(),
        coils: new Map<number, ReadRegisterResult | null>(),
        analogInputs: new Map<number, ReadRegisterResult | null>()
    }
}
interface Icontribution {
    pullRequest: number
    monitor: Subject<IpullRequest>
    pollCount: number
    interval?: NodeJS.Timeout
}
export class M2mSpecification implements IspecificationValidator, IspecificationContributor {
    private differentFilename = false
    private notBackwardCompatible = false
    private ghPollInterval: number[] = [5000, 5000 * 60, 5000 * 60 * 60, 1000 * 60 * 60 * 24];
    private ghPollIntervalIndex: number = 0
    private ghPollIntervalIndexCount: number = 0
    private static ghContributions = new Map<string, Icontribution>()

    constructor(private settings: Ispecification | ImodbusEntity[]) {
        {
            if (!(this.settings as ImodbusSpecification).i18n) {
                (this.settings as ImodbusSpecification) = {
                    filename: "",
                    i18n: [],
                    files: [],
                    status: SpecificationStatus.new,
                    entities: this.settings as ImodbusEntity[],
                    identified: IdentifiedStates.unknown
                }
            }
        }
    }
    messages2Text(msgs: Imessage[]): string {
        let errors: string = ""
        msgs.forEach(msg => {
            if (msg.type != MessageTypes.identifiedByOthers)
                errors += this.getMessageString(msg) + "\n"
        })
        return errors
    }
    contribute(note: string | undefined): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            try {
                let language = ConfigSpecification.mqttdiscoverylanguage
                let messages: Imessage[] = []

                if (language == undefined)
                    messages.push({ type: MessageTypes.noMqttDiscoveryLanguage, category: MessageCategories.configuration })
                else
                    messages = this.validate(language)
                let errors: string = this.messages2Text(messages)

                if (errors.length > 0) {

                    throw new Error("Validation failed with errors: " + errors)
                }

                if (errors.length == 0 && messages.length > 0 && (!note || note.length == 0))
                    throw new Error("Validation failed with warning, but no note text available")
                let fileList = this.getSpecificationsFilesList()
                let spec = this.settings as IbaseSpecification
                let title = ""
                let message = ""
                switch (spec.status) {
                    case SpecificationStatus.added:
                        title = "Add specification "
                        message = this.generateAddedContributionMessage(note)
                        break;
                    case SpecificationStatus.cloned:
                        title = "Update specification "
                        //if (spec.publicSpecification)
                        //  message = this.isEqual(spec.publicSpecification)
                        let pub = (spec as any).publicSpecification


                        message = this.generateClonedContributionMessage(note, pub)
                        break;
                }
                title = title + getSpecificationI18nName(spec, language!)
                if (ConfigSpecification.githubPersonalToken && ConfigSpecification.githubPersonalToken.length) {
                    let github = new M2mGitHub(ConfigSpecification.githubPersonalToken, ConfigSpecification.getPublicDir())
                    github.init().then(() => {
                        github.commitFiles(ConfigSpecification.getLocalDir(), spec.filename, fileList, title, message).then(() => {

                            github.createPullrequest(title, message, spec.filename).then(issue => {
                                new ConfigSpecification().changeContributionStatus((this.settings as IbaseSpecification).filename, SpecificationStatus.contributed, issue)
                                resolve(issue)
                            }).catch(reject)
                        }).catch(reject)
                    }).catch(reject)
                }
                else throw new Error("Github connection is not configured. Set Github Personal Acces Token in configuration UI first")
            }
            catch (e) {
                reject(e)
            }
        })
    }

    private generateAddedContributionMessage(note: string | undefined): string {
        // First contribution:
        // Name of Specification(en)
        let spec = this.settings as ImodbusSpecification
        let message = `First contribution of ${getSpecificationI18nName(spec, "en")}(${spec.filename}) \nEntities:\n`
        message = `${message}Languages: `
        spec.i18n.forEach(l => {
            message = `${message} ${l.lang} `
        })
        message = `${message}\nEntities:\n`
        spec.entities.forEach(ent => {
            message = `${message}\t${getSpecificationI18nEntityName(spec, "en", ent.id)}\n`
        })
        message = `${message}\nImages:\n`
        spec.files.forEach(file => {
            if (file.usage == SpecificationFileUsage.img)
                message = `${message}\t ${file.url}\n`
        })
        message = `${message}\nDocumentation:\n`
        spec.files.forEach(file => {
            if (file.usage == SpecificationFileUsage.documentation)
                message = `${message}\t ${file.url}\n`
        })
        return message
    }

    private generateClonedContributionMessage(note: string | undefined, publicSpecification: IfileSpecification | undefined): string {
        let rcmessage = (note ? note : "")
        this.notBackwardCompatible = false
        this.differentFilename = false
        if (publicSpecification) {
            rcmessage = rcmessage + "Changes:\n"
            let messages = this.isEqual(publicSpecification)
            messages.forEach(
                message => {
                    rcmessage = rcmessage + this.getMessageString(message) + "\n"
                })
            // TODO Check backward compatibility
            if (this.notBackwardCompatible) {
                rcmessage = rcmessage + "\n!!! There are changes which are not backward compatible !!"
                if (note == undefined)
                    throw new Error("There are changes which are not backward compatible")
            }

            if (note != undefined)
                rcmessage = rcmessage + "\n" + note

        }
        return rcmessage;
    }
    getMessageString(message: Imessage): string {
        switch (message.type) {
            case MessageTypes.noDocumentation: return (`No documenation file or URL`);
            case MessageTypes.nameTextMissing: return (`The specification has no Name`);
            case MessageTypes.entityTextMissing: return `entity has no name`
            case MessageTypes.translationMissing: return (`A translation is missing` + ": " + message.additionalInformation);
            case MessageTypes.noEntity: return (`No entity defined for this specification`);
            case MessageTypes.noDocumentation: return (`No dcoumenation file or URL`);
            case MessageTypes.noImage: return (`No image file or URL`);
            case MessageTypes.nonUniqueName: return (`Specification name is not unique`);
            case MessageTypes.identifiedByOthers: {
                let specNames: string = ""
                message.additionalInformation.forEach((name: string) => { specNames = specNames + name + " " })
                return (`Test data of this specification matches to the following other public specifications ${specNames}`);
            }
            case MessageTypes.nonUniqueName: return (` The name is already available in public ` + ": " + message.additionalInformation)
            case MessageTypes.notIdentified: return (` The specification can not be identified with it's test data`)
            case MessageTypes.differentFilename:
                this.differentFilename = true
                return this.getMessageLocal(message, "Filename has been changed. A new public specification will be created")
            case MessageTypes.missingEntity:
                if (!this.differentFilename)
                    this.notBackwardCompatible = true
                return this.getMessageLocal(message, "Entity has been removed", !this.differentFilename)
            case MessageTypes.differentConverter:
                return this.getMessageLocal(message, "Converter has been changed")
            case MessageTypes.addedEntity:
                return this.getMessageLocal(message, "Entity has been added")
            case MessageTypes.differentModbusAddress:
                return this.getMessageLocal(message, "Modbus address has been changed")
            case MessageTypes.differentFunctionCode:
                return this.getMessageLocal(message, "Function code has been changed")
            case MessageTypes.differentIcon:
                return this.getMessageLocal(message, "Icon has been changed")
            case MessageTypes.differentTargetParameter:
                return this.getMessageLocal(message, "Variable configuration: Target parameter has been changed")
            case MessageTypes.differentVariableEntityId:
                return this.getMessageLocal(message, "Variable configuration: Referenced entity has been changed")
            case MessageTypes.differentVariableConfiguration:
                return this.getMessageLocal(message, "Variable configuration has been changed")
            case MessageTypes.differentDeviceClass:
                return this.getMessageLocal(message, "Device class has been changed")
            case MessageTypes.differentIdentificationMax:
                return this.getMessageLocal(message, "Max value has been changed")
            case MessageTypes.differentIdentificationMin:
                return this.getMessageLocal(message, "Min value has been changed")
            case MessageTypes.differentIdentification:
                return this.getMessageLocal(message, "Identification has been changed")
            case MessageTypes.differentMultiplier:
                return this.getMessageLocal(message, "Multiplier has been changed")
            case MessageTypes.differentOffset:
                return this.getMessageLocal(message, "Offset has been changed")
            case MessageTypes.differentOptionTable:
                return this.getMessageLocal(message, "Options have been changed")
            case MessageTypes.differentStringlength:
                return this.getMessageLocal(message, "String length has been changed")
            case MessageTypes.differentManufacturer:
                return this.getMessageLocal(message, "Manufacturer has been changed")
            case MessageTypes.differentModel:
                return this.getMessageLocal(message, "Model has been changed")
            case MessageTypes.differentTranslation:
                return this.getMessageLocal(message, "Translation has been changed")

            case MessageTypes.noMqttDiscoveryLanguage:
                return this.getMessageLocal(message, "MQTT Discovery Langauge is not configured")
        }
        return "unknown MessageType : " + message.type
    }
    private getMessageLocal(message: Imessage, messageText: string, notBackwardCompatible?: boolean): string {
        let msg = structuredClone(messageText)
        if (message.referencedEntity != undefined)
            return msg + " " + getSpecificationI18nEntityName(this.settings as IbaseSpecification, "en", message.referencedEntity)
        if (message.additionalInformation != undefined)
            return msg + " " + message.additionalInformation
        if (!notBackwardCompatible)
            return " This will break compatibilty with previous version"
        return msg
    }
    private handleCloseContributionError(msg: string, reject: (e: any) => void): void {
        log.log(LogLevelEnum.error, msg)
        let e = new Error(msg);
        (e as any).step = "closeContribution"
        reject(e)
    }
    closeContribution(): Promise<IpullRequest> {
        return new Promise<IpullRequest>((resolve, reject) => {

            if (undefined == ConfigSpecification.githubPersonalToken) {
                this.handleCloseContributionError(
                    "No Github Personal Access Token configured. Unable to close contribution " + (this.settings as IfileSpecification).filename,
                    reject)
                return
            }
            let spec = this.settings as IfileSpecification
            if (spec.pullNumber == undefined) {
                this.handleCloseContributionError("No Pull Number in specification. Unable to close contribution " + spec.filename, reject)
                return
            }
            let gh = new M2mGitHub(ConfigSpecification.githubPersonalToken!, join(ConfigSpecification.yamlDir, "public"))
            gh.init().then(() => {
                gh.getPullRequest(spec.pullNumber!).
                    then(pullStatus => {
                        try {
                            if (pullStatus.merged) {
                                new ConfigSpecification().changeContributionStatus(spec.filename, SpecificationStatus.published, undefined)

                            }
                            else if (pullStatus.closed_at != null) {
                                new ConfigSpecification().changeContributionStatus(spec.filename, SpecificationStatus.added, undefined)
                            }
                            if (spec.status != SpecificationStatus.contributed)
                                gh.deleteSpecBranch(spec.filename)
                            gh.fetchPublicFiles()
                            resolve({ merged: pullStatus.merged, closed: pullStatus.closed_at != null, pullNumber: spec.pullNumber! })
                        } catch (e: any) { this.handleCloseContributionError("closeContribution: " + e.message, reject) }
                    }).catch(e => {
                        this.handleCloseContributionError("closeContribution: " + e.message, reject)
                    })
            }).catch(e => {
                this.handleCloseContributionError("closeContribution: " + e.message, reject)
            })
        })


    }
    getSpecificationsFilesList(): string[] {
        let files: string[] = []
        let spec = this.settings as IbaseSpecification
        spec.files.forEach(fs => {
            if (fs.fileLocation == FileLocation.Local)
                files.push(fs.url.replace(/^\//g, ""))
        })
        if (files.length > 0) {
            let p = path.dirname(files[0])
            files.push(join(p, "files.yaml"))
        }
        files.push(join("specifications", spec.filename + ".yaml"))
        return files;
    }

    writeFiles2Stream(root: string, res: NodeJS.WritableStream): void {
        let zip = new JSZip()
        let files = this.getSpecificationsFilesList()
        files.forEach(file => {
            zip.file(file, fs.readFileSync(join(root, file)))
        })
        zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true }).pipe(res).on('finish', function () {
            log.log(LogLevelEnum.notice, "out.zip written.");
        })
    }

    validate(language: string): Imessage[] {
        let rc = this.validateSpecification(language, true)
        let identfied = this.validateIdentification(language)
        if (identfied.length > maxIdentifiedSpecs)
            rc.push({ type: MessageTypes.identifiedByOthers, category: MessageCategories.validateOtherIdentification, additionalInformation: identfied })

        if (!this.validateUniqueName(language))
            rc.push({ type: MessageTypes.nonUniqueName, category: MessageCategories.validateSpecification })
        let mSpec = M2mSpecification.fileToModbusSpecification(this.settings as IfileSpecification)
        if (mSpec.identified != undefined)
            mSpec = M2mSpecification.fileToModbusSpecification(this.settings as IfileSpecification)
        if (mSpec.identified != IdentifiedStates.identified)
            rc.push({ type: MessageTypes.notIdentified, category: MessageCategories.validateSpecification })
        return rc;
    }

    validateUniqueName(language: string): boolean {
        let name = getSpecificationI18nName(this.settings as IbaseSpecification, language)
        let rc = true;
        new ConfigSpecification().filterAllSpecifications((spec) => {
            if (rc && (this.settings as IbaseSpecification).filename != spec.filename) {
                let texts = spec.i18n.find(lang => lang.lang == language)
                if (texts && texts.texts)
                    if ((texts.texts as ISpecificationText[]).find(text => text.textId == 'name' && text.text == name))
                        rc = false;
            }
        })
        return rc;
    }
    static fileToModbusSpecification(inSpec: IfileSpecification, values?: ImodbusValues): ImodbusSpecification {
        let valuesLocal = values
        if (valuesLocal == undefined) {
            valuesLocal = emptyModbusValues()
        }
        // copy from test data if there are no values passed
        if (values == undefined && inSpec.testdata && (
            (inSpec.testdata.analogInputs && inSpec.testdata.analogInputs.length > 0) ||
            (inSpec.testdata.holdingRegisters && inSpec.testdata.holdingRegisters.length > 0) ||
            (inSpec.testdata.coils && inSpec.testdata.coils.length > 0)
        )) {
            inSpec.testdata.holdingRegisters?.forEach(data => {
                valuesLocal!.holdingRegisters.set(data.address, data.value != null ? { data: [data.value], buffer: Buffer.from([data.value]) } : null)
            })
            inSpec.testdata.analogInputs?.forEach(data => {
                valuesLocal!.analogInputs.set(data.address, data.value != null ? { data: [data.value], buffer: Buffer.from([data.value]) } : null)
            })
            inSpec.testdata.coils?.forEach(data => {
                valuesLocal!.coils.set(data.address, data.value != null ? { data: [data.value], buffer: Buffer.from([data.value]) } : null)
            })
        }

        let rc: ImodbusSpecification = Object.assign(inSpec);
        for (let entityIndex = 0; entityIndex < inSpec.entities.length; entityIndex++) {
            let entity = rc.entities[entityIndex];
            if (entity.modbusAddress != undefined && entity.registerType) {
                let sm = M2mSpecification.copyModbusDataToEntity(rc, entity.id, valuesLocal);
                if (sm) {
                    rc.entities[entityIndex] = sm;
                }
            }
        }
        rc.identified = IdentifiedStates.unknown;
        rc.entities.forEach(ent => {
            switch (ent.identified) {
                case IdentifiedStates.notIdentified:
                    rc.identified = IdentifiedStates.notIdentified;
                    break;
                case IdentifiedStates.identified:
                    if (rc.identified == undefined || rc.identified == IdentifiedStates.unknown)
                        rc.identified = IdentifiedStates.identified;
                    break;
            }
        });

        return rc;
    }

    static copyModbusDataToEntity(spec: Ispecification, entityId: number, values: ImodbusValues): ImodbusEntity {
        let entity = spec.entities.find(ent => entityId == ent.id)
        if (entity) {
            let rc: ImodbusEntity = (structuredClone(entity) as ImodbusEntity);
            let converter = ConverterMap.getConverter(entity);
            if (converter) {
                if (entity.modbusAddress != undefined) {
                    try {
                        var data: ReadRegisterResult = { data: [], buffer: Buffer.from("") };
                        for (let address = entity.modbusAddress; address < entity.modbusAddress + converter.getModbusLength(entity); address++) {
                            let value: ReadRegisterResult | undefined | null = undefined

                            switch (entity.registerType) {
                                case ModbusRegisterType.AnalogInputs:
                                    value = values.analogInputs.get(address)
                                    break;
                                case ModbusRegisterType.HoldingRegister:
                                    value = values.holdingRegisters.get(address)
                                    break;
                                case ModbusRegisterType.Coils:
                                    value = values.coils.get(address)
                                    break;

                            }
                            if (value) {
                                data.data = data.data.concat(value.data)
                                if (address == entity.modbusAddress)
                                    data.buffer = Buffer.concat([value.buffer])
                                else
                                    data.buffer = Buffer.concat([data.buffer, value.buffer])
                            }
                        }
                        if (data.data.length > 0) {
                            let mqtt = converter.modbus2mqtt(spec, entity.id, data);
                            let identified = IdentifiedStates.unknown;
                            if (entity.converterParameters)
                                if ((entity.converter.name === "number")) {
                                    if (!(entity.converterParameters as Inumber).identification)
                                        (entity as ImodbusEntity).identified = IdentifiedStates.unknown;
                                    else {
                                        //Inumber
                                        let mm: IminMax = (entity.converterParameters as Inumber).identification!;
                                        identified = (mm.min <= (mqtt as number) && (mqtt as number) <= mm.max ? IdentifiedStates.identified : IdentifiedStates.notIdentified)
                                    }
                                }
                                else {
                                    if (!(entity.converterParameters as Itext).identification) {
                                        if ((entity.converterParameters as Iselect).options || (entity.converterParameters as Iselect).optionModbusValues) {
                                            // Iselect
                                            identified = (mqtt != null ? IdentifiedStates.identified : IdentifiedStates.notIdentified)
                                        } else { // no Converter parameters
                                            identified = ((mqtt as string).length ? IdentifiedStates.identified : IdentifiedStates.unknown)
                                        }
                                    }
                                    else {
                                        // Itext
                                        let reg = (entity.converterParameters as Itext).identification;
                                        if (reg) {
                                            let re = new RegExp("^" + reg + "$");
                                            identified = re.test((mqtt as string)) ? IdentifiedStates.identified : IdentifiedStates.notIdentified
                                        }

                                    }

                                }
                            rc.identified = identified;
                            rc.mqttValue = mqtt;
                            rc.modbusValue = data.data;
                        }
                        else {
                            rc.identified = IdentifiedStates.notIdentified;
                            rc.mqttValue = "";
                            rc.modbusValue = [];
                        }
                    } catch (error) {
                        log.log(LogLevelEnum.error, error);
                    }
                }
                else {
                    log.log(LogLevelEnum.error, "entity has no modbusaddress: entity id:" + entity.id + " converter:" + entity.converter);
                    // It remains an Ientity
                }
            }
            else
                log.log(LogLevelEnum.error, "Converter not found: " + spec.filename + " " + entity.converter.name + " entity id: " + + entity.id);

            return rc;
        }
        else {
            let msg = "EntityId " + entityId + " not found in specifcation "
            log.log(LogLevelEnum.error, msg)
            throw new Error(msg)
        }
    }


    validateIdentification(language: string): IvalidateIdentificationResult[] {
        let identifiedSpecs: IvalidateIdentificationResult[] = [];
        let values = emptyModbusValues()
        let fSettings: IfileSpecification
        if ((this.settings as IfileSpecification).testdata)
            fSettings = (this.settings as IfileSpecification)
        else
            fSettings = ConfigSpecification.toFileSpecification(this.settings as ImodbusSpecification)

        fSettings.testdata.holdingRegisters?.forEach(data => {
            values.holdingRegisters.set(data.address, data.value != null ? { data: [data.value], buffer: Buffer.from([data.value]) } : null)
        })
        fSettings.testdata.analogInputs?.forEach(data => {
            values.analogInputs.set(data.address, data.value != null ? { data: [data.value], buffer: Buffer.from([data.value]) } : null)
        })
        fSettings.testdata.coils?.forEach(data => {
            values.coils.set(data.address, data.value != null ? { data: [data.value], buffer: Buffer.from([data.value]) } : null)
        })
        new ConfigSpecification().filterAllSpecifications((spec) => {
            if ([SpecificationStatus.cloned, SpecificationStatus.published, SpecificationStatus.contributed].includes(spec.status)) {
                var mSpec: ImodbusSpecification | undefined = undefined
                var fSpec: IfileSpecification = spec

                switch (spec.status) {
                    case SpecificationStatus.published:
                        mSpec = M2mSpecification.fileToModbusSpecification(spec, values)
                        break;
                    case SpecificationStatus.contributed:
                        if (spec.publicSpecification) {
                            mSpec = M2mSpecification.fileToModbusSpecification(spec.publicSpecification, values)
                            fSpec = spec.publicSpecification
                        }
                        else
                            mSpec = M2mSpecification.fileToModbusSpecification(spec, values)
                        break;
                    case SpecificationStatus.cloned:
                        if (spec.publicSpecification) {
                            mSpec = M2mSpecification.fileToModbusSpecification(spec.publicSpecification, values)
                            fSpec = spec.publicSpecification
                        }
                        else
                            log.log(LogLevelEnum.error, "Cloned Specification with no public Specification " + spec.filename)
                        break;
                    default:
                        mSpec = M2mSpecification.fileToModbusSpecification(fSpec, values)
                }
                let specName = getSpecificationI18nName(spec, language)
                if (fSettings.filename != spec.filename) {
                    let allMatch = this.allNullValuesMatch(spec, values)
                    if (allMatch && mSpec && mSpec.identified == IdentifiedStates.identified) {

                        let ent = mSpec.entities.find(ent => ent.identified == IdentifiedStates.notIdentified)
                        if (specName)
                            identifiedSpecs.push({ specname: specName, referencedEntity: ent?.id })
                        else
                            identifiedSpecs.push({ specname: "unknown", referencedEntity: ent?.id })
                    }
                }
            }
        })
        return identifiedSpecs;
    }
    allNullDataMatch(datas: Idata[] | undefined, values: Map<number, ReadRegisterResult | null>): boolean {
        let rc = true
        if (datas)
            datas.forEach(data => {
                if (data.value == null && values.get(data.address) != null)
                    rc = false;
            })
        return rc
    }
    allNullValuesMatch(spec: IfileSpecification, values: ImodbusValues): boolean {
        let rc = this.allNullDataMatch(spec.testdata.holdingRegisters, values.holdingRegisters)
        if (!rc)
            return false;
        rc = this.allNullDataMatch(spec.testdata.analogInputs, values.analogInputs)
        if (!rc)
            return false;
        return this.allNullDataMatch(spec.testdata.coils, values.coils);
    }
    static getWriteFunctionCode(functionCode: ModbusRegisterType): number {
        switch (functionCode) {
            case ModbusRegisterType.HoldingRegister:
                return 16
            case ModbusRegisterType.Coils:
                return 15
            default:
                throw new Error("No Registertype available or Registertype is not writable ")
        }
    }

    static getReadFunctionCode(functionCode: ModbusRegisterType): number | undefined {
        return functionCode
    }
    private getPropertyFromVariable(entityId: number, targetParameter: VariableTargetParameters): string | number | undefined {
        let ent = (this.settings as ImodbusSpecification).entities.find(e => e.variableConfiguration &&
            e.variableConfiguration.targetParameter == targetParameter &&
            (e.variableConfiguration.entityId && e.variableConfiguration.entityId == entityId))
        if (ent)
            return ent.mqttValue
        return undefined
    }
    private getEntityFromId(entityId: number): ImodbusEntity | undefined {
        let ent = (this.settings as ImodbusSpecification).entities.find(e => e.id == entityId)
        if (!ent)
            return undefined
        return ent
    }
    static getFileUsage(url: string): SpecificationFileUsage {
        let name = url.toLowerCase();
        if (name.endsWith('.pdf'))
            return SpecificationFileUsage.documentation;
        if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.bmp'))
            return SpecificationFileUsage.img;
        return SpecificationFileUsage.documentation
    }
    getUom(entityId: number): string | undefined {
        let rc = this.getPropertyFromVariable(entityId, VariableTargetParameters.entityUom)
        if (rc)
            return rc as string | undefined;
        let ent = this.getEntityFromId(entityId)
        if (!ent || !ent.converterParameters || !(ent.converterParameters as Inumber)!.uom)
            return undefined

        return (ent.converterParameters as Inumber)!.uom
    }
    getMultiplier(entityId: number): number | undefined {
        let rc = this.getPropertyFromVariable(entityId, VariableTargetParameters.entityMultiplier)
        if (rc)
            return rc as number | undefined;
        let ent = this.getEntityFromId(entityId)
        if (!ent || !ent.converterParameters || undefined == (ent.converterParameters as Inumber)!.multiplier)
            return undefined

        return (ent.converterParameters as Inumber)!.multiplier
    }
    getOffset(entityId: number): number | undefined {
        let rc = this.getPropertyFromVariable(entityId, VariableTargetParameters.entityOffset)
        if (rc)
            return rc as number | undefined;
        let ent = this.getEntityFromId(entityId)
        if (!ent || !ent.converterParameters || (ent.converterParameters as Inumber)!.offset == undefined)
            return undefined
        return (ent.converterParameters as Inumber)!.offset
    }
    isVariable(checkParameter: VariableTargetParameters): boolean {
        let ent = (this.settings as ImodbusSpecification).entities.find(e => e.variableConfiguration &&
            e.variableConfiguration.targetParameter == checkParameter)
        return ent != undefined
    }

    isEqualValue(v1: any, v2: any): boolean {
        if (!v1 && !v2)
            return true
        if (v1 && v2 && v1 == v2)
            return true
        return false;
    }
    isEqual(other: Ispecification): Imessage[] {
        let rc: Imessage[] = [];
        let spec = this.settings as ImodbusSpecification
        if (spec.filename != other.filename)
            rc.push({ type: MessageTypes.differentFilename, category: MessageCategories.compare });
        spec.entities.forEach(ent => {
            if (!other.entities.find(oent => oent.id == ent.id))
                rc.push({ type: MessageTypes.addedEntity, category: MessageCategories.compareEntity, referencedEntity: ent.id })
        })
        other.entities.forEach((oent) => {
            let ent = spec.entities.find(ent => oent.id == ent.id)
            if (!ent)
                rc.push({ type: MessageTypes.missingEntity, category: MessageCategories.compare, additionalInformation: getSpecificationI18nEntityName(other, "en", oent.id) })
            else {
                if (!this.isEqualValue(oent.converter.name, ent.converter.name))
                    rc.push({ type: MessageTypes.differentConverter, category: MessageCategories.compareEntity, referencedEntity: ent.id })
                if (!this.isEqualValue(oent.modbusAddress, ent.modbusAddress))
                    rc.push({ type: MessageTypes.differentModbusAddress, category: MessageCategories.compareEntity, referencedEntity: ent.id })
                if (!this.isEqualValue(oent.registerType, ent.registerType))
                    rc.push({ type: MessageTypes.differentFunctionCode, category: MessageCategories.compareEntity, referencedEntity: ent.id })
                if (!this.isEqualValue(oent.icon, ent.icon))
                    rc.push({ type: MessageTypes.differentIcon, category: MessageCategories.compareEntity, referencedEntity: ent.id })
                if (oent.variableConfiguration && ent.variableConfiguration) {
                    if (!this.isEqualValue(oent.variableConfiguration.targetParameter, ent.variableConfiguration.targetParameter))
                        rc.push({ type: MessageTypes.differentTargetParameter, category: MessageCategories.compareEntity, referencedEntity: ent.id })
                    else if (!this.isEqualValue(oent.variableConfiguration.entityId, ent.variableConfiguration.entityId))
                        rc.push({ type: MessageTypes.differentVariableEntityId, category: MessageCategories.compareEntity, referencedEntity: ent.id })
                }
                else if (oent.variableConfiguration || ent.variableConfiguration)
                    rc.push({ type: MessageTypes.differentVariableConfiguration, category: MessageCategories.compareEntity, referencedEntity: ent.id })
                if (ent.converterParameters && oent.converterParameters)
                    switch (getParameterType(oent.converter)) {
                        case "Inumber": if (!this.isEqualValue((oent.converterParameters as Inumber).device_class, (ent.converterParameters as Inumber).device_class))
                            rc.push({ type: MessageTypes.differentDeviceClass, category: MessageCategories.compareEntity, referencedEntity: ent.id })
                            if ((oent.converterParameters as Inumber).identification && (ent.converterParameters as Inumber).identification) {
                                if (!this.isEqualValue((oent.converterParameters as Inumber).identification!.max, (ent.converterParameters as Inumber).identification!.max))
                                    rc.push({ type: MessageTypes.differentIdentificationMax, category: MessageCategories.compareEntity, referencedEntity: ent.id })
                                else
                                    if (!this.isEqualValue((oent.converterParameters as Inumber).identification!.min, (ent.converterParameters as Inumber).identification!.min))
                                        rc.push({ type: MessageTypes.differentIdentificationMin, category: MessageCategories.compareEntity, referencedEntity: ent.id })
                            }
                            else if ((oent.converterParameters as Inumber).identification || (ent.converterParameters as Inumber).identification)
                                rc.push({ type: MessageTypes.differentIdentification, category: MessageCategories.compareEntity, referencedEntity: ent.id })
                            if (!this.isEqualValue((oent.converterParameters as Inumber).multiplier, (ent.converterParameters as Inumber).multiplier))
                                rc.push({ type: MessageTypes.differentMultiplier, category: MessageCategories.compareEntity, referencedEntity: ent.id })
                            if (!this.isEqualValue((oent.converterParameters as Inumber).offset, (ent.converterParameters as Inumber).offset))
                                rc.push({ type: MessageTypes.differentOffset, category: MessageCategories.compareEntity, referencedEntity: ent.id })
                            break;
                        case "Iselect": if (JSON.stringify((oent.converterParameters as Iselect).optionModbusValues) != JSON.stringify((ent.converterParameters as Iselect).optionModbusValues))
                            rc.push({ type: MessageTypes.differentOptionTable, category: MessageCategories.compareEntity, referencedEntity: ent.id })
                            break;
                        case "Itext": if (!this.isEqualValue((oent.converterParameters as Itext).stringlength, (ent.converterParameters as Itext).stringlength))
                            rc.push({ type: MessageTypes.differentStringlength, category: MessageCategories.compareEntity, referencedEntity: ent.id })
                            if (!this.isEqualValue((oent.converterParameters as Itext).identification, (ent.converterParameters as Itext).identification))
                                rc.push({ type: MessageTypes.differentIdentification, category: MessageCategories.compareEntity, referencedEntity: ent.id })
                            break;
                    }
            }
        })

        if (JSON.stringify(spec.i18n) != JSON.stringify(other.i18n))
            rc.push({ type: MessageTypes.differentTranslation, category: MessageCategories.compare })
        if (!this.isEqualValue(spec.manufacturer, other.manufacturer))
            rc.push({ type: MessageTypes.differentManufacturer, category: MessageCategories.compare })
        if (!this.isEqualValue(spec.model, other.model))
            rc.push({ type: MessageTypes.differentModel, category: MessageCategories.compare })
        if (!this.isEqualValue(spec.identification, other.identification))
            rc.push({ type: MessageTypes.differentIdentification, category: MessageCategories.compare })
        return rc;
    }

    validateFiles(msgs: Imessage[]) {
        let category = MessageCategories.validateFiles
        let spec = this.settings as ImodbusSpecification
        let hasDocumentation = false;
        let hasImage = false;
        spec.files.forEach(f => {
            if (f.usage == SpecificationFileUsage.documentation)
                hasDocumentation = true
            if (f.usage == SpecificationFileUsage.img)
                hasImage = true
        })
        if (!hasDocumentation)
            msgs.push({ type: MessageTypes.noDocumentation, category: category })
        if (!hasImage)
            msgs.push({ type: MessageTypes.noImage, category: category })
    }
    validateSpecification(language: string, forContribution: boolean = false): Imessage[] {
        let msgs: Imessage[] = []
        let spec = this.settings as ImodbusSpecification
        if (spec.entities.length == 0)
            msgs.push({ type: MessageTypes.noEntity, category: MessageCategories.validateEntity })
        this.validateFiles(msgs)
        validateTranslation(spec, language, msgs)
        if (forContribution)
            validateTranslation(spec, "en", msgs)
        return msgs
    }
    getBaseFilename(filename: string): string {
        let idx = filename.lastIndexOf('/')
        if (idx >= 0)
            return filename.substring(idx + 1);
        return filename;
    }
    private static copyNullValues(slaveData: Map<number, ReadRegisterResult | null>, testdata: (Idata | null)[]) {
        for (let address of slaveData.keys()) {
            let value = slaveData.get(address)
            if (value == null)
                testdata.push({ address: address, value: null })
        }
    }
    static getEmptyModbusAddressesFromSlaveToTestdata(slaveAddresses: ImodbusValues): IModbusData {
        let testdata: IModbusData = { holdingRegisters: [], analogInputs: [], coils: [] }
        if (testdata.holdingRegisters)
            M2mSpecification.copyNullValues(slaveAddresses.holdingRegisters, testdata.holdingRegisters)
        if (testdata.analogInputs)
            M2mSpecification.copyNullValues(slaveAddresses.analogInputs, testdata.analogInputs)
        if (testdata.coils)
            M2mSpecification.copyNullValues(slaveAddresses.coils, testdata.coils)
        return testdata
    }
    startPolling(error: (e: any) => void): Observable<IpullRequest> | undefined {
        debug("startPolling")
        let spec = (this.settings as IfileSpecification)
        let contribution = M2mSpecification.ghContributions.get(spec.filename)
        if (contribution == undefined && spec.pullNumber) {
            debug("startPolling for pull Number " + spec.pullNumber)
            let c: Icontribution = {
                pullRequest: spec.pullNumber,
                monitor: new Subject<IpullRequest>(),
                pollCount: 0,
                interval: setInterval(() => {
                    this.poll(error)
                }, 100)
            }
            M2mSpecification.ghContributions.set(spec.filename, c)
            return c.monitor;
        }
        return undefined
    }
    private poll(error: (e: any) => void) {
        let spec = (this.settings as IfileSpecification)
        if (ConfigSpecification.githubPersonalToken == undefined || spec.status != SpecificationStatus.contributed || spec.pullNumber == undefined)
            return;

        let contribution = M2mSpecification.ghContributions.get(spec.filename)
        if (contribution == undefined) {
            this.handleCloseContributionError("Unexpected undefined contribution", error)
        }
        else {
            if (contribution.pollCount > this.ghPollInterval[this.ghPollIntervalIndex] / 100)
                contribution.pollCount = 0
            if (contribution.pollCount == 0) {
                // Set ghPollIntervalIndex (Intervall duration)
                // 10 * every 5 second, 10 * every 5 minutes, 10 * every 5 hours, then once a day
                if (this.ghPollIntervalIndexCount++ >= 10 &&
                    this.ghPollIntervalIndex < this.ghPollInterval.length - 1) {
                    this.ghPollIntervalIndex++
                    this.ghPollIntervalIndexCount = 0
                }
                this.closeContribution().then((pullStatus) => {
                    debug("contribution closed for pull Number " + spec.pullNumber)
                    if (contribution) {
                        contribution.monitor.next(pullStatus)
                        if (pullStatus.closed || pullStatus.merged) {
                            clearInterval(contribution.interval)
                            M2mSpecification.ghContributions.delete(spec.filename)
                            contribution.monitor.complete()
                        }
                    }
                }).catch(error).finally(() => {
                })
            }
            contribution.pollCount++

        }
    }
}