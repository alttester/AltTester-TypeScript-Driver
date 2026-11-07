import { describe, expect, it } from 'vitest';
import { createAltError, InvalidCommandException, NullReferenceException, NotFoundException, UnknownErrorException, AltError } from '../errors';
import { By } from '../types';
import { pathContains, pathFor, pathFromObject } from './paths';

describe('path builders (same strings as Python get_path*, C# SetPath*)', () => {
  it('pathFor', () => {
    expect([By.TAG, By.LAYER, By.NAME, By.COMPONENT, By.PATH, By.ID, By.TEXT].map((b) => pathFor(b, 'v'))).toEqual([
      '//*[@tag=v]',
      '//*[@layer=v]',
      '//v',
      '//*[@component=v]',
      'v',
      '//*[@id=v]',
      '//*[@text=v]',
    ]);
    expect(pathFor(By.NAME, '')).toBe('//');
  });

  it('pathContains', () => {
    expect([By.TAG, By.LAYER, By.NAME, By.COMPONENT, By.PATH, By.ID, By.TEXT].map((b) => pathContains(b, 'v'))).toEqual([
      '//*[contains(@tag,v)]',
      '//*[contains(@layer,v)]',
      '//*[contains(@name,v)]',
      '//*[contains(@component,v)]',
      'v',
      '//*[contains(@id,v)]',
      '//*[contains(@text,v)]',
    ]);
  });

  it('pathFromObject', () => {
    expect([By.TAG, By.LAYER, By.NAME, By.COMPONENT, By.PATH, By.ID, By.TEXT].map((b) => pathFromObject(3, b, 'v'))).toEqual([
      '//*[@id=3]//*[@tag=v]',
      '//*[@id=3]//*[@layer=v]',
      '//*[@id=3]//v',
      '//*[@id=3]//*[@component=v]',
      '//*[@id=3]v',
      '//*[@id=3]//*[@id=v]',
      '//*[@id=3]//*[@text=v]',
    ]);
  });
});

describe('createAltError', () => {
  it('maps wire types to classes and keeps unknown types as AltError', () => {
    expect(createAltError('notFound', 'x')).toBeInstanceOf(NotFoundException);
    expect(createAltError('nullReferenceException', 'x')).toBeInstanceOf(NullReferenceException);
    expect(createAltError('nullReferenceException', 'x')).toBeInstanceOf(NotFoundException);
    expect(createAltError('unknownError', 'x')).toBeInstanceOf(UnknownErrorException);
    const odd = createAltError('somethingNew', 'x');
    expect(odd.constructor).toBe(AltError);
    expect(odd.type).toBe('somethingNew');
    const inv = createAltError('invalidCommand', '');
    expect(inv).toBeInstanceOf(InvalidCommandException);
    expect(inv.message).toContain('Managed Stripping Level');
    expect(inv.name).toBe('InvalidCommandException');
  });
});
