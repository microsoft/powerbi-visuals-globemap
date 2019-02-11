import { ICacheManager } from "./interfaces/ICacheManager";
import { BaseCache } from "./base";
import { ILocationDictionary, IGeocoder, IGeocodeCoordinate, IGeocoderOptions } from "../geocoder/interfaces/geocoderInterfaces";
import { createGeocoder } from "../geocoder/geocoder";
import { ILocationKeyDictionary } from "../interfaces/dataInterfaces";

export class BingCache extends BaseCache implements ICacheManager {

    private geocoder: IGeocoder;

    constructor() {
        super();
        this.geocoder = createGeocoder();
    }

    public async loadCoordinates(keys: string[]): Promise<ILocationDictionary> {
        //const keys: string[] = Object.keys(keyDictionary);
        if (!keys || !keys.length) {
            return new Promise<ILocationDictionary>((resolve, reject) => reject());
        }

        return this.geocoder.geocodeByDataFlow(keys);
    }

    // rewrite details
    private async loadCoordinateFromBing(key: string, category?: string): Promise<IGeocodeCoordinate> {
        return this.geocoder.geocode({ query: key, category: category } as IGeocoderOptions);
    }

    public async saveCoordinates(coordinates: ILocationDictionary): Promise<string> {
        return new Promise<string>(() => { });
    }

}