import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { map } from 'rxjs/operators';
import { Profile, ProfileApiService } from 'pwadb-api-lib';
import { Observable } from 'rxjs';
import { PwaDocument } from 'pwadb-lib';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {

  profiles: Observable<PwaDocument<Profile>[]>
  
  constructor(
    private matIconRegistery: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private profileService: ProfileApiService,
    private router: Router
  ) {

    this.matIconRegistery.addSvgIconSet(this.domSanitizer.bypassSecurityTrustResourceUrl('./assets/mdi.svg'));

    this.profiles = this.profileService.fetch().pipe(

      map(res => res.results)
    );

  }

  navigate(profileId: string) {

    this.profileService.id = profileId;

    this.router.navigate(['dashboard']);
  }
}
