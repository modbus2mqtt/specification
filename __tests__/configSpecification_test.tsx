import { it, expect } from '@jest/globals'
import { ConfigSpecification } from '../src/configspec'
import * as fs from 'fs'
import { join } from 'path'
import { singleMutex, yamlDir } from './configsbase'
import {
  SPECIFICATION_VERSION,
  SpecificationFileUsage,
  SpecificationStatus,
  getFileNameFromName,
  getSpecificationI18nName,
  newSpecification,
} from '@modbus2mqtt/specification.shared'
import { IReadRegisterResultOrError } from '../src/m2mspecification'
import { ImodbusValues } from '../dist'


ConfigSpecification['yamlDir'] = yamlDir
ConfigSpecification.setMqttdiscoverylanguage('en')
let testdata: ImodbusValues = {
  coils: new Map<number, IReadRegisterResultOrError>(),
  holdingRegisters: new Map<number, IReadRegisterResultOrError>(),
  analogInputs: new Map<number, IReadRegisterResultOrError>(),
}

it('check device type status', () => {
  const configSpec = new ConfigSpecification()
  configSpec.readYaml()
  ConfigSpecification.setMqttdiscoverylanguage('en')
  expect(ConfigSpecification.getSpecificationByFilename('waterleveltransmitter')!.status).toBe(SpecificationStatus.cloned)
  expect(ConfigSpecification.getSpecificationByFilename('deyeinverter')!.status).toBe(SpecificationStatus.published)
  expect(ConfigSpecification.getSpecificationByFilename('newDevice')!.status).toBe(SpecificationStatus.added)
})
it('write/Migrate', () => {
  fs.copyFileSync(
    join(ConfigSpecification.yamlDir, 'local/specifications', 'waterleveltransmitter.yaml'),
    join(ConfigSpecification.yamlDir, 'local/specifications', 'waterleveltransmitter1.yaml')
  )

  const configSpec = new ConfigSpecification()
  configSpec.readYaml()
  let wl = ConfigSpecification.getSpecificationByFilename('waterleveltransmitter')!
  configSpec.writeSpecificationFromFileSpec(wl, wl.filename)
  configSpec.readYaml()
  wl = ConfigSpecification.getSpecificationByFilename('waterleveltransmitter')!
  expect(wl.version).toBe(SPECIFICATION_VERSION)
  fs.copyFileSync(
    join(ConfigSpecification.yamlDir, 'local/specifications', 'waterleveltransmitter1.yaml'),
    join(ConfigSpecification.yamlDir, 'local/specifications', 'waterleveltransmitter.yaml')
  )
  fs.unlinkSync(join(ConfigSpecification.yamlDir, 'local/specifications', 'waterleveltransmitter1.yaml'))
})

it('getFileNameFromName remove non ascii characters', () => {
  const name = '/\\*& asdf+-_.'
  let fn = getFileNameFromName(name)
  expect(fn).toBe('asdf+-_.')
})
it('getSpecificationI18nName ', () => {
  const name = '/\\*& asdf+-_.'
  const configSpec = new ConfigSpecification()
  configSpec.readYaml()
  let fn = getFileNameFromName(name)
  let spec = ConfigSpecification.getSpecificationByFilename('waterleveltransmitter')
  expect(getSpecificationI18nName(spec!, 'fr')).toBe('Water Level Transmitter')
  expect(getSpecificationI18nName(spec!, 'en')).toBe('Water Level Transmitter')
  expect(fn).toBe('asdf+-_.')
})

