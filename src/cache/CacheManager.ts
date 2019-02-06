import powerbi from "powerbi-visuals-api";
import ILocalVisualStorageService = powerbi.extensibility.ILocalVisualStorageService;

import { ILocationDictionary } from "../geocoder/interfaces/geocoderInterfaces";
import { MemoryCache } from "./memory";
import { LocalStorageCache } from "./localStorageAPI";
import { BingCache } from "./bing";
import { ICacheManager } from "./interfaces/ICacheManager";
import { CacheSettings } from "./../settings";
import { ILocationKeyDictionary } from "../interfaces/dataInterfaces";

export class CacheManager implements ICacheManager {

    private memoryCache: ICacheManager;
    private localStorageCache: ICacheManager;
    private bingCache: ICacheManager;
    private coordsInLocalStorage: ILocationDictionary;

    constructor(localStorageService: ILocalVisualStorageService) {
        this.memoryCache = new MemoryCache(CacheSettings.MaxCacheSize, CacheSettings.MaxCacheSizeOverflow);
        this.localStorageCache = new LocalStorageCache(localStorageService);
        this.bingCache = new BingCache()
    }

    public async loadCoordinates(locationsDictionary: ILocationKeyDictionary): Promise<ILocationDictionary> {
        let result: ILocationDictionary = {};
        let locationsInMemory = [];

        let locations: string[] = Object.keys(locationsDictionary);

        // load from memory
        let coordsInMemory: ILocationDictionary = await this.memoryCache.loadCoordinates(locations); // {"London": {"lat": 54, "lon": 34"}, "Moscow": {"lat": 64, "lon": 54"}
        locationsInMemory = Object.keys(coordsInMemory);                                             // ["London", "Moscow"]
        locations = locations.filter(loc => !locationsInMemory.includes(loc));                       // ["Moscow"] need to be loaded from LS or Bing

        if (locations.length === 0) {
            result = Object.assign({}, coordsInMemory);
            return new Promise<ILocationDictionary>(resolve => resolve(result));
        }

        // Load from localStorage
        if (!this.coordsInLocalStorage) {
            this.coordsInLocalStorage = await this.localStorageCache.loadCoordinates(locations);
            let locationsInLocalStorage = Object.keys(this.coordsInLocalStorage);
            locations = locations.filter(loc => !locationsInLocalStorage.includes(loc));

            if (locations.length === 0) {
                result = Object.assign({}, locationsInMemory, this.coordsInLocalStorage);
                return new Promise<ILocationDictionary>(resolve => resolve(result));
            }
        }

        // load from Bing
        locationsDictionary = locations
            .reduce((obj, key) => ({ ...obj, [key]: locationsDictionary[key] }), {});
        let coordsInBing = await this.bingCache.loadCoordinates(locationsDictionary);
        result = Object.assign({}, locationsInMemory, this.coordsInLocalStorage, coordsInBing);

        return new Promise<ILocationDictionary>(resolve => resolve(result));
    }

    public async saveCoordinates(coordinates: ILocationDictionary): Promise<string> {
        await this.memoryCache.saveCoordinates(coordinates);
        return this.localStorageCache.saveCoordinates(coordinates);
    }
} 