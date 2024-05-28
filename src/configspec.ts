import { parse, stringify } from 'yaml';
import * as fs from 'fs';
import * as path from 'path';
import { join } from 'path';
import { LogLevelEnum, Logger }from './log'
import { EnumNumberFormat, FileLocation, IbaseSpecification, IimageAndDocumentUrl, ImodbusSpecification, Inumber, ModbusRegisterType, SPECIFICATION_VERSION, SpecificationFileUsage, SpecificationStatus, getSpecificationI18nName } from 'specification.shared';
import { getBaseFilename } from "specification.shared";
import { IModbusData, IfileSpecification } from './ifilespecification';
import { ConverterMap } from './convertermap';
import { M2mSpecification } from './m2mspecification';
import { Migrator } from './migrator';

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            HASSIO_TOKEN: string;
        }
    }
}


const log = new Logger("config")
const secretsLength = 256
const saltRounds = 8
const defaultTokenExpiryTime = 1000 * 60 * 60 * 24 // One day
export const filesUrlPrefix = 'specifications/files'
//const baseTopic = 'modbus2mqtt';
//const baseTopicHomeAssistant = 'homeassistant';
export class ConfigSpecification {
   
    static getPublicDir(): string {
        return join(ConfigSpecification.yamlDir, "public")
    }
    static getLocalDir(): string {
        return join(ConfigSpecification.yamlDir, "local")
    }
    constructor(){}
    getPublicSpecificationPath(spec: IbaseSpecification): string {
        return ConfigSpecification.yamlDir + "/public/specifications/" + spec.filename + ".yaml"
    }
    getContributedSpecificationPath(spec: IbaseSpecification): string {
        return ConfigSpecification.yamlDir + "/contributed/specifications/" + spec.filename + ".yaml"
    }
    getSpecificationPath(spec: IbaseSpecification): string {
        return ConfigSpecification.yamlDir + "/local/specifications/" + spec.filename + ".yaml"
    }
    private getLocalFilesPath(specfilename: string): string {
        return getSpecificationImageOrDocumentUrl(join(ConfigSpecification.yamlDir, "local"), specfilename, "")
    }
    appendSpecificationUrl(specfilename: string, url: IimageAndDocumentUrl): IimageAndDocumentUrl[] | undefined {
        let filesPath = this.getLocalFilesPath(specfilename)
        if (filesPath && !fs.existsSync(filesPath))
            fs.mkdirSync(filesPath, { recursive: true })

        let files: IimageAndDocumentUrl[] = []
        if (fs.existsSync(filesPath)) {
            let filesName = join(filesPath, "files.yaml")
            try {
                let content = fs.readFileSync(filesName, { encoding: 'utf8' })
                files = parse(content.toString())
            } catch (e: any) {
                console.error("Unable to read Files directory for " + filesName)
            }
            if (files.find(uf => uf.url == url.url && uf.usage == url.usage) == null) {
                files.push(url)
                fs.writeFileSync(filesName, stringify(files), { encoding: 'utf8', flag: 'w' })
                let spec = ConfigSpecification.specifications.find(spec => spec.filename == specfilename)
                if (spec)
                    spec.files = files
            }
        } else {
            console.error("Path does not exist " + filesPath)
        }
        return files ? files : undefined;
    }
    appendSpecificationFile(specfilename: string, filename: string, usage: SpecificationFileUsage): IimageAndDocumentUrl[] | undefined {
        if (!usage)
            usage = M2mSpecification.getFileUsage(filename)
        let url = getSpecificationImageOrDocumentUrl(this.getLocalFilesPath(filename), specfilename, filename)
        let iurl = { url: url, fileLocation: FileLocation.Local, usage: usage };
        return this.appendSpecificationUrl(specfilename, iurl)
    }

    private static specifications: IfileSpecification[];
    

