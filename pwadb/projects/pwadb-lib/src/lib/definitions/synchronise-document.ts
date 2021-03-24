import { RxCollectionCreator, RxDatabaseCreator, RxDocument, RxJsonSchema } from 'rxdb';

export type SynchroniseDocType = {
    id: string;
    databaseOptions: RxDatabaseCreator,
    collectionName: string,
    collectionOptions: RxCollectionCreator,
    collectionEvictTime: number,
    collectionSkipDocuments: number,
};

export type SynchroniseDocMethods = {};

export type SynchroniseDocument = RxDocument<SynchroniseDocType>;

export const getSchema: () => RxJsonSchema<SynchroniseDocType> = () => ({
    title: 'synchronise_store',
    description: `Stores database & collectionNames of data in the collection`,
    keyCompression: false,
    version: 0,
    type: 'object',
    properties: {
        id: {
            type: 'string',
            primary: true,
        },
        databaseOptions: {
            type: 'object',
        },
        collectionName: {
            type: 'string'
        },
        collectionOptions: {
            type: 'object',
        },
        collectionEvictTime: {
            type: 'integer'
        },
        collectionSkipDocuments: {
            type: 'integer'
        }
    },
    encrypted: [
        'databaseOptions',
        'collectionName',
        'collectionEvictTime',
        'collectionSkipDocuments'
    ],
});

export const synchroniseDocMethods: SynchroniseDocMethods = {};
