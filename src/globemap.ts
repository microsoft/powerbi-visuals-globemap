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
import "./../style/globemap.less";

import powerbi from "powerbi-visuals-api";

import isEmpty from "lodash.isempty";

import * as THREE from "three";
import { OrbitControls } from "./lib/Three/OrbitControls";

import IPromise = powerbi.IPromise;
import DataView = powerbi.DataView;
import VisualEventType = powerbi.VisualEventType;
import PrimitiveValue = powerbi.PrimitiveValue;
import DataViewValueColumn = powerbi.DataViewValueColumn;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import DataViewValueColumns = powerbi.DataViewValueColumns;
import DataViewValueColumnGroup = powerbi.DataViewValueColumnGroup;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;
import DataViewObjectPropertyIdentifier = powerbi.DataViewObjectPropertyIdentifier;

import ISelectionId = powerbi.visuals.ISelectionId;

import IVisual = powerbi.extensibility.IVisual;
import IVisualLocalStorageV2Service = powerbi.extensibility.IVisualLocalStorageV2Service;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import IColorPalette = powerbi.extensibility.IColorPalette;
import TooltipHideOptions = powerbi.extensibility.TooltipHideOptions;
import TooltipShowOptions = powerbi.extensibility.TooltipShowOptions;
import ITooltipService = powerbi.extensibility.ITooltipService;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import ILocalizationManager = powerbi.extensibility.ILocalizationManager;

import VisualUpdateType = powerbi.VisualUpdateType;

import SubSelectionStylesType = powerbi.visuals.SubSelectionStylesType;
import CustomVisualSubSelection = powerbi.visuals.CustomVisualSubSelection;
import CustomVisualObject = powerbi.visuals.CustomVisualObject;
import SubSelectionStyles = powerbi.visuals.SubSelectionStyles;
import VisualSubSelectionShortcuts = powerbi.visuals.VisualSubSelectionShortcuts;
import VisualShortcutType = powerbi.visuals.VisualShortcutType;
import SubSelectionRegionOutline = powerbi.visuals.SubSelectionRegionOutline;
import SubSelectionOutlineVisibility = powerbi.visuals.SubSelectionOutlineVisibility;
import ArcSubSelectionOutline = powerbi.visuals.ArcSubSelectionOutline;
import SubSelectionOutlineType = powerbi.visuals.SubSelectionOutlineType;

import { GlobeMapSettings, GlobeMapSettingsModel, DataPointReferences } from "./settings";
import { VisualLayout } from "./visualLayout";
import { GlobeMapCategoricalColumns, GlobeMapColumns } from "./columns";
import {
    GlobeMapData,
    GlobeMapDataPoint,
    GlobeMapSeriesDataPoint,
    ITileGapObject,
    TileMap,
    IGlobeMapValueTypeDescriptor,
    IGlobeMapObject3DWithToolTipData,
    ICanvasCoordinate
} from "./interfaces/dataInterfaces";
import {
    BingResourceMetadata,
    BingMetadata
} from "./interfaces/bingInterfaces";
import { CacheManager } from "./cache/CacheManager";
import { BingSettings } from "./settings";

const WebGLHeatmap = require("./lib/WebGLHeatmap");

import ISelectionManager = powerbi.extensibility.ISelectionManager;
import { Selection as d3Selection, select as d3Select } from "d3-selection";

type Selection<T1, T2 = T1> = d3Selection<any, T1, any, T2>;

interface GlobeMapHeatMapClass {
    display: () => void;
    blur: () => void;
    update: () => void;
    clear: () => void;
    addPoint: (x: number, y: number, heatPointSize: number, heatIntensity: number) => void;
    canvas: HTMLVideoElement;
}

import { ILocationDictionary, IGeocodeCoordinate, ILocationKeyDictionary } from "./interfaces/locationInterfaces";

import { converterHelper } from "powerbi-visuals-utils-dataviewutils";

import { ColorHelper } from "powerbi-visuals-utils-colorutils";

import { IValueFormatter } from "powerbi-visuals-utils-formattingutils/lib/src/valueFormatter";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";

import { Geometry } from "./lib/Three/Geometry";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";

export class GlobeMap implements IVisual {
    private mouseDownTime: number;
    private localStorageService: IVisualLocalStorageV2Service;
    public static MercatorSphere: Geometry;
    private GlobeSettings = {
        autoRotate: false,
        earthRadius: 30,
        cameraRadius: 100,
        earthSegments: 100,
        heatmapSize: 1024,
        heatIntensity: 10,
        minHeatIntensity: 3.5,
        maxHeatIntensity: 10,
        heatPointSize: 7,
        minHeatPointSize: 2.8,
        maxHeatPointSize: 7,
        heatmapScaleOnZoom: 0.96,
        barWidth: 0.3,
        minBarWidth: 0.1,
        maxBarWidth: 0.3,
        barWidthScaleOnZoom: 0.96,
        barHeight: 5,
        minBarHeight: 1.75,
        maxBarHeight: 5,
        barHeightScaleOnZoom: 0.96,
        rotateSpeed: 0.5,
        zoomSpeed: 0.8,
        cameraAnimDuration: 1000, // ms
        clickInterval: 200 // ms
    };
    
    private static DataPointFillProperty: DataViewObjectPropertyIdentifier = {
        objectName: "dataPoint",
        propertyName: "fill"
    };
    private static CountTilesPerSegment: number = 4;
    private layout: VisualLayout;
    private root: HTMLElement;
    private rendererContainer: HTMLElement;
    private rendererCanvas: HTMLElement;
    public camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private orbitControls: OrbitControls;
    private earth: THREE.Mesh | { material };
    private data: GlobeMapData;
    private heatmap: GlobeMapHeatMapClass;
    private heatTexture: THREE.Texture;
    private mapTextures: THREE.Texture[];
    public barsGroup: THREE.Object3D;
    private readyToRender: boolean;
    private deferredRenderTimerId: number;
    public cacheManager: CacheManager;
    private locationsToLoad: number = 0;
    private locationsLoaded: number = 0;
    private initialLocationsLength: number = 0;
    private renderLoopEnabled = true;
    public needsRender = false;
    private mousePosNormalized: THREE.Vector2;
    private mousePos: THREE.Vector2;
    private rayCaster: THREE.Raycaster;
    private selectedBar: THREE.Object3D;
    public hoveredBar: THREE.Object3D;
    private averageBarVector: THREE.Vector3;
    private controlContainer: HTMLElement;
    public colors: IColorPalette;
    private animationFrameId: number;
    private cameraAnimationFrameId: number;
    public visualHost: IVisualHost;
    private localizationManager: ILocalizationManager;

    private formattingSettingsService: FormattingSettingsService;
    public formattingServiceModel: GlobeMapSettingsModel;

    public visualOnObjectFormatting: powerbi.extensibility.visual.VisualOnObjectFormatting;
    private formatMode: boolean = false;
    private pressKey: boolean = false;
    private barFromMouseDown: THREE.Object3D;
    public subSelectedBar: IGlobeMapObject3DWithToolTipData;
    private subSelectionService: powerbi.extensibility.IVisualSubSelectionService;
    public subSelectionRegionOutlines: Map<SubSelectionOutlineVisibility, SubSelectionRegionOutline>; 

    private isFirstLoad: boolean = true;

    private tooltipService: ITooltipService;
    private static datapointShiftPoint: number = 0.01;
    private events: IVisualEventService;

    private rootSelection: Selection<any>;
    private selectionManager: ISelectionManager;

