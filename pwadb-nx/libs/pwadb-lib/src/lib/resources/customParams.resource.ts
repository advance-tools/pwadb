import { HttpParameterCodec, HttpParams, HttpParamsOptions } from "@angular/common/http";

export class CustomEncoder implements HttpParameterCodec {
    encodeKey(key: string): string {
        return encodeURIComponent(key);
    }

    encodeValue(value: string): string {
        return encodeURIComponent(value);
    }

    decodeKey(key: string): string {
        return decodeURIComponent(key);
    }

    decodeValue(value: string): string {
        return decodeURIComponent(value);
    }
}

export class CustomHttpParams extends HttpParams {

    constructor(options?: HttpParamsOptions) {

        options = {...(options || {}), encoder: new CustomEncoder()};

        super(options)
    }
}
