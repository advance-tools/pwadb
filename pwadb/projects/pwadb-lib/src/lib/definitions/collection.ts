import { PwaDocType, PwaDocMethods, Datatype, getSchema, PwaDocument } from "./document";
import { RxCollection } from 'rxdb';

export type PwaCollectionMethods = {}

export type PwaCollection<T extends Datatype> = RxCollection<PwaDocType<T>, PwaDocMethods, PwaCollectionMethods>;

export const getCollectionCreator = (name: string, collectionMethods: PwaCollectionMethods, documentMethods: PwaDocMethods) => ({
    name: name,
    schema: getSchema(name),
    pouchSettings: {
        revs_limit: 0,
        auto_compaction: true,
    }, // (optional)
    statics: collectionMethods, // (optional) // ORM-functions for this collection
    methods: documentMethods, // (optional) ORM-functions for documents
    attachments: {}, // (optional) ORM-functions for attachments
    options: {}, // (optional) Custom paramters that might be used in plugins
    migrationStrategies: {}, // (optional)
    autoMigrate: true, // (optional)
});

export const pwaCollectionMethods: PwaCollectionMethods = {};

///////////////////////
// interfaces
///////////////////////

export interface ListResponse<T extends Datatype> {
    count: number;
    next: string;
    previous: string;
    results: T[];
}

export interface CollectionListResponse<T extends Datatype> {
    getCount: number;
    postCount: number;
    putResults: PwaDocument<T>[];
    delResults: PwaDocument<T>[];
    results: PwaDocument<T>[];
}

export interface PwaListResponse<T extends Datatype> {
    count: number;
    results: PwaDocument<T>[];
}
