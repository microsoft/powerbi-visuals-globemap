import { ILocationDictionary } from "../geocoder/interfaces/geocoderInterfaces";
import { GlobeMapData, GlobeMapDataPoint } from "../interfaces/dataInterfaces";

import { MemoryCache } from "./memory";
import { LocalStorageCache } from "./localStorageAPI";
import { BingCache } from "./bing";
import { ICacheManager } from "./interfaces/ICacheManager";


export class CacheManager {

    private memoryCache: ICacheManager;
    private localStorageCache: ICacheManager;
    private bingCache: ICacheManager;

    private needToBeLoaded: { [i: string]: boolean };
    private localStorageCoordinates: ILocationDictionary;

    constructor() {
        this.memoryCache = new MemoryCache();
        this.localStorageCache = new LocalStorageCache();
        this.bingCache = new BingCache()
    }

    private getPlacesToBeLoaded(): string[] {
        let result: string[] = [];

        for (let keysToBeLoaded in this.needToBeLoaded) {
            if (this.needToBeLoaded[keysToBeLoaded]) {
                result.push(keysToBeLoaded);
            }
        }
        return result;
    }

    public async loadCoordinates(data: GlobeMapData): Promise<ILocationDictionary> {
        this.needToBeLoaded = {};
        let locationRecords: ILocationDictionary;

        data.dataPoints.forEach((d: GlobeMapDataPoint) => {
            this.needToBeLoaded[d.placeKey] = true;
        });

        let memoryCoords: ILocationDictionary = {};
        let notLoadedCoordinates: string[] = this.getPlacesToBeLoaded();

        memoryCoords = await this.memoryCache.loadCoordinates(notLoadedCoordinates);
        for (let key in memoryCoords) {
            if (memoryCoords[key] && memoryCoords[key].longitude !== null && memoryCoords[key].latitude !== null) {
                this.needToBeLoaded[key] = false;
            }
        }

        notLoadedCoordinates = this.getPlacesToBeLoaded();
        if (!notLoadedCoordinates.length) {
            return new Promise<ILocationDictionary>((resolve, result) => { resolve(memoryCoords) });
        }

        let localStorageCoords: ILocationDictionary = {};
        if (!this.localStorageCoordinates) {
            localStorageCoords = await this.localStorageCache.loadCoordinates(notLoadedCoordinates);

        } else {
            notLoadedCoordinates.forEach((key: string) => {
                if (this.localStorageCoordinates[key]) {
                    locationRecords[key] = this.localStorageCoordinates[key];
                }
            });
        }
        for (let key in localStorageCoords) {
            if (localStorageCoords[key] && localStorageCoords[key].longitude !== null && localStorageCoords[key].latitude !== null) {
                this.needToBeLoaded[key] = false;
            }
        }

        notLoadedCoordinates = this.getPlacesToBeLoaded();
        if (!notLoadedCoordinates.length) {
            locationRecords = Object.assign({}, memoryCoords, localStorageCoords);
            return new Promise<ILocationDictionary>((resolve, result) => { resolve(locationRecords) });
        }

        // go to the bing!

    }

    public async saveCoordinates(coordinates: ILocationDictionary): Promise<string> {
        try {
            await this.memoryCache.saveCoordinates(coordinates);
            await this.localStorageCache.saveCoordinates(coordinates);
            return new Promise<string>((resolve, reject) => resolve("success"));
        }
        catch (error) {
            return new Promise<string>((resolve, reject) => reject());
        }
    }
} 