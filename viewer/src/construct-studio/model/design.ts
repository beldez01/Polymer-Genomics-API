import type { ControlType, Workspace } from './types'

export interface FreezeVerdict {
  ok: boolean
  blockers: string[]
}

/**
 * Gate 2: sensor sequences cannot be frozen until the target's exact expressed
 * junction is documented empirically. A literature report is not sufficient.
 */
export function canFreeze(workspace: Workspace, designId: string): FreezeVerdict {
  const design = workspace.designs.find((candidate) => candidate.id === designId)
  if (!design) return { ok: false, blockers: [`design ${designId} not found`] }

  if (!design.targetStrandId) {
    return {
      ok: false,
      blockers: ['design has no target strand; the junction cannot be confirmed'],
    }
  }

  const target = workspace.strands.find((strand) => strand.id === design.targetStrandId)
  if (!target) {
    return {
      ok: false,
      blockers: [`target strand ${design.targetStrandId} not found`],
    }
  }

  const fusionSegments = target.segments.filter((segment) => segment.source.type === 'fusion')
  if (fusionSegments.length === 0) {
    return {
      ok: false,
      blockers: ['target has no fusion junction provenance to confirm'],
    }
  }

  const blockers: string[] = []
  for (const segment of fusionSegments) {
    if (segment.source.junctionConfirmation !== 'empirical') {
      blockers.push(
        `target junction confirmation is "${segment.source.junctionConfirmation ?? 'assumed'}"; ` +
          'Gate 2 requires an empirically confirmed junction before freezing',
      )
    }
  }

  return { ok: blockers.length === 0, blockers }
}

export function freezeDesign(workspace: Workspace, designId: string): Workspace {
  const verdict = canFreeze(workspace, designId)
  if (!verdict.ok) {
    throw new Error(`cannot freeze design ${designId}: ${verdict.blockers.join('; ')}`)
  }
  return {
    ...workspace,
    designs: workspace.designs.map((design) =>
      design.id === designId ? { ...design, frozen: true } : design,
    ),
  }
}

export function missingControls(workspace: Workspace, panelId: string): ControlType[] {
  const panel = workspace.panels.find((candidate) => candidate.id === panelId)
  if (!panel) return []

  const present = new Set(
    panel.designIds
      .map((id) => workspace.designs.find((design) => design.id === id)?.controlType)
      .filter((control): control is ControlType => Boolean(control)),
  )
  return panel.requiredControls.filter((control) => !present.has(control))
}
