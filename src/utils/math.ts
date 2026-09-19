/**
 * Math and vector utilities for 2D steering, raycasting, and obstacle avoidance.
 */

import { Vector2, AABB } from '../types';

export const Math2D = {
  vec(x: number, y: number): Vector2 {
    return { x, y };
  },

  add(a: Vector2, b: Vector2): Vector2 {
    return { x: a.x + b.x, y: a.y + b.y };
  },

  sub(a: Vector2, b: Vector2): Vector2 {
    return { x: a.x - b.x, y: a.y - b.y };
  },

  scale(v: Vector2, s: number): Vector2 {
    return { x: v.x * s, y: v.y * s };
  },

  lenSq(v: Vector2): number {
    return v.x * v.x + v.y * v.y;
  },

  length(v: Vector2): number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  },

  dist(a: Vector2, b: Vector2): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  },

  distSq(a: Vector2, b: Vector2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  },

  normalize(v: Vector2): Vector2 {
    const len = Math.hypot(v.x, v.y);
    if (len < 0.00001) return { x: 0, y: 0 };
    return { x: v.x / len, y: v.y / len };
  },

  dot(a: Vector2, b: Vector2): number {
    return a.x * b.x + a.y * b.y;
  },

  cross(a: Vector2, b: Vector2): number {
    return a.x * b.y - a.y * b.x;
  },

  clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  },

  clampLength(v: Vector2, maxLen: number): Vector2 {
    const len = Math.hypot(v.x, v.y);
    if (len > maxLen && len > 0.00001) {
      return { x: (v.x / len) * maxLen, y: (v.y / len) * maxLen };
    }
    return { ...v };
  },

  lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  },

  lerpVec(a: Vector2, b: Vector2, t: number): Vector2 {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    };
  },

  headingToVec(rad: number): Vector2 {
    return { x: Math.cos(rad), y: Math.sin(rad) };
  },

  vecToHeading(v: Vector2): number {
    return Math.atan2(v.y, v.x);
  },

  rotateVec(v: Vector2, angleRad: number): Vector2 {
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    return {
      x: v.x * cos - v.y * sin,
      y: v.x * sin + v.y * cos,
    };
  },

  /**
   * Ray-AABB intersection test.
   * Returns distance along ray (if between 0 and maxDist) and surface normal.
   */
  rayIntersectAABB(
    origin: Vector2,
    dir: Vector2,
    maxDist: number,
    box: AABB
  ): { hit: boolean; distance: number; point?: Vector2; normal?: Vector2 } {
    let tmin = 0;
    let tmax = maxDist;
    let normal: Vector2 = { x: 0, y: 0 };

    const minX = box.x;
    const maxX = box.x + box.width;
    const minY = box.y;
    const maxY = box.y + box.height;

    // X axis slab test
    if (Math.abs(dir.x) < 0.000001) {
      if (origin.x < minX || origin.x > maxX) {
        return { hit: false, distance: maxDist };
      }
    } else {
      const invD = 1.0 / dir.x;
      let t1 = (minX - origin.x) * invD;
      let t2 = (maxX - origin.x) * invD;
      let n1: Vector2 = { x: -1, y: 0 };
      let n2: Vector2 = { x: 1, y: 0 };

      if (t1 > t2) {
        const tmp = t1; t1 = t2; t2 = tmp;
        const tmpN = n1; n1 = n2; n2 = tmpN;
      }

      if (t1 > tmin) {
        tmin = t1;
        normal = n1;
      }
      if (t2 < tmax) {
        tmax = t2;
      }
      if (tmin > tmax) return { hit: false, distance: maxDist };
    }

    // Y axis slab test
    if (Math.abs(dir.y) < 0.000001) {
      if (origin.y < minY || origin.y > maxY) {
        return { hit: false, distance: maxDist };
      }
    } else {
      const invD = 1.0 / dir.y;
      let t1 = (minY - origin.y) * invD;
      let t2 = (maxY - origin.y) * invD;
      let n1: Vector2 = { x: 0, y: -1 };
      let n2: Vector2 = { x: 0, y: 1 };

      if (t1 > t2) {
        const tmp = t1; t1 = t2; t2 = tmp;
        const tmpN = n1; n1 = n2; n2 = tmpN;
      }

      if (t1 > tmin) {
        tmin = t1;
        normal = n1;
      }
      if (t2 < tmax) {
        tmax = t2;
      }
      if (tmin > tmax) return { hit: false, distance: maxDist };
    }

    if (tmin < 0 || tmin > maxDist) {
      return { hit: false, distance: maxDist };
    }

    const hitPoint: Vector2 = {
      x: origin.x + dir.x * tmin,
      y: origin.y + dir.y * tmin,
    };

    return {
      hit: true,
      distance: tmin,
      point: hitPoint,
      normal,
    };
  },

  /**
   * Check if point is inside AABB.
   */
  pointInAABB(p: Vector2, box: AABB, padding = 0): boolean {
    return (
      p.x >= box.x - padding &&
      p.x <= box.x + box.width + padding &&
      p.y >= box.y - padding &&
      p.y <= box.y + box.height + padding
    );
  },

  /**
   * Check if a line segment between A and B intersects any crate.
   */
  hasLineOfSight(a: Vector2, b: Vector2, boxes: AABB[]): boolean {
    const diff = this.sub(b, a);
    const dist = this.length(diff);
    if (dist < 0.0001) return true;
    const dir = this.scale(diff, 1 / dist);

    for (const box of boxes) {
      const result = this.rayIntersectAABB(a, dir, dist, box);
      if (result.hit && result.distance < dist - 2) {
        return false;
      }
    }
    return true;
  },

  /**
   * Resolve box collision against an AABB crate.
   * Returns corrected center position.
   */
  resolveBoxCollision(center: Vector2, halfSize: number, crate: AABB): Vector2 {
    const minX = crate.x;
    const maxX = crate.x + crate.width;
    const minY = crate.y;
    const maxY = crate.y + crate.height;

    // Nearest point on box
    const closestX = this.clamp(center.x, minX, maxX);
    const closestY = this.clamp(center.y, minY, maxY);

    const distX = center.x - closestX;
    const distY = center.y - closestY;
    const distSq = distX * distX + distY * distY;

    // Check if inside or overlapping
    if (distSq < halfSize * halfSize) {
      const dist = Math.sqrt(distSq);
      if (dist < 0.0001) {
        // Deep penetration inside: push along shortest edge
        const dl = center.x - minX;
        const dr = maxX - center.x;
        const dt = center.y - minY;
        const db = maxY - center.y;
        const minVal = Math.min(dl, dr, dt, db);
        if (minVal === dl) return { x: minX - halfSize, y: center.y };
        if (minVal === dr) return { x: maxX + halfSize, y: center.y };
        if (minVal === dt) return { x: center.x, y: minY - halfSize };
        return { x: center.x, y: maxY + halfSize };
      }
      // Push out along normal
      const nx = distX / dist;
      const ny = distY / dist;
      const push = halfSize - dist;
      return {
        x: center.x + nx * push,
        y: center.y + ny * push,
      };
    }

    return { ...center };
  },
};
