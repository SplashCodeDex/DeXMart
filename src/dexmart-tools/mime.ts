import mime from 'mime-types';

export const lookup = (filenameOrExt: string) => mime.lookup(filenameOrExt);
export const contentType = (filenameOrExt: string) => mime.contentType(filenameOrExt);
export const extension = (type: string) => mime.extension(type);

export default {
    lookup,
    contentType,
    extension
};