    static yamlDir: string = "";

    
    private readFilesYaml(directory: string, spec: IfileSpecification) {
        let fp = join(directory, "files", spec.filename, "files.yaml")

        if (fs.existsSync(fp)) {
            let src = fs.readFileSync(fp, { encoding: 'utf8' });
            let f: IimageAndDocumentUrl[] = parse(src)
            spec.files = f;
        }
        else {
            log.log(LogLevelEnum.notice,"File not found: " + fp)
            spec.files = []
        }
        spec.files.forEach(file => {
            if (file.fileLocation == FileLocation.Local) {
                let url = getSpecificationImageOrDocumentUrl(this.getLocalFilesPath(spec.filename), spec.filename, file.url)
                file.url = url;
            }
        })
    }
    private readspecifications(directory: string): IfileSpecification[] {
        var rc: IfileSpecification[] = [];
        if (!fs.existsSync(directory)) {
            log.log(LogLevelEnum.notice, "specifications directory not found " + directory);
            return rc;
        }
        var files: string[] = fs.readdirSync(directory);
        files.forEach((file: string) => {
            try {
                if (file.endsWith(".yaml")) {
                    let newfn = file.replace(".yaml", "");
                    var src: string = fs.readFileSync(directory + "/" + file, { encoding: 'utf8' });
                    var o: IfileSpecification = parse(src);
                    if (o.version != SPECIFICATION_VERSION ){
                        o = new Migrator().migrate(o)
                    }

                    o.filename = newfn;
                    this.readFilesYaml(directory, o)
                    o.entities.forEach(entity => {
                        let cv = ConverterMap.getIConverter(entity)
                        if (cv) {
                            entity.converter = cv;
                            let inumber = (entity.converterParameters as Inumber)
                            if (inumber.multiplier != undefined && inumber.numberFormat == undefined) {
                                inumber.numberFormat = EnumNumberFormat.default
                            }
                        }
                        if (!o.nextEntityId || entity.id > o.nextEntityId + 1)
                            o.nextEntityId = entity.id + 1
                    })
                    //debug("specifications: " + getSpecificationI18nName(o, "en") + " filename:" + o.filename + " new: " + newfn);
                    if (!o.files)
                        o.files = [];
                    rc.push(o);
                }
            }
            catch (e: any) {
                log.log(LogLevelEnum.error, "Unable to load spec " + file + " continuing " + e.message);
            }
        });
        return rc;
    }
   
    // set the base file for relative includes
    readYaml(): void {
        try {
   
            var publishedSpecifications: IfileSpecification[] = this.readspecifications(ConfigSpecification.yamlDir + "/public/specifications");
            var contributedSpecifications: IfileSpecification[] = this.readspecifications(ConfigSpecification.yamlDir + "/contributed/specifications");
            ConfigSpecification.specifications = this.readspecifications(ConfigSpecification.yamlDir + "/local/specifications");
            ConfigSpecification.specifications.forEach((specification: IfileSpecification) => {
                let published = publishedSpecifications.find(obj => { return obj.filename === specification.filename })
                if (!published)
                    specification.status = SpecificationStatus.added; // local only
                else {
                    specification.status = SpecificationStatus.cloned; // contributed expect no local
                    specification.publicSpecification = published
                }
            });
            contributedSpecifications.forEach((specification: IfileSpecification) => {
                if (-1 == ConfigSpecification.specifications.findIndex(obj => { return obj.filename === specification.filename })) {
                    let published = publishedSpecifications.find(obj => { return obj.filename === specification.filename })
                    if (published)
                        specification.publicSpecification = published;
                    ConfigSpecification.specifications.push(specification);
                };
            });
            publishedSpecifications.forEach((specification: IfileSpecification) => {
                if (-1 == ConfigSpecification.specifications.findIndex(obj => { return obj.filename === specification.filename })) {
                    specification.status = SpecificationStatus.published;
                    ConfigSpecification.specifications.push(specification);
                };
            });

            //debug("Number of specifications: " + ConfigSpecification.specifications.length);
     
        }
        catch (error: any) {
            log.log(LogLevelEnum.error, "readyaml failed: " + error.message);
            throw error;
            // Expected output: ReferenceError: nonExistentFunction is not defined
            // (Note: the exact output may be browser-dependent)
        }
    }
    filterAllSpecifications(specFunction: (spec: IfileSpecification) => void) {
        for (let spec of ConfigSpecification.specifications) {
            specFunction(spec);
        }
    }
    