    // eslint-disable-next-line max-lines-per-function
    public static converter(dataView: DataView, colors: IColorPalette, visualHost: IVisualHost, formattingSettingsModel: GlobeMapSettingsModel): GlobeMapData {
        const categorical: GlobeMapColumns<GlobeMapCategoricalColumns> = GlobeMapColumns.getCategoricalColumns(dataView);
        const settings: GlobeMapSettings = GlobeMap.parseSettings(dataView);

        if (!categorical
            || !categorical.Location
            || isEmpty(categorical.Location.values) && (isEmpty(categorical.X) || isEmpty(categorical.Y))) {
            return {
                dataView: dataView,
                dataPoints: [],
                seriesDataPoints: [],
                settings: settings
            };
        }

        const groupedColumns: GlobeMapColumns<DataViewValueColumn>[] = GlobeMapColumns.getGroupedValueColumns(dataView);
        const dataPoints: GlobeMapDataPoint[] = [];
        let seriesDataPoints: GlobeMapSeriesDataPoint[] = [];
        let locations: PrimitiveValue[] = [];
        const colorHelper: ColorHelper = new ColorHelper(colors, GlobeMap.DataPointFillProperty);
        let locationType: string;
        let heights: number[];
        let heightsBySeries: number[] | number[][];
        let toolTipDataBySeries: Record<string, unknown>[];
        let heats: number[];

        if (categorical.Location
            && categorical.Location.values
            && !Array.isArray(categorical.Location)
            && categorical.Location.source
        ) {
            locations = categorical.Location.values;

            const sourceType: IGlobeMapValueTypeDescriptor = <IGlobeMapValueTypeDescriptor>categorical.Location.source.type;

            locationType = sourceType.category
                ? `${sourceType.category}`.toLowerCase()
                : "";
        } else {
            locations = [];
            if (categorical.X && categorical.Y && categorical.X.values && categorical.Y.values) {
                locations = new Array(categorical.X.values.length);
            }
        }
        if (!isEmpty(categorical.Height)) {
            if (groupedColumns.length > 1) {
                heights = [];
                heightsBySeries = [];
                toolTipDataBySeries = [];
                seriesDataPoints = [];
                // creating a matrix for drawing values by series later.
                for (let i: number = 0; i < groupedColumns.length; i++) {
                    const values: number[] = <number[]>groupedColumns[i].Height.values;
                    const dataPointsParams = {
                        dataView: dataView,
                        source: groupedColumns[i].Height.source,
                        seriesIndex: i,
                        metaData: null,
                        colorHelper: colorHelper,
                        colors: colors,
                        visualHost: visualHost,
                        catIndex: null,
                        settings: formattingSettingsModel
                    };
                    seriesDataPoints[i] = GlobeMap.createDataPointForEnumeration(dataPointsParams);
                    for (let j: number = 0; j < values.length; j++) {
                        if (!heights[j]) {
                            heights[j] = 0;
                        }
                        heights[j] += values[j] ? values[j] : 0;
                        if (!heightsBySeries[j]) {
                            heightsBySeries[j] = <number[]>[];
                        }
                        heightsBySeries[j][i] = values[j];
                        if (!toolTipDataBySeries[j]) {
                            toolTipDataBySeries[j] = {};
                        }

                        const displayName = categorical.Series && "source" in categorical.Series ? categorical.Series.source.displayName : "";
                        toolTipDataBySeries[j][i] = {
                            displayName: displayName,
                            value: dataView.categorical.values.grouped()[i].name,
                            dataPointValue: values[j]
                        };
                    }
                }
                for (let i: number = 0; i < groupedColumns.length; i++) {
                    const values: number[] = <number[]>groupedColumns[i].Height.values;
                    for (let j: number = 0; j < values.length; j++) {
                        // calculating relative size of series
                        heightsBySeries[j][i] = <number>values[j] / <number>heights[j];
                    }
                }
            } else {
                heights = <number[]>categorical.Height[0].values;
                heightsBySeries = [];
            }
        } else {
            heightsBySeries = [];
            heights = [];
            if (categorical.Location && categorical.Location.values || categorical.X && categorical.Y && categorical.X.values && categorical.Y.values) {
                let heightsLength: number = 0;
                if (categorical.Location && categorical.Location.values?.length > 0) {
                    heightsLength = categorical.Location.values.length;
                } else if (categorical.X && categorical.X.values?.length > 0) {
                    heightsLength = categorical.X.values.length;
                }

                for (let i = 0; i < heightsLength; i++) {
                    heights.push(1);
                }
            }
        }
        if (!isEmpty(categorical.Heat)) {
            if (groupedColumns.length > 1) {
                heats = [];
                for (let i: number = 0; i < groupedColumns.length; i++) {
                    const values: number[] = <number[]>groupedColumns[i].Heat.values;
                    for (let j = 0; j < values.length; j++) {
                        if (!heats[j]) {
                            heats[j] = 0;
                        }
                        heats[j] += values[j] ? values[j] : 0;
                    }
                }
            } else {
                heats = <number[]>categorical.Heat[0].values;
            }

        } else {
            heats = [];
        }
        const maxHeight: number = Math.max.apply(null, heights) || 1;
        const maxHeat: number = Math.max.apply(null, heats) || 1;
        const heatFormatter: IValueFormatter = valueFormatter.create({
            format: !isEmpty(categorical.Heat) && categorical.Heat[0].source.format,
            value: heats[0],
            value2: heats[1]
        });
        const heightFormatter = valueFormatter.create({
            format: !isEmpty(categorical.Height) && categorical.Height[0].source.format,
            value: heights[0],
            value2: heights[1]
        });
        const len: number = locations.length;
        for (let i: number = 0; i < len; ++i) {
            if (typeof (locations[i]) === "string" || (categorical.X && categorical.Y && categorical.X.values && categorical.Y.values)) {
                const height: number = <number>heights[i] / maxHeight;
                const heat: number = <number>heats[i] / maxHeat;
                let place: string;
                let placeKey: string;
                let toolTipDataLocationName: string;
                let toolTipDataLongName: string;
                let toolTipDataLatName: string;
                let location: IGeocodeCoordinate;
                let locationValue: string;
                let displayName: PrimitiveValue;

                const tooltipLongitude = categorical.X && "source" in categorical.X && categorical.X.source && categorical.X.source.displayName;
                const tooltipLatitiude = categorical.Y && "source" in categorical.Y && categorical.Y.source && categorical.Y.source.displayName;
                const tooltipLocation = categorical.Location && "source" in categorical.Location && categorical.Location.source.displayName;

                if (typeof (locations[i]) === "string") {
                    place = `${locations[i]}`.toLowerCase();
                    placeKey = `${place} / ${locationType}`;
                    location = (!isEmpty(categorical.X) && !isEmpty(categorical.Y))
                        ? { longitude: <number>categorical.X[0].values[i] || 0, latitude: <number>categorical.Y[0].values[i] || 0 }
                        : undefined;
                    toolTipDataLocationName = tooltipLocation;
                    locationValue = `${locations[i]}`;
                    displayName = locations[i];
                } else {
                    location = (!isEmpty(categorical.X) && !isEmpty(categorical.Y))
                        ? { longitude: <number>categorical.X.values[i] || 0, latitude: <number>categorical.Y.values[i] || 0 }
                        : undefined;
                    place = location ? `${categorical.X.values[i]} ${categorical.Y.values[i]}` : undefined;
                    placeKey = location ? `${categorical.X.values[i]} ${categorical.Y.values[i]}` : undefined;
                    toolTipDataLongName = tooltipLongitude;
                    toolTipDataLatName = tooltipLatitiude;
                    locationValue = "";
                    displayName = location ? `${categorical.X.values[i]}, ${categorical.Y.values[i]}` : undefined;
                }

                let longitudeValue: string;
                let latitudeValue: string;

                if(!Array.isArray(categorical.X)) {
                    longitudeValue = GlobeMap.getCategoricalValueByIndex(categorical.X, i);
                }

                if(!Array.isArray(categorical.Y)) {
                    latitudeValue = GlobeMap.getCategoricalValueByIndex(categorical.Y, i);
                }

                const renderDatum: GlobeMapDataPoint = {
                    location: location,
                    placeKey: placeKey,
                    place: place,
                    locationType: locationType,
                    height: height ? height || GlobeMap.datapointShiftPoint : undefined,
                    heightBySeries: <number[]>heightsBySeries[i],
                    seriesToolTipData: toolTipDataBySeries ? toolTipDataBySeries[i] : undefined,
                    heat: heat || 0,
                    toolTipData: {
                        location: { displayName: !isEmpty(toolTipDataLocationName) && toolTipDataLocationName, value: locationValue },
                        longitude: { displayName: !isEmpty(toolTipDataLongName) && toolTipDataLongName, value: longitudeValue },
                        latitude: { displayName: !isEmpty(toolTipDataLatName) && toolTipDataLatName, value: latitudeValue },
                        height: { displayName: !isEmpty(categorical.Height) && categorical.Height[0].source.displayName, value: heightFormatter.format(heights[i]) },
                        heat: { displayName: !isEmpty(categorical.Heat) && categorical.Heat[0].source.displayName, value: heatFormatter.format(heats[i]) }
                    }
                };
                dataPoints.push(renderDatum);

                const source = {...groupedColumns?.[0].Height?.source, displayName: displayName};
                const dataPointsParams = {
                    dataView: dataView,
                    source: source,
                    seriesIndex: 0,
                    metaData: dataView.metadata,
                    colorHelper: colorHelper,
                    colors: colors,
                    visualHost: visualHost,
                    catIndex: i,
                    settings: formattingSettingsModel
                };
                seriesDataPoints[i] = GlobeMap.createDataPointForEnumeration(dataPointsParams);
            }
        }
        return {
            dataView: dataView,
            dataPoints: dataPoints,
            seriesDataPoints: seriesDataPoints,
            settings: settings
        };
    }

    private static parseSettings(dataView: DataView): GlobeMapSettings {
        return GlobeMapSettings.parse(dataView) as GlobeMapSettings;
    }

