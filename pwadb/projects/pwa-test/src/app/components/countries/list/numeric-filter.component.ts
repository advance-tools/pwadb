import { Component, Inject, Injectable } from '@angular/core';
import { Database } from 'pwadb-lib';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { NativeDateAdapter, DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { formatDate } from '@angular/common';

export const PICK_FORMATS = {
    parse: {dateInput: {month: 'short', year: 'numeric', day: 'numeric'}},
    display: {
        dateInput: 'input',
        monthYearLabel: {year: 'numeric', month: 'short'},
        dateA11yLabel: {year: 'numeric', month: 'long', day: 'numeric'},
        monthYearA11yLabel: {year: 'numeric', month: 'long'}
    }
};

@Injectable()
export class PickDateAdapter extends NativeDateAdapter {
    format(date: Date, displayFormat: Object): string {
        if (displayFormat === 'input') {
            return formatDate(date,'dd-MMM-yyyy',this.locale);;
        } else {
            return date.toDateString();
        }
    }
}

@Component({
    selector: 'app-numeric-filter',
    templateUrl: './numeric-filter.component.html',
    providers: [
        {provide: DateAdapter, useClass: PickDateAdapter},
        {provide: MAT_DATE_FORMATS, useValue: PICK_FORMATS}
    ]
})
export class NumericFilter {

    filters = [
        {value: '', display: 'None'},
        {value: '==', display: 'Equals To'},
        {value: '>=', display: 'Greater Than Equals To'},
        {value: '<=', display: 'Lesser Than Equals To'},
        {value: '>', display: 'Greater Than'},
        {value: '<', display: 'Lesser Than'},
        {value: '-', display: 'Range'},
    ]

    filter = this.filters[0];

    value1: number | Date;
    value2: number | Date;

    constructor(@Inject(MAT_BOTTOM_SHEET_DATA) public data: {database: Database<any>, fieldName: string, fieldType: 'number' | 'date'}, private bottomSheet: MatBottomSheetRef) {

        const params = this.data.database.httpParams;

        const fieldName = this.data.fieldName;

        const fieldType = this.data.fieldType;

        let v = params.get(`filter:${fieldName}`);

        if (v) {

            this.filter = this.filters[1];

            this.value2 = fieldType === 'date' ? new Date(v) : parseFloat(v);

            return;
        }

        v = params.get(`filter:${fieldName}.gte`)

        if (v) {

            this.filter = this.filters[2];

            this.value2 = fieldType === 'date' ? new Date(v) : parseFloat(v);

            return;
        }

        v = params.get(`filter:${fieldName}.lte`);

        if (v) {

            this.filter = this.filters[3];
            
            this.value2 = fieldType === 'date' ? new Date(v) : parseFloat(v);

            return;
        }

        v = params.get(`filter:${fieldName}.gt`);

        if (v) {

            this.filter = this.filters[4];

            this.value2 = fieldType === 'date' ? new Date(v) : parseFloat(v);

            return;
        }

        v = params.get(`filter:${fieldName}.lt`);

        if (v) {

            this.filter = this.filters[5];

            this.value2 = fieldType === 'date' ? new Date(v) : parseFloat(v);

            return;
        }

        v = params.get(`filter:${fieldName}.range`);

        if (v) {

            this.filter = this.filters[6];

            this.value1 = fieldType === 'date' ? new Date(params.getAll(`filter:${fieldName}.range`)[0]) : parseFloat(params.getAll(`filter:${fieldName}.range`)[0]);

            this.value2 = fieldType === 'date' ? new Date(params.getAll(`filter:${fieldName}.range`)[1]) : parseFloat(params.getAll(`filter:${fieldName}.range`)[1]);

            return;
        }

        if (!params.keys().find(v => v.includes(`filter:${fieldName}`))) {

            this.filter = this.filters[0];

            this.value1 = null;
            this.value2 = null;
        }
    }

    apply() {

        let params = this.data.database.httpParams;

        const fieldName = this.data.fieldName;

        params.keys().forEach(k => {

            if (k.includes(`filter:${fieldName}`)) params = params.delete(k);
        });

        if (this.filter.value === '==') params = params.set(`filter:${fieldName}`, typeof this.value2 === 'object' ? this.value2.toDateString() : this.value2.toString());

        if (this.filter.value === '>=') params = params.set(`filter:${fieldName}.gte`, typeof this.value2 === 'object' ? this.value2.toDateString() : this.value2.toString());

        if (this.filter.value === '<=') params = params.set(`filter:${fieldName}.lte`, typeof this.value2 === 'object' ? this.value2.toDateString() : this.value2.toString());

        if (this.filter.value === '>') params = params.set(`filter:${fieldName}.gt`, typeof this.value2 === 'object' ? this.value2.toDateString() : this.value2.toString());

        if (this.filter.value === '<') params = params.set(`filter:${fieldName}.lt`, typeof this.value2 === 'object' ? this.value2.toDateString() : this.value2.toString());

        if (this.filter.value === '-') params = params.set(`filter:${fieldName}.range`, typeof this.value1 === 'object' ? this.value1.toDateString() : this.value1.toString()).append(`filter:${fieldName}.range`, typeof this.value2 === 'object' ? this.value2.toDateString() : this.value2.toString());

        this.data.database.httpParams = params;

        this.bottomSheet.dismiss();
    }
}
