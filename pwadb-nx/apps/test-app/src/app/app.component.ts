import { Component } from '@angular/core';
import { FetchLogService } from './local/fetch-log.service';
import { Guid } from 'guid-typescript';


@Component({
  selector: 'pwadb-nx-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'test-app';

  constructor(private fetchLogService: FetchLogService) {

    // test console
    console.log('Testing CollectionAPI service');

    // hit the create
    this.fetchLogService.create({id: 'testUrl', hash: Guid.create().toString()}).subscribe({
        next: v => console.log('emitted value', v)
    });
  }
}
