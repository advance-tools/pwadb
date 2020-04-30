import { Component, Inject, ChangeDetectionStrategy, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Database, DatabaseService, ReactiveDatabase, PwaDocument } from 'pwadb-lib';
import {MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef} from '@angular/material/bottom-sheet';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-string-filter',
    templateUrl: './string-filter.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class StringFilterComponent implements OnDestroy {

    distinctDatabase: Database<any>;
    fieldName: string;

    filters = [
        {value: '', display: 'None'},
        {value: 'iexact', display: 'Insensitive Exact Match'},
        {value: 'exact', display: 'Sensitive Exact Match'},
        {value: 'icontains', display: 'Insensitive Substring Match'},
        {value: 'contains', display: 'Sensitive Substring Match'},
        {value: 'startswith', display: 'Startswith'},
        {value: 'endswith', display: 'Endswith'},
        {value: 'isnull', display: 'Is Null'},
        {value: 'in', display: 'Include Only'}
    ]

    filter = this.filters[0];
    value: boolean | string;
    elements: PwaDocument<any>[] = [];
    inValues: string[] = [];

    subs: Subscription;

    constructor(
        @Inject(MAT_BOTTOM_SHEET_DATA) public data: {apiService: DatabaseService<any>, database: ReactiveDatabase<any>, fieldName: string},
        private bottomSheet: MatBottomSheetRef,
        private cd: ChangeDetectorRef,
    ) {

        this.distinctDatabase = this.data.apiService.getDatabase();
        this.fieldName = this.data.fieldName;

        this.subs = new Subscription();

        this.distinctDatabase.httpParams = this.distinctDatabase.httpParams.set('distinct', this.fieldName);

        this.selectStringFilter();

        const subs = this.distinctDatabase.dataChange.subscribe(v => {

            this.elements = v;

            this.cd.markForCheck();
        });

        this.subs.add(subs);

    }

    ngOnDestroy() {

        this.subs.unsubscribe();
    }

    selectStringFilter() {

        const params = this.data.database.httpParams;

        params.keys().forEach(k => {

            if (k === `${this.fieldName}.iexact`) {

                this.filter = this.filters[1];
                this.value = params.get(k);

            } else if (k === `${this.fieldName}.exact`) {

                this.filter = this.filters[2];
                this.value = params.get(k);
            
            } else if (k === `${this.fieldName}.icontains`) {

                this.filter = this.filters[3];
                this.value = params.get(k);

            } else if (k === `${this.fieldName}.contains`) {

                this.filter = this.filters[4];
                this.value = params.get(k);

            } else if (k === `${this.fieldName}.startswith`) {

                this.filter = this.filters[5];
                this.value = params.get(k);

            } else if (k === `${this.fieldName}.endswith`) {

                this.filter = this.filters[6];
                this.value = params.get(k);

            } else if (k === `${this.fieldName}.isnull`) {

                this.filter = this.filters[7];
                this.value = params.get(k).toLowerCase() === 'true';
            
            } else if (k === `${this.fieldName}.in`) {

                this.filter = this.filters[8];
                this.inValues = params.getAll(k);

            } else {

                this.filter = this.filters[0];
                this.value = null;
            }
        });

    }

    apply() {

        let params = this.data.database.httpParams;

        params.keys().forEach(k => {

            if (k.includes(`${this.fieldName}`)) params = params.delete(k);
        });

        switch(this.filter.value) {

            case 'iexact': {

                params = params.set(`${this.fieldName}.iexact`, this.value.toString());

                break;
            }

            case 'exact': {

                params = params.set(`${this.fieldName}.exact`, this.value.toString());

                break;
            }

            case 'icontains': {

                params = params.set(`${this.fieldName}.icontains`, this.value.toString());

                break;
            }

            case 'contains': {

                params = params.set(`${this.fieldName}.contains`, this.value.toString());

                break;
            }

            case 'startswith': {

                params = params.set(`${this.fieldName}.startswith`, this.value.toString());

                break;
            }

            case 'endswith': {

                params = params.set(`${this.fieldName}.endswith`, this.value.toString());

                break;
            }

            case 'isnull': {

                params = params.set(`${this.fieldName}.isnull`, this.value ? 'True' : 'False');

                break;
            }

            case 'in': {

                this.inValues.forEach(v => params = params.append(`${this.fieldName}.in`, v));

                break;
            }

        }

        this.data.database.httpParams = params;

        this.bottomSheet.dismiss();

    }

}
