import { Component, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { Profile, ProfileApiService } from 'pwadb-api-lib';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Guid } from 'guid-typescript';

@Component({
    selector: 'app-tenant',
    templateUrl: './tenant.component.html',
    styleUrls: ['./tenant.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TenantComponent implements OnDestroy {

    formGroup: FormGroup

    subs: Subscription;

    constructor(private profileService: ProfileApiService) {

        this.formGroup = new FormGroup({
            name: new FormControl(null, [Validators.required]),
            email: new FormControl(null, [Validators.required])
        });

        this.subs = new Subscription();
    }

    ngOnDestroy() {

        this.subs.unsubscribe();
    }

    create() {

        const data: Profile = {
            id: Guid.create().toString(),
            name: this.formGroup.value.name,
            email: this.formGroup.value.email,
        };

        const subs = this.profileService.create(data).subscribe(() => this.formGroup.reset());

        this.subs.add(subs);

    }
}