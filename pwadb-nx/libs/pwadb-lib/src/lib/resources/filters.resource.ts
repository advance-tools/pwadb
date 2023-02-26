import { PwaDocument } from '../definitions/document';
import { HttpParams } from '@angular/common/http';
import trigramSimilarity from 'trigram-similarity';

////////////////
// Types
////////////////
// tslint:disable-next-line: max-line-length
export type Lookup = 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'startswith' | 'endswith' | 'range' | 'isnull' | 'iexact' | 'exact' | 'icontains' | 'contains' | 'in';

export type Query = 'filter' | 'distinct' | 'exclude' | 'ordering' | 'only' | 'search_query';

export type FieldDataType = string | number | boolean | null;

////////////////
// Parsers
////////////////
export function parseNumber(fieldValue: FieldDataType, inputValue: string): {parsedFieldValue: number, parsedInputValue: number} | null {

    const parsedFieldValue = Number(fieldValue?.toString() || '');

    const parsedInputValue = Number(inputValue?.toString() || '');

    return isNaN(parsedFieldValue) && isNaN(parsedInputValue) ? null : {parsedFieldValue, parsedInputValue};
}

export function parseDate(fieldValue: FieldDataType, inputValue: string): {parsedFieldValue: number, parsedInputValue: number} | null {

    const parsedFieldValue = Date.parse(fieldValue?.toString() || '');

    const parsedInputValue = Date.parse(inputValue?.toString() || '');

    return isNaN(parsedFieldValue) && isNaN(parsedInputValue) ? null : {parsedFieldValue, parsedInputValue};
}

export function parseBoolean(fieldValue: FieldDataType, inputValue: string): {parsedFieldValue: boolean, parsedInputValue: boolean} | null  {

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

    // add data in results if field doesn't exist
    if (!(field in v.data)) return true;

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

    // add data in results if field doesn't exist
    if (!(field in v.data)) return true;

    const isDate = parseDate(v.data[field] as FieldDataType, inputValue);

    if (isDate) { return isDate.parsedFieldValue >= isDate.parsedInputValue; }

    const isNumber = parseNumber(v.data[field] as FieldDataType, inputValue);

    if (isNumber) { return isNumber.parsedFieldValue >= isNumber.parsedInputValue; }

    return v.data[field] >= inputValue;
};

// tslint:disable-next-line: max-line-length
export const lte: (v: PwaDocument<any>, field: string, inputValue: string) => boolean = (v: PwaDocument<any>, field: string, inputValue: string) => {

    // add data in results if field doesn't exist
    if (!(field in v.data)) return true;

    const isDate = parseDate(v.data[field] as FieldDataType, inputValue);

    if (isDate) { return isDate.parsedFieldValue <= isDate.parsedInputValue; }

    const isNumber = parseNumber(v.data[field] as FieldDataType, inputValue);

    if (isNumber) { return isNumber.parsedFieldValue <= isNumber.parsedInputValue; }

    return v.data[field] <= inputValue;
};

// tslint:disable-next-line: max-line-length
export const gt: (v: PwaDocument<any>, field: string, inputValue: string) => boolean = (v: PwaDocument<any>, field: string, inputValue: string) => {

    // add data in results if field doesn't exist
    if (!(field in v.data)) return true;

    const isDate = parseDate(v.data[field] as FieldDataType, inputValue);

    if (isDate) { return isDate.parsedFieldValue > isDate.parsedInputValue; }

    const isNumber = parseNumber(v.data[field] as FieldDataType, inputValue);

    if (isNumber) { return isNumber.parsedFieldValue > isNumber.parsedInputValue; }

    return v.data[field] > inputValue;
};

// tslint:disable-next-line: max-line-length
export const lt: (v: PwaDocument<any>, field: string, inputValue: string) => boolean = (v: PwaDocument<any>, field: string, inputValue: string) => {

    // add data in results if field doesn't exist
    if (!(field in v.data)) return true;

    const isDate = parseDate(v.data[field] as FieldDataType, inputValue);

    if (isDate) { return isDate.parsedFieldValue < isDate.parsedInputValue; }

    const isNumber = parseNumber(v.data[field] as FieldDataType, inputValue);

    if (isNumber) { return isNumber.parsedFieldValue < isNumber.parsedInputValue; }

    return v.data[field] < inputValue;
};

