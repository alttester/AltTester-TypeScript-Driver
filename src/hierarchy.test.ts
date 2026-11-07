import { describe, expect, it } from 'vitest';
import { buildHierarchy, type HierarchyNode } from './hierarchy';
import type { AltObjectLight } from './types';

function row(name: string, id: number, transformId: number, transformParentId: number, type = 'GameObject'): AltObjectLight {
  return { name, id, enabled: true, idCamera: 0, transformId, transformParentId, type };
}
const scene = (name: string) => row(name, 0, 0, 0, '');

/** Compact view of a tree: name, or [name, children]. */
type Shape = string | [string, Shape[]];
function shape(nodes: HierarchyNode[]): Shape[] {
  return nodes.map((n) => (n.children.length ? [n.object.name, shape(n.children)] : n.object.name));
}

describe('buildHierarchy', () => {
  it('builds scenes, nested children and DontDestroyOnLoad with children in source order', () => {
    const rows = [
      scene('Main'),
      row('A', 1, 101, 0),
      row('A1', 2, 102, 101),
      row('A1a', 3, 103, 102),
      row('A2', 4, 104, 101),
      row('B', 5, 105, 0),
      scene('Menu'),
      row('C', 6, 106, 0),
      scene('DontDestroyOnLoad'),
      row('D', 7, 107, 0),
      row('D1', 8, 108, 107),
    ];
    const tree = buildHierarchy(rows);
    expect(shape(tree)).toEqual([
      ['Main', [['A', [['A1', ['A1a']], 'A2']], 'B']],
      ['Menu', ['C']],
      ['DontDestroyOnLoad', [['D', ['D1']]]],
    ]);
    expect(tree.map((n) => n.isScene)).toEqual([true, true, true]);
    expect(tree[0].children[0].isScene).toBe(false);
    expect(tree[0].children[0].object).toBe(rows[1]);
  });

  it('attaches an object whose parent is missing to its scene root instead of dropping it', () => {
    const tree = buildHierarchy([
      scene('Main'),
      row('A', 1, 101, 0),
      scene('Second'),
      row('Orphan', 2, 102, 555),
      row('Child', 3, 103, 102),
    ]);
    expect(shape(tree)).toEqual([
      ['Main', ['A']],
      ['Second', [['Orphan', ['Child']]]],
    ]);
  });

  it('a parent that only appears later in the list is not "already seen": the child goes to the scene', () => {
    const tree = buildHierarchy([scene('Main'), row('Early', 1, 101, 102), row('Late', 2, 102, 0)]);
    expect(shape(tree)).toEqual([['Main', ['Early', 'Late']]]);
  });

  it('rows before any scene marker become top-level roots', () => {
    const tree = buildHierarchy([row('Loose', 1, 101, 0), row('Kid', 2, 102, 101), scene('Main')]);
    expect(shape(tree)).toEqual([['Loose', ['Kid']], 'Main']);
    expect(tree[0].isScene).toBe(false);
  });

  it('an empty list yields an empty tree', () => {
    expect(buildHierarchy([])).toEqual([]);
  });

  it('parents the first row of each UIToolkit run to the scene, the rest by transformId', () => {
    const tree = buildHierarchy([
      scene('Main'),
      row('Canvas', 1, 101, 0),
      row('Root', 2, 201, 101, 'UIToolkit'),
      row('Button', 3, 202, 201, 'UIToolkit'),
      row('Label', 4, 203, 201, 'UIToolkit'),
      row('Cube', 5, 105, 0),
      row('Root2', 6, 301, 105, 'UIToolkit'),
      row('Item', 7, 302, 301, 'UIToolkit'),
    ]);
    expect(shape(tree)).toEqual([['Main', ['Canvas', ['Root', ['Button', 'Label']], 'Cube', ['Root2', ['Item']]]]]);
  });

  it('does not mutate the input rows', () => {
    const rows = [scene('Main'), row('A', 1, 101, 0)];
    const copy = structuredClone(rows);
    buildHierarchy(rows);
    expect(rows).toEqual(copy);
  });
});
