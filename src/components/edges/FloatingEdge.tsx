import { getBezierPath, useInternalNode, type EdgeProps, type InternalNode, Position } from "@xyflow/react";

function getNodeCenter(node: InternalNode) {
  return {
    x: node.internals.positionAbsolute.x + (node.measured?.width ?? 0) / 2,
    y: node.internals.positionAbsolute.y + (node.measured?.height ?? 0) / 2,
  };
}

function getIntersection(node: InternalNode, target: { x: number; y: number }) {
  const center = getNodeCenter(node);
  const w = (node.measured?.width ?? 0) / 2;
  const h = (node.measured?.height ?? 0) / 2;
  const dx = target.x - center.x;
  const dy = target.y - center.y;

  if (dx === 0 && dy === 0) {
    return { x: center.x, y: center.y + h, position: Position.Bottom };
  }

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDy * w > absDx * h) {
    const sign = dy > 0 ? 1 : -1;
    return {
      x: center.x + (dx * h) / absDy,
      y: center.y + sign * h,
      position: sign > 0 ? Position.Bottom : Position.Top,
    };
  }

  const sign = dx > 0 ? 1 : -1;
  return {
    x: center.x + sign * w,
    y: center.y + (dy * w) / absDx,
    position: sign > 0 ? Position.Right : Position.Left,
  };
}

export function FloatingEdge({ id, source, target, markerEnd, style }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) return null;

  const targetCenter = getNodeCenter(targetNode);
  const sourceCenter = getNodeCenter(sourceNode);

  const s = getIntersection(sourceNode, targetCenter);
  const t = getIntersection(targetNode, sourceCenter);

  const [edgePath] = getBezierPath({
    sourceX: s.x,
    sourceY: s.y,
    sourcePosition: s.position,
    targetX: t.x,
    targetY: t.y,
    targetPosition: t.position,
  });

  return (
    <path
      id={id}
      className="react-flow__edge-path"
      d={edgePath}
      markerEnd={markerEnd as string}
      style={style}
    />
  );
}