// tslint:disable-next-line: max-line-length
export const range: (v: PwaDocument<any>, field: string, inputValue: string) => boolean = (v: PwaDocument<any>, field: string, inputValue: string) => {

    // add data in results if field doesn't exist
    if (!(field in v.data)) return true;

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

export const startswith: (v: PwaDocument<any>, field: string, inputValue: string) => boolean | undefined = (v: PwaDocument<any>, field: string, inputValue: string) => {

    // add data in results if field doesn't exist
    if (!(field in v.data)) return true;

    return (v.data[field] as FieldDataType)?.toString().startsWith(inputValue);
}

export const endswith: (v: PwaDocument<any>, field: string, inputValue: string) => boolean | undefined   = (v: PwaDocument<any>, field: string, inputValue: string) => {

    // add data in results if field doesn't exist
    if (!(field in v.data)) return true;

    return (v.data[field] as FieldDataType)?.toString().endsWith(inputValue);
}

export const iexact: (v: PwaDocument<any>, field: string, inputValue: string) => boolean                 = (v: PwaDocument<any>, field: string, inputValue: string) => {

    // add data in results if field doesn't exist
    if (!(field in v.data)) return true;

    return !!(v.data[field] as FieldDataType)?.toString().match(new RegExp(`^${inputValue}$`, 'i'));
}

export const exact: (v: PwaDocument<any>, field: string, inputValue: string) => boolean                  = (v: PwaDocument<any>, field: string, inputValue: string) => {

    // add data in results if field doesn't exist
    if (!(field in v.data)) return true;

    return !!(v.data[field] as FieldDataType)?.toString().match(new RegExp(`^${inputValue}$`));
}

export const icontains: (v: PwaDocument<any>, field: string, inputValue: string) => boolean | undefined  = (v: PwaDocument<any>, field: string, inputValue: string) => {

    // add data in results if field doesn't exist
    if (!(field in v.data)) return true;

    return (v.data[field] as FieldDataType)?.toString().toLowerCase().includes(inputValue?.toLowerCase() || '');
}

export const contains: (v: PwaDocument<any>, field: string, inputValue: string) => boolean | undefined   = (v: PwaDocument<any>, field: string, inputValue: string) => {

    // add data in results if field doesn't exist
    if (!(field in v.data)) return true;

    return (v.data[field] as FieldDataType)?.toString().includes(inputValue);
}


///////////////////////////////////////////////
// Lookup Filters (boolean)
///////////////////////////////////////////////
// tslint:disable-next-line: max-line-length
export const isnull: (v: PwaDocument<any>, field: string, inputValue: string) => boolean     = (v: PwaDocument<any>, field: string, inputValue: string) => {

    // add data in results if field doesn't exist
    if (!(field in v.data)) return true;

    return inputValue?.toLowerCase() === 'true' ? v.data[field] === null : v.data[field] !== null;
}


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

    } else if (key.includes('search_query')) {

        const fieldAndLookup = key.split(':')[1].split('.');

        // tslint:disable-next-line: max-line-length
        return {queryType: 'search_query', fields: [fieldAndLookup[0]], lookup: fieldAndLookup.length > 1 ? fieldAndLookup[1] as Lookup : 'eq', inputValue: value};

    } else {

        const fieldAndLookup = key.split('.');

        // tslint:disable-next-line: max-line-length
        return {queryType: 'filter', fields: [fieldAndLookup[0]], lookup: fieldAndLookup.length > 1 ? fieldAndLookup[1] as Lookup : 'eq', inputValue: value};
    }

}


export function queryFilter(validQueryKeys: string[], params?: HttpParams, docs: PwaDocument<any>[] = []): PwaDocument<any>[] {

    if (params) {

        const keys = params.keys();

        //////////////
        // Filters (1)
        //////////////
        keys.forEach(k => {

            if (validQueryKeys.indexOf(k) > -1) {

                const query = getQuery(k, params?.getAll(k)?.join(',') || '');

                if (query.queryType === 'filter') { docs = filter(query.fields[0], query.inputValue || '', docs, query.lookup); }
            }
        });

        ///////////////////
        // SearchQuery (2)
        ///////////////////
        keys.forEach(k => {

            if (validQueryKeys.indexOf(k) > -1) {

                const query = getQuery(k, params?.getAll(k)?.join(',') || '');

                if (query.queryType === 'search_query') { docs = searchQuery(query.fields[0], query.inputValue || '', docs); }
            }
        });

        ///////////////
        // Exclude (3)
        ///////////////

        keys.forEach(k => {

            if (validQueryKeys.indexOf(k) > -1) {

                const query = getQuery(k, params?.getAll(k)?.join(',') || '');

                if (query.queryType === 'exclude') { docs = exclude(query.fields[0], query.inputValue || '', docs, query.lookup); }
            }
        });

        ////////////////
        // Order By (4)
        ////////////////

        keys.forEach(k => {

            if (validQueryKeys.indexOf(k) > -1) {

                const query = getQuery(k, params?.getAll(k)?.join(',') || '');

                if (query.queryType === 'ordering') { docs = orderBy(query.fields, docs); }
            }
        });

        ////////////////
        // Distinct (5)
        ////////////////

        keys.forEach(k => {

            if (validQueryKeys.indexOf(k) > -1) {

                const query = getQuery(k, params?.getAll(k)?.join(',') || '');

                if (query.queryType === 'distinct') { docs = distinct(query.fields, docs); }
            }
        });

    }

    return docs;
}

