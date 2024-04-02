import { ILocationDictionary, IGeocodeCoordinate, ILocationCoordinateRecord } from "../interfaces/locationInterfaces";

interface GeocodeCacheEntry {
    coordinate: IGeocodeCoordinate;
    hitCount: number;
}

interface Dictionary<T> {
    [index: string]: T;
}

export class MemoryCache {
    private geocodeCache: Dictionary<GeocodeCacheEntry>;
    private geocodeCacheCount: number;
    private maxCacheSize: number;
    private maxCacheSizeOverflow: number;

    constructor(maxCacheSize: number, maxCacheSizeOverflow: number) {
        this.geocodeCache = {};
        this.geocodeCacheCount = 0;
        this.maxCacheSize = maxCacheSize;
        this.maxCacheSizeOverflow = maxCacheSizeOverflow;
    }

    public async loadCoordinates(keys: string[]): Promise<ILocationDictionary> {
        console.log("Loading from memory cache...");
        
        if (!keys || !keys.length) {
            return;
        }

        const locations: ILocationDictionary = {};
        for (const key of keys) {
            if (this.geocodeCache[key]) {
                this.geocodeCache[key].hitCount++;
                locations[key] = this.geocodeCache[key].coordinate;
            }
        }

        if (Object.keys(locations).length === 0) {
            console.log("Memory cache is empty");  
        }

        return locations;
    }

    public saveCoordinates(coordinates: ILocationDictionary): Promise<void> {
        console.log("Saving coordinates to memory cache...");
        
        if (!coordinates) {
            console.log("No locations to be saved to memory cache");
            return;
        }

        for (const key in coordinates) {
            const coordinateRecord: ILocationCoordinateRecord = {
                key: key,
                coordinate: {
                    latitude: coordinates[key].latitude,
                    longitude: coordinates[key].longitude
                }
            };
            this.saveSingleCoordinate(coordinateRecord);
        }

        console.log("Successfully saved coordinates to memory cache");
    }

    private saveSingleCoordinate(locationRecord: ILocationCoordinateRecord) {
        let geocodeCache: Dictionary<GeocodeCacheEntry> = this.geocodeCache;

        if (geocodeCache[locationRecord.key]) {
            return;
        }

        const maxCacheSize: number = this.maxCacheSize;
        const maxCacheCount: number = maxCacheSize + this.maxCacheSizeOverflow;

        // are we about to exceed the maximum?
        if (this.geocodeCacheCount >= maxCacheCount) {
            const keys: string[] = Object.keys(geocodeCache);
            const cacheSize: number = keys.length;

            // sort keys in *descending* hitCount order
            keys.sort((a: string, b: string) => {
                const cachedA: GeocodeCacheEntry = geocodeCache[a];
                const cachedB: GeocodeCacheEntry = geocodeCache[b];
                const ca: number = cachedA ? cachedA.hitCount : 0;
                const cb: number = cachedB ? cachedB.hitCount : 0;
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
                const newGeocodeCache: Dictionary<GeocodeCacheEntry> = {};
                for (let i = 0; i < maxCacheSize; ++i) {
                    newGeocodeCache[keys[i]] = geocodeCache[keys[i]];
                }

                geocodeCache = this.geocodeCache = newGeocodeCache;
            }

            this.geocodeCacheCount = maxCacheSize;
        }

        geocodeCache[locationRecord.key] = { coordinate: locationRecord.coordinate, hitCount: 1 };
        ++this.geocodeCacheCount;
    }
}
