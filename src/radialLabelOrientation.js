const TAU = Math.PI * 2;
// Around 12° on either side of the vertical flip lines, either reading
// direction remains upright enough. Use one shared direction in this narrow
// zone so tiny rotations do not reverse adjacent labels.
const FLIP_BUFFER = Math.PI / 15;
// A parent can summarize a very wide terminal fan (for example, an
// "Unknown" bucket with thousands of children).  In that case the parent's
// midpoint is not a useful reading-direction anchor for leaves on the other
// side of the circle.  Only share the parent's orientation inside a local fan.
const MAX_SHARED_PARENT_DISTANCE = Math.PI / 4;

function normalizeAngle(angle) {
  return ((Number(angle) % TAU) + TAU) % TAU;
}

function hasDescendants(node) {
  return (node?.children?.length || 0) > 0 || (node?._children?.length || 0) > 0;
}

function circularDistance(firstAngle, secondAngle) {
  const difference = Math.abs(normalizeAngle(firstAngle) - normalizeAngle(secondAngle));
  return Math.min(difference, TAU - difference);
}

/**
 * Returns true when a radial label should read outward from the node.
 *
 * Terminal siblings follow their shared parent's orientation. This prevents
 * adjacent names on opposite sides of the top/bottom flip boundary from
 * suddenly reading in opposite directions within the same small fan.
 */
export function isRadialLabelOutward(node, rotationRad = 0) {
  if (!node) return true;

  const nodeAngle = normalizeAngle((node.x ?? 0) + rotationRad);
  if (Math.abs(nodeAngle - Math.PI) <= FLIP_BUFFER) return false;
  if (nodeAngle <= FLIP_BUFFER || nodeAngle >= TAU - FLIP_BUFFER) return true;

  const terminalWithBranchParent = !hasDescendants(node)
    && node.parent?.depth > 0
    && circularDistance(node.x ?? 0, node.parent.x ?? node.x ?? 0) <= MAX_SHARED_PARENT_DISTANCE;
  const orientationAnchor = terminalWithBranchParent ? node.parent : node;
  const angle = normalizeAngle((orientationAnchor?.x ?? node.x ?? 0) + rotationRad);
  return angle < Math.PI;
}
