
export function flatten<T>(arr: T[], result: any[] = []): any[] {

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


export function createFormData(object: Record<string, any>, form?: FormData, namespace?: string): FormData {

    let formData = form || new FormData();

    for (let propertyName in object) {

        const formKey = namespace ? `${namespace}.${propertyName}` : propertyName;

        if (object[propertyName] instanceof Date) {

            formData.append(formKey, object[propertyName].toISOString());

        } else if (object[propertyName] instanceof Array) {

            if (object[propertyName].length === 0){

                const tempFormKey = `${formKey}-${0}`;

                formData.append(tempFormKey, '');

            } else {

                object[propertyName].forEach((element: any, index: number) => {

                    const tempFormKey = `${formKey}-${index}`;

                    if (typeof element === 'object') {

                        createFormData(element, formData, tempFormKey);

                    } else {

                        formData.append(tempFormKey, element.toString());
                    }

                });
            }



        } else if (typeof object[propertyName] === 'object' && !(object[propertyName] instanceof File) && object[propertyName] !== null && object[propertyName] !== undefined) {

            createFormData(object[propertyName], formData, formKey);

        } else if (typeof object[propertyName] === 'object' && (object[propertyName] instanceof File) && object[propertyName] !== null && object[propertyName] !== undefined) {

            formData.append(formKey, object[propertyName]);

        } else {

            formData.append(formKey, object[propertyName] === null || object[propertyName] === undefined ? '' : object[propertyName].toString());
        }
    }

    return formData;
}

// export function createFormData(object: Object, form?: FormData, namespace?: string): FormData {

//     let formData = form || new FormData();

//     for (let propertyName in object) {

//         const formKey = namespace ? `${namespace}.${propertyName}` : propertyName;

//         if (object[propertyName] instanceof Date) {

//             formData.append(formKey, object[propertyName].toISOString());

//         } else if (object[propertyName] instanceof Array) {

//             object[propertyName].forEach((element: any, index: number) => {

//                 const tempFormKey = `${formKey}-${index}`;

//                 if (typeof element === 'object') {

//                     createFormData(element, formData, tempFormKey);

//                 } else {

//                     formData.append(tempFormKey, element.toString());
//                 }

//             });

//         } else if (typeof object[propertyName] === 'object' && !(object[propertyName] instanceof File) && object[propertyName] !== null && object[propertyName] !== undefined) {

//             createFormData(object[propertyName], formData, formKey);

//         } else {

//             formData.append(formKey, object[propertyName] === null || object[propertyName] === undefined ? '' : object[propertyName].toString());
//         }
//     }

//     return formData;
// }
