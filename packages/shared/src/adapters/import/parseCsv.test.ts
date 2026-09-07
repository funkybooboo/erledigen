import { describe, expect, test } from 'bun:test';
import { parseCsv } from './parseCsv';

describe('parseCsv', () => {
    test('parses a simple header + rows', () => {
        expect(parseCsv('a,b,c\r\n1,2,3\r\n4,5,6\r\n')).toEqual([
            ['a', 'b', 'c'],
            ['1', '2', '3'],
            ['4', '5', '6'],
        ]);
    });

    test('accepts LF line endings', () => {
        expect(parseCsv('a,b\n1,2')).toEqual([
            ['a', 'b'],
            ['1', '2'],
        ]);
    });

    test('no trailing newline does not create an empty row', () => {
        expect(parseCsv('a,b\r\n1,2')).toEqual([
            ['a', 'b'],
            ['1', '2'],
        ]);
    });

    test('quoted cells may contain commas', () => {
        expect(parseCsv('a,b\r\n"one, two",plain')).toEqual([
            ['a', 'b'],
            ['one, two', 'plain'],
        ]);
    });

    test('quoted cells may span line breaks', () => {
        expect(parseCsv('a,b\r\n"multi\r\nline","x"')).toEqual([
            ['a', 'b'],
            ['multi\r\nline', 'x'],
        ]);
    });

    test('doubled quotes inside a quoted cell are literal quotes', () => {
        expect(parseCsv('a\r\n"say ""hi"""')).toEqual([['a'], ['say "hi"']]);
    });

    test('empty cells are preserved (positional columns)', () => {
        expect(parseCsv('TYPE,CONTENT,DATE\r\ntask,,')).toEqual([
            ['TYPE', 'CONTENT', 'DATE'],
            ['task', '', ''],
        ]);
    });

    test('blank rows are empty-string rows', () => {
        const rows = parseCsv('a,b\r\n1,2\r\n,\r\n3,4');
        expect(rows[2]).toEqual(['', '']);
    });
});