   static emptyTestData = {holdingRegisters:[],coils:[],analogInputs:[]}
    // removes non configuration data
    // Adds  testData array from Modbus values. They can be used to test specification
    static toFileSpecification(modbusSpec: ImodbusSpecification, testdata:IModbusData =this.emptyTestData): IfileSpecification {
        let fileSpec: IfileSpecification = { ...modbusSpec, version: SPECIFICATION_VERSION, testdata: structuredClone(this.emptyTestData) }
        delete fileSpec['identification'];
        // delete (fileSpec as any)['status'];
        fileSpec.testdata = testdata;
        modbusSpec.entities.forEach(entity => {
            if (entity.modbusValue)
                for (let idx = 0; idx < entity.modbusValue.length; idx++){
                    switch( entity.registerType){
                        case ModbusRegisterType.AnalogInputs:
                            fileSpec.testdata.analogInputs?.push({ address: entity.modbusAddress + idx, value: entity.modbusValue[idx] })
                            break;
                        case ModbusRegisterType.HoldingRegister:
                            fileSpec.testdata.holdingRegisters?.push({ address: entity.modbusAddress + idx, value: entity.modbusValue[idx] })
                            break;                    
                        case ModbusRegisterType.Coils:
                            fileSpec.testdata.coils?.push({ address: entity.modbusAddress + idx, value: entity.modbusValue[idx] })
                            break;
                    }
                     entity.converter.registerTypes = []
                }
        })
        if( fileSpec.testdata.analogInputs?.length == 0)
            delete fileSpec.testdata.analogInputs
        if( fileSpec.testdata.holdingRegisters?.length == 0)
            delete fileSpec.testdata.holdingRegisters
        if( fileSpec.testdata.coils?.length == 0)
            delete fileSpec.testdata.coils
        fileSpec.entities.forEach(entity => {
            delete (entity as any)['modbusValue']
            delete (entity as any)['mqttValue']
            delete (entity as any)['identified']
        })
        return fileSpec
    }
    static deleteSpecificationFile(specfilename: string, url: string, usage: SpecificationFileUsage): IimageAndDocumentUrl[] {
        let fname = getBaseFilename(url)
        let decodedUrl = decodeURIComponent(url).replaceAll('+', ' ')
        let deleteFlag: boolean = true
        let yamlFile = getSpecificationImageOrDocumentUrl(join(ConfigSpecification.yamlDir, "local"), specfilename, "files.yaml")
        let files: IimageAndDocumentUrl[] = []
        if (fs.existsSync(yamlFile)) {
            try {
                let content = fs.readFileSync(yamlFile, { encoding: 'utf8' })
                files = parse(content.toString())
                let imgFileIdx: number = files.findIndex(f => decodeURIComponent(f.url).replaceAll('+', ' ') == decodedUrl && f.usage == SpecificationFileUsage.img)
                let docFileIdx: number = files.findIndex(f => decodeURIComponent(f.url).replaceAll('+', ' ') == decodedUrl && f.usage == SpecificationFileUsage.documentation)
                if (imgFileIdx >= 0 && docFileIdx >= 0)
                    deleteFlag = false
                let idx = (usage == SpecificationFileUsage.img ? imgFileIdx : docFileIdx)
                if (idx >= 0) {
                    files.splice(idx, 1)

                    fs.writeFileSync(yamlFile, stringify(files), { encoding: 'utf8', flag: 'w' })
                    let spec = ConfigSpecification.specifications.find(spec => spec.filename == specfilename)
                    if (spec)
                        spec.files = files
                }

            }
            catch (e: any) {
                console.error("Unable to read Files directory for " + specfilename)
            }
        }
        specfilename = getSpecificationImageOrDocumentUrl(join(ConfigSpecification.yamlDir, "local"), specfilename, fname)
        if (fs.existsSync(specfilename) && deleteFlag)
            fs.unlinkSync(specfilename);
        return files
    }
    private renameFilesPath(spec: IfileSpecification, oldfilename: string, newDirectory: string) {
        let oldDirectory = "local"
        if (spec.status == SpecificationStatus.contributed)
            oldDirectory = "contributed"
        let specsDir = join(ConfigSpecification.yamlDir, newDirectory, "specifications")
        let oldPath = getSpecificationImageOrDocumentUrl(join(ConfigSpecification.yamlDir, oldDirectory), oldfilename, "")
        let newPath = getSpecificationImageOrDocumentUrl(join(ConfigSpecification.yamlDir, newDirectory), spec.filename, "")
        let newParentDir = path.dirname(newPath)
        if (!fs.existsSync(newParentDir))
            fs.mkdirSync(newParentDir, { recursive: true })
        if (!fs.existsSync(newPath) && fs.existsSync(oldPath))
            fs.renameSync(oldPath, newPath)
        this.readFilesYaml(specsDir, spec)
    }
    private cleanSpecForWriting(spec: IfileSpecification): void {
        spec.entities.forEach(e => {
            if (!e.icon || e.icon.length == 0)
                delete e.icon
            if (!spec.manufacturer || spec.manufacturer.length == 0)
                delete spec.manufacturer
            if (!spec.model || spec.model.length == 0)
                delete spec.model
            if (spec.publicSpecification)
                delete spec.publicSpecification;
        })
    }
    changeContributionStatus(filename: string, newStatus: SpecificationStatus) {
        // moves Specification files to contribution directory
        let spec = ConfigSpecification.specifications.find(f => f.filename == filename)
        if (!spec)
            throw new Error("Specification " + filename + " not found")
        if (newStatus && newStatus == spec.status)
            return
        let newPath = this.getContributedSpecificationPath(spec)
        let oldPath = this.getSpecificationPath(spec);
        let newDirectory = "contributed"
        if ([SpecificationStatus.cloned, SpecificationStatus.added].includes(newStatus) && spec.status == SpecificationStatus.contributed) {
            let publicPath = this.getPublicSpecificationPath(spec)
            if (fs.existsSync(publicPath))
                newStatus = SpecificationStatus.cloned
            else
                newStatus = SpecificationStatus.added
            newPath = this.getSpecificationPath(spec)
            newDirectory = "local"
            oldPath = this.getContributedSpecificationPath(spec);
        }
        // firet move files, because old status must be "local" directory before calling it
        this.renameFilesPath(spec, spec.filename, newDirectory)
        fs.renameSync(oldPath, newPath)
        // Now change the status in ConfigSpecification.specifications array
        spec = ConfigSpecification.specifications.find(f => f.filename == filename)
        if (spec)
            spec.status = newStatus
    }

