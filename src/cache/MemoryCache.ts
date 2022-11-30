import { ILocationDictionary, ILocationCoordinateRecord, IGeocodeCoordinate } from "../geocoder/interfaces/geocoderInterfaces";

interface GeocodeCacheEntry {
    coordinate: IGeocodeCoordinate;
    hitCount: number;
}

export class MemoryCache {
    private geocodeCache: _.Dictionary<GeocodeCacheEntry>;
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
            for (const key in this.geocodeCache) {
                if (this.geocodeCache[key]) {
                    this.geocodeCache[key].hitCount++;
                    locations[key] = this.geocodeCache[key].coordinate;
                }
            }

            return locations;
    }

    public saveCoordinates(coordinates: ILocationDictionary): Promise<void> {
        console.log("Saving coordinates to memory cache...");
        
        if (!coordinates) {
            console.log("No locations to be saved");
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
            this.saveCoordinate(coordinateRecord);
        }
    }

    public saveCoordinate(locationRecord: ILocationCoordinateRecord) {
        let geocodeCache: _.Dictionary<GeocodeCacheEntry> = this.geocodeCache;

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
                const newGeocodeCache: _.Dictionary<GeocodeCacheEntry> = {};
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
