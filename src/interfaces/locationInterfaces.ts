export interface IGeocodeCoordinate {
    latitude: number;
    longitude: number;
}

export interface ILocationDictionary {
    [i: string]: IGeocodeCoordinate;
}

export interface ILocationCoordinateRecord {
    key: string;
    coordinate: IGeocodeCoordinate;
}

export interface ILocationKeyDictionary {
    [placeKey: string]: {
        place: string; locationType: string;
    };
}