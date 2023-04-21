import powerbi from "powerbi-visuals-api";
import IPromise2 = powerbi.IPromise2;
import ILocalVisualStorageService = powerbi.extensibility.ILocalVisualStorageService;
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
    private coordsInLocalStorage: ILocationDictionary;
    private localStorageService: ILocalVisualStorageService;

    constructor(localStorageService: ILocalVisualStorageService) {
        this.memoryCache = new MemoryCache(CacheSettings.MaxCacheSize, CacheSettings.MaxCacheSizeOverflow);
        this.localStorageService = localStorageService;
        this.bingGeocoder = new BingGeocoder();
        this.coordsInLocalStorage = {};
    }

    private createLocalStorageCache(): IPromise2<LocalStorageCache, void>  {
        const cache = new LocalStorageCache(this.localStorageService);

        return (<LocalStorageCache>cache).syncStatus()
            .then(status => {
                console.log(`Received local storage status: ${status}`);
                this.localStorageCache = cache;
                return cache            
            });
    }

    private getLocationsFromBing = async (locations: string[], locationsInMemory: string[], locationsDictionary: ILocationKeyDictionary): Promise<ILocationDictionary> => {
        console.log("Getting locations from Bing...");
        
        locationsDictionary = locations
            .reduce((obj, key) => ({ ...obj, [key]: locationsDictionary[key] }), {});

        const coordinatesFromBing = await this.bingGeocoder.geocode(locations);
        const resultObject = Object.assign({}, locationsInMemory, this.coordsInLocalStorage, coordinatesFromBing);
        
        return resultObject;
    }

    public async loadCoordinates(locationsDictionary: ILocationKeyDictionary): Promise<ILocationDictionary> {
        let result: ILocationDictionary = {};

        if (isEmpty(locationsDictionary)) {
            return result;
        }

        let locationsInMemory: string[] = [];
        let locations: string[] = Object.keys(locationsDictionary);
        
        // Load from memory
        const coordsInMemory: ILocationDictionary = await this.memoryCache.loadCoordinates(locations); // {"London": {"lat": 54, "lon": 34"}, "Moscow": {"lat": 64, "lon": 54"}
        locationsInMemory = Object.keys(coordsInMemory);
        
        locations = locations.filter(loc => !locationsInMemory.includes(loc));                        
        
        if (locations.length === 0) {
            result = Object.assign({}, coordsInMemory);
            return result;
        }


        // Load from localStorage
        if (isEmpty(this.coordsInLocalStorage)) {
            return this.createLocalStorageCache()
                .then(cache => cache.loadCoordinates(locations))
                .then(async (coordinatesPromise: Promise<ILocationDictionary>) => {
                    const coordinates = await coordinatesPromise;
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
                            const locationsFromBing = await this.getLocationsFromBing(locations, locationsInMemory, locationsDictionary);
                            return locationsFromBing;
                        }
                    }
                    else {
                        console.log("Local storage is empty, will attempt to load the coordinates from Bing API");
                        
                        const locationsFromBing = await this.getLocationsFromBing(locations, locationsInMemory, locationsDictionary);
                        return locationsFromBing;
                    }
                    
                }).catch(async (e) => {
                    console.error("Error while loading coordinates from local storage", e);
                    const locationsFromBing = await this.getLocationsFromBing(locations, locationsInMemory, locationsDictionary);
                    return locationsFromBing;
            });
        }
        else {
            return this.coordsInLocalStorage;
        }
    }

    public async saveCoordinates(coordinates: ILocationDictionary): Promise<void> {
        await this.memoryCache.saveCoordinates(coordinates);
        return this.localStorageCache.saveCoordinates(coordinates);
    }
}