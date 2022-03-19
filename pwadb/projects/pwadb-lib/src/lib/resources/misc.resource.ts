
export function flatten<T>(arr: T[], result = []): any[] {

    for (let i = 0, length = arr.length; i < length; i++) {

        const value = arr[i];

        if (Array.isArray(value)) {

            flatten(value, result);

        } else {

            result.push(value);
        }
    }

    return result;
}
