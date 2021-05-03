import { PwaDocument } from '../definitions/document';
import { HttpParams } from '@angular/common/http';

////////////////
// Types
////////////////
// tslint:disable-next-line: max-line-length
export type Lookup = 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'startswith' | 'endswith' | 'range' | 'isnull' | 'iexact' | 'exact' | 'icontains' | 'contains' | 'in';

export type Query = 'filter' | 'distinct' | 'exclude' | 'ordering' | 'only';

export type FieldDataType = string | number | boolean | null;

////////////////
// Parsers
////////////////
export function parseNumber(fieldValue: FieldDataType, inputValue: string): null | {[key: string]: number} {

    const parsedFieldValue = Number(fieldValue?.toString() || '');

    const parsedInputValue = Number(inputValue?.toString() || '');

    return isNaN(parsedFieldValue) && isNaN(parsedInputValue) ? null : {parsedFieldValue, parsedInputValue};
}

export function parseDate(fieldValue: FieldDataType, inputValue: string): null | {[key: string]: number} {

    const parsedFieldValue = Date.parse(fieldValue?.toString() || '');

    const parsedInputValue = Date.parse(inputValue?.toString() || '');

    return isNaN(parsedFieldValue) && isNaN(parsedInputValue) ? null : {parsedFieldValue, parsedInputValue};
}

export function parseBoolean(fieldValue: FieldDataType, inputValue: string): null | {[key: string]: boolean} {

    // tslint:disable-next-line: max-line-length
    const parsedFieldValue = fieldValue?.toString().toLowerCase() === 'true' ? true : fieldValue?.toString().toLowerCase() === 'false' ? false : null;

    // tslint:disable-next-line: max-line-length
    const parsedInputValue = inputValue?.toString().toLowerCase() === 'true' ? true : inputValue?.toString().toLowerCase() === 'false' ? false : null;

    return parsedFieldValue === null || parsedInputValue === null ? null : {parsedFieldValue, parsedInputValue};
}

///////////////////////////////////////////////
// Lookup Filters (num, date, string, boolean)
///////////////////////////////////////////////

// tslint:disable-next-line: max-line-length
export const eq: (v: PwaDocument<any>, field: string, inputValue: string) => boolean = (v: PwaDocument<any>, field: string, inputValue: string) => {

    const isDate = parseDate(v.data[field] as FieldDataType, inputValue);

    if (isDate) { return isDate.parsedFieldValue === isDate.parsedInputValue; }

    const isNumber = parseNumber(v.data[field] as FieldDataType, inputValue);

    if (isNumber) { return isNumber.parsedFieldValue === isNumber.parsedInputValue; }

    const isBoolean = parseBoolean(v.data[field] as FieldDataType, inputValue);

    if (isBoolean) { return isBoolean.parsedFieldValue === isBoolean.parsedInputValue; }

    return v.data[field] === inputValue;
};

///////////////////////////////////////////////
// Lookup Filters (num, date)
///////////////////////////////////////////////

// tslint:disable-next-line: max-line-length
export const gte: (v: PwaDocument<any>, field: string, inputValue: string) => boolean = (v: PwaDocument<any>, field: string, inputValue: string) => {

    const isDate = parseDate(v.data[field] as FieldDataType, inputValue);

    if (isDate) { return isDate.parsedFieldValue >= isDate.parsedInputValue; }

    const isNumber = parseNumber(v.data[field] as FieldDataType, inputValue);

    if (isNumber) { return isNumber.parsedFieldValue >= isNumber.parsedInputValue; }

    return v.data[field] >= inputValue;
};

// tslint:disable-next-line: max-line-length
export const lte: (v: PwaDocument<any>, field: string, inputValue: string) => boolean = (v: PwaDocument<any>, field: string, inputValue: string) => {

    const isDate = parseDate(v.data[field] as FieldDataType, inputValue);

    if (isDate) { return isDate.parsedFieldValue <= isDate.parsedInputValue; }

    const isNumber = parseNumber(v.data[field] as FieldDataType, inputValue);

    if (isNumber) { return isNumber.parsedFieldValue <= isNumber.parsedInputValue; }

    return v.data[field] <= inputValue;
};