it('add new specification, add files, set filename', () => {
  let cfgSpec = new ConfigSpecification()
  cfgSpec.readYaml()

  let fdir = join(ConfigSpecification.getLocalDir(), '/specifications/files')
  let fdirNew = join(fdir, '_new')
  let fdirAddSpecTest = join(fdir, 'addspectest')
  fs.rmSync(fdirNew, { recursive: true, force: true })
  fs.rmSync(fdirAddSpecTest, { recursive: true, force: true })
  fs.rmSync(join(ConfigSpecification.getLocalDir(), '/specifications/files', 'addspectest.yaml'), { recursive: true, force: true })
  fs.mkdirSync(fdirNew, { recursive: true })
  fs.writeFileSync(join(fdirNew, 'test.pdf'), 'test')
  let mspec = newSpecification
  let spec = ConfigSpecification.toFileSpecification(mspec)
  cfgSpec.appendSpecificationFile(spec.filename, 'test.pdf', SpecificationFileUsage.documentation)
  fs.writeFileSync(join(fdirNew, 'test.jpg'), 'test')
  cfgSpec.appendSpecificationFile(spec.filename, 'test.jpg', SpecificationFileUsage.img)
  let g = ConfigSpecification.getSpecificationByFilename('_new')
  expect(g).not.toBeNull()
  expect(g!.files.find((f) => f.url.endsWith('/_new/test.jpg'))).not.toBeNull()
  expect(g!.files.find((f) => f.url.endsWith('/_new/test.pdf'))).not.toBeNull()
  expect(g).not.toBeNull()
  cfgSpec.appendSpecificationFile(spec.filename, 'test.jpg', SpecificationFileUsage.img)
  mspec.filename = 'addspectest'
  let wasCalled = false

  cfgSpec.writeSpecification(
    mspec,
    testdata,
    (filename) => {
      expect(filename).toBe(mspec.filename)
      wasCalled = true
    },
    null
  )
  expect(wasCalled).toBeTruthy()
  expect(fs.existsSync(fdirNew)).toBeFalsy()
  g = ConfigSpecification.getSpecificationByFilename('addspectest')
  expect(g).not.toBeNull()
  expect(g!.files.length).toBe(2)
  spec.filename = 'modifiedfilename'
  wasCalled = false
  cfgSpec.writeSpecification(
    mspec,
    testdata,
    (filename) => {
      expect(filename).toBe(mspec.filename)
      wasCalled = true
    },
    null
  )
  cfgSpec.deleteSpecification('addspectest')
})
it('contribution', () => {
  singleMutex.runExclusive(() => {
    let cfg = new ConfigSpecification()
    let localSpecdir = join(yamlDir, 'local/specifications')
    let contributedSpecdir = join(yamlDir, 'contributed/specifications')
    fs.copyFileSync(join(localSpecdir, 'waterleveltransmitter.yaml'), join(localSpecdir, 'waterleveltransmitter1.yaml'))
    let filesDir = join(localSpecdir, 'files/waterleveltransmitter1')
    let publicSpecdir = join(yamlDir, 'public/specifications')

    cleanWaterLevelTransmitter1(publicSpecdir)
    cleanWaterLevelTransmitter1(contributedSpecdir)
    if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir)
    fs.copyFileSync(
      join(localSpecdir, 'files/waterleveltransmitter/files.yaml'),
      join(localSpecdir, 'files/waterleveltransmitter1/files.yaml')
    )
    cfg.readYaml()
    let g = ConfigSpecification.getSpecificationByFilename('waterleveltransmitter1')
    expect(g).toBeDefined()
    expect(g?.status).toBe(SpecificationStatus.added)

    expect(fs.existsSync(join(localSpecdir, 'waterleveltransmitter1.yaml'))).toBeTruthy()
    expect(fs.existsSync(join(localSpecdir, 'files/waterleveltransmitter1/files.yaml'))).toBeTruthy()
    cfg.changeContributionStatus('waterleveltransmitter1', SpecificationStatus.contributed, 1)
    expect(fs.existsSync(join(contributedSpecdir, 'waterleveltransmitter1.yaml'))).toBeTruthy()
    expect(fs.existsSync(join(contributedSpecdir, 'files/waterleveltransmitter1/files.yaml'))).toBeTruthy()
    expect(fs.existsSync(join(localSpecdir, 'waterleveltransmitter1.yaml'))).toBeFalsy()
    expect(fs.existsSync(join(localSpecdir, 'files/waterleveltransmitter1/files.yaml'))).toBeFalsy()

    g = ConfigSpecification.getSpecificationByFilename('waterleveltransmitter1')
    expect(g?.status).toBe(SpecificationStatus.contributed)
    cfg.changeContributionStatus('waterleveltransmitter1', SpecificationStatus.added, undefined)
    expect(fs.existsSync(join(localSpecdir, 'waterleveltransmitter1.yaml'))).toBeTruthy()
    expect(fs.existsSync(join(localSpecdir, 'files/waterleveltransmitter1/files.yaml'))).toBeTruthy()
    g = ConfigSpecification.getSpecificationByFilename('waterleveltransmitter1')
    expect(g?.status).toBe(SpecificationStatus.added)
    cfg.changeContributionStatus('waterleveltransmitter1', SpecificationStatus.contributed, 1)
    expect(fs.existsSync(join(contributedSpecdir, 'waterleveltransmitter1.yaml'))).toBeTruthy()
    expect(fs.existsSync(join(contributedSpecdir, 'files/waterleveltransmitter1/files.yaml'))).toBeTruthy()
    g = ConfigSpecification.getSpecificationByFilename('waterleveltransmitter1')
    expect(g?.status).toBe(SpecificationStatus.contributed)
    cfg.changeContributionStatus('waterleveltransmitter1', SpecificationStatus.published, 1)
    g = ConfigSpecification.getSpecificationByFilename('waterleveltransmitter1')

    expect(fs.existsSync(join(contributedSpecdir, 'waterleveltransmitter1.yaml'))).toBeFalsy()
    expect(fs.existsSync(join(contributedSpecdir, 'files/waterleveltransmitter1/files.yaml'))).toBeFalsy()
    expect(g?.status).toBe(SpecificationStatus.published)
    cleanWaterLevelTransmitter1(publicSpecdir)
    cleanWaterLevelTransmitter1(contributedSpecdir)
    cleanWaterLevelTransmitter1(localSpecdir)
  })
})

