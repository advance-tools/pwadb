import { Injectable } from '@angular/core';
import { PwaDatabaseService } from '@advance-tools/pwadb-lib';
import { CRMAuthDatabase } from '../resources/collection.resource';

@Injectable({
    providedIn: 'root',
})
export class DatabaseService extends PwaDatabaseService<CRMAuthDatabase> {

    constructor() {

        super({dbCreator: {name: 'testApp/services/authdb', ignoreDuplicate: true}});
    }
}