// tslint:disable-next-line: max-line-length
export const gt: (v: PwaDocument<any>, field: string, inputValue: string) => boolean = (v: PwaDocument<any>, field: string, inputValue: string) => {

    const isDate = parseDate(v.data[field] as FieldDataType, inputValue);

    if (isDate) { return isDate.parsedFieldValue > isDate.parsedInputValue; }

    const isNumber = parseNumber(v.data[field] as FieldDataType, inputValue);

    if (isNumber) { return isNumber.parsedFieldValue > isNumber.parsedInputValue; }

    return v.data[field] > inputValue;
};

// tslint:disable-next-line: max-line-length
export const lt: (v: PwaDocument<any>, field: string, inputValue: string) => boolean = (v: PwaDocument<any>, field: string, inputValue: string) => {

    const isDate = parseDate(v.data[field] as FieldDataType, inputValue);

    if (isDate) { return isDate.parsedFieldValue < isDate.parsedInputValue; }

    const isNumber = parseNumber(v.data[field] as FieldDataType, inputValue);

    if (isNumber) { return isNumber.parsedFieldValue < isNumber.parsedInputValue; }

    return v.data[field] < inputValue;
};

// tslint:disable-next-line: max-line-length
export const range: (v: PwaDocument<any>, field: string, inputValue: string) => boolean = (v: PwaDocument<any>, field: string, inputValue: string) => {

    const values = inputValue.toString().split(',');

    const isDate1 = parseDate(v.data[field] as FieldDataType, values[0]);

    const isDate2 = parseDate(v.data[field] as FieldDataType, values[1]);

    // tslint:disable-next-line: max-line-length
    if (isDate1 && isDate2) { return isDate1.parsedFieldValue >= isDate1.parsedInputValue && isDate2.parsedFieldValue < isDate2.parsedInputValue; }

    const isNumber1 = parseNumber(v.data[field] as FieldDataType, values[0]);

    const isNumber2 = parseNumber(v.data[field] as FieldDataType, values[1]);

    // tslint:disable-next-line: max-line-length
    if (isNumber1 && isNumber2) { return isNumber1.parsedFieldValue >= isNumber1.parsedInputValue && isNumber2.parsedFieldValue < isNumber2.parsedInputValue; }

    return v.data[field] >= values[0] && v.data[field] < values[1];
};

///////////////////////////////////////////////
// Lookup Filters (string)
///////////////////////////////////////////////

// tslint:disable-next-line: max-line-length
export const startswith: (v: PwaDocument<any>, field: string, inputValue: string) => boolean = (v: PwaDocument<any>, field: string, inputValue: string) => (v.data[field] as FieldDataType)?.toString().startsWith(inputValue);

// tslint:disable-next-line: max-line-length
export const endswith: (v: PwaDocument<any>, field: string, inputValue: string) => boolean   = (v: PwaDocument<any>, field: string, inputValue: string) => (v.data[field] as FieldDataType)?.toString().endsWith(inputValue);

// tslint:disable-next-line: max-line-length
export const iexact: (v: PwaDocument<any>, field: string, inputValue: string) => boolean     = (v: PwaDocument<any>, field: string, inputValue: string) => !!(v.data[field] as FieldDataType)?.toString().match(new RegExp(`^${inputValue}$`, 'i'));

// tslint:disable-next-line: max-line-length
export const exact: (v: PwaDocument<any>, field: string, inputValue: string) => boolean      = (v: PwaDocument<any>, field: string, inputValue: string) => !!(v.data[field] as FieldDataType)?.toString().match(new RegExp(`^${inputValue}$`));

// tslint:disable-next-line: max-line-length
export const icontains: (v: PwaDocument<any>, field: string, inputValue: string) => boolean  = (v: PwaDocument<any>, field: string, inputValue: string) => (v.data[field] as FieldDataType)?.toString().toLowerCase().includes(inputValue?.toLowerCase() || '');

// tslint:disable-next-line: max-line-length
export const contains: (v: PwaDocument<any>, field: string, inputValue: string) => boolean   = (v: PwaDocument<any>, field: string, inputValue: string) => (v.data[field] as FieldDataType)?.toString().includes(inputValue);

