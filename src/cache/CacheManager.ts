import powerbi from "powerbi-visuals-api";

import isEmpty from "lodash.isempty";

import ILocalVisualStorageService = powerbi.extensibility.ILocalVisualStorageService;

import { ILocationDictionary } from "../geocoder/interfaces/geocoderInterfaces";
import { MemoryCache } from "./MemoryCache";
import { LocalStorageCache } from "./LocalStorageCache";
import { Bing } from "./bing";
import { CacheSettings } from "./../settings";
import { ILocationKeyDictionary } from "../interfaces/dataInterfaces";

export class CacheManager {

    private memoryCache: MemoryCache;
    private localStorageCache: LocalStorageCache;
    private bing: Bing;
    private coordsInLocalStorage: ILocationDictionary;
    private localStorageService: ILocalVisualStorageService;

    constructor(localStorageService: ILocalVisualStorageService) {
        console.log("CacheManager constructor");
        this.memoryCache = new MemoryCache(CacheSettings.MaxCacheSize, CacheSettings.MaxCacheSizeOverflow);
        //this.localStorageCache = new LocalStorageCache(localStorageService);
        this.localStorageService = localStorageService;
        this.bing = new Bing();
        this.coordsInLocalStorage = {};
    }

    private createLocalStorageCache()  {
        const cache = new LocalStorageCache(this.localStorageService);

        return (<LocalStorageCache>cache).setStatus()
            .then(status => {
                console.log(`createLocalStorageCache method received local storage status: ${status}`);
                this.localStorageCache = cache;
                return cache            
            });
    }

    public async loadCoordinates(locationsDictionary: ILocationKeyDictionary): Promise<ILocationDictionary> {
    
        let result: ILocationDictionary = {};

        if (isEmpty(locationsDictionary)) {
            return result;
        }

        let locationsInMemory = [];
        let locations: string[] = Object.keys(locationsDictionary);
        
        // Load from memory
        const coordsInMemory: ILocationDictionary = await this.memoryCache.loadCoordinates(locations); // {"London": {"lat": 54, "lon": 34"}, "Moscow": {"lat": 64, "lon": 54"}
        locationsInMemory = Object.keys(coordsInMemory);
        
        console.log("Locations in memory", JSON.stringify(locationsInMemory));
        
        locations = locations.filter(loc => !locationsInMemory.includes(loc));                       // ["Moscow"] need to be loaded from LS or Bing

        console.log("Locations after filter", JSON.stringify(locations));
        
        if (locations.length === 0) {
            result = Object.assign({}, coordsInMemory);
            return result;
        }

        const getLocationsFromBing = async (): Promise<ILocationDictionary> => {
            console.log("Getting locations from BING");
            
            locationsDictionary = locations
                .reduce((obj, key) => ({ ...obj, [key]: locationsDictionary[key] }), {});

            const coordsInBing = await this.bing.loadCoordinates(locations);
            result = Object.assign({}, locationsInMemory, this.coordsInLocalStorage, coordsInBing);
            
            return result;
        }

        // Load from localStorage
        if (isEmpty(this.coordsInLocalStorage)) {
            return this.createLocalStorageCache()
                .then(cache => cache.loadCoordinates(locations))
                .then(async (c ) => {
                    const coordinates = await c;
                    if (coordinates && Object.keys(coordinates).length > 0) {
                        if (isEmpty(this.coordsInLocalStorage)) {
                            this.coordsInLocalStorage = coordinates;
                        }
                        
                        if (this.coordsInLocalStorage) {
                            const locationsInLocalStorage = Object.keys(this.coordsInLocalStorage);
                            locations = locations.filter(loc => !locationsInLocalStorage.includes(loc));
                    
                            if (locations.length === 0) {
                                result = Object.assign({}, locationsInMemory, this.coordsInLocalStorage);
                                return result;
                            }
    
                            // Load additional locations from Bing
                            const locationsFromBing = await getLocationsFromBing();
                            return locationsFromBing;
                        }
                    }
                    else {
                        console.log("Local storage is empty, will attempt to load the coordinates from Bing API");
                        
                        const locationsFromBing = await getLocationsFromBing();
                        return locationsFromBing;
                    }
                    
                }).catch((e) => {
                    console.error("Error while loading coordinates", e);
                    return getLocationsFromBing();
            });
        }
        else return this.coordsInLocalStorage;

        // Load from Bing
        const locationsFromBing = await getLocationsFromBing();
        return locationsFromBing;
    }

    public async saveCoordinates(coordinates: ILocationDictionary): Promise<void> {
        await this.memoryCache.saveCoordinates(coordinates);
        return this.localStorageCache.saveCoordinates(coordinates);
    }
}