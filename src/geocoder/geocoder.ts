/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

import {
    IGeocoder,
    ILocationDictionary
} from "./interfaces/geocoderInterfaces";
import { BingJobStatusResponse } from "../interfaces/bingInterfaces";

import { BingSettings } from "../settings";

export const CategoryTypes = {
    Address: "Address",
    City: "City",
    Continent: "Continent",
    CountryRegion: "Country", // The text has to stay "Country" because it is used as a key in the geocoding caching dictionary
    County: "County",
    Longitude: "Longitude",
    Latitude: "Latitude",
    Place: "Place",
    PostalCode: "PostalCode",
    StateOrProvince: "StateOrProvince"
};

export function createGeocoder(): IGeocoder {
    return new DefaultGeocoder();
}

export abstract class BingMapsGeocoder implements IGeocoder {

    protected abstract bingSpatialDataFlowUrl(): string;

    private contentType: string;
    private inputType: string;
    private key: string;

    private static requestTimeout = 3500;
    private static HttpStatuses = {
        OK: 200,
        CREATED: 201
    };
    private static JobStatuses = {
        COMPLETED: "Completed",
        ABORTED: "Aborted",
        PENDING: "Pending"
    };

    constructor() {
        this.contentType = "application/xml";
        this.inputType = "xml";
        this.key = BingSettings.BingKey;
    }

    private createXmlStringFromLocationQueries(queries: string[]): string {
        const xmlns: string = "https://schemas.microsoft.com/search/local/2010/5/geocode";
        const xmlStart: string = `<?xml version="1.0" encoding="utf-8"?>
            <GeocodeFeed xmlns="${xmlns}">`;
        const xmlEnd: string = `</GeocodeFeed>`;

        let entities: string = '';
        let cultureName: string = navigator["userLanguage"] || navigator["language"];
        cultureName = mapLocalesForBing(cultureName);
        for (let i = 0; i < queries.length; i++) {
            const entity: string = `
            <GeocodeEntity Id="${i + 1}" xmlns="${xmlns}">
                <GeocodeRequest Culture="${cultureName}" Query="${queries[i]}" MaxResults="1">
                </GeocodeRequest>
            </GeocodeEntity>`;
            entities += entity;
        }

        const result: string = xmlStart + entities + xmlEnd;
        return result;
    }

    // eslint-disable-next-line max-lines-per-function
    public async geocodeByDataFlow(queries: string[]): Promise<ILocationDictionary> {
        const xmlString = this.createXmlStringFromLocationQueries(queries);
        try {
            console.log("Creating a job...");
            
            const createJobResult = await this.createJob(xmlString);
            
            console.log("Created job with response status", createJobResult.status);
            const createJobResultJson = await createJobResult.json();
            console.log("createJobResultJson", JSON.stringify(createJobResultJson));
            
            if (!createJobResult.ok || createJobResult.status !== BingMapsGeocoder.HttpStatuses.CREATED) {
                console.error("Geocoder Job creation error");
                return {};
            }

            //const createdJobBody = await createJobResult.json();
            const jobID: string = createJobResultJson.resourceSets[0].resources[0].id;
            let taskStatus = BingMapsGeocoder.JobStatuses.PENDING;
            
            return await new Promise((resolve, reject) => {
                const interval = setInterval(async () => {
                    try {
                        const jobStatus: BingJobStatusResponse = await this.monitorJobStatus(jobID);
                        console.log(`Returned job status ${jobStatus.statusCode}`);
                        
                        if (jobStatus.statusCode === BingMapsGeocoder.HttpStatuses.OK) {
                            taskStatus = jobStatus.resourceSets[0].resources[0].status;
                            console.log(`Returned task status ${taskStatus}`);

                            if (taskStatus === BingMapsGeocoder.JobStatuses.COMPLETED) {
                                console.log("Getting job results...");
                                
                                const jobResult: XMLDocument = await this.getJobResult(jobID);
                                const locationDictionary: ILocationDictionary = this.parseXmlJobResult(jobResult);     
                                console.log("Locations were retrieved from API");                   
                                clearInterval(interval);
                                    
                                resolve (locationDictionary);
                                return;     
                            }

                            if (taskStatus === BingMapsGeocoder.JobStatuses.ABORTED) {
                                console.error("Geocoder job was aborted due to an error");
                                clearInterval(interval);
                                reject("123");
                                return;
                            }
                        }

                    } catch(e) {
                        clearInterval(interval);
                        console.error("Geocoder Job status request has been failed");
                        reject("123");
                        return;
                    }
                }, BingMapsGeocoder.requestTimeout);

        })} catch(e) {
            console.error("Geocoder API call error", e);
            return;
        }
    }

