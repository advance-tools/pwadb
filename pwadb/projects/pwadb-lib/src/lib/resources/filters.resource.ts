import { PwaDocument } from '../definitions/document';
import { HttpParams } from '@angular/common/http';

////////////////
// Types
////////////////
export type Lookup = 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'startswith' | 'endswith' | 'range' | 'isnull' | 'iexact' | 'exact' | 'icontains' | 'contains' | 'in';

export type Query = 'filter' | 'distinct' | 'exclude' | 'order_by' | 'only';

export type FieldDataType = string | number | boolean | null;

////////////////
// Parsers
////////////////
export function parseNumber(fieldValue: FieldDataType, inputValue: string) {

    const parsedFieldValue = parseFloat(fieldValue.toString());

    const parsedInputValue = parseFloat(inputValue.toString());

    return parsedFieldValue !== NaN && parsedInputValue !== NaN ? {parsedFieldValue, parsedInputValue} : false;
}

export function parseDate(fieldValue: FieldDataType, inputValue: string) {

    const parsedFieldValue = Date.parse(fieldValue.toString());

    const parsedInputValue = Date.parse(inputValue.toString());

    return parsedFieldValue !== NaN && parsedInputValue !== NaN ? {parsedFieldValue, parsedInputValue} : false;
}

///////////////////////////////////////////////
// Lookup Filters (num, date, string, boolean)
///////////////////////////////////////////////

export const eq = (v: PwaDocument<any>, field: string, inputValue: string) => {

    const isNumber = parseNumber(v.data[field] as FieldDataType, inputValue);

    if (isNumber) return isNumber.parsedFieldValue === isNumber.parsedInputValue;

    const isDate = parseDate(v.data[field] as FieldDataType, inputValue);

    if (isDate) return isDate.parsedFieldValue === isDate.parsedInputValue;

    return v.data[field] === inputValue;
}

///////////////////////////////////////////////
// Lookup Filters (num, date)
///////////////////////////////////////////////

export const gte = (v: PwaDocument<any>, field: string, inputValue: string) => {

    const isNumber = parseNumber(v.data[field] as FieldDataType, inputValue);

    if (isNumber) return isNumber.parsedFieldValue >= isNumber.parsedInputValue;

    const isDate = parseDate(v.data[field] as FieldDataType, inputValue);

    if (isDate) return isDate.parsedFieldValue >= isDate.parsedInputValue;

    return v.data[field] >= inputValue;
}

export const lte = (v: PwaDocument<any>, field: string, inputValue: string) => {

    const isNumber = parseNumber(v.data[field] as FieldDataType, inputValue);

    if (isNumber) return isNumber.parsedFieldValue <= isNumber.parsedInputValue;

    const isDate = parseDate(v.data[field] as FieldDataType, inputValue);

    if (isDate) return isDate.parsedFieldValue <= isDate.parsedInputValue;

    return v.data[field] <= inputValue;
}

export const gt = (v: PwaDocument<any>, field: string, inputValue: string) => {

    const isNumber = parseNumber(v.data[field] as FieldDataType, inputValue);

    if (isNumber) return isNumber.parsedFieldValue > isNumber.parsedInputValue;

    const isDate = parseDate(v.data[field] as FieldDataType, inputValue);

    if (isDate) return isDate.parsedFieldValue > isDate.parsedInputValue;

    return v.data[field] > inputValue;
}

export const lt = (v: PwaDocument<any>, field: string, inputValue: string) => {

    const isNumber = parseNumber(v.data[field] as FieldDataType, inputValue);

    if (isNumber) return isNumber.parsedFieldValue < isNumber.parsedInputValue;

    const isDate = parseDate(v.data[field] as FieldDataType, inputValue);

    if (isDate) return isDate.parsedFieldValue < isDate.parsedInputValue;

    return v.data[field] < inputValue;
}

