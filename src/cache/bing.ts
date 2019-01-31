import { ICacheManager } from "./interfaces/ICacheManager";
import { BaseCache } from "./base";
import { ILocationDictionary } from "../geocoder/interfaces/geocoderInterfaces";

export class BingCache extends BaseCache implements ICacheManager {

    public async loadCoordinates(keys: string): Promise<ILocationDictionary> {
        return new Promise<ILocationDictionary>(() => { });
    }

    public async saveCoordinates(coordinates: ILocationDictionary): Promise<string> {
        return new Promise<string>(() => { });
    }

}