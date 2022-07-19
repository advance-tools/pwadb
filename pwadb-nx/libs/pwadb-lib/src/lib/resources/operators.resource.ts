import { NgZone } from '@angular/core';
import { Observable } from 'rxjs';


export function enterZone<T>(zone: NgZone | null) {

    return (source: Observable<T>) =>

        new Observable<T>(observer => {

            if (zone) {

                source.subscribe({
                    next: (x) => zone.run(() => observer.next(x)),
                    error: (err) => observer.error(err),
                    complete: () => observer.complete()
                })
            } else {

                source.subscribe({
                    next: (x) => observer.next(x),
                    error: (e) => observer.error(e),
                    complete: () => observer.complete(),
                });
            }

        });
}
