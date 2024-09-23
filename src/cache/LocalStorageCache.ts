import powerbi from "powerbi-visuals-api";

import IVisualLocalStorageV2Service = powerbi.extensibility.IVisualLocalStorageV2Service;
import LocalStorageStatus = powerbi.PrivilegeStatus;
import IPromise2 = powerbi.IPromise2;

import { ILocationDictionary } from "../interfaces/locationInterfaces";

export class LocalStorageCache {
    private static TILE_LOCATIONS = "GLOBEMAP_TILE_LOCATIONS";
    private localStorageService: IVisualLocalStorageV2Service;
    private localStorageStatus: LocalStorageStatus;

    constructor(localStorageService: IVisualLocalStorageV2Service) {
        this.localStorageService = localStorageService;
    }

    public syncStatus(): IPromise2<LocalStorageStatus, void> {
        return this.localStorageService.status()
            .then(status => {
                this.localStorageStatus = status;
                return status;
            })
            .catch(() => console.error("Could not get local storage status"));
    }

    public loadCoordinates(keys: string[]): Promise<ILocationDictionary> {
        const result: ILocationDictionary = {};
        console.log("Loading coordinates from local storage...");

        if (this.localStorageStatus !== LocalStorageStatus.Allowed) {
            console.error("Local storage is not allowed");
            return;
        }

        return new Promise<ILocationDictionary>((resolve) => {
            return this.localStorageService.get(LocalStorageCache.TILE_LOCATIONS)
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
        });       
    }

    public saveCoordinates(coordinates: ILocationDictionary): IPromise2<void, void> {
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
                const mergedObject = locationsFromStorage ? {...locationsFromStorage, ...locationItemsObject} : locationItemsObject;

                const valueObjectToString = JSON.stringify(mergedObject);
                
                this.localStorageService.set(LocalStorageCache.TILE_LOCATIONS, valueObjectToString)
                    .then(() => console.log("Successfully saved coordinates to local storage"))
                    .catch(() => console.error("Could not save coordinates to local storage")
                );
            }).catch(() => {
                console.log("Local storage is likely empty, trying to add coordinates...")
                const valueObjectToString = JSON.stringify(locationItemsObject);
                this.localStorageService.set(LocalStorageCache.TILE_LOCATIONS, valueObjectToString)
                    .then(() => console.log("Set coordinates to local storage"))
                    .catch(() => console.error("Could not save coordinates to local storage"));
            });
    }
}