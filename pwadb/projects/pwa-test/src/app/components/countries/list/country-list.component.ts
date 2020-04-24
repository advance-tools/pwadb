import { Component, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CountriesApiService, Country } from 'pwadb-api-lib';
import { MatTableDataSource } from '@angular/material/table';
import { Subscription } from 'rxjs';
import { PwaDocument, ReactiveDatabase } from 'pwadb-lib';
import { Sort } from '@angular/material/sort';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { StringFilterComponent } from './string-filter.component';
import { NumericFilter } from './numeric-filter.component';

@Component({
    selector: 'app-country-list',
    templateUrl: './country-list.component.html',
    styleUrls: ['./country-list.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CountryListComponent implements OnDestroy {

    dataSource: MatTableDataSource<PwaDocument<Country> | string>;
    displayedColumns = ['position', 'name', 'phone_code', 'code', 'my_currency__name', 'iso2', 'iso3', 'created_at', 'updated_at'];

    tableDatabase: ReactiveDatabase<Country>;

    subs: Subscription;

    constructor(private c: CountriesApiService, private _bottomSheet: MatBottomSheet) {

        this.subs = new Subscription();

        this.dataSource = new MatTableDataSource([]);

        this.tableDatabase = this.c.getReactiveDatabase();

        const subs = this.tableDatabase.dataChange.subscribe(v => this.dataSource.data = v);

        this.subs.add(subs);

        this.tableDatabase.initialise();
    }

    ngOnDestroy() {

        this.tableDatabase.stop();
        
        this.subs.unsubscribe();
    }

    isLoadMore = (index: number) => index === this.tableDatabase.data.length - 1 && this.tableDatabase.isLoadable;

    sortChange(sort: Sort) {

        const httpParams = this.tableDatabase.httpParams.delete('order_by');

        if (!sort.active || sort.direction === '') {
         
            this.tableDatabase.httpParams = httpParams;
            
            return;
        }

        const order = sort.direction === 'desc' ? '-' : '';

        this.tableDatabase.httpParams = httpParams.set('order_by', `${order}${sort.active}`);

    }

    openStringBottomSheet(fieldName: string) {

        this._bottomSheet.open(StringFilterComponent, {data: { apiService: this.c, fieldName, database: this.tableDatabase }})
    }

    openNumericBottomSheet(fieldName: string, fieldType: 'number' | 'date') {

        this._bottomSheet.open(NumericFilter, {data: { database: this.tableDatabase, fieldName, fieldType }})
    }

}
