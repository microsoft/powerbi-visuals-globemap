import { ICacheManager } from "./interfaces/ICacheManager";
import { ILocationDictionary } from "../geocoder/interfaces/geocoderInterfaces";

export class BingCache extends BaseCache implements ICacheManager {

    public async loadCoordinates(): Promise<ILocationDictionary> {

    }

    public sync saveCoordinates(): Promise<string> {

    }

}