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

module powerbi.extensibility.visual {
    import SelectableDataPoint = powerbi.extensibility.utils.interactivity.SelectableDataPoint;
    import IInteractivityService = powerbi.extensibility.utils.interactivity.IInteractivityService;
    import IAxisProperties = powerbi.extensibility.utils.chart.axis.IAxisProperties;
    import IValueFormatter = powerbi.extensibility.utils.formatting.IValueFormatter;

    export interface GlobeMapData {
        dataView: DataView;
        settings: GlobeMapSettings;
        dataPoints: GlobeMapDataPoint[];
        seriesDataPoints: GlobeMapSeriesDataPoint[];
    }

    export interface GlobeMapDataPoint {
        location: ILocation;
        place: string;
        locationType: string;
        placeKey: string;
        height: number;
        heightBySeries: number[];
        seriesToolTipData: any[];
        heat: number;
        toolTipData: any;
    }

    export interface GlobeMapSeriesDataPoint extends SelectableDataPoint {
        label: string;
        color: string;
        category?: string;
    }
}


