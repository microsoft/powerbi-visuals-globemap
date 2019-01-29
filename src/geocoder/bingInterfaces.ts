// what we care about in the Bing geocoding and geospatial responses
export interface BingGeocodeResponse {
    resourceSets: { resources: BingLocation[] }[];
}

export interface BingLocation {
    name?: string;
    entityType?: string;
    address?: BingAddress;
    point?: { coordinates?: number[] };
}

export interface BingAddress {
    addressLine?: string;
    adminDistrict?: string;
    adminDistrict2?: string;
    countryRegion?: string;
    countryRegionIso2?: string;
    formattedAddress?: string;
    locality?: string;
    postalCode?: string;
    neighborhood?: string;
    landmark?: string;
}

export interface BingGeoboundaryResponse {
    d?: { results?: BingGeoboundary[] };
}

export interface BingGeoboundary {
    Primitives?: BingGeoboundaryPrimitive[];
}

export interface BingGeoboundaryPrimitive {
    Shape: string;
}