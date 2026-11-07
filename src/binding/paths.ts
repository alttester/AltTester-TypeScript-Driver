// Path builders for find-type commands, a literal port of the bindings
// (Python commands/base_command.py get_path*, C# AltBaseFindObjects.SetPath*). Values are not escaped,
// exactly as in the official bindings.

import { By } from '../types';

export function pathFor(by: By, value: string | number): string {
  switch (by) {
    case By.TAG:
      return `//*[@tag=${value}]`;
    case By.LAYER:
      return `//*[@layer=${value}]`;
    case By.NAME:
      return `//${value}`;
    case By.COMPONENT:
      return `//*[@component=${value}]`;
    case By.PATH:
      return String(value);
    case By.ID:
      return `//*[@id=${value}]`;
    case By.TEXT:
      return `//*[@text=${value}]`;
  }
  throw new TypeError(`Unknown By value: ${String(by)}`);
}

export function pathContains(by: By, value: string | number): string {
  switch (by) {
    case By.TAG:
      return `//*[contains(@tag,${value})]`;
    case By.LAYER:
      return `//*[contains(@layer,${value})]`;
    case By.NAME:
      return `//*[contains(@name,${value})]`;
    case By.COMPONENT:
      return `//*[contains(@component,${value})]`;
    case By.PATH:
      return String(value);
    case By.ID:
      return `//*[contains(@id,${value})]`;
    case By.TEXT:
      return `//*[contains(@text,${value})]`;
  }
  throw new TypeError(`Unknown By value: ${String(by)}`);
}

export function pathFromObject(parentId: number, by: By, value: string | number): string {
  const root = `//*[@id=${parentId}]`;
  switch (by) {
    case By.TAG:
      return `${root}//*[@tag=${value}]`;
    case By.LAYER:
      return `${root}//*[@layer=${value}]`;
    case By.NAME:
      return `${root}//${value}`;
    case By.COMPONENT:
      return `${root}//*[@component=${value}]`;
    case By.PATH:
      return `${root}${value}`;
    case By.ID:
      return `${root}//*[@id=${value}]`;
    case By.TEXT:
      return `${root}//*[@text=${value}]`;
  }
  throw new TypeError(`Unknown By value: ${String(by)}`);
}
