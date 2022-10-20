import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { auditTime, distinctUntilChanged, map } from 'rxjs/operators';
import { enterZone } from './operators.resource';

@Injectable({
    providedIn: 'platform'
})
export class ApiProgressService {

    isProgressing$: Observable<boolean>;
    private progress: BehaviorSubject<boolean[]>;

    constructor(private zone: NgZone) {

        this.progress = new BehaviorSubject<boolean[]>([]);

        this.isProgressing$ = this.progress.asObservable().pipe(

            map(v => !!v.length),

            distinctUntilChanged(),

            auditTime(1000 / 60),

            enterZone(zone)
        );
    }

    add(): void {

        const newProgress: boolean[] =  this.progress.value;

        newProgress.push(true);

        this.progress.next(newProgress);
    }

    remove(): void {

        if (this.isProgressing()) {

            const newProgress: boolean[] =  this.progress.value;

            newProgress.pop();

            this.progress.next(newProgress);
        }
    }

    isProgressing(): boolean {

        return !!this.progress.value.length;
    }
}
