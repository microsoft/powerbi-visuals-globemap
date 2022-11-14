import powerbi from "powerbi-visuals-api";

import assign from "lodash.assign";

import ILocalVisualStorageService = powerbi.extensibility.ILocalVisualStorageService;
import LocalStorageStatus = powerbi.PrivilegeStatus;

import { ICacheManager } from "./interfaces/ICacheManager";
import { ILocationDictionary } from "../geocoder/interfaces/geocoderInterfaces";

export class LocalStorageCache implements ICacheManager {

    private static TILE_LOCATIONS = "GLOBEMAP_TILE_LOCATIONS";
    private localStorageService: ILocalVisualStorageService;
    private localStorageStatus: LocalStorageStatus;

    constructor(localStorageService: ILocalVisualStorageService) {
        this.localStorageService = localStorageService;
        console.log("LocalStorageCache constructor");

        /*this.setStatus()
            .then(status => {
                this.localStorageStatus = status;
                console.log(`Local storage status promise resolved in LocalStorageCache constructor with code ${status}`);
            });*/
    }

    public setStatus() {
        return this.localStorageService.status()
            .then(status => {
                console.log(`Received local storage status with code ${status} in getStatus method`);
                this.localStorageStatus = status;
                return status;
            })
            .catch(() => console.log("Could not get local storage status"));
    }

    public loadCoordinates(keys: string[]) {
        const result: ILocationDictionary = {};
        console.log("Loading coordinates from local storage...");

        if (this.localStorageStatus !== LocalStorageStatus.Allowed) {
            console.error("Local storage is not allowed");
            return;
        }
        
        return this.localStorageService.get(LocalStorageCache.TILE_LOCATIONS).then((data) => {
                const parsedValue = JSON.parse(data);
                if (!parsedValue) {
                    throw "Storage can not be parsed";
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

                return result;
            })
                .catch(() => {
                    return("No locations in storage");
                });
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

        return this.localStorageService.get(LocalStorageCache.TILE_LOCATIONS).then((data) => {
                const locationsFromStorage = JSON.parse(data);
                const mergedObject = locationsFromStorage ? assign(locationsFromStorage, locationItemsObject) : locationItemsObject;

                const valueObjectToString = JSON.stringify(mergedObject);
                this.localStorageService.set(LocalStorageCache.TILE_LOCATIONS, valueObjectToString)
                    .catch(() => console.error("Could not save location to local storage")
                );
            }).catch(() => {
                console.error("Storage service save error")
                const valueObjectToString = JSON.stringify(locationItemsObject);
                this.localStorageService.set(LocalStorageCache.TILE_LOCATIONS, valueObjectToString)
                    .catch(() => console.error("Could not save location to local storage"));
            });
    }
}