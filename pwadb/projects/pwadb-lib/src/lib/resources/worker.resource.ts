import { DoWork, ObservableWorker } from 'observable-webworker';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { WorkerInput, WorkerOutput } from '../definitions/worker';
import { queryFilter } from './filters.resource';


@ObservableWorker()
export class FilterWorker implements DoWork<WorkerInput, WorkerOutput> {

    public work(input$: Observable<WorkerInput>): Observable<WorkerOutput> {

        return input$.pipe(

            switchMap(input => input.docs$.pipe(

                map(allDocs => {

                    const results = queryFilter(input.validQueryKeys, input.params, allDocs);

                    const start = parseInt(input.params?.get('offset') || '0');

                    const end = start + parseInt(input.params?.get('limit') || '100');

                    return {
                        getCount: results.filter(v => v.method === 'GET').length,
                        postCount: results.filter(v => v.method === 'POST').length,
                        putResults: results.filter(v => v.method === 'PUT'),
                        delResults: results.filter(v => v.method === 'DELETE'),
                        results: results.slice(start, end)
                    };
                })

            )),

        );
    }
}