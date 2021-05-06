import { RxJsonSchema, RxDocument } from 'rxdb';

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type Datatype = {
    id: string;
};

export type PwaDocType<T extends Datatype> = {
    tenantUrl: string;
    matchUrl: string;
    method: Method;
    data: T | null;
    time: number;
    error: string | null;
    createdAt: number;
    updatedAt: number;
};

export type PwaDocMethods = {};

export type PwaDocument<T extends Datatype> = RxDocument<PwaDocType<T>, PwaDocMethods>;

export const getSchema: (name: string) => RxJsonSchema<PwaDocType<any>> = (name: string) => ({
    title: name + '_store',
    description: `Store ${name} types of data in the collection`,
    keyCompression: false,
    version: 0,
    type: 'object',
    properties: {
        tenantUrl: {
            type: 'string',
            primary: true,
        },
        matchUrl: {
            type: 'string',
        },
        method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'DELETE'],
        },
        data: {
            type: ['object', 'null'],
        },
        time: {
            type: 'integer',
        },
        error: {
            type: ['string', 'null'],
        },
        createdAt: {
            type: 'integer',
        },
        updatedAt: {
            type: 'integer'
        }
    },
    encrypted: [
        'data'
    ],
});

export const pwaDocMethods: PwaDocMethods = {};
