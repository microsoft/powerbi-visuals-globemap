import { IGeocodingCache, createGeocodingCache } from "./geocodingCache";
import { IGeocodeBoundaryCoordinate, IGeocodeCoordinate, ILocationCoordinateRecord } from "./geocoderInterfaces";
import { Settings } from "./geocoder";

export namespace GeocodeCacheManager {
    let geocodingCache: IGeocodingCache;

    function ensureCache(): IGeocodingCache {
        if (!geocodingCache) {
            geocodingCache = createGeocodingCache(Settings.MaxCacheSize, Settings.MaxCacheSizeOverflow);
        }

        return geocodingCache;
    }

    export function getCoordinates(key: string): JQueryDeferred<IGeocodeCoordinate> {
        let deferred: JQueryDeferred<IGeocodeCoordinate> = $.Deferred();
        if (key) {
            ensureCache().getCoordinates(key)
                .then((data: IGeocodeCoordinate) => deferred.resolve(data))
                .fail(() => deferred.reject());

            return deferred;
        }
    }

    export function registerCoordinates(key: string, coordinates: IGeocodeCoordinate | IGeocodeBoundaryCoordinate): void {
        if (key) {
            return ensureCache().registerCoordinates(key, coordinates);
        }
    }

    export function getCoordinatesFromMemory(keys: string[]): ILocationCoordinateRecord[] {
        if (!keys || !keys.length)
            return undefined;

        const cacheInstance: IGeocodingCache = ensureCache();
        let locationCoordinates: ILocationCoordinateRecord[] = [];
        keys.forEach((key: string) => {
            const coordinatesFromCache: IGeocodeCoordinate = cacheInstance.getCoordinatesFromMemory(key);
            if (coordinatesFromCache) {
                locationCoordinates.push({
                    key,
                    coordinate: coordinatesFromCache
                });
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
                    cacheInstance.registerInMemory(locationItem);
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

    export function getCoordinatesFromStorage(keys: string[]): IPromise<{}> {
        let deferred = $.Deferred();
        const cacheInstance: IGeocodingCache = ensureCache();
        if (!keys || !keys.length) {
            return deferred.reject();
        }

        return cacheInstance.getCoordinatesFromStorage(keys);
    }

    export function reset(cache: IGeocodingCache) {
        geocodingCache = cache;
    }
}