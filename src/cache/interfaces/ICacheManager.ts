import { ILocationDictionary } from "../../geocoder/interfaces/geocoderInterfaces";

export interface ICacheManager {
    loadCoordinates(data: any): Promise<ILocationDictionary>;
    saveCoordinates(coordinates: ILocationDictionary): Promise<string>;
}