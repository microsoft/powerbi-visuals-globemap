export interface BingGeocodeResponse {
    resourceSets: BingGeocodeResourceSet[];
    statusCode: number;
}

export interface BingGeocodeResourceSet {
    resources: BingGeocodeResource[];
}

export interface BingGeocodeResource {
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

export interface BingGeocodeQuery {
    geocodeEntities: BingGeocodeEntity[];
}

export interface BingGeocodeEntity {
    query: string;
}

export interface BingMetadata {
    resourceSets: BingMetadataResourceSet[];
    statusCode: string;
    statusDescription: string;
}

export interface BingMetadataResourceSet {
    resources: BingResourceMetadata[];
}

export interface BingResourceMetadata {
    imageHeight: number;
    imageWidth: number;
    imageUrl: string;
    imageUrlSubdomains: string[];
}