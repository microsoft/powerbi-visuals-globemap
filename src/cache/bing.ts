import { ILocationDictionary, IGeocoder } from "../geocoder/interfaces/geocoderInterfaces";
import { createGeocoder } from "../geocoder/geocoder";

export class Bing {
    private geocoder: IGeocoder;

    constructor() {
        this.geocoder = createGeocoder();
    }

    public loadCoordinates(locations: string[]): Promise<ILocationDictionary> {
        if (!locations || !locations.length) {
            return;
        }

        return this.geocoder.geocodeByDataFlow(locations);
    }
}