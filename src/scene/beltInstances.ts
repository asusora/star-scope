import * as T from 'three'

// Orbit, spin, scale/tilt and color. The shader places each rock directly in world space.
export const rockStride = 15

function distantIndices(prototype: T.SphereGeometry) {
  const { widthSegments, heightSegments } = prototype.parameters
  const indices: number[] = []
  const stride = widthSegments + 1
  // Retain the sculpted vertices, normals, UV seam and pole winding of the original.
  const step = 3
  for (let y = 0; y < heightSegments; y += step) {
    const nextY = Math.min(y + step, heightSegments)
    for (let x = 0; x < widthSegments; x += step) {
      const nextX = Math.min(x + step, widthSegments)
      const a = y * stride + nextX, b = y * stride + x
      const c = nextY * stride + x, d = nextY * stride + nextX
      if (y > 0) indices.push(a, b, d)
      if (nextY < heightSegments) indices.push(b, c, d)
    }
  }
  return indices
}

export function createBeltInstances(
  prototype: T.SphereGeometry,
  material: T.Material,
  rocks: Float32Array,
) {
  const count = rocks.length / rockStride
  const order = Array.from({ length: count }, (_, i) => i * rockStride)
  order.sort((a, b) => rocks[a + 2] - rocks[b + 2])
  const sorted = new Float32Array(rocks.length)
  order.forEach((offset, i) => sorted.set(rocks.subarray(offset, offset + rockStride), i * rockStride))

  prototype.computeBoundingSphere()
  const shape = prototype.boundingSphere!
  const radius = shape.radius + shape.center.length()
  const horizon = 4 // simulation seconds, independent of playback speed
  const groups = Array.from({ length: 16 }, (_, i) => {
    const start = Math.floor(i * count / 16) * rockStride
    const end = Math.floor((i + 1) * count / 16) * rockStride
    let margin = 0, maxRadius = 0
    for (let j = start; j < end; j += rockStride) {
      const size = radius * Math.max(sorted[j + 8], sorted[j + 9], sorted[j + 10])
      const speed = Math.abs(sorted[j + 3]) * Math.hypot(sorted[j], sorted[j + 1])
      maxRadius = Math.max(maxRadius, size)
      margin = Math.max(margin, size + speed * horizon)
    }
    return { start, end, margin, maxRadius, box: new T.Box3(), far: false }
  })

  function makeBatch(index: T.BufferAttribute | number[]) {
    const buffer = new T.InstancedInterleavedBuffer(new Float32Array(sorted.length), rockStride)
    buffer.setUsage(T.DynamicDrawUsage)
    const geometry = new T.InstancedBufferGeometry()
    geometry.setIndex(index)
    for (const [name, attr] of Object.entries(prototype.attributes)) geometry.setAttribute(name, attr)
    geometry.setAttribute('aOrbit', new T.InterleavedBufferAttribute(buffer, 4, 0))
    geometry.setAttribute('aSpin', new T.InterleavedBufferAttribute(buffer, 4, 4))
    geometry.setAttribute('aScaleTilt', new T.InterleavedBufferAttribute(buffer, 4, 8))
    geometry.setAttribute('color', new T.InterleavedBufferAttribute(buffer, 3, 12))
    geometry.instanceCount = 0
    const mesh = new T.Mesh(geometry, material)
    mesh.frustumCulled = false
    mesh.visible = false
    let previousMask = 0
    function show(mask: number) {
      if (mask === previousMask) return
      previousMask = mask
      mesh.visible = mask !== 0
      let length = 0
      for (const [i, { start, end }] of groups.entries()) {
        if (!(mask & (1 << i))) continue
        buffer.array.set(sorted.subarray(start, end), length)
        length += end - start
      }
      geometry.instanceCount = length / rockStride
      if (length) {
        buffer.clearUpdateRanges()
        buffer.addUpdateRange(0, length)
        buffer.needsUpdate = true
      }
    }
    return { mesh, show }
  }

  const full = makeBatch(prototype.index!)
  const distant = makeBatch(distantIndices(prototype))
  const center = new T.Vector3()
  let boundsClock = -Infinity
  let boundsOffset = -Infinity
  function update(
    frustum: T.Frustum,
    view: T.Matrix4,
    focalPixels: number,
    clock: number,
    angleOffset = 0,
  ) {
    if (Math.abs(clock - boundsClock) >= horizon || Math.abs(angleOffset - boundsOffset) >= 0.06) {
      for (const { start, end, margin, box } of groups) {
        box.makeEmpty()
        for (let j = start; j < end; j += rockStride) {
          const angle = sorted[j + 2] + clock * sorted[j + 3] + angleOffset
          center.set(
            sorted[j] * Math.cos(angle),
            sorted[j + 1] * Math.sin(angle + sorted[j + 11]),
            -sorted[j] * Math.sin(angle),
          )
          box.expandByPoint(center)
        }
        box.expandByScalar(margin)
      }
      boundsClock = clock
      boundsOffset = angleOffset
    }
    let fullMask = 0, distantMask = 0
    const m = view.elements
    for (const [i, group] of groups.entries()) {
      const { min, max } = group.box
      if (!frustum.intersectsBox(group.box)) continue
      // Choose detail for the largest rock at the nearest depth of this arc.
      const depth = -(m[14] + m[2] * (m[2] > 0 ? max.x : min.x)
        + m[6] * (m[6] > 0 ? max.y : min.y) + m[10] * (m[10] > 0 ? max.z : min.z))
      const threshold = group.far ? 5 : 4 // projected radius in drawing-buffer pixels
      group.far = group.maxRadius * focalPixels < threshold * depth
      if (group.far) distantMask |= 1 << i
      else fullMask |= 1 << i
    }
    full.show(fullMask)
    distant.show(distantMask)
  }
  return { full: full.mesh, distant: distant.mesh, update }
}
