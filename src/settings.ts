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


// powerbi.extensibility.utils.dataview
import { dataViewObjectsParser } from "powerbi-visuals-utils-dataviewutils";
import DataViewObjectsParser = dataViewObjectsParser.DataViewObjectsParser;

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import FormattingSettingsCard = formattingSettings.Card;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;
import { GlobeMapData } from "./interfaces/dataInterfaces";

import { ColorHelper } from "powerbi-visuals-utils-colorutils";

import powerbi from "powerbi-visuals-api";
import ISelectionId = powerbi.visuals.ISelectionId

export const CacheSettings = {
    /** Maximum cache size of cached geocode data. */
    MaxCacheSize: 3000,

    /** Maximum cache overflow of cached geocode data to kick the cache reducing. */
    MaxCacheSizeOverflow: 100,
};

export const BingSettings = {
    /** Maximum Bing requests at once. The Bing have limit how many request at once you can do per socket. */
    MaxBingRequest: 6,

    // Add your Bing key here
    BingKey: process.env.TEST_BING_KEY
};

export class GlobeMapSettings extends DataViewObjectsParser {
    public dataPoint: DataPointSettings = new DataPointSettings();
}

export class GlobeMapSettingsModel extends FormattingSettingsModel {
    dataPoint = new DataPointSettings();
    cards = [this.dataPoint];

    populateDataPointColorSelector(globeMapData: GlobeMapData) {
        const slices: FormattingSettingsSlice[] = this.dataPoint.slices;
        if (slices && globeMapData && globeMapData.seriesDataPoints) {
            globeMapData.seriesDataPoints.forEach(dataPoint => {
                if(slices.some((dataPointColorSelector: FormattingSettingsSlice) => dataPointColorSelector.displayName === dataPoint.label)){
                    return;
                }
                slices.push(new formattingSettings.ColorPicker({
                    name: "fill",
                    displayName: dataPoint.label,
                    value: { value: dataPoint.color },
                    selector: ColorHelper.normalizeSelector((dataPoint.identity as ISelectionId).getSelector())
                }));
            });
        }
    }
}

export class DataPointSettings extends FormattingSettingsCard {
    
    defaultColor = new formattingSettings.ColorPicker({
        name: "defaultColor",
        displayName: "Default color",
        displayNameKey: "Visual_DefaultColor",
        value: { value: "#118DFF" }
    });

    name = "dataPoint";
    displayName = "Data colors";
    displayNameKey = "Visual_DataPoint";
    slices = [this.defaultColor];
}