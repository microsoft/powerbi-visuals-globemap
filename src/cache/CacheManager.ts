import powerbi from "powerbi-visuals-api";
import IPromise2 = powerbi.IPromise2;
import IVisualLocalStorageV2Service = powerbi.extensibility.IVisualLocalStorageV2Service;
import isEmpty from "lodash.isempty";
import { ILocationDictionary, ILocationKeyDictionary } from "../interfaces/locationInterfaces";
import { MemoryCache } from "./MemoryCache";
import { LocalStorageCache } from "./LocalStorageCache";
import { CacheSettings } from "./../settings";
import { BingGeocoder } from "../geocoder";

export class CacheManager {
    private memoryCache: MemoryCache;
    private localStorageCache: LocalStorageCache;
    private bingGeocoder: BingGeocoder;

    constructor(localStorageService: IVisualLocalStorageV2Service, memoryCache?: MemoryCache, localStorageCache?: LocalStorageCache, bingGeocoder?: BingGeocoder) {
        this.memoryCache = memoryCache ?? new MemoryCache(CacheSettings.MaxCacheSize, CacheSettings.MaxCacheSizeOverflow);
        this.bingGeocoder = bingGeocoder ?? new BingGeocoder();
        this.localStorageCache = localStorageCache ?? new LocalStorageCache(localStorageService);
    }

    private syncLocalStorageCacheStatus(): Promise<void>  {
        return new Promise((resolve) => {
            this.localStorageCache.syncStatus()
            .then((status: powerbi.PrivilegeStatus) => {
                console.log(`Received local storage status: ${status}`);
                resolve();
            })
        });
    }

    private getLocationsFromBing = async (locations: string[], locationsDictionary: ILocationKeyDictionary): Promise<ILocationDictionary> => {
        console.log("Getting locations from Bing...");
        
        locationsDictionary = locations
            .reduce((obj, key) => ({ ...obj, [key]: locationsDictionary[key] }), {});

        const coordinatesFromBing = await this.bingGeocoder.geocode(locations);
        return coordinatesFromBing;
    }

    public async loadCoordinates(locationsDictionary: ILocationKeyDictionary): Promise<ILocationDictionary> {
        let result: ILocationDictionary = {};

        if (isEmpty(locationsDictionary)) {
            return result;
        }

        let locationsInMemory: string[] = [];
        let locations: string[] = Object.keys(locationsDictionary);
        
        // Load from memory
        const coordsInMemory: ILocationDictionary = this.memoryCache.loadCoordinates(locations); // {"London": {"lat": 54, "lon": 34"}, "Moscow": {"lat": 64, "lon": 54"}
        locationsInMemory = Object.keys(coordsInMemory);
        locations = locations.filter(loc => !locationsInMemory.includes(loc));                        
        if (locations.length === 0) {
            result = Object.assign({}, coordsInMemory);
            return result;
        }

        // Load from local storage
        await this.syncLocalStorageCacheStatus();
        const coordsInLocalStorage: ILocationDictionary = await this.localStorageCache.loadCoordinates(locations);
        const locationsInlocalStorage = Object.keys(coordsInLocalStorage);
        locations = locations.filter(loc => !locationsInlocalStorage.includes(loc));                        
        if (locations.length === 0) {
            result = Object.assign({}, coordsInMemory, coordsInLocalStorage);
            return result;
        }

        // Load from Bing
        const coordsFromBing: ILocationDictionary = await this.getLocationsFromBing(locations, locationsDictionary);
        result = Object.assign({}, coordsInMemory, coordsInLocalStorage, coordsFromBing);
        return result;
    }

    public saveCoordinates(coordinates: ILocationDictionary): IPromise2<void, void> {
        this.memoryCache.saveCoordinates(coordinates);
        return this.localStorageCache.saveCoordinates(coordinates);
    }
}