///////////////////////////////////////////////
// Lookup Filters (boolean)
///////////////////////////////////////////////
// tslint:disable-next-line: max-line-length
export const isnull: (v: PwaDocument<any>, field: string, inputValue: string) => boolean     = (v: PwaDocument<any>, field: string, inputValue: string) => inputValue?.toLowerCase() === 'true' ? v.data[field] === null : v.data[field] !== null;


export function getQuery(key: string, value: string): {queryType: Query, fields: string[], lookup?: Lookup, inputValue?: string} {

    if (key.includes('distinct')) {

        return {queryType: 'distinct', fields: value.split(',')};

    } else if (key.includes('only')) {

        return {queryType: 'only', fields: value.split(',')};

    } else if (key.includes('ordering')) {

        return {queryType: 'ordering', fields: value.split(',')};

    } else if (key.includes('exclude')) {

        const fieldAndLookup = key.split(':')[1].split('.');

        // tslint:disable-next-line: max-line-length
        return {queryType: 'exclude', fields: [fieldAndLookup[0]], lookup: fieldAndLookup.length > 1 ? fieldAndLookup[1] as Lookup : 'eq', inputValue: value};

    } else if (key.includes('filter')) {

        const fieldAndLookup = key.split(':')[1].split('.');

        // tslint:disable-next-line: max-line-length
        return {queryType: 'filter', fields: [fieldAndLookup[0]], lookup: fieldAndLookup.length > 1 ? fieldAndLookup[1] as Lookup : 'eq', inputValue: value};

    } else {

        const fieldAndLookup = key.split('.');

        // tslint:disable-next-line: max-line-length
        return {queryType: 'filter', fields: [fieldAndLookup[0]], lookup: fieldAndLookup.length > 1 ? fieldAndLookup[1] as Lookup : 'eq', inputValue: value};
    }

}


export function queryFilter(validQueryKeys: string[], params: HttpParams, docs: PwaDocument<any>[]): PwaDocument<any>[] {

    if (params) {

        const keys = params.keys();

        //////////////
        // Filters (1)
        //////////////
        keys.forEach(k => {

            if (validQueryKeys.indexOf(k) > -1) {

                const query = getQuery(k, params.getAll(k).join(','));

                if (query.queryType === 'filter') { docs = filter(query.fields[0], query.inputValue, docs, query.lookup); }
            }
        });

        ///////////////
        // Exclude (2)
        ///////////////

        keys.forEach(k => {

            if (validQueryKeys.indexOf(k) > -1) {

                const query = getQuery(k, params.getAll(k).join(','));

                if (query.queryType === 'exclude') { docs = exclude(query.fields[0], query.inputValue, docs, query.lookup); }
            }
        });

        ////////////////
        // Order By (3)
        ////////////////

        keys.forEach(k => {

            if (validQueryKeys.indexOf(k) > -1) {

                const query = getQuery(k, params.getAll(k).join(','));

                if (query.queryType === 'ordering') { docs = orderBy(query.fields, docs); }
            }
        });

        ////////////////
        // Distinct (4)
        ////////////////

        keys.forEach(k => {

            if (validQueryKeys.indexOf(k) > -1) {

                const query = getQuery(k, params.getAll(k).join(','));

                if (query.queryType === 'distinct') { docs = distinct(query.fields, docs); }
            }
        });

    }

    return docs;
}

