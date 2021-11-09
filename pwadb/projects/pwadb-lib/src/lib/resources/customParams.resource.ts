import { HttpParameterCodec, HttpParams, HttpParamsOptions } from "@angular/common/http";

export class CustomEncoder implements HttpParameterCodec {
    encodeKey(key: string): string {
        return key; // encodeURIComponent(key);
    }

    encodeValue(value: string): string {
        return value; // encodeURIComponent(value);
    }

    decodeKey(key: string): string {
        return key; // decodeURIComponent(key);
    }

    decodeValue(value: string): string {
        return value; // decodeURIComponent(value);
    }
}

export class CustomHttpParams extends HttpParams {

    constructor(options?: HttpParamsOptions) {

        options = {...(options || {}), encoder: new CustomEncoder()};

        super(options)
    }
}
