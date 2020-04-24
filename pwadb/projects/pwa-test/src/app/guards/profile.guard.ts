import { CanActivate, Router } from '@angular/router';
import { ProfileApiService } from 'pwadb-api-lib';
import { Injectable } from '@angular/core';

@Injectable()
export class CanActivateRouteGuard implements CanActivate {

    constructor(private profileService: ProfileApiService, private router: Router) {}

    canActivate() {

        if (!this.profileService.id) this.router.navigate(['/']);

        return !!this.profileService.id;
    }
}
