import { Component, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CountriesApiService, Country } from 'pwadb-api-lib';
import { MatTableDataSource } from '@angular/material/table';
import { Subscription } from 'rxjs';
import { PwaDocument, LOAD_MORE, TableLoadMoreDatabase } from 'pwadb-lib';
import { debounceTime } from 'rxjs/operators';

@Component({
    selector: 'app-country-list',
    templateUrl: './country-list.component.html',
    styleUrls: ['./country-list.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CountryListComponent implements OnDestroy {

    dataSource: MatTableDataSource<PwaDocument<Country> | string>;
    displayedColumns = ['position', 'name', 'phone_code', 'code', 'my_currency_name', 'iso2', 'iso3'];

    tableDatabase: TableLoadMoreDatabase<Country>;

    subs: Subscription;

    constructor(private c: CountriesApiService, private cd: ChangeDetectorRef) {

        this.subs = new Subscription();

        this.dataSource = new MatTableDataSource([]);

        this.tableDatabase = this.c.getTableLoadMoreDatabase();

        const subs = this.tableDatabase.dataChange.subscribe(v => {

            this.dataSource.data = v;

            this.cd.markForCheck();
        });

        this.subs.add(subs);

        this.tableDatabase.initialise();
    }

    ngOnDestroy() {

        this.subs.unsubscribe();
    }

    isLoadMore = (index: number, element: PwaDocument<Country> | string) => element === LOAD_MORE;
    isObject = (index: number, element: PwaDocument<Country> | string) => element !== LOAD_MORE;
}
