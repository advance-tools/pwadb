import { Observable } from 'rxjs';
import { PwaDocument } from './document';
import { HttpParams } from '@angular/common/http';

export interface WorkerInput {
    docs$: Observable<PwaDocument<any>[]>;
    params?: HttpParams;
    validQueryKeys: string[];
}

export interface WorkerOutput {
    getCount: number;
    postCount: number;
    putResults: PwaDocument<any>[];
    delResults: PwaDocument<any>[];
    results: PwaDocument<any>[];
}