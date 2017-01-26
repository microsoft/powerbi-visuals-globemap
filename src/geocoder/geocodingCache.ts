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

module powerbi.extensibility.geocoder {

    import IStorageService = powerbi.extensibility.utils.formatting.IStorageService;

    interface GeocodeCacheEntry {
        coordinate: IGeocodeCoordinate;
        hitCount: number;
    }

    export interface IGeocodingCache {
        getCoordinates(key: string): IGeocodeCoordinate;
        registerCoordinates(key: string, coordinate: IGeocodeCoordinate): void;
        registerCoordinates(key: string, coordinate: IGeocodeBoundaryCoordinate): void;
    }

    export function createGeocodingCache(maxCacheSize: number, maxCacheSizeOverflow: number, localStorageService?: IStorageService): IGeocodingCache {
        if (!localStorageService)
            localStorageService = localStorageService;
        return new GeocodingCache(maxCacheSize, maxCacheSizeOverflow, localStorageService);
    }

    class GeocodingCache implements IGeocodingCache {
        private geocodeCache: _.Dictionary<GeocodeCacheEntry>;
        private geocodeCacheCount: number;
        private maxCacheSize: number;
        private maxCacheSizeOverflow: number;
        private localStorageService: IStorageService;

        constructor(maxCacheSize: number, maxCacheSizeOverflow: number, localStorageService: IStorageService) {
            this.geocodeCache = {};
            this.geocodeCacheCount = 0;
            this.maxCacheSize = maxCacheSize;
            this.maxCacheSizeOverflow = maxCacheSizeOverflow;
            this.localStorageService = localStorageService;
        }

    /**
    * Retrieves the coordinate for the key from the cache, returning undefined on a cache miss.
    */
        public getCoordinates(key: string): IGeocodeCoordinate {
            // Check in-memory cache
            let pair = this.geocodeCache[key];
            if (pair) {
                ++pair.hitCount;
                return pair.coordinate;
            }
            // Check local storage cache
            pair = this.localStorageService.getData(key);
            if (pair) {
                this.registerInMemory(key, pair.coordinate);
                return pair.coordinate;
            }
            return undefined;
        }
    /**
    * Registers the query and coordinate to the cache.
    */
        public registerCoordinates(key: string, coordinate: IGeocodeCoordinate): void {
            this.registerInMemory(key, coordinate);
            this.registerInStorage(key, coordinate);
        }

        private registerInMemory(key: string, coordinate: IGeocodeCoordinate): void {
            let geocodeCache = this.geocodeCache;
            let maxCacheSize = this.maxCacheSize;
            let maxCacheCount = maxCacheSize + this.maxCacheSizeOverflow;

            // are we about to exceed the maximum?
            if (this.geocodeCacheCount >= maxCacheCount) {
                let keys = Object.keys(geocodeCache);
                let cacheSize = keys.length;

                // sort keys in *descending* hitCount order
                keys.sort((a: string, b: string) => {
                    let cachedA = geocodeCache[a];
                    let cachedB = geocodeCache[b];
                    let ca = cachedA ? cachedA.hitCount : 0;
                    let cb = cachedB ? cachedB.hitCount : 0;
                    return ca < cb ? 1 : (ca > cb ? -1 : 0);
                });

                // whack ones with the lower hitCounts.
                // - while # whacked keys is small, do a quick wipe
                // - after awhile we get lots of keys whose cached value is undefined. 
                //   when there are "too many," make a whole new memory cache.
                if (cacheSize < 2 * maxCacheCount) {
                    for (let i = maxCacheSize; i < cacheSize; i++)
                        geocodeCache[keys[i]] = undefined;
                }
                else {
                    let newGeocodeCache: _.Dictionary<GeocodeCacheEntry> = {};
                    for (let i = 0; i < maxCacheSize; ++i)
                        newGeocodeCache[keys[i]] = geocodeCache[keys[i]];

                    geocodeCache = this.geocodeCache = newGeocodeCache;
                }

                this.geocodeCacheCount = maxCacheSize;
            }

            geocodeCache[key] = { coordinate: coordinate, hitCount: 1 };
            ++this.geocodeCacheCount;
        }

        private registerInStorage(key: string, coordinate: IGeocodeCoordinate): void {
            this.localStorageService.setData(key, { coordinate: coordinate });
        }
    }
}