export function filter(field: string, inputValue: string, docs: PwaDocument<any>[], lookup?: Lookup, isExclude = false): PwaDocument<any>[] {

    // in lookup would same as eq with OR values
    let f = (v: PwaDocument<any>) => inputValue.split(',').reduce((acc, cur) => acc || eq(v, field, cur), false);

    if (lookup === 'gte') { f = v => inputValue.split(',').reduce((acc, cur) => acc || gte(v, field, cur), false); }

    if (lookup === 'lte') { f = v => inputValue.split(',').reduce((acc, cur) => acc || lte(v, field, cur), false); }

    if (lookup === 'gt') { f = v => inputValue.split(',').reduce((acc, cur) => acc || gt(v, field, cur), false); }

    if (lookup === 'lt') { f = v => inputValue.split(',').reduce((acc, cur) => acc || lt(v, field, cur), false); }

    if (lookup === 'range') { f = v => range(v, field, inputValue); }

    if (lookup === 'startswith') { f = v => inputValue.split(',').reduce((acc, cur) => acc || startswith(v, field, cur), false); }

    if (lookup === 'endswith') { f = v => inputValue.split(',').reduce((acc, cur) => acc || endswith(v, field, cur), false); }

    if (lookup === 'iexact') { f = v => inputValue.split(',').reduce((acc, cur) => acc || iexact(v, field, cur), false); }

    if (lookup === 'exact') { f = v => inputValue.split(',').reduce((acc, cur) => acc || exact(v, field, cur), false); }

    if (lookup === 'icontains') { f = v => inputValue.split(',').reduce((acc, cur) => acc || icontains(v, field, cur), false); }

    if (lookup === 'contains') { f = v => inputValue.split(',').reduce((acc, cur) => acc || contains(v, field, cur), false); }

    if (lookup === 'isnull') { f = v => inputValue.split(',').reduce((acc, cur) => acc || isnull(v, field, cur), false); }

    return docs.filter((v) => {

        const o = f(v);

        return isExclude ? !o : o;
    });
}

export function exclude(field: string, inputValue: string, docs: PwaDocument<any>[], lookup?: Lookup): PwaDocument<any>[] {

    return filter(field, inputValue, docs, lookup, true);
}

export function distinct(fields: string[], docs: PwaDocument<any>[]): PwaDocument<any>[] {

    const uniques = new Set<FieldDataType>();

    const distinctArray: PwaDocument<any>[] = [];

    docs.forEach(v => {

        const key = fields.reduce((acc, cur) => acc += `-${(v.data[cur] as FieldDataType)?.toString() || 'null'}`, '');

        if (!uniques.has(key)) {

            uniques.add(key);

            distinctArray.push(v);
        }
    });

    return distinctArray;
}

export function orderBy(fields: string[], docs: PwaDocument<any>[]): PwaDocument<any>[] {

    return docs.sort((a, b) => {

        // tslint:disable-next-line: prefer-for-of
        for (let i = 0; i < fields.length; i++) {

            const order = fields[i].indexOf('-') === 0 ? 'desc' : 'asc';

            const parseFieldName = order === 'desc' ? fields[i].split('-')[1] : fields[i];

            if (!(parseFieldName in a?.data) || !(parseFieldName in b?.data)) { console.log(parseFieldName, a?.data, b?.data); continue; }

            const isDate = parseDate(a.data[parseFieldName], b.data[parseFieldName]);

            // tslint:disable-next-line: max-line-length
            if (isDate && order === 'asc' && isDate.parsedFieldValue !== isDate.parsedInputValue) { return isDate.parsedFieldValue - isDate.parsedInputValue; }

            // tslint:disable-next-line: max-line-length
            if (isDate && order === 'desc' && isDate.parsedInputValue !== isDate.parsedFieldValue) { return isDate.parsedInputValue - isDate.parsedFieldValue; }

            const isNumber = parseNumber(a.data[parseFieldName], b.data[parseFieldName]);

            // tslint:disable-next-line: max-line-length
            if (isNumber && order === 'asc' && isNumber.parsedFieldValue !== isNumber.parsedInputValue) { return isNumber.parsedFieldValue - isNumber.parsedInputValue; }

            // tslint:disable-next-line: max-line-length
            if (isNumber && order === 'desc' && isNumber.parsedInputValue !== isNumber.parsedFieldValue) { return isNumber.parsedInputValue - isNumber.parsedFieldValue; }

            const valueA = ((a.data[parseFieldName] as FieldDataType)?.toString() || '').toLowerCase();

            const valueB = ((b.data[parseFieldName] as FieldDataType)?.toString() || '').toLowerCase();

            if (valueA < valueB) { return order === 'asc' ? -1 : 1; }

            if (valueA > valueB) { return order === 'asc' ? 1 : -1; }

        }

        return 0;
    });
}
