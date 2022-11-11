import { ICacheManager } from "./interfaces/ICacheManager";
import { ILocationDictionary, IGeocoder } from "../geocoder/interfaces/geocoderInterfaces";
import { createGeocoder } from "../geocoder/geocoder";

export class Bing implements ICacheManager {

    private geocoder: IGeocoder;

    constructor() {
        this.geocoder = createGeocoder();
    }

    public async loadCoordinates(keys: string[]): Promise<ILocationDictionary> {
        if (!keys || !keys.length) {
            return new Promise<ILocationDictionary>((resolve, reject) => reject("Empty location keys"));
        }

        return this.geocoder.geocodeByDataFlow(keys);
    }

    public async saveCoordinates(coordinates: ILocationDictionary): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        return new Promise<void>(() => { });
    }

}