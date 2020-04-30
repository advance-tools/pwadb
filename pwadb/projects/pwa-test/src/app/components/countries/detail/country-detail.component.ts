import { Component, OnDestroy, ChangeDetectionStrategy} from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { PwaDocument, Database } from 'pwadb-lib';
import { Country, Currency, CountriesApiService, CurrencyApiService } from 'pwadb-api-lib';
import { Observable, Subscription, BehaviorSubject, combineLatest, of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { switchMap, map, filter, tap, debounceTime, share } from 'rxjs/operators';
import { Location } from '@angular/common';
import { Guid } from 'guid-typescript';

@Component({
    selector: 'app-country-detail',
    templateUrl: './country-detail.component.html',
    styleUrls: ['./country-detail.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CountryDetailComponent implements OnDestroy {

    formGroup: FormGroup;
    id: Observable<string>;
    document: Observable<PwaDocument<Country>>;
    loading: BehaviorSubject<boolean>;

    crDatabase: Database<Currency>;

    subs: Subscription;

    constructor(
        private c: CountriesApiService,
        private cr: CurrencyApiService,
        private route: ActivatedRoute,
        private l: Location
    ) {

        this.formGroup = new FormGroup({
            name            : new FormControl(),
            phone_code      : new FormControl(),
            code            : new FormControl(),
            iso2            : new FormControl(),
            iso3            : new FormControl(),
            my_currency     : new FormControl(),
        });

        this.subs = new Subscription();

        this.loading = new BehaviorSubject(true);

        this.id = this.route.paramMap.pipe(

            map(params => params.get('id')),
        );

        this.document = this.id.pipe(

            tap(id => { if (!id) this.loading.next(false); }),

            filter(id => !!id),

            switchMap(id => this.c.retrieveReactive(id)),

            share(),
        );

        this.crDatabase = this.cr.getDatabase();

        /////////////////
        // Subscriptions
        /////////////////

        const subs1 = this.formGroup.get('my_currency').valueChanges.pipe(

            debounceTime(300),

        ).subscribe((v: PwaDocument<Currency> | string) => {

            if (v && typeof v === 'object') this.crDatabase.httpParams = this.crDatabase.httpParams.set('name.icontains', v.data.name);

            if (v && typeof v === 'string') this.crDatabase.httpParams = this.crDatabase.httpParams.set('name.icontains', v);

            if (v === '') {

                let params = this.crDatabase.httpParams;
    
                if (params.has('name:icontains')) params = params.delete('name:icontains');
    
                this.crDatabase.httpParams = params;
            }

        });

        this.subs.add(subs1);

        const subs2 = this.document.pipe(

            switchMap(doc => combineLatest([of(doc), !!doc?.data.my_currency_id ? this.cr.retrieve(doc.data.my_currency_id) : of(null)])),

        ).subscribe(([country, currency]) => {

            this.formGroup.setValue({
                name                : country?.data.name,
                phone_code          : country?.data.phone_code,
                code                : country?.data.code,
                iso2                : country?.data.iso2,
                iso3                : country?.data.iso3,
                my_currency         : currency,
            });
 
            this.loading.next(false);
        });

        this.subs.add(subs2);
    }

    ngOnDestroy() {

        this.subs.unsubscribe();
    }

    displayFunc(doc: PwaDocument<Currency>): string {

        return doc?.data.name;
    }

    //////////////////////
    // actions
    //////////////////////

    back() {

        this.l.back();
    }

    delete(id: string) {

        this.subs.add(this.c.delete(id).subscribe(v => this.back()));
    }

    update(doc: PwaDocument<Country>) {

        const data: Country = {
            id                  : doc.data.id,
            name                : this.formGroup.value.name,
            code                : this.formGroup.value.code,
            phone_code          : this.formGroup.value.phone_code,
            iso2                : this.formGroup.value.iso2,
            iso3                : this.formGroup.value.iso3, 
            my_currency_id      : this.formGroup.value.my_currency?.data.id,
            my_currency__name   : this.formGroup.value.my_currency?.data.name,
            created_at          : doc.data.created_at,
            updated_at          : doc.data.updated_at,
        };

        this.subs.add(this.c.update(data).subscribe());
    }

    create() {

        const data: Country = {
            id                  : Guid.create().toString(),
            name                : this.formGroup.value.name,
            code                : this.formGroup.value.code,
            phone_code          : this.formGroup.value.phone_code,
            iso2                : this.formGroup.value.iso2,
            iso3                : this.formGroup.value.iso3, 
            my_currency_id      : this.formGroup.value.my_currency?.data.id,
            my_currency__name   : this.formGroup.value.my_currency?.data.name,
            created_at          : new Date().toUTCString(),
            updated_at          : new Date().toUTCString(),
        };

        this.subs.add(this.c.create(data).subscribe());
    }
}