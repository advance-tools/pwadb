import { PwaDatabaseService } from 'pwadb-lib';
import { MyDatabase } from '../resources/schema.resource';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
    providedIn: 'root'
})
export class DatabaseService extends PwaDatabaseService<MyDatabase> {

    constructor(private httpService: HttpClient) {

        super(httpService);

    }
}
