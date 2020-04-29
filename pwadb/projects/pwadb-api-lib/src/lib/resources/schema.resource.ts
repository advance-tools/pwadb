import { PwaCollection } from 'pwadb-lib';

////////////////////
// Apis
////////////////////

export const hostURL = 'http://localhost:8000/api';

////////////////////
// Database
////////////////////
export interface MyDatabase {
    cities: PwaCollection<City>,
    states: PwaCollection<State>,
    currencies: PwaCollection<Currency>,
    countries: PwaCollection<Country>,
    tenants: PwaCollection<Profile>,
}

////////////////////
// Collections
////////////////////

export enum Collections {
    cities = 'cities',
    states = 'states',
    currency = 'currencies',
    country = 'countries',
    tenant = 'tenants',
}

////////////////////
// Doctypes
////////////////////

export interface Profile {
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

export interface Currency {
    id: string;
    name: string;
    symbol: string;
    decimal_places: number;
    code: string;
    created_at: string;
    updated_at: string;
}

export interface State {
    id: string;
    name: string;
    gst_code: string;
    my_country_id: string;
    my_country__name: string;
    my_country__code: string;
    my_country__my_currency_id: string;
    my_country__my_currency__name: string;
    created_at: string;
    updated_at: string;
}

export interface City {
    id: string;
    name: string;
    my_state_id: string;
    my_state__name: string;
    my_state__gst_code: string;
    my_state__my_country_id: string;
    my_state__my_country__name: string;
    my_state__my_country__code: string;
    my_state__my_country__my_currency_id: string;
    my_state__my_country__my_currency__name: string;
    created_at: string;
    updated_at: string;
}