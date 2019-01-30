import powerbi from "powerbi-visuals-api";

import { IGeocodingCache, createGeocodingCache } from "./geocodingCache";
import { IGeocodeCoordinate, ILocationCoordinateRecord, ILocationDictionary } from "./interfaces/geocoderInterfaces";
import { Settings } from "./geocoder";

export namespace GeocodeCacheManager {
    let geocodingCache: IGeocodingCache;

    function ensureCache(): IGeocodingCache {
        if (!geocodingCache) {
            geocodingCache = createGeocodingCache(Settings.MaxCacheSize, Settings.MaxCacheSizeOverflow);
        }

        return geocodingCache;
    }

    export function getCoordinatesFromMemory(keys?: string[]): ILocationDictionary {
        const cacheInstance: IGeocodingCache = ensureCache();
        if (!keys || !keys.length) {
            return cacheInstance.getAllCoordinatesFromMemory();
        }

        let locationCoordinates: ILocationDictionary = {};
        keys.forEach((key: string) => {
            const coordinatesFromCache: IGeocodeCoordinate = cacheInstance.getCoordinateFromMemory(key);
            if (coordinatesFromCache) {
                locationCoordinates[key] = coordinatesFromCache;
            }
        });

        return locationCoordinates;
    }

    export function saveToMemory(locationItems: ILocationCoordinateRecord[]): void {
        if (!locationItems || !locationItems.length) {
            return;
        }

        const cacheInstance: IGeocodingCache = ensureCache();
        locationItems.forEach((locationItem: ILocationCoordinateRecord) => {
            const key: string = locationItem.key;
            if (key) {
                const coordinatesFromCache: IGeocodeCoordinate = cacheInstance.getCoordinateFromMemory(key);
                if (!coordinatesFromCache) {
                    cacheInstance.saveToMemory(locationItem);
                }
            }
        });
    }

    export async function saveToStorage(locationItems: ILocationCoordinateRecord[]): Promise<string> {
        const cacheInstance: IGeocodingCache = ensureCache();

        return new Promise<string>((resolve, reject) => {
            if (!locationItems || !locationItems.length) {
                reject();
            }
            cacheInstance.saveToStorage(locationItems)
                .then((result) => {
                    resolve(result);
                })
                .catch(() => {
                    reject();
                });
        });
    }

    export async function getCoordinatesFromStorage(keys?: string[]): Promise<ILocationDictionary> {
        const cacheInstance: IGeocodingCache = ensureCache();
        return new Promise<ILocationDictionary>((resolve, reject) => {
            cacheInstance.getCoordinatesFromStorage(keys)
                .then((coordinates) => {
                    resolve(coordinates);
                })
                .catch(() => {
                    reject();
                });
        });
    }

    export function reset(cache: IGeocodingCache) {
        geocodingCache = cache;
    }
}