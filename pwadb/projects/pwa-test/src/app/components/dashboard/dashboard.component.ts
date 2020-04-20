import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Observable } from 'rxjs';
import { PwaDocument } from 'pwadb-lib';
import { Tenant, TenantApiService } from 'pwadb-api-lib';
import { Router } from '@angular/router';

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {

    profile$: Observable<PwaDocument<Tenant>>;

    constructor(private tenantService: TenantApiService, private router: Router) {

        this.profile$ = this.tenantService.retrieveReactive();
    }

    onCountryClick(profileId: string) {

        this.router.navigate(['../countries'], {queryParams: {tenantId: profileId}})
    }

    onTreeClick(profileId: string) {

        this.router.navigate(['../tree-example'], {queryParams: {tenantId: profileId}})
    }
}