export const range = (v: PwaDocument<any>, field: string, inputValue: string) => {

    const values = inputValue.toString().split(',');

    const isNumber1 = parseNumber(v.data[field] as FieldDataType, values[0]);

    const isNumber2 = parseNumber(v.data[field] as FieldDataType, values[1]);

    if (isNumber1 && isNumber2) return isNumber1.parsedFieldValue >= isNumber1.parsedInputValue && isNumber2.parsedFieldValue < isNumber2.parsedInputValue;

    const isDate1 = parseDate(v.data[field] as FieldDataType, values[0]);

    const isDate2 = parseDate(v.data[field] as FieldDataType, values[1]);

    if (isDate1 && isDate2) return isDate1.parsedFieldValue >= isDate1.parsedInputValue && isDate2.parsedFieldValue < isDate2.parsedInputValue;

    return v.data[field] >= values[0] && v.data[field] < values[1];
};

///////////////////////////////////////////////
// Lookup Filters (string)
///////////////////////////////////////////////

export const startswith = (v: PwaDocument<any>, field: string, inputValue: string) => (v.data[field] as FieldDataType).toString().match(new RegExp(`^${inputValue}.*`)).length > 0;

export const endswith   = (v: PwaDocument<any>, field: string, inputValue: string) => (v.data[field] as FieldDataType).toString().match(new RegExp(`*.${inputValue}$`)).length > 0;

export const iexact     = (v: PwaDocument<any>, field: string, inputValue: string) => (v.data[field] as FieldDataType).toString().match(new RegExp(`^${inputValue}$`, 'i')).length > 0;

export const exact      = (v: PwaDocument<any>, field: string, inputValue: string) => (v.data[field] as FieldDataType).toString().match(new RegExp(`^${inputValue}$`)).length > 0;

export const icontains  = (v: PwaDocument<any>, field: string, inputValue: string) => (v.data[field] as FieldDataType).toString().toLowerCase().includes(inputValue);

export const contains   = (v: PwaDocument<any>, field: string, inputValue: string) => (v.data[field] as FieldDataType).toString().includes(inputValue);

///////////////////////////////////////////////
// Lookup Filters (boolean)
///////////////////////////////////////////////

export const isnull     = (v: PwaDocument<any>, field: string, inputValue: string) => inputValue.toLowerCase() === 'true' ? v.data[field] === null : v.data[field] !== null;


export function getQuery(key: string, value: string): {queryType: Query, fields: string[], lookup?: Lookup ,inputValue?: string} {

    if (key.includes('distinct')) {

        return {queryType: 'distinct', fields: value.split(',')};

    } else if (key.includes('only')) {

        return {queryType: 'only', fields: value.split(',')};

    } else if (key.includes('order_by')) {

        return {queryType: 'order_by', fields: value.split(',')};

    } else if (key.includes('exclude')) {

        const fieldAndLookup = key.split(':')[1].split('.');

        return {queryType: 'exclude', fields: [fieldAndLookup[0]], lookup: fieldAndLookup.length === 1 ? fieldAndLookup[1] as Lookup : 'eq', inputValue: value};

    } else if (key.includes('filter')) {

        const fieldAndLookup = key.split(':')[1].split('.');

        return {queryType: 'filter', fields: [fieldAndLookup[0]], lookup: fieldAndLookup.length === 1 ? fieldAndLookup[1] as Lookup : 'eq', inputValue: value};

    } else {

        const fieldAndLookup = key.split('.');

        return {queryType: 'filter', fields: [fieldAndLookup[0]], lookup: fieldAndLookup.length === 1 ? fieldAndLookup[1] as Lookup : 'eq', inputValue: value}
    }

}


export function queryFilter(validQueryKeys: string[], params: HttpParams, docs: PwaDocument<any>[]) {

    if (params) {

        params.keys().forEach(k => {
    
            if (k in validQueryKeys) {
    
                const query = getQuery(k, params.getAll(k).join(','));
    
                if (query.queryType === 'distinct') {
    
                    docs = distinct(query.fields, docs);
    
                } else if (query.queryType === 'filter') {
    
                    docs = filter(query.fields[0], query.inputValue, docs, query.lookup);
    
                } else if (query.queryType === 'exclude') {
    
                    docs = exclude(query.fields[0], query.inputValue, docs, query.lookup);
    
                } else if (query.queryType === 'order_by') {
    
                    docs = orderBy(query.fields, docs);
                }
            }
        });
    }

    return docs;
}