function cleanWaterLevelTransmitter1(contributedSpecdir: string) {
  if (fs.existsSync(join(contributedSpecdir, 'files/waterleveltransmitter1')))
    fs.rmSync(join(contributedSpecdir, 'files/waterleveltransmitter1'), { recursive: true })
  if (fs.existsSync(join(contributedSpecdir, 'waterleveltransmitter1.yaml')))
    fs.unlinkSync(join(contributedSpecdir, 'waterleveltransmitter1.yaml'))
}
it('contribution cloned', () => {
  singleMutex.runExclusive(() => {
    let cfg = new ConfigSpecification()
    let localSpecdir = join(yamlDir, 'local/specifications')
    let publicSpecdir = join(yamlDir, 'public/specifications')
    let contributedSpecdir = join(yamlDir, 'contributed/specifications')
    fs.copyFileSync(join(localSpecdir, 'waterleveltransmitter.yaml'), join(localSpecdir, 'waterleveltransmitter1.yaml'))
    fs.copyFileSync(join(localSpecdir, 'waterleveltransmitter.yaml'), join(publicSpecdir, 'waterleveltransmitter1.yaml'))
    cleanWaterLevelTransmitter1(contributedSpecdir)
    let filesDir = join(localSpecdir, 'files/waterleveltransmitter1')
    let publicfilesDir = join(publicSpecdir, 'files/waterleveltransmitter1')
    if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir)
    if (!fs.existsSync(publicfilesDir)) fs.mkdirSync(publicfilesDir)
    fs.copyFileSync(
      join(localSpecdir, 'files/waterleveltransmitter/files.yaml'),
      join(localSpecdir, 'files/waterleveltransmitter1/files.yaml')
    )
    fs.copyFileSync(
      join(localSpecdir, 'files/waterleveltransmitter/files.yaml'),
      join(publicSpecdir, 'files/waterleveltransmitter1/files.yaml')
    )
    cfg.readYaml()
    let g = ConfigSpecification.getSpecificationByFilename('waterleveltransmitter1')
    expect(g).toBeDefined()
    expect(g?.status).toBe(SpecificationStatus.cloned)

    expect(fs.existsSync(join(localSpecdir, 'waterleveltransmitter1.yaml'))).toBeTruthy()
    expect(fs.existsSync(join(localSpecdir, 'files/waterleveltransmitter1/files.yaml'))).toBeTruthy()
    expect(fs.existsSync(join(publicSpecdir, 'waterleveltransmitter1.yaml'))).toBeTruthy()
    expect(fs.existsSync(join(publicSpecdir, 'files/waterleveltransmitter1/files.yaml'))).toBeTruthy()
    cfg.changeContributionStatus('waterleveltransmitter1', SpecificationStatus.contributed, 1)
    expect(fs.existsSync(join(contributedSpecdir, 'waterleveltransmitter1.yaml'))).toBeTruthy()
    expect(fs.existsSync(join(contributedSpecdir, 'files/waterleveltransmitter1/files.yaml'))).toBeTruthy()
    expect(fs.existsSync(join(localSpecdir, 'waterleveltransmitter1.yaml'))).toBeFalsy()
    expect(fs.existsSync(join(localSpecdir, 'files/waterleveltransmitter1/files.yaml'))).toBeFalsy()

    g = ConfigSpecification.getSpecificationByFilename('waterleveltransmitter1')
    expect(g?.status).toBe(SpecificationStatus.contributed)
    cfg.changeContributionStatus('waterleveltransmitter1', SpecificationStatus.cloned, undefined)
    expect(fs.existsSync(join(localSpecdir, 'waterleveltransmitter1.yaml'))).toBeTruthy()
    expect(fs.existsSync(join(localSpecdir, 'files/waterleveltransmitter1/files.yaml'))).toBeTruthy()
    g = ConfigSpecification.getSpecificationByFilename('waterleveltransmitter1')
    expect(g?.status).toBe(SpecificationStatus.cloned)
    cfg.changeContributionStatus('waterleveltransmitter1', SpecificationStatus.contributed, 1)
    expect(fs.existsSync(join(contributedSpecdir, 'waterleveltransmitter1.yaml'))).toBeTruthy()
    expect(fs.existsSync(join(contributedSpecdir, 'files/waterleveltransmitter1/files.yaml'))).toBeTruthy()
    g = ConfigSpecification.getSpecificationByFilename('waterleveltransmitter1')
    expect(g?.status).toBe(SpecificationStatus.contributed)
    cfg.changeContributionStatus('waterleveltransmitter1', SpecificationStatus.published, 1)
    g = ConfigSpecification.getSpecificationByFilename('waterleveltransmitter1')

    expect(fs.existsSync(join(contributedSpecdir, 'waterleveltransmitter1.yaml'))).toBeFalsy()
    expect(fs.existsSync(join(contributedSpecdir, 'files/waterleveltransmitter1/files.yaml'))).toBeFalsy()
    expect(g?.status).toBe(SpecificationStatus.published)
    cleanWaterLevelTransmitter1(publicSpecdir)
    cleanWaterLevelTransmitter1(contributedSpecdir)
    cleanWaterLevelTransmitter1(localSpecdir)
  })
})
