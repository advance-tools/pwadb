import { RxDocument, RxJsonSchema } from 'rxdb';
import { PwaDocument } from './document';

export type SynchroniseDocType = {
    id: string;
    databaseOptions: string,
    collectionName: string,
    collectionOptions: string,
    collectionEvictTime: number,
    collectionSkipDocuments: number
};

export type SynchroniseDocMethods = {};

export type SynchroniseDocument = RxDocument<SynchroniseDocType>;

export const getSynchroniseSchema: () => RxJsonSchema<SynchroniseDocType> = () => ({
    title: 'synchronise_store',
    description: `Stores database & collectionNames of data in the collection`,
    keyCompression: false,
    version: 0,
    type: 'object',
    primaryKey: 'id',
    properties: {
        id: {
            type: 'string',
            primary: true,
        },
        databaseOptions: {
            type: 'string',
        },
        collectionName: {
            type: 'string'
        },
        collectionOptions: {
            type: 'string',
        },
        collectionEvictTime: {
            type: 'integer'
        },
        collectionSkipDocuments: {
            type: 'integer'
        },
        collectionReqTitleFieldName: {
            type: 'string'
        },
        collectionReqSubTitleFieldName: {
            type: ['string', 'null']
        },
        collectionReqIconFieldName: {
            type: ['string', 'null']
        }
    },
    encrypted: [
        'databaseOptions',
        'collectionName',
        'collectionOptions',
        'collectionEvictTime',
        'collectionSkipDocuments',
        'collectionReqTitleFieldName',
        'collectionReqSubTitleFieldName',
        'collectionReqIconFieldName',
    ],
});

export const synchroniseDocMethods: SynchroniseDocMethods = {};

