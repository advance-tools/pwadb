import { RxCollection, RxCollectionCreator } from 'rxdb';
import { getSynchroniseSchema, SynchroniseDocMethods, SynchroniseDocType } from './synchronise-document';

export type SynchroniseCollectionMethods = {};

export type SynchroniseCollection = RxCollection<SynchroniseDocType, SynchroniseDocMethods, SynchroniseCollectionMethods>;

export const getSynchroniseCollectionCreator = (
    name: string,
    collectionMethods: SynchroniseCollectionMethods,
    documentMethods: SynchroniseDocMethods,
    attachments = {},
    options = {},
    migrationStrategies = {},
    autoMigrate = true,
) => ({
        name,
        schema: getSynchroniseSchema(),
        statics: collectionMethods, // (optional) // ORM-functions for this collection
        methods: documentMethods, // (optional) ORM-functions for documents
        attachments, // (optional) ORM-functions for attachments
        options, // (optional) Custom paramters that might be used in plugins
        migrationStrategies: {
            ...migrationStrategies
        }, // (optional)
        autoMigrate, // (optional)
} as RxCollectionCreator);

export const synchroniseCollectionMethods: SynchroniseCollectionMethods = {};
