import { describe, expect, it } from 'vitest';
import type { Person } from '../../../src/domain/people';
import { foldName, searchPeopleByName } from '../../../src/ui/people-helpers';

function person(personId: string, name: string): Person {
  return { personId, name, note: '', archived: false, stageId: 'a', stageXpAwarded: [] };
}

const PEOPLE: Person[] = [person('1', 'Dũng Giang'), person('2', 'Nam Uyên'), person('3', 'Đức Lan'), person('4', 'Hà')];

const ids = (list: readonly Person[]): string[] => list.map((p) => p.personId);

describe('foldName', () => {
  it('strips diacritics, maps đ/Đ to d and lower-cases', () => {
    expect(foldName('Dũng Giang')).toBe('dung giang');
    expect(foldName('ĐỨC')).toBe('duc');
    expect(foldName('  Uyên ')).toBe('uyen');
  });

  it('handles precomposed and decomposed input alike', () => {
    expect(foldName('Dũng'.normalize('NFC'))).toBe(foldName('Dũng'.normalize('NFD')));
  });
});

describe('searchPeopleByName', () => {
  it('matches without diacritics and case (AC-25)', () => {
    expect(ids(searchPeopleByName(PEOPLE, 'dung'))).toEqual(['1']);
    expect(ids(searchPeopleByName(PEOPLE, 'DŨNG'))).toEqual(['1']);
  });

  it('matches đ with a plain d', () => {
    expect(ids(searchPeopleByName(PEOPLE, 'duc'))).toEqual(['3']);
    expect(ids(searchPeopleByName(PEOPLE, 'đức'))).toEqual(['3']);
  });

  it('is a substring match anywhere in the name, keeping list order', () => {
    expect(ids(searchPeopleByName(PEOPLE, 'an'))).toEqual(['1', '3']);
    expect(ids(searchPeopleByName(PEOPLE, 'am'))).toEqual(['2']);
    expect(ids(searchPeopleByName(PEOPLE, 'uyen'))).toEqual(['2']);
  });

  it('returns everyone for a blank query and nobody when nothing matches', () => {
    expect(ids(searchPeopleByName(PEOPLE, '   '))).toEqual(['1', '2', '3', '4']);
    expect(searchPeopleByName(PEOPLE, 'xyz')).toEqual([]);
  });

  it('does not mutate the input list', () => {
    const copy = [...PEOPLE];
    searchPeopleByName(PEOPLE, 'dung');
    expect(PEOPLE).toEqual(copy);
  });
});
