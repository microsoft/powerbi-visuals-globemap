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

import powerbi from "powerbi-visuals-api";

import DataView = powerbi.DataView;
import ValueTypeDescriptor = powerbi.ValueTypeDescriptor;

import { interactivitySelectionService } from "powerbi-visuals-utils-interactivityutils";
import SelectableDataPoint = interactivitySelectionService.SelectableDataPoint;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import { GlobeMapSettings } from "../settings";
import { IGeocodeCoordinate } from "./locationInterfaces";

export interface GlobeMapData {
    dataView: DataView;
    settings: GlobeMapSettings;
    dataPoints: GlobeMapDataPoint[];
    seriesDataPoints: GlobeMapSeriesDataPoint[];
}

export interface GlobeMapDataPoint {
    location: IGeocodeCoordinate;
    place: string;
    locationType: string;
    placeKey: string;
    height: number;
    heightBySeries: number[];
    seriesToolTipData: Record<string, unknown>;
    heat: number;
    toolTipData: Record<string, unknown>;
}

export interface GlobeMapSeriesDataPoint extends SelectableDataPoint {
    label: string;
    color: string;
    category?: string;
}

export interface TileMap {
    [quadKey: string]: string;
}

export interface ICanvasCoordinate {
    x: number;
    y: number;
}

export interface IGlobeMapValueTypeDescriptor extends ValueTypeDescriptor {
    category: string;
}

export interface IGlobeMapToolTipData {
    location: VisualTooltipDataItem;
    longitude: VisualTooltipDataItem;
    latitude: VisualTooltipDataItem;
    series: VisualTooltipDataItem;
    height: VisualTooltipDataItem;
    heat: VisualTooltipDataItem;
}

export interface IGlobeMapObject3DWithToolTipData extends THREE.Object3D {
    toolTipData: IGlobeMapToolTipData;
    identity: ISelectionId;
    label: string;
}

export interface ITileGapObject {
    gaps: number[][];
    rank: number;
}
