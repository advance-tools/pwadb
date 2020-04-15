import { PwaDocType, PwaDocMethods, Datatype, getSchema } from "./document";
import { RxCollection } from 'rxdb';

export type PwaCollectionMethods = {}

export type PwaCollection<T extends Datatype> = RxCollection<PwaDocType<T>, PwaDocMethods, PwaCollectionMethods>;

export const getCollectionCreator = (name: string, collectionMethods: PwaCollectionMethods, documentMethods: PwaDocMethods) => ({
    name: name,
    schema: getSchema(name),
    pouchSettings: {
        revs_limit: 1,
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