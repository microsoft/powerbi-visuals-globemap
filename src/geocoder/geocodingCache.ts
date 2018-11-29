/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

import ILocalVisualStorageService = powerbi.extensibility.visual.ILocalVisualStorageService;

module powerbi.extensibility.geocoder {
    interface GeocodeCacheEntry {
        coordinate: IGeocodeCoordinate;
        hitCount: number;
    }

    export interface IGeocodingCache {
        getCoordinates(key: string): IGeocodeCoordinate;
        registerCoordinates(key: string, coordinate: IGeocodeCoordinate): void;
        registerCoordinates(key: string, coordinate: IGeocodeBoundaryCoordinate): void;
    }

    export function createGeocodingCache(maxCacheSize: number, maxCacheSizeOverflow: number): IGeocodingCache {
        return new GeocodingCache(maxCacheSize, maxCacheSizeOverflow, this.localStorageService);
    }

    class GeocodingCache implements IGeocodingCache {
        private geocodeCache: _.Dictionary<GeocodeCacheEntry>;
        private geocodeCacheCount: number;
        private maxCacheSize: number;
        private maxCacheSizeOverflow: number;
        private localStorageService: ILocalVisualStorageService;

        private static TILE_LOCATIONS = "GLOBEMAP_TILE_LOCATIONS";

        constructor(maxCacheSize: number, maxCacheSizeOverflow: number, localStorageService: ILocalVisualStorageService) {
            this.geocodeCache = {};
            this.geocodeCacheCount = 0;
            this.maxCacheSize = maxCacheSize;
            this.maxCacheSizeOverflow = maxCacheSizeOverflow;
            this.localStorageService = localStorageService;
        }

        private minimizeKey(key: string): string {
            return key.split(";").pop().slice(0, -1);
        }

        /**
        * Retrieves the coordinate for the key from the cache, returning undefined on a cache miss.
        */
        public getCoordinates(key: string): IGeocodeCoordinate {
            // Check in-memory cache
            let pair: GeocodeCacheEntry = this.geocodeCache[key];
            if (pair) {
                ++pair.hitCount;
                return pair.coordinate;
            }
            // Check local storage cache
            const minimizesKey: string = this.minimizeKey(key);
            const localStoragePromise: IPromise<string> = this.localStorageService.get(GeocodingCache.TILE_LOCATIONS);
            localStoragePromise.then((value) => {
                const parsedValue = JSON.parse(value);
                if (!parsedValue)
                    return undefined;

                if (parsedValue[minimizesKey]) {
                    const location = parsedValue[minimizesKey];
                    pair = {
                        coordinate: {
                            latitude: location.lat,
                            longitude: location.long
                        }
                    } as GeocodeCacheEntry;
                    this.registerInMemory(key, pair.coordinate);
                    return pair.coordinate;
                }

                return undefined;
            })
                .catch(() => {
                    return undefined;
                });
        }
        /**
        * Registers the query and coordinate to the cache.
        */
        public registerCoordinates(key: string, coordinate: IGeocodeCoordinate): void {
            this.registerInMemory(key, coordinate);
            this.registerInStorage(key, coordinate);
        }

        private registerInMemory(key: string, coordinate: IGeocodeCoordinate): void {
            let geocodeCache: _.Dictionary<GeocodeCacheEntry> = this.geocodeCache;
            let maxCacheSize: number = this.maxCacheSize;
            let maxCacheCount: number = maxCacheSize + this.maxCacheSizeOverflow;

            // are we about to exceed the maximum?
            if (this.geocodeCacheCount >= maxCacheCount) {
                let keys: string[] = Object.keys(geocodeCache);
                let cacheSize: number = keys.length;

                // sort keys in *descending* hitCount order
                keys.sort((a: string, b: string) => {
                    let cachedA: GeocodeCacheEntry = geocodeCache[a];
                    let cachedB: GeocodeCacheEntry = geocodeCache[b];
                    let ca: number = cachedA ? cachedA.hitCount : 0;
                    let cb: number = cachedB ? cachedB.hitCount : 0;
                    return ca < cb ? 1 : (ca > cb ? -1 : 0);
                });

                // whack ones with the lower hitCounts.
                // - while # whacked keys is small, do a quick wipe
                // - after awhile we get lots of keys whose cached value is undefined.
                //   when there are "too many," make a whole new memory cache.
                if (cacheSize < 2 * maxCacheCount) {
                    for (let i = maxCacheSize; i < cacheSize; i++) {
                        geocodeCache[keys[i]] = undefined;
                    }
                }
                else {
                    let newGeocodeCache: _.Dictionary<GeocodeCacheEntry> = {};
                    for (let i = 0; i < maxCacheSize; ++i) {
                        newGeocodeCache[keys[i]] = geocodeCache[keys[i]];
                    }

                    geocodeCache = this.geocodeCache = newGeocodeCache;
                }

                this.geocodeCacheCount = maxCacheSize;
            }

            geocodeCache[key] = { coordinate: coordinate, hitCount: 1 };
            ++this.geocodeCacheCount;
        }

        private registerInStorage(key: string, coordinate: IGeocodeCoordinate): void {
            const valuesObj = {};
            const minimizeKey: string = this.minimizeKey(key);
            valuesObj[minimizeKey] = {
                "long": coordinate.longitude,
                "lat": coordinate.latitude
            };
            let valueObjectToString: string = JSON.stringify(valuesObj);
            this.localStorageService.get(GeocodingCache.TILE_LOCATIONS).then((data) => {
                const locations = JSON.parse(data);
                const mergedObject = location ? _.extend(locations, valuesObj) : valuesObj;
                valueObjectToString = JSON.stringify(mergedObject);
                this.localStorageService.set(GeocodingCache.TILE_LOCATIONS, valueObjectToString);
            }).catch(() => {
                this.localStorageService.set(GeocodingCache.TILE_LOCATIONS, valueObjectToString);
            });
        }
    }
}