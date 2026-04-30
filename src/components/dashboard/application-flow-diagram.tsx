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
  linkOpacity: number
  y: number
  h: number
}

const NODE_W = 12
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

const TWO_LINE_H = 24

export default function ApplicationFlowDiagram({ total, interview, offer, rejected, noResponse }: Props) {
  if (total === 0) return null

  const W = 580
  const H = 188
  const USABLE_H = H - PAD_Y * 2
  const COL_X = [95, 390]

  const col0 = layoutNodes(
    [{ id: 'total', label: 'Applied', value: total, color: '#16a34a', linkOpacity: 1 }],
    total, GAP, PAD_Y, USABLE_H,
  )

  // Positive outcomes at top, rejections next, no response at bottom
  const col1 = layoutNodes(
    [
      { id: 'offer',       label: 'Offer',        value: offer,       color: '#15803d', linkOpacity: 0.32 },
      { id: 'interview',   label: 'Interviewing', value: interview,   color: '#b45309', linkOpacity: 0.32 },
      { id: 'rejected',    label: 'Rejected',     value: rejected,    color: '#dc2626', linkOpacity: 0.22 },
      { id: 'noresponse',  label: 'No Response',  value: noResponse,  color: '#9ca3af', linkOpacity: 0.13 },
    ],
    total, GAP, PAD_Y, USABLE_H,
  )

  const links = col1.map(tgt => {
    const srcY0 = col0[0].y
    const srcH = col0[0].h
    // Accumulate offset for this target's slice on the source bar
    let offset = 0
    for (const n of col1) {
      if (n.id === tgt.id) break
      offset += (n.value / total) * srcH
    }
    const sliceH = (tgt.value / total) * srcH
    return {
      key: tgt.id,
      color: tgt.color,
      opacity: tgt.linkOpacity,
      d: bezierPath(COL_X[0] + NODE_W, srcY0 + offset, srcY0 + offset + sliceH, COL_X[1], tgt.y, tgt.y + tgt.h),
    }
  })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: H }}>
      {/* Ribbon links */}
      {links.map(link => (
        <path key={link.key} d={link.d} fill={link.color} opacity={link.opacity} />
      ))}

      {/* Node bars */}
      {[col0, col1].map((col, ci) =>
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

      {/* Col 0 label: bold count + "Applied" to the left */}
      <text
        x={COL_X[0] - 10}
        y={col0[0].y + col0[0].h / 2}
        textAnchor="end"
        dominantBaseline="middle"
        fill="#111827"
        fontSize={13}
      >
        <tspan fontWeight="800">{total}</tspan>
        <tspan fill="#6b7280" fontWeight="400"> Applied</tspan>
      </text>

      {/* Col 1 labels: two-line for tall nodes, inline for short */}
      {col1.map(node => {
        const x = COL_X[1] + NODE_W + 10
        const cy = node.y + node.h / 2
        if (node.h >= TWO_LINE_H) {
          return (
            <g key={node.id}>
              <text x={x} y={cy - 5} fill="#6b7280" fontSize={10}>{node.label}</text>
              <text x={x} y={cy + 7} fill={node.color} fontSize={13} fontWeight="700">{node.value}</text>
            </g>
          )
        }
        return (
          <text
            key={node.id}
            x={x}
            y={cy}
            dominantBaseline="middle"
            fill="#374151"
            fontSize={11}
          >
            {node.label}{' '}
            <tspan fontWeight="700" fill={node.color}>{node.value}</tspan>
          </text>
        )
      })}
    </svg>
  )
}
