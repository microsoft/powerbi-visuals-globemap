import { ICacheManager } from "./interfaces/ICacheManager";
import { ILocationDictionary } from "../geocoder/interfaces/geocoderInterfaces";

export class BaseCache implements ICacheManager {
    async loadCoordinates(data: any): Promise<ILocationDictionary> {
        return new Promise<ILocationDictionary>(() => { });
    };
    async saveCoordinates(coordinates: ILocationDictionary): Promise<string> {
        return new Promise<string>(() => { });
    };
}