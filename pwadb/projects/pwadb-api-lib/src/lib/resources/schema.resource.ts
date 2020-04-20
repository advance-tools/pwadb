import { PwaCollection } from 'pwadb-lib';

////////////////////
// Apis
////////////////////

export const hostURL = 'http://localhost:8000/api';

////////////////////
// Database
////////////////////
export interface MyDatabase {
    countries: PwaCollection<Country>,
    tenants: PwaCollection<Tenant>,
}

////////////////////
// Collections
////////////////////

export enum Collections {
    country = 'countries',
    tenant = 'tenants',
}

////////////////////
// Doctypes
////////////////////

export interface Tenant {
    id: string;
    name: string;
    email: string;
}

export interface Country {
    id: string,
    iso3: string,
    iso2: string,
    phone_code: number,
    name: string,
    code: string,
    my_currency_id: string,
    my_currency__name: string,
    created_at: string,
    updated_at: string
}