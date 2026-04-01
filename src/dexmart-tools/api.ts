import axios from 'axios';
import FormData from 'form-data';
import * as FileType from 'file-type';

export interface APIConfig {
    baseURL: string;
    apikey?: string;
}

export const APIs: Record<string, APIConfig> = {
    izumi: {
        baseURL: 'https://izumi-api.herokuapp.com', 
        apikey: 'free'
    },
    // Add other APIs as referenced in the code
    zell: { baseURL: 'https://api.zell.com', apikey: 'free' },
    neko: { baseURL: 'https://api.neko.com', apikey: 'free' },
    diibot: { baseURL: 'https://api.diibot.com', apikey: 'free' },
    davidcyril: { baseURL: 'https://api.davidcyril.com', apikey: 'free' },
    siputzx: { baseURL: 'https://api.siputzx.com', apikey: 'free' },
    hang: { baseURL: 'https://api.hang.com', apikey: 'free' },
    zenzxz: { baseURL: 'https://api.zenzxz.com', apikey: 'free' },
};

/**
 * Creates a URL for an API call with optional parameters and apikey.
 * @param name API name from APIs list
 * @param path Endpoint path
 * @param params Query parameters
 * @returns Fully qualified URL string
 */
export const createUrl = (name: string, path: string, params: Record<string, string | number | boolean | undefined | null> = {}): string => {
    // Handle full URLs passed as name (legacy/direct usage)
    if (name.startsWith('http')) {
        const url = new URL(name + (path.startsWith('/') ? path : '/' + path));
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, String(value));
            }
        }
        return url.toString();
    }

    const api = APIs[name];
    if (!api) {
        // Fallback for unknown APIs, try to construct if it looks like a domain or throw
        throw new Error(`API ${name} not found`);
    }

    // Handle path starting with / or not
    const basePath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(api.baseURL + basePath);

    if (api.apikey) {
        url.searchParams.append('apikey', api.apikey);
    }

    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value));
        }
    }

    return url.toString();
};

export const listUrl = (): Record<string, APIConfig> => APIs;

export const uploadImage = async (buffer: Buffer): Promise<string> => {
    try {
        const type = await FileType.fromBuffer(buffer);
        const form = new FormData();
        form.append('file', buffer, {
            filename: `file.${type?.ext || 'jpg'}`,
            contentType: type?.mime || 'image/jpeg',
        });

        const response = await axios.post('https://telegra.ph/upload', form, {
            headers: form.getHeaders(),
        });

        if (response.data && response.data[0] && response.data[0].src) {
            return 'https://telegra.ph' + response.data[0].src;
        }
        
        throw new Error('Telegraph upload failed: Invalid response');
    } catch (error: any) {
        throw new Error(`Failed to upload image: ${error.message}`);
    }
};

export const uploadFile = async (buffer: Buffer, filename: string): Promise<string> => {
    try {
        const type = await FileType.fromBuffer(buffer);
        const form = new FormData();
        form.append('file', buffer, {
            filename: filename || `file.${type?.ext || 'bin'}`,
            contentType: type?.mime || 'application/octet-stream',
        });

        const response = await axios.post('https://telegra.ph/upload', form, {
            headers: form.getHeaders(),
        });

        if (response.data && response.data[0] && response.data[0].src) {
            return 'https://telegra.ph' + response.data[0].src;
        }
        
        throw new Error('Telegraph upload failed: Invalid response');
    } catch (error: any) {
        throw new Error(`Failed to upload file: ${error.message}`);
    }
};

export default {
    createUrl,
    listUrl,
    uploadImage,
    uploadFile,
    APIs
};