export function filter(field: string, inputValue: string, docs: PwaDocument<any>[], lookup?: Lookup) {

    // in lookup would same as eq with OR values
    let f = (v: PwaDocument<any>) => inputValue.split(',').reduce((acc, cur) => acc || eq(v, field, cur), false);

    if (lookup === 'gte') f = v => inputValue.split(',').reduce((acc, cur) => acc || gte(v, field, cur), false);

    if (lookup === 'lte') f = v => inputValue.split(',').reduce((acc, cur) => acc || lte(v, field, cur), false);

    if (lookup === 'gt') f = v => inputValue.split(',').reduce((acc, cur) => acc || gt(v, field, cur), false);

    if (lookup === 'lt') f = v => inputValue.split(',').reduce((acc, cur) => acc || lt(v, field, cur), false);

    if (lookup === 'range') f = v => range(v, field, inputValue);

    if (lookup === 'startswith') f = v => inputValue.split(',').reduce((acc, cur) => acc || startswith(v, field, cur), false);

    if (lookup === 'endswith') f = v => inputValue.split(',').reduce((acc, cur) => acc || endswith(v, field, cur), false);

    if (lookup === 'iexact') f = v => inputValue.split(',').reduce((acc, cur) => acc || iexact(v, field, cur), false);

    if (lookup === 'exact') f = v => inputValue.split(',').reduce((acc, cur) => acc || exact(v, field, cur), false);

    if (lookup === 'icontains') f = v => inputValue.split(',').reduce((acc, cur) => acc || icontains(v, field, cur), false);

    if (lookup === 'contains') f = v => inputValue.split(',').reduce((acc, cur) => acc || contains(v, field, cur), false);

    if (lookup === 'isnull') f = v => inputValue.split(',').reduce((acc, cur) => acc || isnull(v, field, cur), false);

    return docs.filter(f);
}

export function exclude(field: string, inputValue: string, docs: PwaDocument<any>[], lookup?: Lookup) {

    const filteredDocs = new Set(filter(field, inputValue, docs, lookup));

    return docs.filter(v => !filteredDocs.has(v));
}

export function distinct(fields: string[], docs: PwaDocument<any>[]) {

    const uniques = new Set<FieldDataType>();

    const distinctArray: PwaDocument<any>[] = [];

    docs.forEach(v => {

        const key = fields.reduce((acc, cur) => acc += `-${(v.data[cur] as FieldDataType).toString()}`, '');

        if (!uniques.has(key)) {

            uniques.add(key);

            distinctArray.push(v);
        }
    });

    return distinctArray;
}

export function orderBy(fields: string[], docs: PwaDocument<any>[]) {

    return docs.sort((a, b) => {

        for (let i = 0; i < fields.length; i++) {

            const order = fields[i].indexOf('-') === 0 ? 'desc' : 'asc';

            const isNumber = parseNumber(a.data[fields[i]], b.data[fields[i]]);

            if (isNumber && order === 'asc' && isNumber.parsedFieldValue !== isNumber.parsedInputValue) return isNumber.parsedFieldValue - isNumber.parsedInputValue;

            if (isNumber && order === 'desc' && isNumber.parsedInputValue !== isNumber.parsedFieldValue) return isNumber.parsedInputValue - isNumber.parsedFieldValue;

            const isDate = parseDate(a.data[fields[i]], b.data[fields[i]]);

            if (isDate && order === 'asc' && isDate.parsedFieldValue !== isDate.parsedInputValue) return isDate.parsedFieldValue - isDate.parsedInputValue;

            if (isDate && order === 'desc' && isDate.parsedInputValue !== isDate.parsedFieldValue) return isDate.parsedInputValue - isDate.parsedFieldValue;

            const valueA = (a.data[fields[i]] as FieldDataType).toString().toLowerCase();

            const valueB = (b.data[fields[i]] as FieldDataType).toString().toLowerCase();

            if (valueA < valueB) return -1;

            if (valueA > valueB) return 1;

        }

        return 0;
    });
}
