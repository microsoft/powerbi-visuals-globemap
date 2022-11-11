import { ILocationDictionary } from "../../geocoder/interfaces/geocoderInterfaces";
import { ILocationKeyDictionary } from "../../interfaces/dataInterfaces";
import powerbi from "powerbi-visuals-api";
import Promise2 = powerbi.IPromise2;

export interface ICacheManager {
    loadCoordinates(data: string[] | ILocationKeyDictionary): Promise<ILocationDictionary> | Promise2<ILocationDictionary, string>;
    saveCoordinates(coordinates: ILocationDictionary): Promise<void> | Promise2<void, void>;
}