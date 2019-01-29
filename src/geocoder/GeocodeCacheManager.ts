import powerbi from "powerbi-visuals-api";
import IPromise = powerbi.IPromise;

import { IGeocodingCache, createGeocodingCache } from "./geocodingCache";
import { IGeocodeCoordinate, ILocationCoordinateRecord, ILocationDictionary } from "./geocoderInterfaces";
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

    export function saveToStorage(locationItems: ILocationCoordinateRecord[]): IPromise<{}> {
        let deferred = $.Deferred();
        const cacheInstance: IGeocodingCache = ensureCache();
        if (!locationItems || !locationItems.length) {
            return deferred.reject();
        }

        return cacheInstance.saveToStorage(locationItems);
    }

    export function getCoordinatesFromStorage(keys?: string[]): IPromise<{}> {
        let deferred = $.Deferred();
        const cacheInstance: IGeocodingCache = ensureCache();

        return cacheInstance.getCoordinatesFromStorage(keys);
    }

    export function reset(cache: IGeocodingCache) {
        geocodingCache = cache;
    }
}