export function searchQuery(field: string, inputValue, docs: PwaDocument<any>[]): PwaDocument<any>[] {

    return docs.map(doc => {

        // Ex. "'+91239898343':2A '395008':8B 'custom':10A 'gujarat':7B 'india':9B 'nanpura':4B,5B 'surat':6B 'testcustom':1A 'testcustomer2@gmail.com':3A"
        const lexems = doc.data[field].split(' ').map(v => v.split(':')[0].replaceAll("'",' ')).join('');

        const similarity = trigramSimilarity(inputValue, lexems);

        return {doc, similarity};
    })
    .filter(v => v.similarity >= 0.07)
    .sort((a, b) => b.similarity - a.similarity)
    .map(v => v.doc);
}

export function filter(field: string, inputValue: string, docs: PwaDocument<any>[], lookup?: Lookup, isExclude = false): PwaDocument<any>[] {

    console.log(docs, field, inputValue, lookup);

    // in lookup would same as eq with OR values
    let f = (v: PwaDocument<any>) => inputValue.split(',').reduce((acc, cur) => acc || eq(v, field, cur), false);

    if (lookup === 'gte') { f = v => inputValue.split(',').reduce((acc: boolean, cur: string) => acc || gte(v, field, cur), false); }

    if (lookup === 'lte') { f = v => inputValue.split(',').reduce((acc: boolean, cur: string) => acc || lte(v, field, cur), false); }

    if (lookup === 'gt') { f = v => inputValue.split(',').reduce((acc: boolean, cur: string) => acc || gt(v, field, cur), false); }

    if (lookup === 'lt') { f = v => inputValue.split(',').reduce((acc: boolean, cur: string) => acc || lt(v, field, cur), false); }

    if (lookup === 'range') { f = v => range(v, field, inputValue); }

    if (lookup === 'startswith') { f = v => inputValue.split(',').reduce((acc: boolean, cur: string) => acc || !!startswith(v, field, cur), false); }

    if (lookup === 'endswith') { f = v => inputValue.split(',').reduce((acc: boolean, cur: string) => acc || !!endswith(v, field, cur), false); }

    if (lookup === 'iexact') { f = v => inputValue.split(',').reduce((acc: boolean, cur: string) => acc || iexact(v, field, cur), false); }

    if (lookup === 'exact') { f = v => inputValue.split(',').reduce((acc: boolean, cur: string) => acc || exact(v, field, cur), false); }

    if (lookup === 'icontains') { f = v => inputValue.split(',').reduce((acc: boolean, cur: string) => acc || !!icontains(v, field, cur), false); }

    if (lookup === 'contains') { f = v => inputValue.split(',').reduce((acc: boolean, cur: string) => acc || !!contains(v, field, cur), false); }

    if (lookup === 'isnull') { f = v => inputValue.split(',').reduce((acc: boolean, cur: string) => acc || isnull(v, field, cur), false); }

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

            if (!(parseFieldName in a?.data) || !(parseFieldName in b?.data)) { continue; }

            let output = 0;

            const isDate = parseDate(a.data[parseFieldName], b.data[parseFieldName]);

            // tslint:disable-next-line: max-line-length
            if (isDate && order === 'asc' && isDate.parsedFieldValue !== isDate.parsedInputValue) {

                output = isDate.parsedFieldValue - isDate.parsedInputValue;

                if (output > 0 || output < 0) { return output; }
            }

            // tslint:disable-next-line: max-line-length
            if (isDate && order === 'desc' && isDate.parsedInputValue !== isDate.parsedFieldValue) {

                output = isDate.parsedInputValue - isDate.parsedFieldValue;

                if (output > 0 || output < 0) { return output; }
            }

            const isNumber = parseNumber(a.data[parseFieldName], b.data[parseFieldName]);

            // tslint:disable-next-line: max-line-length
            if (isNumber && order === 'asc' && isNumber.parsedFieldValue !== isNumber.parsedInputValue) {

                output = isNumber.parsedFieldValue - isNumber.parsedInputValue;

                if (output > 0 || output < 0) { return output; }
            }

            // tslint:disable-next-line: max-line-length
            if (isNumber && order === 'desc' && isNumber.parsedInputValue !== isNumber.parsedFieldValue) {

                output = isNumber.parsedInputValue - isNumber.parsedFieldValue;

                if (output > 0 || output < 0) { return output; }
            }

            const valueA = (a.data[parseFieldName] as FieldDataType)?.toString() || '';

            const valueB = (b.data[parseFieldName] as FieldDataType)?.toString() || '';

            output = order === 'asc' ? valueA.localeCompare(valueB) : valueA.localeCompare(valueB) * -1;

            if (output > 0 || output < 0) { return output; }

        }

        return 0;
    });
}
