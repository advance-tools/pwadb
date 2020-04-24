import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Observable } from 'rxjs';
import { PwaDocument } from 'pwadb-lib';
import { Profile, ProfileApiService } from 'pwadb-api-lib';

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {

    profile$: Observable<PwaDocument<Profile>>;

    constructor(private profileService: ProfileApiService) {

        this.profile$ = this.profileService.retrieve();
    }

}
