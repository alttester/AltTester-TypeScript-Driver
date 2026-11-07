// Builds the hierarchy tree from getAllLoadedScenesAndObjects' flat depth-first rows (KTD8).
// Mirrors Desktop's HierarchyController.createHierarchyElements, except that an object whose parent
// is not among the rows already seen attaches to its scene root instead of being dropped.

import type { AltObjectLight } from './types';

export interface HierarchyNode {
  object: AltObjectLight;
  isScene: boolean;
  children: HierarchyNode[];
}

const isSceneMarker = (o: AltObjectLight) => o.id === 0 && o.transformId === 0;

/** Returns the roots in source order: scene nodes, plus any rows that came before the first scene. */
export function buildHierarchy(rows: readonly AltObjectLight[]): HierarchyNode[] {
  const roots: HierarchyNode[] = [];
  const byTransformId = new Map<number, HierarchyNode>();
  let scene: HierarchyNode | null = null;
  let firstUiToolkit = true;

  for (const object of rows) {
    if (isSceneMarker(object)) {
      scene = { object, isScene: true, children: [] };
      roots.push(scene);
      continue;
    }
    const node: HierarchyNode = { object, isScene: false, children: [] };
    let parentId = object.transformParentId;
    // Desktop parents the first row of a consecutive UIToolkit run to the scene.
    if (object.type === 'UIToolkit') {
      if (firstUiToolkit) {
        firstUiToolkit = false;
        parentId = 0;
      }
    } else {
      firstUiToolkit = true;
    }
    const parent = parentId === 0 ? null : byTransformId.get(parentId);
    if (parent) parent.children.push(node);
    else if (scene) scene.children.push(node);
    else roots.push(node);
    byTransformId.set(object.transformId, node);
  }
  return roots;
}
