import { Component } from '@angular/core';
import { FetchLogService } from './local/fetch-log.service';
import { Guid } from 'guid-typescript';
import { concat } from 'rxjs';


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
    const createOp = this.fetchLogService.create({id: 'testUrl', hash: Guid.create().toString()});
    const updateOp = this.fetchLogService.update({id: 'testUrl', hash: Guid.create().toString()});
    const deleteOp = this.fetchLogService.delete('testUrl');

    concat(createOp, updateOp, deleteOp).subscribe({
        next: v => console.log('emitted value', v)
    });
  }
}
