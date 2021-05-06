import { PwaDocType, PwaDocMethods, Datatype, getSchema, PwaDocument } from './document';
import { RxCollection, RxCollectionCreator } from 'rxdb';

export type PwaCollectionMethods = {};

export type PwaCollection<T extends Datatype> = RxCollection<PwaDocType<T>, PwaDocMethods, PwaCollectionMethods>;

export const getCollectionCreator = (
    name: string,
    collectionMethods: PwaCollectionMethods,
    documentMethods: PwaDocMethods,
    attachments = {},
    options = {},
    migrationStrategies = {},
    autoMigrate = true,
) => ({
        name,
        schema: getSchema(name),
        pouchSettings: {
            revs_limit: 0,
            auto_compaction: true,
        }, // (optional)
        statics: collectionMethods, // (optional) // ORM-functions for this collection
        methods: documentMethods, // (optional) ORM-functions for documents
        attachments, // (optional) ORM-functions for attachments
        options, // (optional) Custom paramters that might be used in plugins
        migrationStrategies: {
            // 1 means, this transforms data from version 0 to version 1
            1: (oldDoc: PwaDocType<any>) => {

                oldDoc.createdAt = new Date().getTime();
                oldDoc.updatedAt = new Date().getTime();

                return oldDoc;
            },
            ...migrationStrategies
        }, // (optional)
        autoMigrate, // (optional)
} as RxCollectionCreator);

export const pwaCollectionMethods: PwaCollectionMethods = {};

///////////////////////
// interfaces
///////////////////////

export interface ListResponse<T extends Datatype> {
    next: string;
    previous: string;
    results: T[];
}

export interface CollectionListResponse<T extends Datatype> {
    next: string;
    previous: string;
    results: PwaDocument<T>[];
    count?: number;
}

export interface PwaListResponse<T extends Datatype> {
    next: string;
    previous: string;
    results: PwaDocument<T>[];
}