    private async createJob(xmlInput): Promise<Response> {
        const queryString = `input=${this.inputType}&output=json&key=${this.key}`;
        const url = `${this.bingSpatialDataFlowUrl()}?${queryString}`;
                
        return fetch(url, {
            headers: {
                'Accept': this.contentType,
                'Content-Type': this.contentType
            },
            method: "POST",
            body: xmlInput
        });
    }

    private async getJobResult(jobID: string): Promise<XMLDocument> {
        const queryString = `key=${this.key}`;
        const url = `${this.bingSpatialDataFlowUrl()}/${jobID}/output/succeeded?${queryString}`;
    
        const response = await fetch(url);
        const responseText = await response.text(); 
        
        const xmlDoc: XMLDocument = new DOMParser().parseFromString(responseText, "application/xml");

        return xmlDoc;
    }

    private async monitorJobStatus(jobID: string): Promise<BingJobStatusResponse> {
        const queryString = `key=${this.key}`;
        const url = `${this.bingSpatialDataFlowUrl()}/${jobID}?${queryString}`;

        const response = await fetch(url);
        const jobStatus: BingJobStatusResponse = await response.json();

        return jobStatus;
    }

    private parseXmlJobResult(xmlDocument: XMLDocument): ILocationDictionary {
        const result: ILocationDictionary = {};
        const entities = xmlDocument.getElementsByTagName("GeocodeEntity");
        for (let i = 0; i < entities.length; i++) {
            const currentEntity = entities[i];
            const geocodeRequest = currentEntity.getElementsByTagName("GeocodeRequest");
            const geocodeResponse = currentEntity.getElementsByTagName("GeocodeResponse");
            const query: string = geocodeRequest.item(0).getAttribute("Query");
            const statusCode: string = geocodeResponse.item(0).getAttribute("StatusCode");

            if (statusCode === "Success") {
                const longitude: number = Number(geocodeResponse[0].children[1].getAttribute("Longitude"));
                const latitude: number = Number(geocodeResponse[0].children[1].getAttribute("Latitude"));
                result[query] = {
                    latitude,
                    longitude
                };
            }
        }

        return result;
    }
}

export class DefaultGeocoder extends BingMapsGeocoder {
    protected bingSpatialDataFlowUrl(): string {
        return 'https://spatial.virtualearth.net/REST/v1/Dataflows/Geocode';
    }
}

/** Note: Used for test mockup */
// export let BingAjaxCall: BingAjaxService = $.ajax;
export const CategoryTypeArray = [
    "Address",
    "City",
    "Continent",
    "Country",
    "County",
    "Longitude",
    "Latitude",
    "Place",
    "PostalCode",
    "StateOrProvince"
];

export function isCategoryType(value: string): boolean {
    return CategoryTypeArray.indexOf(value) > -1;
}

/**
 * Map locales that cause failures to similar locales that work
 */
function mapLocalesForBing(locale: string): string {
    switch (locale.toLowerCase()) {
        case 'fr': // Bing gives a 404 error when this language code is used (fr is only obtained from Chrome).  Use fr-FR for a near-identical version that works. Defect # 255717 opened with Bing.
            return 'fr-FR';
        case 'de':
            return 'de-DE';
        default:
            return locale;
    }
}
