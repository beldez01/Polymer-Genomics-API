import {
  createAnnotation,
  createDuplex,
  createStrand,
  createWorkspace,
} from '../model/factories'
import { seedRopeLayout } from '../model/ropeLayout'

function sequenceOf(length: number, motif: string): string {
  return motif.repeat(Math.ceil(length / motif.length)).slice(0, length)
}

export function createCanvasDemoWorkspace() {
  const workspace = createWorkspace()
  const target = createStrand({
    id: 'demo-target',
    name: 'Example target RNA',
    sequence: sequenceOf(240, 'AUGCACGU'),
    kind: 'target',
    role: 'target',
    renderMode: 'serpentine',
    placement: { x: 60, y: 60 },
  })
  target.annotations = [
    createAnnotation({
      id: 'demo-target-region', start: 48, end: 108, label: 'Example target region',
      type: 'sensor', colorToken: 'blue',
    }),
  ]

  const sensor = createStrand({
    id: 'demo-sensor',
    name: 'Example sensor construct',
    sequence: sequenceOf(84, 'GGACUACU'),
    kind: 'probe',
    role: 'construct',
    placement: { x: 95, y: 170 },
  })
  sensor.annotations = [
    createAnnotation({
      id: 'demo-sensor-arm', start: 12, end: 36, label: 'Recognition arm',
      type: 'recognition-arm', colorToken: 'blue',
    }),
    createAnnotation({
      id: 'demo-sensor-payload', start: 48, end: 72, label: 'Payload region',
      type: 'payload', colorToken: 'violet',
    }),
  ]
  sensor.layout = seedRopeLayout(sensor)

  const control = createStrand({
    id: 'demo-control',
    name: 'Example control construct',
    sequence: sequenceOf(72, 'UACGAGCA'),
    kind: 'probe',
    role: 'counter-target',
    placement: { x: 95, y: 230 },
  })
  control.annotations = [
    createAnnotation({
      id: 'demo-control-region', start: 10, end: 34, label: 'Control region',
      type: 'custom', colorToken: 'neutral',
    }),
  ]
  control.layout = seedRopeLayout(control)

  workspace.strands = [target, sensor, control]
  workspace.duplexes = [createDuplex({
    id: 'demo-duplex',
    a: { strandId: sensor.id, start: 12, end: 36 },
    b: { strandId: target.id, start: 64, end: 88 },
    role: 'sensor',
  })]
  workspace.referenceFrameId = target.id
  workspace.viewport = { x: 20, y: 20, zoom: 2.5 }
  return workspace
}

export function createPerformanceWorkspace() {
  const workspace = createWorkspace()
  const target = createStrand({
    id: 'perf-target',
    name: '10 kb performance target',
    sequence: sequenceOf(10_000, 'AUGCGUAC'),
    kind: 'target',
    role: 'target',
    renderMode: 'serpentine',
    placement: { x: 80, y: 60 },
  })
  target.annotations = Array.from({ length: 30 }, (_, index) => createAnnotation({
    id: `perf-annotation-${index + 1}`,
    start: index * 320,
    end: index * 320 + 160,
    label: `Performance interval ${index + 1}`,
    type: index % 3 === 0 ? 'sensor' : index % 3 === 1 ? 'payload' : 'custom',
    colorToken: index % 3 === 0 ? 'blue' : index % 3 === 1 ? 'violet' : 'neutral',
  }))

  const shortStrands = Array.from({ length: 4 }, (_, index) => createStrand({
    id: `perf-short-${index + 1}`,
    name: `Performance short strand ${index + 1}`,
    sequence: sequenceOf(96 + index * 8, ['ACGU', 'GCAU', 'UAGC', 'CGUA'][index]),
    kind: 'probe',
    role: 'construct',
    placement: { x: 180 + index * 170, y: 4_120 + index * 70 },
  }))

  workspace.strands = [target, ...shortStrands]
  workspace.duplexes = shortStrands.map((strand, index) => createDuplex({
    id: `perf-duplex-${index + 1}`,
    a: { strandId: strand.id, start: 12, end: 36 },
    b: { strandId: target.id, start: 1_000 + index * 2_000, end: 1_024 + index * 2_000 },
    role: 'sensor',
  }))
  workspace.referenceFrameId = target.id
  workspace.viewport = { x: 0, y: 0, zoom: 0.2 }
  return workspace
}