    contributeSpecification(filename: string) {
        this.changeContributionStatus(filename, SpecificationStatus.contributed)
    }
    cancelContributionForSpecification(filename: string) {
        this.changeContributionStatus(filename, SpecificationStatus.added)
    }

    writeSpecificationFromFileSpec(spec: IfileSpecification, originalFilename: string | null) {
        if (spec.filename == "_new") {
            throw new Error("No or invalid filename for specification")
        }
        let publicFilepath = this.getPublicSpecificationPath(spec);
        let contributedFilepath = this.getContributedSpecificationPath(spec)
        let filename = this.getSpecificationPath(spec);
        this.cleanSpecForWriting(spec)
        if (spec) {
            if (spec.status == SpecificationStatus.new) {
                this.renameFilesPath(spec, "_new", "local")
            }
            else if (originalFilename) {
                if (originalFilename != spec.filename) {
                    if (spec.status == SpecificationStatus.cloned || spec.status == SpecificationStatus.published || spec.status == SpecificationStatus.contributed)
                        throw new Error("Cannot rename a published file")
                    // delete yaml file and rename files directory
                    let s = spec.filename;
                    spec.filename = originalFilename;
                    let originalFilepath = this.getSpecificationPath(spec);
                    spec.filename = s;
                    fs.unlinkSync(originalFilepath)
                    this.renameFilesPath(spec, originalFilename, "local")
                }
            }
            else
                throw new Error(spec.status + " !=" + SpecificationStatus.new + " and no originalfilename")
            if (!fs.existsSync(publicFilepath))
                spec.status = SpecificationStatus.added;
            else
                if (fs.existsSync(contributedFilepath)) {
                    spec.status = SpecificationStatus.contributed;
                    filename = contributedFilepath
                }
                else
                    spec.status = SpecificationStatus.cloned;
        }
        else throw new Error("spec is undefined")

        let dir = path.dirname(filename);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
      
        // Update files list add files, which are not in list yet.
        let ns: any = structuredClone(spec)
        ns.version = SPECIFICATION_VERSION;
        delete ns.files
        let s = stringify(ns);
        fs.writeFileSync(filename, s, { encoding: 'utf8' });

        let idx = ConfigSpecification.specifications.findIndex(cspec => { return cspec.filename === spec.filename });
        if (idx >= 0)
            ConfigSpecification.specifications[idx] = spec;
        else
            ConfigSpecification.specifications.push(spec);
        return spec;
    }
    writeSpecification(spec: ImodbusSpecification, testdata:IModbusData, onAfterSave:(filename:string)=>void, originalFilename: string | null): IfileSpecification {
        let fileSpec: IfileSpecification = ConfigSpecification.toFileSpecification(spec,testdata)
        this.writeSpecificationFromFileSpec(fileSpec,originalFilename)
        onAfterSave(fileSpec.filename)
        return fileSpec;
    }
   
