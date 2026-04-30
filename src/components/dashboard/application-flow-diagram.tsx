'use client'

interface Props {
  total: number
  interview: number
  offer: number
  rejected: number
  noResponse: number
}

type LayoutNode = {
  id: string
  label: string
  value: number
  color: string
  y: number
  h: number
}

const NODE_W = 10
const GAP = 10
const PAD_Y = 18

function layoutNodes(
  nodes: Omit<LayoutNode, 'y' | 'h'>[],
  scaleTotal: number,
  gap: number,
  startY: number,
  containerH: number,
): LayoutNode[] {
  const vis = nodes.filter(n => n.value > 0)
  const totalGap = (vis.length - 1) * gap
  const availH = containerH - totalGap
  let y = startY
  return vis.map(n => {
    const h = Math.max(10, (n.value / scaleTotal) * availH)
    const node = { ...n, y, h }
    y += h + gap
    return node
  })
}

function bezierPath(
  x1: number, y1t: number, y1b: number,
  x2: number, y2t: number, y2b: number,
): string {
  const cx = (x1 + x2) / 2
  return (
    `M${x1},${y1t} C${cx},${y1t} ${cx},${y2t} ${x2},${y2t} ` +
    `L${x2},${y2b} C${cx},${y2b} ${cx},${y1b} ${x1},${y1b} Z`
  )
}

export default function ApplicationFlowDiagram({ total, interview, offer, rejected, noResponse }: Props) {
  if (total === 0) return null

  const inPipeline = interview + offer
  const hasPipeline = inPipeline > 0

  const W = 580
  const H = 180
  const USABLE_H = H - PAD_Y * 2

  // Wider gap between columns when only 2 cols → gentler S-curves
  const COL_X = hasPipeline ? [70, 255, 455] : [70, 400]

  const col0 = layoutNodes(
    [{ id: 'total', label: 'Applied', value: total, color: '#16a34a' }],
    total, GAP, PAD_Y, USABLE_H,
  )

  // Order: pipeline (top, positive), rejected (middle), no-response (bottom)
  const col1 = layoutNodes(
    [
      { id: 'pipeline', label: 'In Pipeline', value: inPipeline, color: '#d97706' },
      { id: 'rejected', label: 'Rejected', value: rejected, color: '#dc2626' },
      { id: 'noresponse', label: 'No Response', value: noResponse, color: '#9ca3af' },
    ],
    total, GAP, PAD_Y, USABLE_H,
  )

  const pipelineNode = col1.find(n => n.id === 'pipeline')

  const col2 = pipelineNode && hasPipeline
    ? layoutNodes(
        [
          { id: 'offer', label: 'Offer', value: offer, color: '#15803d' },
          { id: 'interview', label: 'Interviewing', value: interview, color: '#b45309' },
        ],
        inPipeline, GAP, pipelineNode.y, pipelineNode.h,
      )
    : []

  interface LinkShape { d: string; color: string; key: string }
  const links: LinkShape[] = []

  // col0 → col1
  let srcY = col0[0].y
  for (const tgt of col1) {
    const sliceH = (tgt.value / total) * col0[0].h
    links.push({
      key: `0-${tgt.id}`,
      color: tgt.color,
      d: bezierPath(COL_X[0] + NODE_W, srcY, srcY + sliceH, COL_X[1], tgt.y, tgt.y + tgt.h),
    })
    srcY += sliceH
  }

  // col1 pipeline → col2
  if (pipelineNode && col2.length > 0) {
    let sy = pipelineNode.y
    for (const tgt of col2) {
      const sliceH = (tgt.value / inPipeline) * pipelineNode.h
      links.push({
        key: `1-${tgt.id}`,
        color: tgt.color,
        d: bezierPath(COL_X[1] + NODE_W, sy, sy + sliceH, COL_X[2], tgt.y, tgt.y + tgt.h),
      })
      sy += sliceH
    }
  }

  const allCols = [col0, col1, ...(hasPipeline ? [col2] : [])]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: H }}>
      {/* Ribbon links (behind nodes) */}
      {links.map(link => (
        <path key={link.key} d={link.d} fill={link.color} opacity={0.22} />
      ))}

      {/* Node bars */}
      {allCols.map((col, ci) =>
        col.map(node => (
          <rect
            key={node.id}
            x={COL_X[ci]}
            y={node.y}
            width={NODE_W}
            height={node.h}
            fill={node.color}
            rx={2}
          />
        )),
      )}

      {/* Col 0: label to the left */}
      {col0.map(node => (
        <text
          key={node.id}
          x={COL_X[0] - 10}
          y={node.y + node.h / 2}
          textAnchor="end"
          dominantBaseline="middle"
          fill="#374151"
          fontSize={12}
        >
          <tspan fontWeight="700">{node.value}</tspan>
          {' '}{node.label}
        </text>
      ))}

      {/* Col 1 labels: to the right */}
      {col1.map(node => (
        <text
          key={node.id}
          x={COL_X[1] + NODE_W + 8}
          y={node.y + node.h / 2}
          dominantBaseline="middle"
          fill="#374151"
          fontSize={11}
        >
          {node.label}{' '}
          <tspan fontWeight="700" fill={node.color}>{node.value}</tspan>
        </text>
      ))}

      {/* Col 2 labels: to the right */}
      {col2.map(node => (
        <text
          key={node.id}
          x={COL_X[2] + NODE_W + 8}
          y={node.y + node.h / 2}
          dominantBaseline="middle"
          fill="#374151"
          fontSize={11}
        >
          {node.label}{' '}
          <tspan fontWeight="700" fill={node.color}>{node.value}</tspan>
        </text>
      ))}
    </svg>
  )
}
