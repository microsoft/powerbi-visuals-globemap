import powerbi from "powerbi-visuals-api";

import assign from "lodash.assign";

import ILocalVisualStorageService = powerbi.extensibility.ILocalVisualStorageService;
import LocalStorageStatus = powerbi.PrivilegeStatus;

import { ILocationDictionary } from "../geocoder/interfaces/geocoderInterfaces";

export class LocalStorageCache {

    private static TILE_LOCATIONS = "GLOBEMAP_TILE_LOCATIONS";
    private localStorageService: ILocalVisualStorageService;
    private localStorageStatus: LocalStorageStatus;

    constructor(localStorageService: ILocalVisualStorageService) {
        this.localStorageService = localStorageService;
    }

    public setStatus() {
        return this.localStorageService.status()
            .then(status => {
                this.localStorageStatus = status;
                return status;
            })
            .catch(() => console.error("Could not get local storage status"));
    }

    public loadCoordinates(keys: string[]) {
        const result: ILocationDictionary = {};
        console.log("Loading coordinates from local storage...");

        if (this.localStorageStatus !== LocalStorageStatus.Allowed) {
            console.error("Local storage is not allowed");
            return;
        }

        return new Promise<ILocationDictionary>((resolve, reject) => {this.localStorageService.get(LocalStorageCache.TILE_LOCATIONS)
            .catch(() => {
                console.log("Did not get any data from local storage service");
                resolve({});
                return;
            })
            .then((data) => {    
                const parsedValue = JSON.parse(data);

                if (!parsedValue) {
                    console.log("Local storage can not be parsed");      
                    resolve({});
                    return;
                }

                if (!keys || !keys.length) {
                    for (const key in parsedValue) {
                        if (Object.prototype.hasOwnProperty.call(parsedValue, key)) {
                            const location = parsedValue[key];
                            if (location) {
                                result[key] = {
                                    latitude: location.lat,
                                    longitude: location.lon
                                };
                            }
                        }
                    }
                } else {
                    keys.forEach((key: string) => {
                        const location = parsedValue[key];
                        if (location) {
                            result[key] = {
                                latitude: location.lat,
                                longitude: location.lon
                            };
                        }
                    });
                }

                resolve(result);
            })  
    })   
            /*.catch((e) => {
                console.error("LS error", e);
                this.localStorageService.set(LocalStorageCache.TILE_LOCATIONS, "{}")
                    .then(() => console.log("Set empty object to storage in then block"))
                    .catch(() => console.error("Could not set empty object to storage"));
            })*/
            
    }

    public saveCoordinates(coordinates: ILocationDictionary) {
        if (this.localStorageStatus !== LocalStorageStatus.Allowed) {
            console.error("Local storage is not allowed");
            return;
        }

        const locationItemsObject = {};
        for (const key in coordinates) {
            locationItemsObject[key] = {
                "lon": coordinates[key].longitude,
                "lat": coordinates[key].latitude
            };
        }
        console.log("Saving coordinates to local storage...");

        return this.localStorageService.get(LocalStorageCache.TILE_LOCATIONS)
            .then((data) => {
                const locationsFromStorage = JSON.parse(data);
                const mergedObject = locationsFromStorage ? assign(locationsFromStorage, locationItemsObject) : locationItemsObject;

                const valueObjectToString = JSON.stringify(mergedObject);
                

                this.localStorageService.set(LocalStorageCache.TILE_LOCATIONS, valueObjectToString)
                    .then(() => console.log("Set locations to storage"))
                    .catch(() => console.error("Could not save location to local storage")
                );
            }).catch((e) => {
                console.error("Local storage is likely empty, setting locations...", e)
                const valueObjectToString = JSON.stringify(locationItemsObject);
                this.localStorageService.set(LocalStorageCache.TILE_LOCATIONS, valueObjectToString)
                    .then(() => console.log("Set locations to storage"))
                    .catch(() => console.error("Could not save location to local storage"));
            });
    }
}