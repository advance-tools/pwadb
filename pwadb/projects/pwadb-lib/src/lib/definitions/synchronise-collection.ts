import { RxCollection, RxCollectionCreator } from 'rxdb';
import { getSchema, SynchroniseDocMethods, SynchroniseDocType } from './synchronise-document';

export type SynchroniseCollectionMethods = {};

export type SynchroniseCollection = RxCollection<SynchroniseDocType, SynchroniseDocMethods, SynchroniseCollectionMethods>;

export const getCollectionCreator = (
    name: string,
    collectionMethods: SynchroniseCollectionMethods,
    documentMethods: SynchroniseDocMethods,
    attachments = {},
    options = {},
    migrationStrategies = {},
    autoMigrate = true,
) => ({
        name,
        schema: getSchema(),
        pouchSettings: {
            revs_limit: 0,
            auto_compaction: true,
        }, // (optional)
        statics: collectionMethods, // (optional) // ORM-functions for this collection
        methods: documentMethods, // (optional) ORM-functions for documents
        attachments, // (optional) ORM-functions for attachments
        options, // (optional) Custom paramters that might be used in plugins
        migrationStrategies, // (optional)
        autoMigrate, // (optional)
} as RxCollectionCreator);

export const synchroniseCollectionMethods: SynchroniseCollectionMethods = {};