    private static createDataPointForEnumeration(dataPointsParams: { dataView, seriesIndex, source, visualHost, catIndex, metaData, colorHelper, settings }): GlobeMapSeriesDataPoint {
        let sourceForFormat: DataViewMetadataColumn = dataPointsParams.source;
        let nameForFormat: PrimitiveValue = dataPointsParams.source.displayName;

        if (dataPointsParams.source.groupName !== undefined) {
            const columns: DataViewValueColumnGroup = dataPointsParams.dataView.categorical.values.grouped()[dataPointsParams.seriesIndex];
            const values: DataViewValueColumns = <DataViewValueColumns>columns.values;
            sourceForFormat = values.source;
            nameForFormat = dataPointsParams.source.groupName;
        }

        const label: string = valueFormatter.format(nameForFormat, valueFormatter.getFormatString(sourceForFormat, null));

        const categoryColumn: DataViewCategoryColumn = dataPointsParams.dataView
            && dataPointsParams.dataView.categorical
            && dataPointsParams.dataView.categorical.categories
            && dataPointsParams.dataView.categorical.categories[0];

        const identity: ISelectionId =
            dataPointsParams.visualHost.createSelectionIdBuilder()
                .withCategory(categoryColumn, dataPointsParams.catIndex)
                .createSelectionId();

        const category: string = `${converterHelper.getSeriesName(dataPointsParams.source)}`;
        const objects = categoryColumn && categoryColumn.objects;
        let color: string = (
            objects && objects[dataPointsParams.catIndex] && objects[dataPointsParams.catIndex].dataPoint 
                ? objects[dataPointsParams.catIndex].dataPoint.fill["solid"].color 
                : dataPointsParams.settings.dataPoint.defaultColor.value.value);

        if (dataPointsParams.colorHelper.isHighContrast) {
            color = dataPointsParams.colorHelper.getHighContrastColor("foreground", color);
        }

        return {
            label: label,
            identity: identity,
            category: category,
            color: color,
            selected: null
        };
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel { 
        this.formattingServiceModel.populateDataPointColorSelector(this.data);
        return this.formattingSettingsService.buildFormattingModel(this.formattingServiceModel);
    }

    constructor(options: VisualConstructorOptions) {       
        this.currentLanguage = options.host.locale;
        this.localStorageService = options.host.storageV2Service;
        this.events = options.host.eventService;

        this.root = options.element;
        this.root.setAttribute("drag-resize-disabled", "true");
        this.root.style.position = "absolute";

        this.rootSelection = d3Select(this.root);

        this.visualHost = options.host;
        this.visualHost.telemetry.trace(VisualEventType.Trace, 'bing load coordinates');
        this.tooltipService = this.visualHost.tooltipService;

        this.localizationManager = this.visualHost.createLocalizationManager();
        this.formattingSettingsService = new FormattingSettingsService(this.localizationManager);

        this.subSelectionService = this.visualHost.subSelectionService;
        this.selectionManager = this.visualHost.createSelectionManager();

        this.layout = new VisualLayout();
        this.readyToRender = false;
        this.cacheManager = new CacheManager(this.localStorageService);
        this.colors = options.host.colorPalette;
        this.subSelectionRegionOutlines = new Map<SubSelectionOutlineVisibility, SubSelectionRegionOutline>();
        this.visualOnObjectFormatting = {
            getSubSelectionStyles: (subSelections) => this.getSubSelectionStyles(subSelections),
            getSubSelectionShortcuts: (subSelections) => this.getSubSelectionShortcuts(subSelections),
            getSubSelectables: () => this.getSubSelectables()
        };
        this.setup();
    }

    private getSubSelectables(): CustomVisualSubSelection[] | undefined {
        return this.data?.seriesDataPoints.map((dataPoint: GlobeMapSeriesDataPoint) => this.createSubSelectionForDataPoint(dataPoint));
    }

    private createSubSelectionForDataPoint(dataPoint: GlobeMapSeriesDataPoint | IGlobeMapObject3DWithToolTipData, showUI: boolean = false, event?: MouseEvent): CustomVisualSubSelection {
        const customVisualObjects: CustomVisualObject[] = [];
        if (dataPoint){
            const customVisualObject: CustomVisualObject = {
                objectName: DataPointReferences.fill.objectName,
                selectionId: dataPoint.identity as powerbi.visuals.ISelectionId
            };
            customVisualObjects.push(customVisualObject);
        }

        const dataPointSubSelection: CustomVisualSubSelection = {
            customVisualObjects,
            displayName: dataPoint ? dataPoint.label : "",
            subSelectionType: SubSelectionStylesType.Shape,
            showUI,
            selectionOrigin: {
                x: event ? event.clientX : 0,
                y: event ? event.clientY : 0
            }
        };

        return dataPointSubSelection;
    }

    private getSubSelectionStyles(subSelections: CustomVisualSubSelection[]): SubSelectionStyles | undefined {
        const visualObject = subSelections[0]?.customVisualObjects[0];
        if (visualObject) {
            switch (visualObject.objectName) {
                case DataPointReferences.fill.objectName:
                    return this.getDataPointStyles(subSelections);
            }
        }
    }

    private getDataPointStyles(subSelections: CustomVisualSubSelection[]): SubSelectionStyles {
        const selector = subSelections[0].customVisualObjects[0].selectionId?.getSelector();
        return {
            type: SubSelectionStylesType.Shape,
            fill: {
                reference: {
                    ...DataPointReferences.fill,
                    selector
                },
                label: this.localizationManager.getDisplayName("Visual_Fill")
            },
        };
    }

    private getSubSelectionShortcuts(subSelections: CustomVisualSubSelection[]): VisualSubSelectionShortcuts | undefined {
        const visualObject = subSelections[0]?.customVisualObjects[0];
        if (visualObject) {
            switch (visualObject.objectName) {
                case DataPointReferences.fill.objectName:
                    return this.getDataPointShortcuts(subSelections);
            }
        }
    }

    private getDataPointShortcuts(subSelections: CustomVisualSubSelection[]): VisualSubSelectionShortcuts {
        const selectionId: powerbi.visuals.ISelectionId = subSelections[0].customVisualObjects[0].selectionId;
        const selector = selectionId?.getSelector();
        return [
            {
                type: VisualShortcutType.Reset,
                relatedResetFormattingIds: [{
                    ...DataPointReferences.fill,
                    selector
                }]
            },
            {
                type: VisualShortcutType.Navigate,
                destinationInfo: { cardUid: DataPointReferences.cardUid },
                label: this.localizationManager.getDisplayName("Visual_OnObject_FormatDataPoint")
            }
        ];
    }

    private setup(): void {
        this.initScene();
        this.initMercartorSphere();
        this.initTextures().then(
            () => {
                this.earth = this.createEarth();
                this.scene.add(<THREE.Mesh>this.earth);
                this.readyToRender = true;
            });
        this.initZoomControl();
        this.initHeatmap();
        this.initRayCaster();
        this.handleContextMenu();
    }
    private static cameraFov: number = 35;
    private static cameraNear: number = 0.1;
    private static cameraFar: number = 10000;
    private static clearColor: number = 0xbac4d2;
    private static ambientLight: number = 0xffffff;
    private static directionalLight: number = 0xffffff;
    private static directionalLightIntensity: number = 2;
    private static tileSize: number = 256;
    private static initialResolutionLevel: number = 2;
    private static maxResolutionLevel: number = 5;
    private static metadataUrl: string = `https://dev.virtualearth.net/REST/V1/Imagery/Metadata/RoadOnDemand?output=json&uriScheme=https&key=${BingSettings.BingKey}`;
    private static reserveBindMapsMetadata: BingResourceMetadata = {
        imageUrl: "https://{subdomain}.ssl.ak.dynamic.tiles.virtualearth.net/comp/ch/{quadkey}?mkt={culture}&it=G,L&og=2310&n=z",
        imageUrlSubdomains: [
            "t0",
            "t1",
            "t2",
            "t3"
        ],
        imageHeight: 256,
        imageWidth: 256
    };
    private currentLanguage: string = "en-GB";
    private static TILE_STORAGE_KEY = "GLOBEMAP_TILES_STORAGE";

    private initScene(): void {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        
        this.rendererContainer = document.createElement("div");
        this.rendererContainer.classList.add("globeMapView");

        this.root.append(this.rendererContainer);

        this.rendererContainer.append(this.renderer.domElement);
        this.rendererCanvas = this.renderer.domElement;
        this.camera = new THREE.PerspectiveCamera(
            GlobeMap.cameraFov,
            this.layout.viewportIn.width / this.layout.viewportIn.height,
            GlobeMap.cameraNear,
            GlobeMap.cameraFar);
        this.orbitControls = new OrbitControls(this.camera, this.rendererCanvas);
        this.orbitControls.enablePan = false;
        this.scene = new THREE.Scene();

        this.renderer.setSize(this.layout.viewportIn.width, this.layout.viewportIn.height);
        this.renderer.setClearColor(GlobeMap.clearColor, 1);
        this.camera.position.z = this.GlobeSettings.cameraRadius;
        this.orbitControls.maxDistance = this.GlobeSettings.cameraRadius;
        this.orbitControls.minDistance = this.GlobeSettings.earthRadius + 5;
        this.orbitControls.rotateSpeed = this.GlobeSettings.rotateSpeed;
        this.orbitControls.zoomSpeed = this.GlobeSettings.zoomSpeed;
        this.orbitControls.autoRotate = this.GlobeSettings.autoRotate;

        const ambientLight: THREE.AmbientLight = new THREE.AmbientLight(GlobeMap.ambientLight);
        const light1: THREE.DirectionalLight = new THREE.DirectionalLight(GlobeMap.directionalLight, GlobeMap.directionalLightIntensity);
        const light2: THREE.DirectionalLight = new THREE.DirectionalLight(GlobeMap.directionalLight, GlobeMap.directionalLightIntensity);

        this.scene.add(ambientLight);
        this.scene.add(light1);
        this.scene.add(light2);

        light1.position.set(20, 20, 20);
        light2.position.set(0, 0, -20);

        const render: FrameRequestCallback = () => {
            try {
                if (this.renderLoopEnabled) {
                    this.animationFrameId = requestAnimationFrame(render);
                }
                if (!this.shouldRender()) {
                    return;
                }
                this.orbitControls.update();
                this.setEarthTexture();
                if (this.heatmap && this.heatmap.display) {
                    this.heatmap.display(); // Needed for IE/Edge to behave nicely
                }
                this.renderer.render(this.scene, this.camera);
                this.intersectBars();
                this.needsRender = false;

                if (this.formatMode){
                    this.formatModeShowActiveOutlines();
                    this.renderOutlines();
                }

            } catch (e) {
                console.error(`Render error: ${e}`);
            }
        };

        this.animationFrameId = requestAnimationFrame(render);
    }

    private shouldRender(): boolean {
        return this.readyToRender && this.needsRender;
    }

    private createEarth(): THREE.Mesh {
        const geometry: Geometry = new Geometry(
            this.GlobeSettings.earthRadius,
            this.GlobeSettings.earthSegments,
            this.GlobeSettings.earthSegments);
        const material: THREE.MeshPhongMaterial = new THREE.MeshPhongMaterial({
            map: this.mapTextures[0],
            side: THREE.DoubleSide,
            flatShading: false,
            shininess: 1
        });

        const mesh: THREE.Mesh = new THREE.Mesh(geometry.toBufferGeometry(), material);
        mesh.add(new THREE.AmbientLight(0xaaaaaa, 1));

        return mesh;
    }

    private static dollyX: number = 0.95;
    public zoomClicked(zoomDirection: number): void {
        if (this.orbitControls.enabled === false) {
            return;
        }

        if (zoomDirection === 1) {
            this.orbitControls.dollyOut(Math.pow(GlobeMap.dollyX, this.GlobeSettings.zoomSpeed));
        } else if (zoomDirection === -1) {
            this.orbitControls.dollyIn(Math.pow(GlobeMap.dollyX, this.GlobeSettings.zoomSpeed));
        }

        this.updateBarsAndHeatMapByZoom(-zoomDirection);
        this.orbitControls.update();
        this.animateCamera(this.camera.position);

        if (this.formatMode){
            this.subSelectionRegionOutlines.delete(SubSelectionOutlineVisibility.Hover);
            this.needsRender = true;
        }
    }

    public rotateCam(deltaX: number, deltaY: number): void {
        if (!this.orbitControls.enabled) {
            return;
        }
        if (this.formatMode) {
            this.subSelectionRegionOutlines.delete(SubSelectionOutlineVisibility.Hover);
            this.needsRender = true;
        }
        this.orbitControls.rotateLeft(2 * Math.PI * deltaX / this.rendererCanvas.offsetHeight * this.GlobeSettings.rotateSpeed);
        this.orbitControls.rotateUp(2 * Math.PI * deltaY / this.rendererCanvas.offsetHeight * this.GlobeSettings.rotateSpeed);
        this.orbitControls.update();
        this.animateCamera(this.camera.position);
    }

    public static minimizeTiles(tileCacheArray: TileMap[]): ITileGapObject[] {
        if (!tileCacheArray || !tileCacheArray.length) {
            return [];
        }

        const result = [];
        tileCacheArray.forEach(obj => {
            let rank: number = 0, lastKey: number = Number(Object.keys(obj)[0]);
            let gap: number[] = [lastKey];
            const gaps = [];
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    rank = key.length;
                    const convertedKey: number = Number(key);
                    if (Math.abs(convertedKey - lastKey) > 1) {
                        gap.push(lastKey);
                        gaps.push(gap);
                        gap = [convertedKey];
                    }
                    lastKey = convertedKey;
                }
            }
            gap.push(lastKey);
            gaps.push(gap);
            const currentZoomTiles: ITileGapObject = {
                gaps,
                rank
            };
            result.push(currentZoomTiles);
        });

