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

import { ILocationDictionary } from "./interfaces/locationInterfaces";
import { BingSettings } from "./settings";
import { BingGeocodeResponse, BingGeocodeResourceSet, BingGeocodeEntity } from "./interfaces/bingInterfaces";

export class BingGeocoder {
    private contentType: string = "application/json";
    private apiUrl: string = `https://dev.virtualearth.net/REST/v1/Locations/multigeocode?input=json&key=${BingSettings.BingKey}&output=json`;

    public async geocode(locations: string[]): Promise<ILocationDictionary> {
        if (!locations || !locations.length) {
            return;
        }

        const batches: string[][] = this.getBatches(locations);
        const result: ILocationDictionary = {};

        try {
            await Promise.all(batches.map(async (batch: string[]) => {
                const geocodeEntities: BingGeocodeEntity[] = batch.map(location => {
                    return {
                        query: location
                    };
                });
              
                const response = await fetch(this.apiUrl, {
                    headers: {
                        'Accept': this.contentType,
                        'Content-Type': this.contentType
                    },
                    method: "POST",
                    body: JSON.stringify({ geocodeEntities })
                });
        
                const responseJson: BingGeocodeResponse = await response.json();
    
                for (let i = 0; i < responseJson.resourceSets.length; i++) {
                    const currentSet: BingGeocodeResourceSet = responseJson.resourceSets[i];
                    
                    if (!currentSet.resources[0]?.point){
                        console.log(`Could not get coordinates of '${batch[i]}' from Bing`);
                    }
                    else {
                        const coordinates: number[] = currentSet.resources[0].point.coordinates;
                        
                        const latitude: number = coordinates[0];
                        const longitude: number = coordinates[1];
        
                        const name: string = batch[i];
                        result[name] = { latitude, longitude };
                    }   
                }
            }));
        } catch (e) {
            console.error("Geocode request failed", e);
        }

        return result;
    }

    private getBatches(locations: string[]): string[][] {
        const batches: string[][] = [];
        const maxBatchSize = 30; // this limit is set by API endpoint

        for(let i = 0; i < locations.length; i += maxBatchSize) {
            const batch = locations.slice(i, i + maxBatchSize);
            batches.push(batch);    
        }

        return batches;
    }
}