    deleteSpecification(specfileName: string) {
        let found = false;
        for (let idx = 0; idx < ConfigSpecification.specifications.length; idx++) {
            let sp = ConfigSpecification.specifications[idx];
            if (sp.filename === specfileName && sp.status in [SpecificationStatus.cloned, SpecificationStatus.added, SpecificationStatus.new]) {
                found = true;
                fs.unlink(this.getSpecificationPath(sp), (err) => {
                    if (err)
                        log.log(LogLevelEnum.error, err);
                });
                ConfigSpecification.specifications.splice(idx, 1);
                return;
            }
        }
        if (!found && (!specfileName || specfileName != "_new"))
            log.log(LogLevelEnum.notice,"specification not found for deletion " + specfileName);
    }
   
    static getSpecificationByName(name: string): IfileSpecification | undefined {
        return structuredClone(ConfigSpecification.specifications.find(spec => { return getSpecificationI18nName(spec, "en") === name }));
    }
    static getSpecificationByFilename(filename: string): IfileSpecification | undefined {

        if (filename == "_new") {
            let rc: IfileSpecification = {
                version: SPECIFICATION_VERSION,
                entities: [], files: [], i18n: [],
                testdata: structuredClone(this.emptyTestData),
                filename: "_new",
                status: SpecificationStatus.new
            }
            let dir = getSpecificationImageOrDocumentUrl(join(ConfigSpecification.yamlDir, "local"), "_new", "")
            if (fs.existsSync(dir)) {
                let files = fs.readdirSync(dir)
                files.forEach(file => {
                    let url = getSpecificationImageOrDocumentUrl(join(ConfigSpecification.yamlDir , "local"), "_new", file)
                    rc.files.push({
                        url: url,
                        fileLocation: FileLocation.Local,
                        usage: M2mSpecification.getFileUsage(file)
                    })
                })
            }

            return rc;
        }
        return structuredClone(ConfigSpecification.specifications.find(spec => { return spec.filename === filename }));
    }
    static getFileNameFromSlaveId(slaveid: number): string {
        return "s" + slaveid;
    }
}
export function getSpecificationImageOrDocumentUrl(rootUrl: string | undefined, specName: string, url: string): string {
    let fn = getBaseFilename(url)
    let rc: string = ""
    if (rootUrl) {
        let append = '/'
        if (rootUrl.endsWith('/'))
            append = ''
        rc = rootUrl + append + join(filesUrlPrefix, specName, fn);
    }
    else
        rc = "/" + join(filesUrlPrefix, specName, fn);

    return rc;
}