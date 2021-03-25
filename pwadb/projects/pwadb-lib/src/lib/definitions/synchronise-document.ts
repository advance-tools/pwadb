import { RxCollectionCreator, RxDatabaseCreator, RxDocument, RxJsonSchema } from 'rxdb';
import { PwaDocument } from './document';

export type SynchroniseDocType = {
    id: string;
    databaseOptions: RxDatabaseCreator,
    collectionName: string,
    collectionOptions: RxCollectionCreator,
    collectionEvictTime: number,
    collectionSkipDocuments: number,
    collectionReqTitleFieldName: string,
    collectionReqSubTitleFieldName: string,
    collectionReqIconFieldName: string,
};

export type SynchroniseDocMethods = {};

export type SynchroniseDocument = RxDocument<SynchroniseDocType>;

export const getSynchroniseSchema: () => RxJsonSchema<SynchroniseDocType> = () => ({
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
        'collectionEvictTime',
        'collectionSkipDocuments'
    ],
});

export const synchroniseDocMethods: SynchroniseDocMethods = {};


export interface RequestDocument {
    title: string;
    subTitle: string;
    icon: string;
    document: PwaDocument<any>;
}
