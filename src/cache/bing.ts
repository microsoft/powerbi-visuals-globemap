import { ILocationDictionary, IGeocoder } from "../geocoder/interfaces/geocoderInterfaces";
import { createGeocoder } from "../geocoder/geocoder";

export class Bing {

    private geocoder: IGeocoder;

    constructor() {
        this.geocoder = createGeocoder();
    }

    public loadCoordinates(keys: string[]): Promise<ILocationDictionary> {
        if (!keys || !keys.length) {
            return;
        }

        return this.geocoder.geocodeByDataFlow(keys);
    }
}