        return result;
    }

    public extendTiles(tileCacheData: string, language: string): Promise<TileMap[]> {
        const result: TileMap[] = [];
    
        return new Promise<TileMap[]>((resolve, reject) => {
            if (!tileCacheData || !tileCacheData.length) {
                resolve(result);
                return;
            }

            const tileCacheArray: ITileGapObject[] = JSON.parse(tileCacheData);
            if (!tileCacheArray || !Array.isArray(tileCacheArray) || !tileCacheArray.length) {
                resolve(result);
                return;
            }

            this.getBingMapsServerMetadata()
                .then((metadata: BingResourceMetadata) => {
                    const urlTemplate = metadata.imageUrl.replace("{culture}", language).replace("&shading=hill", "");
                    const subdomains = metadata.imageUrlSubdomains;

                    tileCacheArray?.forEach((zoomArray: ITileGapObject) => {
                        const rank: number = zoomArray.rank;
                        const gaps = zoomArray.gaps;
                        const resultForCurrentZoom = {};
                        gaps?.forEach((gap: number[]) => {
                            for (let gapItem = gap[0]; gapItem <= gap[gap.length-1]; gapItem++) {
                                // last number in current gapItem is used as its subdomain index
                                const subdomainIndex: number = gapItem % 10; 
                                let stringGap: string = gapItem.toString();
                                while (stringGap.length < rank) {
                                    stringGap = `0${stringGap}`;
                                }
                                resultForCurrentZoom[stringGap] = urlTemplate.replace("{subdomain}", subdomains[subdomainIndex]).replace("{quadkey}", stringGap);
                            }
                        });
                        result.push(resultForCurrentZoom);
                    });

                    resolve(result);
                })
                .catch(() => {
                    reject("Bing Map service metadata loading error");
                });
        });
    }

    private loadFromBing(language: string): Promise<TileMap[]> {
        const tileCacheValue: TileMap[] = [];

        return this.getBingMapsServerMetadata()
                .then((metadata: BingResourceMetadata) => {
                    const urlTemplate = metadata.imageUrl.replace("{culture}", language).replace("&shading=hill", "");

                    for (let level: number = GlobeMap.initialResolutionLevel; level <= GlobeMap.maxResolutionLevel; ++level) {
                        const levelTiles = GlobeMap.generateQuadsByLevel(level, urlTemplate, metadata.imageUrlSubdomains);
                        tileCacheValue.push(levelTiles);
                    }

                    const minimizedTileCacheData: string = JSON.stringify(GlobeMap.minimizeTiles(tileCacheValue));
                    this.localStorageService.set(`${GlobeMap.TILE_STORAGE_KEY}_${language}`, minimizedTileCacheData);

                    return tileCacheValue;
                }).catch(() => {                    
                    return tileCacheValue;
                });
    }

    private getTilesData(language: string): Promise<Record<string, unknown>[] | TileMap[]> {
        return new Promise<Record<string, unknown>[] | TileMap[]>((resolve, reject) => {
            const tileCachePromise: IPromise<string> = this.localStorageService.get(`${GlobeMap.TILE_STORAGE_KEY}_${language}`);

            tileCachePromise.then(data => {
                this.extendTiles(data, this.currentLanguage)
                    .then((tilesData) => {
                        if (!tilesData || tilesData.length === 0) {
                            throw "No tiles in cache, will try to load from Bing"; 
                        }
                        resolve(tilesData);
                    })
                    .catch(() => {
                        this.loadFromBing(language)
                            .then((bingData) => resolve(bingData))
                            .catch((e) => reject(`Tiles loading from Bing error: ${e}`));
                    })
            }).catch(() => {
                this.loadFromBing(language)
                    .then((bingData) => resolve(bingData))
                    .catch((e) => reject(`Tiles loading from Bing error: ${e}`));
            });
        })
    }

    private initTextures(): Promise<string> {
        this.mapTextures = [];
        
        return this.getTilesData(this.currentLanguage)
                .then((tiles: TileMap[]) => {                    
                    for (let level: number = GlobeMap.initialResolutionLevel; level <= GlobeMap.maxResolutionLevel; ++level) {
                        this.mapTextures.push(this.createTexture(level, tiles[level - GlobeMap.initialResolutionLevel]));
                    }
                    return "success";
                })
                .catch(() => {                    
                    return "Get tiles error" ;
                });

    }

    private async getBingMapsServerMetadata(): Promise<BingResourceMetadata> {
        let metaData: BingMetadata = {} as BingMetadata;

        try {
            const response = await fetch(GlobeMap.metadataUrl);
            metaData = await response.json();
            if (metaData.resourceSets.length) {
                const resourceSet = metaData.resourceSets[0];
                
                if (resourceSet && resourceSet.resources.length) {
                    return resourceSet.resources[0];
                }
            }
            throw "Bing Maps API response was changed. Please update code for new version";
        }
        catch(e) {
            console.error(`Error occured while retrieving metadata from Bing: ${e}`);  
            return GlobeMap.reserveBindMapsMetadata;   
        } 
    }

    /**
     * Generate Bing tile object by map level
     * @see https://msdn.microsoft.com/en-us/library/bb259689.aspx
     * @private
     * @param {number} level map lavel
     * @param {string} urlTemplate url template
     * @example https://ecn.{subdomain}.tiles.virtualearth.net/tiles/r{quadkey}.jpeg?g=5691&mkt={culture}&shading=hill
     * @param {string[]} subdomains list of subdomauns
     * @returns {{ [quadKey: string]: string }} Object <quadKey> : <image url>
     * @memberOf GlobeMap
     */
    private static generateQuadsByLevel(level: number, urlTemplate: string, subdomains: string[]): TileMap {
        const result: TileMap = {};
        let currentSubDomainNumber: number = 0;
        const generateQuard = (currentLevel: number = 0, quadKey: string = ""): void => {
            if (currentLevel < level) {
                for (let i = 0; i < GlobeMap.CountTilesPerSegment; i++) {
                    generateQuard(currentLevel + 1, `${quadKey}${i}`);
                }
            } else if (currentLevel === level) {
                result[quadKey] = urlTemplate.replace("{subdomain}", subdomains[currentSubDomainNumber]).replace("{quadkey}", quadKey);
                currentSubDomainNumber++;
                currentSubDomainNumber = currentSubDomainNumber < subdomains.length ? currentSubDomainNumber : 0;
            }
        };
        generateQuard();
        return result;
    }

    private createTexture(level: number, tiles: TileMap): THREE.Texture {
        const numSegments: number = Math.pow(2, level);
        const canvasSize: number = GlobeMap.tileSize * numSegments;
        const canvas: HTMLCanvasElement = document.createElement("canvas");
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        const texture: THREE.Texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace;
        this.loadTiles(canvas, tiles, () => {
            texture.needsUpdate = true;
            this.needsRender = true;
        });
        return texture;
    }

    /**
     * Load tiles of Bing Maps
     * @param canvasEl HTML canvas object
     * @param tiles map of tiles
     * @param successCallback call this function when all tiles of the map are successfully loaded
     */
    private loadTiles(canvasEl: HTMLCanvasElement, tiles: TileMap, successCallback: () => void): void {
        let tilesLoaded: number = 0;
        const countTiles: number = tiles && Object.keys(tiles).length;
        const canvasContext: CanvasRenderingContext2D = canvasEl.getContext("2d");
        
        for (const quadKey in tiles) {
            if (Object.prototype.hasOwnProperty.call(tiles, quadKey)) {
                const coords: ICanvasCoordinate = this.getCoordByQuadKey(quadKey);
                const tile: HTMLImageElement = new Image();
                tile.onload = () => {
                    tilesLoaded++;
                    canvasContext.drawImage(tile, coords.x * GlobeMap.tileSize, coords.y * GlobeMap.tileSize, GlobeMap.tileSize, GlobeMap.tileSize);
                    if (tilesLoaded === countTiles) {
                        successCallback();
                    }
                };
                // So the canvas doesn't get tainted
                tile.crossOrigin = "";
                tile.src = tiles[quadKey];
            }
        }
    }

    /**
     * Get coordinates by Bing Maps quard name
     * @private
     * @param {string} quard Bing Maps quard name
     * @returns {CanvasCoordinate} image coordinate
     * @memberOf GlobeMap
     */
    private getCoordByQuadKey(quard: string): ICanvasCoordinate {
        const last: number = quard.length - 1;
        let x: number = 0;
        let y: number = 0;

        for (let i: number = last; i >= 0; i--) {
            const chr: string = quard.charAt(i);
            const pow: number = Math.pow(2, last - i);
            switch (chr) {
                case "1": x += pow; break;
                case "2": y += pow; break;
                case "3": x += pow; y += pow; break;
            }
        }

        return { x: x, y: y };
    }

    private initHeatmap() {
        let heatmap: GlobeMapHeatMapClass;
        try {
            heatmap = this.heatmap = new WebGLHeatmap({ width: this.GlobeSettings.heatmapSize, height: this.GlobeSettings.heatmapSize, intensityToAlpha: true });
        } catch (e) {
            // IE & Edge will throw an error about texImage2D, we need to ignore it
            console.error(e);
        }

        // canvas contents will be used for a texture
        const texture: THREE.Texture = this.heatTexture = new THREE.Texture(heatmap.canvas);
        texture.needsUpdate = true;

        const material: THREE.MeshBasicMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
        const geometry: THREE.SphereGeometry = new THREE.SphereGeometry(this.GlobeSettings.earthRadius + 0.01, this.GlobeSettings.earthSegments, this.GlobeSettings.earthSegments);
        const mesh: THREE.Mesh = new THREE.Mesh(geometry, material);

        window["heatmap"] = heatmap;
        window["heatmapTexture"] = texture;

        this.scene.add(mesh);
    }

    private setEarthTexture(): void {
        // get distance as arbitrary value from 0-1
        if (!this.camera) {
            return;
        }
        const maxDistance: number = this.GlobeSettings.cameraRadius - this.GlobeSettings.earthRadius;
        const distance: number = (this.camera.position.length() - this.GlobeSettings.earthRadius) / maxDistance;
        let texture: THREE.Texture = this.mapTextures[0];
        for (let divider: number = GlobeMap.initialResolutionLevel; divider <= GlobeMap.maxResolutionLevel; divider++) {
            if (distance <= divider / GlobeMap.maxResolutionLevel) {
                texture = this.mapTextures[GlobeMap.maxResolutionLevel - divider];
                break;
            }
        }

        if (this.earth.material.map !== texture) {
            this.earth.material.map = texture;
        }

        if (this.selectedBar) {
            this.orbitControls.rotateSpeed = this.GlobeSettings.rotateSpeed;
        } else {
            this.orbitControls.rotateSpeed = this.GlobeSettings.rotateSpeed * distance;
        }
    }

    public update(options: VisualUpdateOptions) {     
        this.events.renderingStarted(options);
   
        if (options.dataViews === undefined || options.dataViews === null) {
            return;
        }
        this.layout.viewport = options.viewport;

        this.root.style.height = `${this.layout.viewportIn.height.toString()}px`;
        this.root.style.width = `${this.layout.viewportIn.width.toString()}px`;

        this.formattingServiceModel = this.formattingSettingsService.populateFormattingSettingsModel(GlobeMapSettingsModel, options.dataViews[0]);
        this.formatMode = options.formatMode;

        this.controlContainer.setAttribute("style",
            `display: ${this.layout.viewportIn.height > GlobeMap.ZoomControlSettings.height
                && this.layout.viewportIn.width > GlobeMap.ZoomControlSettings.width
                ? null : "none"}`);

        if (this.layout.viewportChanged) {
            if (this.camera && this.renderer) {
                this.camera.aspect = this.layout.viewportIn.width / this.layout.viewportIn.height;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(this.layout.viewportIn.width, this.layout.viewportIn.height);
                this.renderer.render(this.scene, this.camera);
            }
        }

        if (options.type & VisualUpdateType.Data) {
            this.cleanHeatAndBar();
            const data: GlobeMapData = GlobeMap.converter(options.dataViews[0], this.colors, this.visualHost, this.formattingServiceModel);
            if (data) {
                this.data = data;

                const locationsNeedToBeLoaded: ILocationKeyDictionary = {};
                data.dataPoints.forEach((d: GlobeMapDataPoint) => {
                    if (!d.location && d.place)
                        locationsNeedToBeLoaded[d.place] = {
                            place: d.place, locationType: d.locationType
                        };
                });

                this.cacheManager.loadCoordinates(locationsNeedToBeLoaded)
                    .then((coordinates: ILocationDictionary) => {
                        this.data.dataPoints.forEach((d: GlobeMapDataPoint) => {
                            d.location = coordinates[d.place] || d.location;
                        });

                        this.render();
                        this.events.renderingFinished(options);

                        if (Object.keys(coordinates).length > 0) {
                            this.cacheManager.saveCoordinates(coordinates);
                        }

                    }).catch((e) => {
                        console.error("Error occured while loading coordinates", e);
                        this.events.renderingFailed(options);
                    });
            }
        }

        if (this.formatMode && (options.type & (powerbi.VisualUpdateType.Data
            | powerbi.VisualUpdateType.Resize
            | powerbi.VisualUpdateType.FormattingSubSelectionChange))){

            this.updateOutlinesFromSubSelections(options.subSelections);
            this.events.renderingFinished(options);
        }
    }

    private updateOutlinesFromSubSelections(subSelections: CustomVisualSubSelection[]){
        const visualObject = subSelections?.[0]?.customVisualObjects[0];
        if (visualObject) {
            switch (visualObject.objectName) {
                case DataPointReferences.fill.objectName: 
                    this.updateDataPointOutline(subSelections);
            }
        }
    }

    private updateDataPointOutline(subSelections: CustomVisualSubSelection[]): void {
        const selectionId: powerbi.visuals.ISelectionId = subSelections[0].customVisualObjects[0].selectionId;
        if (selectionId){
            const subSelectedBar: IGlobeMapObject3DWithToolTipData = this.subSelectedBar;
            this.needsRender = true;

            //animation for disambiguation menu
            if ((subSelectedBar && !selectionId.equals(subSelectedBar.identity)) || (!subSelectedBar && !this.hoveredBar)){
                const newSelectedBar = this.barsGroup?.children.find((bar: IGlobeMapObject3DWithToolTipData) => selectionId.equals(bar.identity));
                this.subSelectedBar = newSelectedBar as IGlobeMapObject3DWithToolTipData;
                if (this.subSelectedBar) {
                    this.animateCamera(this.subSelectedBar.position);
                }
            }

        }
    }

    private formatModeShowActiveOutlines(): void {
        this.subSelectionRegionOutlines.delete(SubSelectionOutlineVisibility.Active);
        const selectedBar = this.subSelectedBar;
        if (selectedBar && !this.pressKey) {
            const regionOutline: SubSelectionRegionOutline = this.formatModeCreateOutline(selectedBar, SubSelectionOutlineVisibility.Active);
            this.subSelectionRegionOutlines.set(SubSelectionOutlineVisibility.Active, regionOutline);
        }
    }

    private formatModeCreateOutline(bar: IGlobeMapObject3DWithToolTipData, visibility: SubSelectionOutlineVisibility): SubSelectionRegionOutline {
        const barPos = this.worldToScreenPositions(bar);
        const arcOutline: ArcSubSelectionOutline = {
            type: SubSelectionOutlineType.Arc,
            center: {...barPos},
            innerRadius: 0,
            outerRadius: 10,
            startAngle: 0,
            endAngle: 360
        }
            
        const regionOutline: SubSelectionRegionOutline = { 
            id: `${bar.identity.getKey()}`, 
            visibility: visibility, 
            outline: arcOutline
        }; 

        return regionOutline;
    }

    public worldToScreenPositions(bar: THREE.Object3D) {
        const vector = new THREE.Vector3();
        const canvas = this.renderer.domElement;

        bar.updateMatrixWorld();  
        vector.setFromMatrixPosition(bar.matrixWorld);

        vector.project(this.camera); 

        const x = (vector.x + 1) / 2 * canvas.width ;
        const y = -(vector.y - 1) / 2 * canvas.height;
        
        return {x, y};
    }
        
    private renderOutlines(): void { 
        const regionOutlines = Array.from(this.subSelectionRegionOutlines.values());
        this.subSelectionService.updateRegionOutlines(regionOutlines); 
    } 

    public cleanHeatAndBar(): void {
        this.heatmap.clear();
        this.heatTexture.needsUpdate = true;
        if (this.barsGroup) {
            this.scene.remove(this.barsGroup);
        }
    }

    private render(): void {
        if (!this.data) {
            return;
        }

        if (!this.readyToRender) {
            this.defferedRender();
            return;
        }

        this.updateBarsAndHeatMapByZoom();

        if (this.barsGroup.children.length > 0 && this.camera && (this.initialLocationsLength !== this.barsGroup.children.length || this.barsGroup.children.length === 1)) {
            this.averageBarVector.multiplyScalar(1 / this.barsGroup.children.length);
            if (this.locationsLoaded === this.locationsToLoad) {
                this.initialLocationsLength = this.barsGroup.children.length;

                const maxDistance: number = this.GlobeSettings.cameraRadius - this.GlobeSettings.earthRadius;
                const distance: number = (this.camera.position.length() - this.GlobeSettings.earthRadius) / maxDistance;

                let angleRate: number = 12;

                if (distance < 0.5) {
                    angleRate = 36;
                } else if (distance < 0.25) {
                    angleRate = 60;
                } else if (distance < 0.15) {
                    angleRate = 0;
                }

                if (angleRate > 0) {
                    const axisY = new THREE.Vector3(0, 1, 0);
                    const axisZ = new THREE.Vector3(0, 0, 1);
                    const angle = Math.PI / angleRate;
                    this.averageBarVector.applyAxisAngle(axisY, angle);
                    this.averageBarVector.applyAxisAngle(axisZ, angle);
                }

                this.isFirstLoad ? this.setCameraPosition(this.averageBarVector) : this.animateCamera(this.averageBarVector);
            }
        }

        this.heatmap.blur();
        this.heatTexture.needsUpdate = true;
        this.needsRender = true;

        if (this.isFirstLoad === true) {
            this.isFirstLoad = false;
        }
    }

    private getBarMaterialByIndex(index: number): THREE.MeshPhongMaterial {
        return new THREE.MeshPhongMaterial({ color: this.data.seriesDataPoints[index] ? this.data.seriesDataPoints[index].color : this.data.seriesDataPoints[0].color });
    }

    private getToolTipDataForSeries(toolTipData, dataPointToolTip): { height } {
        const result: { height } = Object.assign({}, {
            series: { displayName: dataPointToolTip.displayName, value: dataPointToolTip.value }
        }, toolTipData);
        result.height.value = dataPointToolTip.dataPointValue;
        return result;
    }

    private defferedRender() {
        if (!this.deferredRenderTimerId) {
            // tslint:disable-next-line
            this.deferredRenderTimerId = <any>setTimeout(() => {
                this.deferredRenderTimerId = null;
                this.render();
            }, 500);
        }
    }

    private handleContextMenu = () => {
        this.rootSelection.on('contextmenu', (event) => {
            const datapoint = d3Select(event.target).datum() as { identity: ISelectionId };
            this.selectionManager.showContextMenu(datapoint ? datapoint.identity : {}, {
                x: event.clientX,
                y: event.clientY
            });
            event.preventDefault();
        });
    }

    private handleMouseMove = (event: MouseEvent) => {
        const element = this.root;
        const elementStyle: CSSStyleDeclaration = window.getComputedStyle(element);

        const elementViewHeight: number = element.offsetHeight - element.offsetTop
            - parseFloat(elementStyle.paddingTop)
            - parseFloat(elementStyle.paddingBottom);
    
        const elementViewWidth: number = element.offsetWidth - element.offsetLeft
            - parseFloat(elementStyle.paddingLeft)
            - parseFloat(elementStyle.paddingRight);
    
        const fractionalPositionX: number = event.offsetX / elementViewWidth;
        const fractionalPositionY: number = event.offsetY / elementViewHeight;
    
        this.mousePos = new THREE.Vector2(event.clientX, event.clientY);
    
        // get coordinates in -1 to +1 space
        this.mousePosNormalized = new THREE.Vector2(fractionalPositionX * 2 - 1, -fractionalPositionY * 2 + 1);
    
        this.needsRender = true;

        if (this.formatMode && !this.pressKey){
            this.handleFormatModeHoverBar();
        }
    }

    private handleFormatModeHoverBar(): void { 
        this.subSelectionRegionOutlines.delete(SubSelectionOutlineVisibility.Hover);

        const hoveredBar = this.hoveredBar as IGlobeMapObject3DWithToolTipData;

        if (hoveredBar) {
            const newHoverOutline: SubSelectionRegionOutline = this.formatModeCreateOutline(hoveredBar, SubSelectionOutlineVisibility.Hover);
            const activeOutline = this.subSelectionRegionOutlines.get(SubSelectionOutlineVisibility.Active);
            if (newHoverOutline.id !== activeOutline?.id){
                this.subSelectionRegionOutlines.set(SubSelectionOutlineVisibility.Hover, newHoverOutline);
            }
        }
    } 

    private handleMouseDown = () => {
        cancelAnimationFrame(this.cameraAnimationFrameId);
        this.mouseDownTime = Date.now();
        if (this.formatMode) {
            this.handleFormatModeMouseDown();
        }
    };

    private handleFormatModeMouseDown(): void{
        this.pressKey = true;
        this.subSelectionRegionOutlines.delete(SubSelectionOutlineVisibility.Active);
        this.subSelectionRegionOutlines.delete(SubSelectionOutlineVisibility.Hover);
        this.barFromMouseDown = this.hoveredBar as IGlobeMapObject3DWithToolTipData ?? null;
        this.needsRender = true;
    }

    private handleMouseUp = (event: MouseEvent) => {
        const isSlowClick: boolean = (Date.now() - this.mouseDownTime) > this.GlobeSettings.clickInterval;

        if (this.formatMode){
           this.handleFormatModeMouseUp(isSlowClick, event);
        }

        // Debounce slow clicks
        if (isSlowClick){
            return;
        }
        if (this.hoveredBar && event.shiftKey && !this.formatMode) {
            this.selectedBar = this.hoveredBar;
            this.animateCamera(this.selectedBar.position, () => {
                if (!this.selectedBar) return;
                this.orbitControls.target.copy(this.selectedBar.position.clone().normalize().multiplyScalar(this.GlobeSettings.earthRadius));
                this.orbitControls.minDistance = 1;
            });
        } else {
            if (this.selectedBar && !this.formatMode) {
                this.animateCamera(this.selectedBar.position, () => {
                    this.orbitControls.target.set(0, 0, 0);
                    this.orbitControls.minDistance = this.GlobeSettings.earthRadius + 1;
                });
                this.selectedBar = null;
            }
        }
    }

    private handleFormatModeMouseUp(isSlowClick: boolean, event: MouseEvent): void { 
        this.pressKey = false;
        this.subSelectedBar = this.barFromMouseDown as IGlobeMapObject3DWithToolTipData ?? this.subSelectedBar;
        if (!isSlowClick && !this.barFromMouseDown){
            this.subSelectedBar = null;
        }
        this.subSelectFromEvent(event, event.button === 2);
        this.needsRender = true;
    } 

    private subSelectFromEvent(event: MouseEvent, showUI: boolean): void { 
        const newSubSelection = this.createSubSelectionForDataPoint(this.subSelectedBar, showUI, event);
        this.subSelectionService.subSelect(newSubSelection); 
    } 

    private handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        this.needsRender = true;
        if (this.orbitControls.enabled && this.orbitControls.enableZoom) {
            cancelAnimationFrame(this.cameraAnimationFrameId);
            this.heatTexture.needsUpdate = true;
            const event: { deltaY, detail } = e;
            const delta: number = event.deltaY < 0 || event.detail < 0 ? 1 : -1;
            this.updateBarsAndHeatMapByZoom(delta);
            if (this.formatMode) {
                this.subSelectionRegionOutlines.delete(SubSelectionOutlineVisibility.Hover);
                this.needsRender = true;
            }
        }
    }

    private initRayCaster() {
        this.rayCaster = new THREE.Raycaster();

        this.rendererCanvas.addEventListener("pointermove", this.handleMouseMove);
        
        this.rendererCanvas.addEventListener("pointerdown", this.handleMouseDown);
        
        this.rendererCanvas.addEventListener("pointerup", this.handleMouseUp);
        
        this.rendererCanvas.addEventListener("wheel", this.handleWheel, { passive: false });
    }

    private intersectBars() {
        if (!this.rayCaster
            || !this.barsGroup
            || !this.mousePosNormalized
            || !this.mousePos) {

            return;
        }

        const rayCaster: THREE.Raycaster = this.rayCaster;

        rayCaster.setFromCamera(this.mousePosNormalized, this.camera);
        const intersects: THREE.Intersection[] = rayCaster.intersectObjects(this.barsGroup.children);

        if (intersects && intersects.length > 0) {
            const object: IGlobeMapObject3DWithToolTipData = <IGlobeMapObject3DWithToolTipData>intersects[0].object;

            if (!object || !(object).toolTipData) {
                return;
            }

            const toolTipData: { location, longitude, latitude, series, height, heat } = (object).toolTipData;
            const toolTipItems: VisualTooltipDataItem[] = [];

            if (toolTipData.location.displayName) {
                toolTipItems.push(toolTipData.location);
            }

            if (toolTipData.longitude.displayName) {
                toolTipItems.push(toolTipData.longitude);
            }

            if (toolTipData.latitude.displayName) {
                toolTipItems.push(toolTipData.latitude);
            }

            if (toolTipData.series) {
                toolTipItems.push(toolTipData.series);
            }

            if (toolTipData.height.displayName) {
                toolTipItems.push(toolTipData.height);
            }

            if (toolTipData.heat.displayName) {
                toolTipItems.push(toolTipData.heat);
            }

            this.hoveredBar = object;

            const tooltipShowOptions: TooltipShowOptions = {
                coordinates: [
                    this.mousePos.x,
                    this.mousePos.y
                ],
                isTouchEvent: false,
                dataItems: toolTipItems,
                identities: []
            };

            this.visualHost.tooltipService.show(tooltipShowOptions);
        } else {
            this.hoveredBar = null;
            this.hideTooltip();
        }
    }

    private hideTooltip(): void {
        const tooltipHideOptions: TooltipHideOptions = {
            immediately: true,
            isTouchEvent: false
        };

        this.tooltipService.hide(tooltipHideOptions);
    }

    private setCameraPosition(to: THREE.Vector3) {
        this.hideTooltip();

        if (!this.camera) {
            return;
        }

        const endPos: THREE.Vector3 = to.clone().normalize();
        const length: number = this.camera.position.length();
        const pos: THREE.Vector3 = new THREE.Vector3()
            .add(endPos.clone().multiplyScalar(2))
            .normalize()
            .multiplyScalar(length);

        this.camera.position.set(pos.x, pos.y, pos.z);
    }

    private animateCamera(to: THREE.Vector3, done?: () => void) {
        this.hideTooltip();

        if (!this.camera) {
            return;
        }

        cancelAnimationFrame(this.cameraAnimationFrameId);
        const startTime: number = Date.now();
        const duration: number = this.GlobeSettings.cameraAnimDuration;
        const endTime: number = startTime + duration;
        const startPos: THREE.Vector3 = this.camera.position.clone().normalize();
        const endPos: THREE.Vector3 = to.clone().normalize();
        const length: number = this.camera.position.length();
        const alpha: number = 2;
        const beta: number = 1.9;
        const easeInOutQuint = (t) => {
            if (t < alpha) {
                return beta * t * t * t * t * t;
            }
            return 1 + beta * (--t) * t * t * t * t;
        };

        const onUpdate: FrameRequestCallback = () => {
            const now: number = Date.now();
            let t: number = (now - startTime) / duration;
            if (t > alpha) {
                t = alpha;
            }
            t = easeInOutQuint(t);

            const pos: THREE.Vector3 = new THREE.Vector3()
                .add(startPos.clone().multiplyScalar(alpha - t))
                .add(endPos.clone().multiplyScalar(t))
                .normalize()
                .multiplyScalar(length);

            this.camera.position.set(pos.x, pos.y, pos.z);

            if (now < endTime) {
                this.cameraAnimationFrameId = requestAnimationFrame(onUpdate);
            } else if (done) {
                done();
            }

            this.needsRender = true;
        };

        this.cameraAnimationFrameId = requestAnimationFrame(onUpdate);
    }

    public destroy() {
        cancelAnimationFrame(this.animationFrameId);
        cancelAnimationFrame(this.cameraAnimationFrameId);
        clearTimeout(this.deferredRenderTimerId);
        this.renderLoopEnabled = false;
        this.scene = null;
        this.heatmap = null;
        this.heatTexture = null;
        this.camera = null;
        if (this.renderer) {
            const context = this.renderer.getContext();
            if (context) {
                const extension: { loseContext } = context.getExtension("WEBGL_lose_context");
                if (extension) {
                    extension.loseContext();
                }
                this.renderer.dispose();
                this.renderer.forceContextLoss();
            }
            this.renderer.domElement = null;
        }
        this.renderer = null;
        this.data = null;
        this.barsGroup = null;
        if (this.orbitControls) {
            this.orbitControls.dispose();
        }

        this.orbitControls = null;

        if (this.rendererCanvas) {

            this.rendererCanvas.removeEventListener("pointermove", this.handleMouseMove); 

            this.rendererCanvas.removeEventListener("pointerdown", this.handleMouseDown); 

            this.rendererCanvas.removeEventListener("pointerup", this.handleMouseUp); 

            this.rendererCanvas.removeEventListener("wheel", this.handleWheel);  
        }

        this.rendererCanvas = null;

        if (this.root) {
            this.root.replaceChildren();
        }

        this.hideTooltip();
    }
    private static ZoomControlSettings = {
        height: 145,
        width: 145,
        markup: `
            <svg width="145" height="145" class="controls">
                <g class="control js-control--move-up">
                    <circle cx="85" cy="20" r="17" />
                    <path d="M85 8 l12 20 a40,70 0 0,0 -24,0z" />
                </g>
                <g class="control js-control--move-right">
                    <circle cx="119" cy="54" r="17" class="zoomControlCircle" />
                    <path d="M130.9 54 l-20 -12 a70,40 0 0,1 0,24z" class="zoomControlPath" />
                </g>
                <g class="control js-control--move-down">
                    <circle cx="85" cy="88" r="17" />
                    <path d="M 85 100 l12 -20 a40,70 0 0,1 -24,0z" />
                </g>
                <g class="control js-control--move-left">
                    <circle cx="51" cy="54" r="17" />
                    <path d="M39 54 l20 -12 a70,40 0 0,0 0,24z" />
                </g>
                <g class="control js-control--zoom-down">
                    <circle cx="51" cy="122" r="17" />
                    <rect x="42" y="120" width="17" height="6" class="zoomControlPath" />
                </g>
                <g class="control js-control--zoom-up">
                    <circle cx="119" cy="122" r="17" />
                    <rect x="110.5" y="120" width="17" height="6" />
                    <rect x="116" y="114" width="6" height="17" />
                </g>
            </svg>
            `,
        zoomStep: 1,
        angleOfRotation: 5
    };
    private initZoomControl() {
        this.controlContainer = document.createElement("div");
        this.controlContainer.className = "controls-container";
        this.controlContainer.appendChild(this.createControlElements());
        this.root.append(this.controlContainer);
        const allG = this.controlContainer.querySelectorAll("g");

        for (let i = 0; i < allG.length; ++i) {
            allG[i].onmousedown = (event) => {
                event.stopPropagation();
                if (event.button === 0) {
                    const controlType = (<{ className }>(event.currentTarget as HTMLHtmlElement)).className.baseVal.toString().split(" ").filter(className => className.search("js-") !== -1)[0];
                    switch (controlType) {
                        case "js-control--move-up": this.rotateCam(0, GlobeMap.ZoomControlSettings.angleOfRotation); break;
                        case "js-control--move-down": this.rotateCam(0, -GlobeMap.ZoomControlSettings.angleOfRotation); break;
                        case "js-control--move-left": this.rotateCam(GlobeMap.ZoomControlSettings.angleOfRotation, 0); break;
                        case "js-control--move-right": this.rotateCam(-GlobeMap.ZoomControlSettings.angleOfRotation, 0); break;
                        case "js-control--zoom-up": this.zoomClicked(-GlobeMap.ZoomControlSettings.zoomStep); break;
                        case "js-control--zoom-down": this.zoomClicked(GlobeMap.ZoomControlSettings.zoomStep); break;
                    }
                }
            };
        }
    }
    private initMercartorSphere() {
        if (GlobeMap.MercatorSphere) return;

        const ms = new Geometry(
            this.GlobeSettings.earthRadius,
            this.GlobeSettings.earthSegments,
            this.GlobeSettings.earthSegments);
        ms.prototype = Object.create(Geometry.prototype);

        GlobeMap.MercatorSphere = ms;
    }

    private updateBarsAndHeatMapByZoom(delta: number = 0): void {
        if (!this.data) {
            return;
        }
        // delta > 0 ? Zoom increased
        // delta < 0 ? Zoom decreased
        let heatSizeScale: number = delta > 0 ? this.GlobeSettings.heatmapScaleOnZoom : (1 / this.GlobeSettings.heatmapScaleOnZoom);
        let barHeightScale: number = delta > 0 ? this.GlobeSettings.barHeightScaleOnZoom : (1 / this.GlobeSettings.barHeightScaleOnZoom);
        let barWidthtScale: number = delta > 0 ? this.GlobeSettings.barWidthScaleOnZoom : (1 / this.GlobeSettings.barWidthScaleOnZoom);

        if (delta === 0) {
            heatSizeScale = 1;
            barHeightScale = 1;
            barWidthtScale = 1;
        }

        // Calculate new bar and heat sizes by zool level
        this.GlobeSettings.heatPointSize = this.calculateNewSizeOfShape(this.GlobeSettings.heatPointSize, heatSizeScale, this.GlobeSettings.minHeatPointSize, this.GlobeSettings.maxHeatPointSize);
        this.GlobeSettings.heatIntensity = this.calculateNewSizeOfShape(this.GlobeSettings.heatIntensity, heatSizeScale, this.GlobeSettings.minHeatIntensity, this.GlobeSettings.maxHeatIntensity);
        this.GlobeSettings.barHeight = this.calculateNewSizeOfShape(this.GlobeSettings.barHeight, barHeightScale, this.GlobeSettings.minBarHeight, this.GlobeSettings.maxBarHeight);
        this.GlobeSettings.barWidth = this.calculateNewSizeOfShape(this.GlobeSettings.barWidth, barWidthtScale, this.GlobeSettings.minBarWidth, this.GlobeSettings.maxBarWidth);

        this.cleanHeatAndBar();
        this.barsGroup = new THREE.Object3D();
        this.scene.add(this.barsGroup);
        this.averageBarVector = new THREE.Vector3();
        const len: number = this.data.dataPoints.length;
        for (let i: number = 0; i < len; ++i) {
            const renderDatum: GlobeMapDataPoint = this.data.dataPoints[i];
            const seriesDatum: GlobeMapSeriesDataPoint = this.data.seriesDataPoints[i];

            if (!renderDatum.location || renderDatum.location.longitude === undefined || renderDatum.location.latitude === undefined
                || (renderDatum.location.longitude === 0 && renderDatum.location.latitude === 0)
            ) {
                continue;
            }

            if (renderDatum.heat > 0.001) {
                if (renderDatum.heat < 0.1) renderDatum.heat = 0.1;
                const x: number = (180 + renderDatum.location.longitude) / 360 * this.GlobeSettings.heatmapSize;
                const y: number = (1 - ((90 + renderDatum.location.latitude) / 180)) * this.GlobeSettings.heatmapSize;

                this.heatmap.addPoint(x, y, this.GlobeSettings.heatPointSize, renderDatum.heat * this.GlobeSettings.heatIntensity);
            }

            if (renderDatum.height >= 0) {
                if (renderDatum.height < 0.01) renderDatum.height = 0.01;
                const latRadians: number = renderDatum.location.latitude / 180 * Math.PI; // radians
                const lngRadians: number = renderDatum.location.longitude / 180 * Math.PI;

                const x: number = Math.cos(lngRadians) * Math.cos(latRadians);
                const z: number = -Math.sin(lngRadians) * Math.cos(latRadians);
                const y: number = Math.sin(latRadians);
                const vector: THREE.Vector3 = new THREE.Vector3(x, y, z);

                this.averageBarVector.add(vector);

                const barHeight: number = this.GlobeSettings.barHeight * renderDatum.height;
                // this array holds the relative series values to the actual measure for example [0.2,0.3,0.5]
                // this is how we draw the vectors relativly to the complete value one on top of another.
                const measuresBySeries: number[] = [];
                // this array holds the original values of the series for the tool tips
                const dataPointToolTip: string[] = [];
                if (renderDatum.heightBySeries) {
                    for (let c: number = 0; c < renderDatum.heightBySeries.length; c++) {

                        if (renderDatum.heightBySeries[c] || renderDatum.heightBySeries[c] === 0) {
                            measuresBySeries.push(renderDatum.heightBySeries[c]);
                        }

                        let seriesToolTipData = "";

                        if (renderDatum.seriesToolTipData
                            && renderDatum.seriesToolTipData[c] 
                            && typeof renderDatum.seriesToolTipData[c] === "string") {
                                seriesToolTipData = renderDatum.seriesToolTipData[c] as string;
                            }

                        dataPointToolTip.push(seriesToolTipData);
                    }
                } else {
                    // no category series so we'll just draw one value
                    measuresBySeries.push(1);
                }

                let previousMeasureValue = 0;
                for (let j: number = 0; j < measuresBySeries.length; j++) {
                    previousMeasureValue += measuresBySeries[j];
                    const geometry: THREE.BoxGeometry = new THREE.BoxGeometry(this.GlobeSettings.barWidth, this.GlobeSettings.barWidth, barHeight * measuresBySeries[j]);
                    const bar: THREE.Mesh & {toolTipData?, identity?, label?} = new THREE.Mesh(geometry, this.getBarMaterialByIndex(i));
                    const position: THREE.Vector3 = vector.clone().multiplyScalar(this.GlobeSettings.earthRadius + ((barHeight / 2) * previousMeasureValue));
                    bar.position.set(position.x, position.y, position.z);
                    bar.lookAt(vector);
                    bar.toolTipData = dataPointToolTip.length === 0
                        ? renderDatum.toolTipData
                        : this.getToolTipDataForSeries(renderDatum.toolTipData, dataPointToolTip[j]);

                    bar.identity = seriesDatum.identity;
                    bar.label = seriesDatum.label;
                    this.barsGroup.add(bar);

                    previousMeasureValue += measuresBySeries[j];
                    if (this.subSelectedBar?.identity.equals(bar.identity)){
                        this.subSelectedBar = bar as IGlobeMapObject3DWithToolTipData;
                    }
                }
            }
        }

        this.heatmap.update();
    }

    private calculateNewSizeOfShape(size: number, scale: number, minSize: number, maxSize: number): number {
        size *= scale;
        if (size > maxSize) {
            size = maxSize;
        } else if (size < minSize) {
            size = minSize;
        }

        return size;
    }

    private createControlElements(): Element {
        const protocol: string = "http";
        const svgNS: string = `${protocol}://www.w3.org/2000/svg`;

        const circle = (cx: number, cy: number, r: number, classNames?: string) => {
            const c = document.createElementNS(svgNS, "circle");
            c.setAttribute("cx", cx.toString());
            c.setAttribute("cy", cy.toString());
            c.setAttribute("r", r.toString());
            if (classNames) {
                (<{ className }>c).className.baseVal = classNames;
            }
            return c;
        };

        const path = (d: string, classNames?: string) => {
            const p = document.createElementNS(svgNS, "path");
            p.setAttribute("d", d);
            if (classNames) {
                (<{ className }>p).className.baseVal = classNames;
            }
            return p;
        };

        const rect = (x: number, y: number, width: number, height: number, classNames?: string) => {
            const r = document.createElementNS(svgNS, "rect");
            r.setAttribute("x", x.toString());
            r.setAttribute("y", y.toString());
            r.setAttribute("width", width.toString());
            r.setAttribute("height", height.toString());
            if (classNames) {
                (<{ className }>r).className.baseVal = classNames;
            }
            return r;
        };

        const g = (classNames: string) => {
            const g = document.createElementNS(svgNS, "g");
            if (classNames) {
                (<{ className }>g).className.baseVal = classNames;
            }
            return g;
        };

        const moveUpButton = g("control js-control--move-up");
        moveUpButton.appendChild(circle(85, 20, 17));
        moveUpButton.appendChild(path("M85 8 l12 20 a40,70 0 0,0 -24,0z"));

        const moveRightButton = g("control js-control--move-right");
        moveRightButton.appendChild(circle(119, 54, 17, "zoomControlCircle"));
        moveRightButton.appendChild(path("M130.9 54 l-20 -12 a70,40 0 0,1 0,24z", "zoomControlPath"));

        const moveDownButton = g("control js-control--move-down");
        moveDownButton.appendChild(circle(85, 88, 17));
        moveDownButton.appendChild(path("M 85 100 l12 -20 a40,70 0 0,1 -24,0z"));

        const moveLeftButton = g("control js-control--move-left");
        moveLeftButton.appendChild(circle(51, 54, 17));
        moveLeftButton.appendChild(path("M39 54 l20 -12 a70,40 0 0,0 0,24z"));

        const zoomDownButton = g("control js-control--zoom-down");
        zoomDownButton.appendChild(circle(51, 122, 17));
        zoomDownButton.appendChild(rect(42, 120, 17, 6, "zoomControlPath"));

        const zoomUpButton = g("control js-control--zoom-up");
        zoomUpButton.appendChild(circle(119, 122, 17));
        zoomUpButton.appendChild(rect(110.5, 120, 17, 6));
        zoomUpButton.appendChild(rect(116, 114, 6, 17));

        const controlsContainerSVG = document.createElementNS(svgNS, "svg");
        (<{ className }>controlsContainerSVG).className.baseVal = "controls";
        controlsContainerSVG.setAttribute("width", "145");
        controlsContainerSVG.setAttribute("height", "145");

        controlsContainerSVG.appendChild(moveUpButton);
        controlsContainerSVG.appendChild(moveRightButton);
        controlsContainerSVG.appendChild(moveDownButton);
        controlsContainerSVG.appendChild(moveLeftButton);
        controlsContainerSVG.appendChild(zoomDownButton);
        controlsContainerSVG.appendChild(zoomUpButton);

        return controlsContainerSVG;
    }

    public static getCategoricalValueByIndex(category: DataViewCategoryColumn | DataViewValueColumn, index: number): string {
        if (!category ||
            !Array.isArray(category.values) ||
            category.values.length <= index) {
            return "";
        }
        return `${category.values[index]}`;
    }
}
