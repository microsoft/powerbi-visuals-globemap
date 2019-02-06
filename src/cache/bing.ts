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

    public async loadCoordinates(keyDictionary: ILocationKeyDictionary): Promise<ILocationDictionary> {
        const keys: string[] = Object.keys(keyDictionary);
        if (!keys || !keys.length) {
            return new Promise<ILocationDictionary>((resolve, reject) => reject());
        }

        let result: ILocationDictionary = {};

        // there can be some not existing location keys for each we will receive the rejected Promise - so, we won't use Promises.all()
        // our goal is to receive existing location's coordinates
        for (const key of keys) {
            let coordinate: IGeocodeCoordinate;
            try {
                coordinate = await this.loadCoordinateFromBing(keyDictionary[key].place, keyDictionary[key].locationType);
            }
            catch (error) {
                continue;
            }

            result[key] = coordinate;
        }

        return new Promise<ILocationDictionary>((resolve) => resolve(result));
    }

    // rewrite details
    private async loadCoordinateFromBing(key: string, category?: string): Promise<IGeocodeCoordinate> {
        return this.geocoder.geocode({ query: key, category: category } as IGeocoderOptions);
    }

    public async saveCoordinates(coordinates: ILocationDictionary): Promise<string> {
        return new Promise<string>(() => { });
    }

}